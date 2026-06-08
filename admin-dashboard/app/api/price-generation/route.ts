import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(14, parseInt(searchParams.get('days') || '7'));

  try {
    // 1. Read last N days from cache — sub-millisecond, no scan
    const history = await query<any>(`
      SELECT TOP ${days}
        price_date,
        slots_generated,
        total_rows,
        real_rows,
        sim_rows,
        markets_covered,
        items_covered,
        avg_confidence,
        first_slot_at,
        last_slot_at,
        slot_detail,
        top_markets,
        refreshed_at
      FROM dbo.Generation_Stats_Cache
      ORDER BY price_date DESC
    `);

    // 2. Today's slot detail from cache
    const today = new Date().toISOString().slice(0, 10);
    const todayCache = history.find((h: any) =>
      new Date(h.price_date).toISOString().slice(0, 10) === today
    );

    let todaySlots: any[] = [];
    if (todayCache?.slot_detail) {
      try { todaySlots = JSON.parse(todayCache.slot_detail); } catch { todaySlots = []; }
    }

    let topMarkets: any[] = [];
    if (todayCache?.top_markets) {
      try { topMarkets = JSON.parse(todayCache.top_markets); } catch { topMarkets = []; }
    } else if (history.length > 0 && history[0]?.top_markets) {
      try { topMarkets = JSON.parse(history[0].top_markets); } catch { topMarkets = []; }
    }

    // 3. Summary freshness — lightweight, not Daily_Prices
    const [summaryFreshness] = await Promise.all([
      query<any>(`
        SELECT
          MAX(last_updated)  AS last_refreshed,
          MAX(price_date)    AS latest_price_date,
          COUNT(*)           AS total_rows,
          DATEDIFF(MINUTE, MAX(last_updated), GETUTCDATE()) AS minutes_stale,
          COUNT(DISTINCT market_id) AS markets,
          COUNT(DISTINCT item_id)   AS items
        FROM dbo.Latest_Prices_Summary
        WHERE is_nbs_ref = 0 AND is_food = 1
      `),
    ]);

    // 4. Missing slots — derived from cache
    const missingSlots = history
      .filter((h: any) => h.slots_generated < 3)
      .map((h: any) => ({
        price_date: h.price_date,
        slots_present: h.slots_generated,
        slots_missing: 3 - h.slots_generated,
      }));

    // 5. Aggregate stats from cache
    const statsFromCache = history.reduce(
      (acc: any, h: any) => ({
        days_with_data: acc.days_with_data + (h.total_rows > 0 ? 1 : 0),
        total_rows: acc.total_rows + (h.total_rows || 0),
        total_real: acc.total_real + (h.real_rows || 0),
        total_sim_tracked: acc.total_sim_tracked + (h.sim_rows || 0),
        unique_markets: Math.max(acc.unique_markets, h.markets_covered || 0),
        unique_items: Math.max(acc.unique_items, h.items_covered || 0),
        latest_date: !acc.latest_date || h.price_date > acc.latest_date ? h.price_date : acc.latest_date,
        earliest_date: !acc.earliest_date || h.price_date < acc.earliest_date ? h.price_date : acc.earliest_date,
        avg_confidence_overall: acc.avg_confidence_overall + (parseFloat(h.avg_confidence) || 0),
      }),
      { days_with_data: 0, total_rows: 0, total_real: 0, total_sim_tracked: 0, total_sim_baseline: 0, unique_markets: 0, unique_items: 0, latest_date: null, earliest_date: null, avg_confidence_overall: 0 }
    );
    if (statsFromCache.days_with_data > 0) {
      statsFromCache.avg_confidence_overall = statsFromCache.avg_confidence_overall / statsFromCache.days_with_data;
    }

    // 6. Pipeline health
    const expectedRows = 172020;
    const staleMinutes = summaryFreshness[0]?.minutes_stale || 9999;
    const todayData = todayCache;

    let pipelineStatus: 'healthy' | 'degraded' | 'critical' | 'unknown' = 'unknown';
    let statusReason = '';

    if (!todayData || todayData.total_rows === 0) {
      pipelineStatus = 'critical';
      statusReason = 'No generation data for today';
    } else if (todayData.slots_generated < 3) {
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

    // Format history for frontend compatibility
    const formattedHistory = history.map((h: any) => ({
      price_date: h.price_date,
      slots_generated: h.slots_generated,
      total_rows: h.total_rows,
      real_rows: h.real_rows,
      sim_rows: h.sim_rows,
      first_slot_at: h.first_slot_at,
      last_slot_at: h.last_slot_at,
      markets_covered: h.markets_covered,
      items_covered: h.items_covered,
    }));

    return NextResponse.json({
      success: true,
      data: {
        pipeline_status: pipelineStatus,
        status_reason: statusReason,
        today_slots: todaySlots,
        history: formattedHistory,
        missing_slots: missingSlots,
        summary_freshness: summaryFreshness[0] || {},
        stats: statsFromCache,
        slot_performance: [],
        top_markets: topMarkets,
        expected_rows_per_slot: expectedRows,
        expected_slots_per_day: 3,
        cache_refreshed_at: todayCache?.refreshed_at || null,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[PriceGeneration API]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST — manual trigger
export async function POST(request: NextRequest) {
  const { slot, date } = await request.json();
  const validSlots = ['08:30', '11:30', '14:30'];
  if (!validSlots.includes(slot)) {
    return NextResponse.json({ success: false, error: 'Invalid slot' }, { status: 400 });
  }
  try {
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
