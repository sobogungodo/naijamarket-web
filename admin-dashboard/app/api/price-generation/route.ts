import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// ============================================================
// PRICE GENERATION MONITOR API
// GET /api/price-generation
// Confirmed tables: Daily_Prices, Latest_Prices_Summary
// Confirmed columns from live schema
// ============================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(30, parseInt(searchParams.get('days') || '7'));

  try {
    // 1. Today's slot status — confirmed columns: price_date, time_slot, time_slot_name, generated_at
    const todaySlots = await query<any>(`
      SELECT
        time_slot,
        time_slot_name,
        COUNT(*)           AS rows_generated,
        MIN(generated_at)  AS started_at,
        MAX(generated_at)  AS completed_at,
        DATEDIFF(SECOND, MIN(generated_at), MAX(generated_at)) AS duration_sec,
        SUM(CASE WHEN data_source = 'REAL_ANCHORED'  THEN 1 ELSE 0 END) AS real_anchored,
        SUM(CASE WHEN data_source = 'SIM_TRACKED'    THEN 1 ELSE 0 END) AS sim_tracked,
        SUM(CASE WHEN data_source = 'SIM_BASELINE'   THEN 1 ELSE 0 END) AS sim_baseline,
        AVG(CAST(confidence_score AS FLOAT))          AS avg_confidence
      FROM dbo.Daily_Prices
      WHERE price_date = (SELECT MAX(price_date) FROM dbo.Daily_Prices WHERE nbs_adjusted = 0)
        AND nbs_adjusted = 0
      GROUP BY time_slot, time_slot_name
      ORDER BY time_slot
    `);

    // 2. Daily generation history — last N days
    const history = await query<any>(`
      SELECT
        price_date,
        COUNT(DISTINCT time_slot)  AS slots_generated,
        COUNT(*)                   AS total_rows,
        SUM(CASE WHEN data_source = 'REAL_ANCHORED' THEN 1 ELSE 0 END) AS real_rows,
        SUM(CASE WHEN data_source = 'SIM_TRACKED'   THEN 1 ELSE 0 END) AS sim_rows,
        MIN(generated_at)          AS first_slot_at,
        MAX(generated_at)          AS last_slot_at,
        COUNT(DISTINCT market_id)  AS markets_covered,
        COUNT(DISTINCT item_id)    AS items_covered
      FROM dbo.Daily_Prices
      WHERE price_date >= DATEADD(day, -${days}, (SELECT MAX(price_date) FROM dbo.Daily_Prices WHERE nbs_adjusted = 0))
        AND nbs_adjusted = 0
      GROUP BY price_date
      ORDER BY price_date DESC
    `);

    // 3. Missing slots detection — which days have < 3 slots
    const missingSlots = await query<any>(`
      SELECT
        price_date,
        COUNT(DISTINCT time_slot) AS slots_present,
        3 - COUNT(DISTINCT time_slot) AS slots_missing,
        (SELECT STRING_AGG(s2.time_slot, ', ')
         FROM (SELECT DISTINCT d2.time_slot FROM dbo.Daily_Prices d2
               WHERE d2.price_date = dp.price_date AND d2.nbs_adjusted = 0) s2
        ) AS present_slots
      FROM dbo.Daily_Prices dp
      WHERE dp.price_date >= DATEADD(day, -${days}, (SELECT MAX(price_date) FROM dbo.Daily_Prices WHERE nbs_adjusted = 0))
        AND dp.nbs_adjusted = 0
      GROUP BY dp.price_date
      HAVING COUNT(DISTINCT dp.time_slot) < 3
      ORDER BY dp.price_date DESC
    `);

    // 4. Latest_Prices_Summary freshness
    const summaryFreshness = await query<any>(`
      SELECT
        MAX(last_updated)  AS last_refreshed,
        MAX(price_date)    AS latest_price_date,
        COUNT(*)           AS total_rows,
        DATEDIFF(MINUTE, MAX(last_updated), GETUTCDATE()) AS minutes_stale,
        COUNT(DISTINCT market_id) AS markets,
        COUNT(DISTINCT item_id)   AS items
      FROM dbo.Latest_Prices_Summary
      WHERE is_nbs_ref = 0 AND is_food = 1
    `);

    // 5. Generation stats summary
    const stats = await query<any>(`
      SELECT
        COUNT(DISTINCT price_date)        AS days_with_data,
        COUNT(DISTINCT item_id)           AS unique_items,
        COUNT(DISTINCT market_id)         AS unique_markets,
        COUNT(*)                          AS total_rows,
        MAX(price_date)                   AS latest_date,
        MIN(price_date)                   AS earliest_date,
        AVG(CAST(confidence_score AS FLOAT)) AS avg_confidence_overall,
        SUM(CASE WHEN data_source = 'REAL_ANCHORED' THEN 1 ELSE 0 END) AS total_real,
        SUM(CASE WHEN data_source = 'SIM_TRACKED'   THEN 1 ELSE 0 END) AS total_sim_tracked,
        SUM(CASE WHEN data_source = 'SIM_BASELINE'  THEN 1 ELSE 0 END) AS total_sim_baseline
      FROM dbo.Daily_Prices
      WHERE price_date >= DATEADD(day, -${days}, (SELECT MAX(price_date) FROM dbo.Daily_Prices WHERE nbs_adjusted = 0))
        AND nbs_adjusted = 0
    `);

    // 6. Per-slot performance breakdown
    const slotPerf = await query<any>(`
      SELECT
        time_slot,
        time_slot_name,
        COUNT(DISTINCT price_date)        AS days_run,
        AVG(CAST(confidence_score AS FLOAT)) AS avg_confidence,
        SUM(CASE WHEN data_source = 'REAL_ANCHORED' THEN 1 ELSE 0 END) * 100.0
          / NULLIF(COUNT(*), 0)           AS real_anchored_pct
      FROM dbo.Daily_Prices
      WHERE price_date >= DATEADD(day, -${days}, (SELECT MAX(price_date) FROM dbo.Daily_Prices WHERE nbs_adjusted = 0))
        AND nbs_adjusted = 0
      GROUP BY time_slot, time_slot_name
      ORDER BY time_slot
    `);

    // 7. Top markets by coverage
    const topMarkets = await query<any>(`
      SELECT TOP 10
        market_name,
        state,
        COUNT(DISTINCT price_date)       AS active_days,
        COUNT(DISTINCT item_id)          AS items_tracked,
        AVG(CAST(confidence_score AS FLOAT)) AS avg_confidence,
        SUM(CASE WHEN data_source = 'REAL_ANCHORED' THEN 1 ELSE 0 END) * 100.0
          / NULLIF(COUNT(*), 0)          AS real_pct
      FROM dbo.Daily_Prices
      WHERE price_date >= DATEADD(day, -${days}, (SELECT MAX(price_date) FROM dbo.Daily_Prices WHERE nbs_adjusted = 0))
        AND nbs_adjusted = 0
      GROUP BY market_name, state
      ORDER BY active_days DESC, avg_confidence DESC
    `);

    // Determine overall pipeline health
    const today = new Date().toISOString().slice(0, 10);
    const todayData = history.find((h: any) =>
      new Date(h.price_date).toISOString().slice(0, 10) === today
    );
    const expectedRows = 172020;
    const expectedSlots = 3;
    const staleMinutes = summaryFreshness[0]?.minutes_stale || 9999;

    let pipelineStatus: 'healthy' | 'degraded' | 'critical' | 'unknown' = 'unknown';
    let statusReason = '';

    if (!todayData) {
      pipelineStatus = 'critical';
      statusReason = 'No generation data for today';
    } else if (todayData.slots_generated < expectedSlots) {
      pipelineStatus = 'degraded';
      statusReason = `Only ${todayData.slots_generated}/3 slots generated today`;
    } else if (todayData.total_rows < expectedRows * 0.9) {
      pipelineStatus = 'degraded';
      statusReason = `Row count below expected (${todayData.total_rows.toLocaleString()} vs ${expectedRows.toLocaleString()})`;
    } else if (staleMinutes > 120) {
      pipelineStatus = 'degraded';
      statusReason = `Latest_Prices_Summary stale by ${staleMinutes} minutes`;
    } else {
      pipelineStatus = 'healthy';
      statusReason = 'All slots generated, summary fresh';
    }

    return NextResponse.json({
      success: true,
      data: {
        pipeline_status: pipelineStatus,
        status_reason: statusReason,
        today_slots: todaySlots,
        history,
        missing_slots: missingSlots,
        summary_freshness: summaryFreshness[0] || {},
        stats: stats[0] || {},
        slot_performance: slotPerf,
        top_markets: topMarkets,
        expected_rows_per_slot: expectedRows,
        expected_slots_per_day: expectedSlots,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[PriceGeneration API]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST — manual trigger hint (actual trigger is via Azure Function HTTP endpoint)
export async function POST(request: NextRequest) {
  const { slot, date } = await request.json();
  const validSlots = ['08:30', '11:30', '14:30'];
  if (!validSlots.includes(slot)) {
    return NextResponse.json({ success: false, error: 'Invalid slot' }, { status: 400 });
  }
  try {
    // Trigger via Azure Function HTTP endpoint
    const funcUrl = process.env.SCRAPER_FUNC_URL || 'https://func-naijamarket-scraper.azurewebsites.net';
    const key = process.env.SCRAPER_FUNC_KEY || '';
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const slotMap: Record<string, string> = {
      '08:30': 'generate_morning_prices',
      '11:30': 'generate_midday_prices',
      '14:30': 'generate_afternoon_prices',
    };
    const res = await fetch(`${funcUrl}/api/${slotMap[slot]}?code=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_date: targetDate }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      message: `Triggered ${slot} generation for ${targetDate}`,
      function_responded: res?.ok ?? false,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
