import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// ============================================================
// DATA PIPELINE MONITOR API
// GET /api/pipeline
// Covers: generation, scraping, archival, freshness
// Confirmed tables: Daily_Prices, Latest_Prices_Summary,
//   Verified_External_Prices, Fuel_Prices, NFPI_Monthly,
//   Submissions, Validator_Votes, Validator_Notification_Queue
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const now = new Date().toISOString();

    // 1. Price generation health (last 7 days)
    const generationHealth = await query<any>(`
      SELECT
        price_date,
        COUNT(DISTINCT time_slot)  AS slots_generated,
        COUNT(*)                   AS rows,
        MIN(generated_at)          AS first_generated,
        MAX(generated_at)          AS last_generated,
        AVG(CAST(confidence_score AS FLOAT)) AS avg_confidence,
        SUM(CASE WHEN data_source='REAL_ANCHORED' THEN 1 ELSE 0 END) AS real_rows,
        SUM(CASE WHEN data_source='SIM_TRACKED'   THEN 1 ELSE 0 END) AS sim_rows
      FROM dbo.Daily_Prices
      WHERE price_date >= DATEADD(day, -7, CAST(GETUTCDATE() AS DATE))
        AND nbs_adjusted = 0
      GROUP BY price_date
      ORDER BY price_date DESC
    `);

    // 2. Latest_Prices_Summary freshness
    const summaryFreshness = await query<any>(`
      SELECT
        MAX(last_updated)  AS last_refreshed,
        MAX(price_date)    AS latest_price_date,
        COUNT(*)           AS row_count,
        DATEDIFF(MINUTE, MAX(last_updated), GETUTCDATE()) AS minutes_stale
      FROM dbo.Latest_Prices_Summary
      WHERE is_nbs_ref = 0 AND is_food = 1
    `);

    // 3. Verified_External_Prices (scraper output)
    let scraperStatus: any = { status: 'unknown', message: 'Table not accessible' };
    try {
      const scraperData = await query<any>(`
        SELECT
          MAX(created_at)  AS last_scrape,
          COUNT(*)         AS total_verified,
          DATEDIFF(HOUR, MAX(created_at), GETUTCDATE()) AS hours_stale,
          COUNT(DISTINCT source) AS sources
        FROM dbo.Verified_External_Prices
      `);
      scraperStatus = scraperData[0] || {};
    } catch { /* table may not exist */ }

    // 4. Fuel prices freshness
    let fuelStatus: any = {};
    try {
      const fuelData = await query<any>(`
        SELECT
          MAX(updated_at)  AS last_updated,
          COUNT(*)         AS row_count,
          DATEDIFF(HOUR, MAX(updated_at), GETUTCDATE()) AS hours_stale
        FROM dbo.Fuel_Prices
      `);
      fuelStatus = fuelData[0] || {};
    } catch { /* ignore */ }

    // 5. NFPI compute freshness
    const nfpiStatus = await query<any>(`
      SELECT
        MAX(computed_at)   AS last_computed,
        MAX(period_label)  AS latest_period,
        COUNT(*)           AS periods_computed,
        DATEDIFF(DAY, MAX(computed_at), GETUTCDATE()) AS days_stale
      FROM dbo.NFPI_Monthly
    `);

    // 6. Synthetic pipeline status
    const syntheticStatus = await query<any>(`
      SELECT
        (SELECT COUNT(*) FROM dbo.Submissions
         WHERE trader_id LIKE 'SYN-TR-%'
           AND submitted_at >= DATEADD(day, -1, GETUTCDATE())) AS synthetic_submissions_24h,
        (SELECT COUNT(*) FROM dbo.Validator_Votes
         WHERE validator_id LIKE 'SYN-VL-%'
           AND created_at >= DATEADD(day, -1, GETUTCDATE())) AS synthetic_votes_24h,
        (SELECT COUNT(*) FROM dbo.Submissions
         WHERE validation_status = 'PENDING'
           AND submitted_at >= DATEADD(day, -1, GETUTCDATE())) AS pending_validations_24h
    `);

    // 7. Notification queue health
    let notifQueue: any = {};
    try {
      const queueData = await query<any>(`
        SELECT
          COUNT(*)  AS total_queued,
          SUM(CASE WHEN status = 'PENDING_WHATSAPP' THEN 1 ELSE 0 END) AS pending_wa,
          SUM(CASE WHEN status = 'SENT'             THEN 1 ELSE 0 END) AS sent,
          SUM(CASE WHEN status = 'FAILED'           THEN 1 ELSE 0 END) AS failed
        FROM dbo.Validator_Notification_Queue
      `);
      notifQueue = queueData[0] || {};
    } catch { /* ignore */ }

    // 8. DB size stats
    const dbSize = await query<any>(`
      SELECT
        SUM(st.row_count) AS total_rows,
        COUNT(DISTINCT t.object_id) AS table_count
      FROM sys.dm_db_partition_stats st
      JOIN sys.tables t ON t.object_id = st.object_id
      WHERE st.index_id IN (0, 1)
    `).catch(() => [{ total_rows: 0, table_count: 0 }]);

    // Build pipeline components with health status
    const today = new Date().toISOString().slice(0, 10);
    const todayGen = generationHealth.find((g: any) =>
      new Date(g.price_date).toISOString().slice(0, 10) === today
    );

    const components = [
      {
        name: 'Price Generation',
        description: '3× daily via timer functions (07:30/10:30/13:30 UTC)',
        status: !todayGen ? 'critical'
          : todayGen.slots_generated < 3 ? 'degraded' : 'healthy',
        detail: todayGen
          ? `${todayGen.slots_generated}/3 slots today · ${todayGen.rows.toLocaleString()} rows`
          : 'No data generated today',
        last_run: todayGen?.last_generated || null,
        expected_rows: 172020,
        actual_rows: todayGen?.rows || 0,
      },
      {
        name: 'Latest Prices Cache',
        description: 'usp_Refresh_LatestPrices — runs after each generation slot',
        status: (summaryFreshness[0]?.minutes_stale || 9999) > 180 ? 'degraded' : 'healthy',
        detail: `${summaryFreshness[0]?.row_count?.toLocaleString() || 0} rows · ${summaryFreshness[0]?.minutes_stale || '?'} min stale`,
        last_run: summaryFreshness[0]?.last_refreshed || null,
        expected_rows: 168970,
        actual_rows: summaryFreshness[0]?.row_count || 0,
      },
      {
        name: 'Price Scraper',
        description: 'External price feeds → Verified_External_Prices (06:00 UTC)',
        status: (scraperStatus?.hours_stale || 999) > 48 ? 'critical'
          : (scraperStatus?.hours_stale || 999) > 25 ? 'degraded' : 'healthy',
        detail: scraperStatus?.total_verified
          ? `${scraperStatus.total_verified.toLocaleString()} verified prices · ${scraperStatus.hours_stale}h stale`
          : 'No scraper data found',
        last_run: scraperStatus?.last_scrape || null,
      },
      {
        name: 'Fuel Prices',
        description: 'fuel_price_scraper — daily at 05:30 UTC',
        status: (fuelStatus?.hours_stale || 999) > 48 ? 'degraded' : 'healthy',
        detail: fuelStatus?.row_count
          ? `${fuelStatus.row_count} records · ${fuelStatus.hours_stale}h stale`
          : 'No data',
        last_run: fuelStatus?.last_updated || null,
      },
      {
        name: 'NFPI Computation',
        description: 'sp_Compute_NFPI — monthly, 5th of each month',
        status: (nfpiStatus[0]?.days_stale || 999) > 45 ? 'degraded' : 'healthy',
        detail: `Period: ${nfpiStatus[0]?.latest_period || '?'} · ${nfpiStatus[0]?.periods_computed || 0} months · ${nfpiStatus[0]?.days_stale || '?'} days stale`,
        last_run: nfpiStatus[0]?.last_computed || null,
      },
      {
        name: 'Synthetic Engine',
        description: 'sp_Generate_Synthetic_Submissions → Validations',
        status: (syntheticStatus[0]?.synthetic_submissions_24h || 0) === 0 ? 'degraded' : 'healthy',
        detail: `${syntheticStatus[0]?.synthetic_submissions_24h || 0} submissions · ${syntheticStatus[0]?.synthetic_votes_24h || 0} votes (24h)`,
        last_run: null,
      },
      {
        name: 'Notification Queue',
        description: 'WhatsApp delivery to validators',
        status: (notifQueue?.failed || 0) > 10 ? 'degraded' : 'healthy',
        detail: notifQueue?.total_queued != null
          ? `${notifQueue.pending_wa || 0} pending · ${notifQueue.sent || 0} sent · ${notifQueue.failed || 0} failed`
          : 'Queue not available',
        last_run: null,
      },
    ];

    const criticalCount = components.filter(c => c.status === 'critical').length;
    const degradedCount = components.filter(c => c.status === 'degraded').length;
    const overallHealth = criticalCount > 0 ? 'critical'
      : degradedCount > 1 ? 'degraded' : degradedCount === 1 ? 'warning' : 'healthy';

    return NextResponse.json({
      success: true,
      data: {
        overall_health: overallHealth,
        components,
        generation_history: generationHealth,
        db_stats: dbSize[0] || {},
        synthetic: syntheticStatus[0] || {},
      },
      timestamp: now,
    });
  } catch (error: any) {
    console.error('[Pipeline API]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
