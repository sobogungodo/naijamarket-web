import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const revalidate = 60;
export const maxDuration = 30;

// The DB sits at 20 DTU outside its scale-up windows (07:10-11:10 and
// 13:10-17:10 UTC), where these queries can take longer than this function is
// allowed to live. lib/db.ts allows a request 60s — twice our maxDuration — so
// without a bound of our own the platform kills the function mid-query and
// serves an HTML error page. The client then fails on JSON.parse with a
// message that says nothing useful. Bound each query below the function budget
// so a slow DB surfaces as a real JSON error instead.
const HISTORY_TIMEOUT_MS = 8000;
const LIVE_TIMEOUT_MS = 7000;
const FRESHNESS_TIMEOUT_MS = 7000;

function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // Clamp to the range the UI offers. parseInt can yield NaN on junk input,
  // which would interpolate into `SELECT TOP NaN` and fail — fall back to 7.
  const requestedDays = parseInt(searchParams.get('days') || '7', 10);
  const days = Number.isFinite(requestedDays)
    ? Math.min(30, Math.max(1, requestedDays))
    : 7;

  // Parts of the response that could not be produced this request. Anything
  // listed here is missing from the payload rather than silently zeroed, so the
  // dashboard can say so instead of rendering an empty page that looks like a
  // dead pipeline.
  const degraded: string[] = [];

  try {
    // 1. Read last N days from cache — sub-millisecond, no scan
    const history = await withTimeout(query<any>(`
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
    `), HISTORY_TIMEOUT_MS, 'generation history query');

    // 2. Today's slot detail — sourced LIVE from Daily_Prices so a stale
    //    generation cache never zeroes out the dashboard. price_date is stored
    //    in WAT (UTC+1), so compute "today" the same way.
    const today = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
    const todayCache = history.find((h: any) =>
      new Date(h.price_date).toISOString().slice(0, 10) === today
    );

    // Daily_Prices is ~52M rows; this aggregate is the most expensive query
    // here. If it can't finish in budget, fall through to the cached
    // slot_detail below rather than failing the whole response.
    let todayLive: any[] = [];
    try {
      todayLive = await withTimeout(query<any>(`
        SELECT
          time_slot,
          MAX(time_slot_name) AS time_slot_name,
          COUNT(*)            AS rows_generated,
          MIN(generated_at)   AS started_at,
          MAX(generated_at)   AS completed_at,
          SUM(CASE WHEN data_source = 'REAL_ANCHORED' THEN 1 ELSE 0 END) AS real_anchored,
          SUM(CASE WHEN data_source = 'SIM_TRACKED'   THEN 1 ELSE 0 END) AS sim_tracked,
          SUM(CASE WHEN data_source = 'SIM_BASELINE'  THEN 1 ELSE 0 END) AS sim_baseline,
          AVG(CAST(confidence_score AS FLOAT))                           AS avg_confidence
        FROM dbo.Daily_Prices
        WHERE price_date = CAST(DATEADD(HOUR, 1, GETUTCDATE()) AS DATE)
        GROUP BY time_slot
        ORDER BY time_slot
      `), LIVE_TIMEOUT_MS, "today's live slot query");
    } catch (e: any) {
      console.error('[PriceGeneration API] live slot query failed:', e?.message);
      degraded.push(`live slot detail (${e?.message || 'query failed'}) — showing cached values`);
    }
    let todaySlots: any[] = todayLive.map((r: any) => ({
      time_slot: r.time_slot,
      time_slot_name: r.time_slot_name,
      rows_generated: r.rows_generated,
      started_at: r.started_at,
      completed_at: r.completed_at,
      real_anchored: r.real_anchored,
      sim_tracked: r.sim_tracked,
      sim_baseline: r.sim_baseline,
      avg_confidence: r.avg_confidence,
    }));
    // Defensive fallback to the cache if the live query returns nothing
    if (todaySlots.length === 0 && todayCache?.slot_detail) {
      try { todaySlots = JSON.parse(todayCache.slot_detail); } catch { todaySlots = []; }
    }

    let topMarkets: any[] = [];
    if (todayCache?.top_markets) {
      try { topMarkets = JSON.parse(todayCache.top_markets); } catch { topMarkets = []; }
    } else if (history.length > 0 && history[0]?.top_markets) {
      try { topMarkets = JSON.parse(history[0].top_markets); } catch { topMarkets = []; }
    }

    // 3. Summary freshness. Not Daily_Prices, but the two COUNT(DISTINCT)s
    //    still scan Latest_Prices_Summary, so bound it like the rest.
    let summaryFreshness: any[] = [];
    try {
      summaryFreshness = await withTimeout(query<any>(`
        SELECT
          MAX(last_updated)  AS last_refreshed,
          MAX(price_date)    AS latest_price_date,
          COUNT(*)           AS total_rows,
          DATEDIFF(MINUTE, MAX(last_updated), GETUTCDATE()) AS minutes_stale,
          COUNT(DISTINCT market_id) AS markets,
          COUNT(DISTINCT item_id)   AS items
        FROM dbo.Latest_Prices_Summary
        WHERE is_nbs_ref = 0 AND is_food = 1
      `), FRESHNESS_TIMEOUT_MS, 'summary freshness query');
    } catch (e: any) {
      console.error('[PriceGeneration API] freshness query failed:', e?.message);
      degraded.push(`summary freshness (${e?.message || 'query failed'})`);
    }

    // 4. Missing slots — derived from cache. The UI shows which slots DID run,
    //    so unpack slot_detail (already selected above) for that list.
    const missingSlots = history
      .filter((h: any) => h.slots_generated < 3)
      .map((h: any) => {
        let presentSlots = '';
        if (h.slot_detail) {
          try {
            presentSlots = (JSON.parse(h.slot_detail) as any[])
              .map(s => s.time_slot)
              .filter(Boolean)
              .sort()
              .join(', ');
          } catch { presentSlots = ''; }
        }
        return {
          price_date: h.price_date,
          slots_present: h.slots_generated,
          slots_missing: 3 - h.slots_generated,
          present_slots: presentSlots,
        };
      });

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
    // Only a value we actually read counts as a staleness signal. Defaulting a
    // failed query to 9999 would report the summary as stale by ~7 days when
    // the truth is that we never managed to ask.
    const staleMinutes: number | null =
      typeof summaryFreshness[0]?.minutes_stale === 'number'
        ? summaryFreshness[0].minutes_stale
        : null;
    // Prefer LIVE today data (from Daily_Prices) over the possibly-stale cache.
    const todayLiveTotal = todaySlots.reduce((a: number, s: any) => a + (s.rows_generated || 0), 0);
    const todayData = todaySlots.length > 0
      ? { total_rows: todayLiveTotal, slots_generated: todaySlots.length }
      : todayCache;

    let pipelineStatus: 'healthy' | 'degraded' | 'critical' | 'unknown' = 'unknown';
    let statusReason = '';

    // "We couldn't read it" is not the same as "the pipeline produced nothing".
    // Reporting CRITICAL on a timed-out query sends people hunting a dead
    // pipeline that is actually fine.
    const todayUnknown = !todayData && degraded.length > 0;

    if (todayUnknown) {
      pipelineStatus = 'unknown';
      statusReason = 'Could not read today\'s generation data — see warnings';
    } else if (!todayData || todayData.total_rows === 0) {
      pipelineStatus = 'critical';
      statusReason = 'No generation data for today';
    } else if (todayData.slots_generated < 3) {
      pipelineStatus = 'degraded';
      statusReason = `Only ${todayData.slots_generated}/3 slots generated today`;
    } else if (todayData.total_rows < expectedRows * 0.9) {
      pipelineStatus = 'degraded';
      statusReason = `Row count below expected (${todayData.total_rows.toLocaleString()} vs ${expectedRows.toLocaleString()})`;
    } else if (staleMinutes !== null && staleMinutes > 120) {
      pipelineStatus = 'degraded';
      statusReason = `Latest_Prices_Summary stale by ${staleMinutes} minutes`;
    } else if (staleMinutes === null) {
      pipelineStatus = 'degraded';
      statusReason = 'All slots generated; summary freshness unavailable';
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
        degraded,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[PriceGeneration API]', error);
    // The history read is the one query we can't do without. Return a real
    // JSON body so the client shows the reason rather than choking on an HTML
    // platform error page.
    return NextResponse.json(
      {
        success: false,
        error: `Could not load generation stats: ${error?.message || 'unknown error'}`,
      },
      { status: 503 }
    );
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
    let res: Response | null = null;
    let fetchError = '';
    try {
      res = await fetch(`${funcUrl}/api/${slotMap[slot]}?code=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_date: targetDate }),
        signal: AbortSignal.timeout(10000),
      });
    } catch (e: any) {
      fetchError = e?.name === 'TimeoutError' ? 'request timed out after 10s' : (e?.message || 'request failed');
    }

    // Don't claim success when the generation function never accepted the call —
    // a silent "Triggered" here reads as a working pipeline when nothing ran.
    if (!res) {
      return NextResponse.json({
        success: false,
        error: `Could not reach generation function for ${slot}: ${fetchError}`,
      }, { status: 502 });
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return NextResponse.json({
        success: false,
        error: `Generation function returned ${res.status} for ${slot}${body ? `: ${body.slice(0, 300)}` : ''}`,
      }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      message: `Triggered ${slot} generation for ${targetDate}`,
      function_responded: true,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
