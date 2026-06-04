import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// ============================================================
// MARKET PERFORMANCE API
// GET /api/market-performance
// Confirmed tables: Latest_Prices_Summary, Daily_Prices,
//   Markets, Submissions, Traders_register
// ============================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days   = Math.min(30, parseInt(searchParams.get('days') || '7'));
  const state  = searchParams.get('state') || '';
  const market = searchParams.get('market_id') || '';

  const stateFilter  = state  ? `AND state = '${state.replace(/'/g, "''")}'` : '';
  const marketFilter = market ? `AND market_id = '${market.replace(/'/g, "''")}'` : '';

  try {
    if (market) {
      // Single market deep-dive
      const marketInfo = await query<any>(`
        SELECT
          m.market_id, m.market_name, m.state,
          m.latitude, m.longitude
        FROM dbo.Markets m
        WHERE m.market_id = '${market.replace(/'/g, "''")}'
      `);

      const priceProfile = await query<any>(`
        SELECT
          lps.category_name,
          COUNT(DISTINCT lps.item_id)        AS items_tracked,
          AVG(lps.price_naira)               AS avg_price,
          AVG(lps.month_change_pct)          AS avg_month_change,
          AVG(CAST(lps.confidence_score AS FLOAT)) AS avg_confidence,
          SUM(CASE WHEN lps.trend = 'UP' THEN 1 ELSE 0 END) AS rising,
          SUM(CASE WHEN lps.trend = 'DOWN' THEN 1 ELSE 0 END) AS falling
        FROM dbo.Latest_Prices_Summary lps
        WHERE lps.market_id = '${market.replace(/'/g, "''")}'
          AND lps.is_nbs_ref = 0 AND lps.is_food = 1
        GROUP BY lps.category_name
        ORDER BY items_tracked DESC
      `);

      const dailyActivity = await query<any>(`
        SELECT
          dp.price_date,
          COUNT(DISTINCT dp.item_id)     AS items_priced,
          COUNT(DISTINCT dp.time_slot)   AS slots,
          AVG(dp.price_naira)            AS avg_price,
          AVG(CAST(dp.confidence_score AS FLOAT)) AS avg_confidence,
          SUM(CASE WHEN dp.data_source = 'REAL_ANCHORED' THEN 1 ELSE 0 END) AS real_rows
        FROM dbo.Daily_Prices dp
        WHERE dp.market_id = '${market.replace(/'/g, "''")}'
          AND dp.nbs_adjusted = 0
          AND dp.price_date >= DATEADD(day, -${days}, CAST(GETUTCDATE() AS DATE))
        GROUP BY dp.price_date
        ORDER BY dp.price_date DESC
      `);

      const submissions = await query<any>(`
        SELECT
          COUNT(*)                       AS total_submissions,
          SUM(CASE WHEN validation_status = 'APPROVED' THEN 1 ELSE 0 END) AS approved,
          SUM(CASE WHEN validation_status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected,
          SUM(CASE WHEN validation_status = 'PENDING'  THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN fraud_flag = 1   THEN 1 ELSE 0 END) AS fraud_flagged,
          COUNT(DISTINCT trader_id)      AS active_traders,
          AVG(CAST(price AS FLOAT))      AS avg_submitted_price
        FROM dbo.Submissions
        WHERE market_id = '${market.replace(/'/g, "''")}'
          AND submitted_at >= DATEADD(day, -${days}, GETUTCDATE())
      `);

      return NextResponse.json({
        success: true,
        data: {
          market_info: marketInfo[0] || {},
          price_profile: priceProfile,
          daily_activity: dailyActivity,
          submissions: submissions[0] || {},
        },
        timestamp: new Date().toISOString(),
      });
    }

    // All markets summary
    const marketSummary = await query<any>(`
      SELECT
        lps.market_id,
        lps.market_name,
        lps.state,
        COUNT(DISTINCT lps.item_id)          AS items_tracked,
        COUNT(*)                             AS price_points,
        AVG(lps.price_naira)                 AS avg_price,
        AVG(lps.month_change_pct)            AS avg_monthly_change,
        AVG(CAST(lps.confidence_score AS FLOAT)) AS avg_confidence,
        SUM(CASE WHEN lps.trend = 'UP'   THEN 1 ELSE 0 END) AS rising_items,
        SUM(CASE WHEN lps.trend = 'DOWN' THEN 1 ELSE 0 END) AS falling_items,
        MAX(lps.price_date)                  AS latest_price_date,
        MAX(lps.last_updated)                AS last_updated
      FROM dbo.Latest_Prices_Summary lps
      WHERE lps.is_nbs_ref = 0 AND lps.is_food = 1 ${stateFilter}
      GROUP BY lps.market_id, lps.market_name, lps.state
      ORDER BY items_tracked DESC, avg_confidence DESC
    `);

    // Daily generation coverage per market (last N days)
    const coverageGaps = await query<any>(`
      SELECT TOP 20
        market_id,
        market_name,
        state,
        COUNT(DISTINCT price_date)           AS days_with_data,
        ${days} - COUNT(DISTINCT price_date) AS days_missing,
        AVG(CAST(confidence_score AS FLOAT)) AS avg_confidence,
        SUM(CASE WHEN data_source = 'REAL_ANCHORED' THEN 1 ELSE 0 END) * 100.0
          / NULLIF(COUNT(*), 0)              AS real_anchor_pct
      FROM dbo.Daily_Prices
      WHERE price_date >= DATEADD(day, -${days}, CAST(GETUTCDATE() AS DATE))
        AND nbs_adjusted = 0
      GROUP BY market_id, market_name, state
      HAVING ${days} - COUNT(DISTINCT price_date) > 0
      ORDER BY days_missing DESC
    `);

    // Submission volume by market (last N days)
    const submissionVolume = await query<any>(`
      SELECT TOP 20
        market_id,
        market           AS market_name,
        state,
        COUNT(*)         AS total_submissions,
        COUNT(DISTINCT trader_id) AS unique_traders,
        SUM(CASE WHEN validation_status = 'APPROVED' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN fraud_flag = 1 THEN 1 ELSE 0 END) AS fraud_flags,
        SUM(CASE WHEN validation_status = 'APPROVED' THEN 1 ELSE 0 END) * 100.0
          / NULLIF(COUNT(*), 0) AS approval_rate
      FROM dbo.Submissions
      WHERE submitted_at >= DATEADD(day, -${days}, GETUTCDATE())
      GROUP BY market_id, market, state
      ORDER BY total_submissions DESC
    `);

    // State-level rollup
    const stateRollup = await query<any>(`
      SELECT
        state,
        COUNT(DISTINCT market_id)            AS markets,
        COUNT(DISTINCT item_id)              AS items,
        AVG(price_naira)                     AS avg_price,
        AVG(month_change_pct)                AS avg_monthly_change,
        AVG(CAST(confidence_score AS FLOAT)) AS avg_confidence
      FROM dbo.Latest_Prices_Summary
      WHERE is_nbs_ref = 0 AND is_food = 1
      GROUP BY state
      ORDER BY markets DESC
    `);

    // KPIs
    const kpis = await query<any>(`
      SELECT
        COUNT(DISTINCT market_id) AS total_markets,
        COUNT(DISTINCT state)     AS states_covered,
        AVG(CAST(confidence_score AS FLOAT)) AS platform_confidence,
        (SELECT COUNT(*) FROM dbo.Submissions
         WHERE submitted_at >= DATEADD(day, -1, GETUTCDATE())) AS submissions_24h,
        (SELECT COUNT(DISTINCT market_id) FROM dbo.Daily_Prices
         WHERE price_date = CAST(GETUTCDATE() AS DATE) AND nbs_adjusted = 0) AS markets_with_data_today
      FROM dbo.Latest_Prices_Summary
      WHERE is_nbs_ref = 0 AND is_food = 1
    `);

    return NextResponse.json({
      success: true,
      data: {
        kpis: kpis[0] || {},
        markets: marketSummary,
        coverage_gaps: coverageGaps,
        submission_volume: submissionVolume,
        state_rollup: stateRollup,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[MarketPerformance API]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
