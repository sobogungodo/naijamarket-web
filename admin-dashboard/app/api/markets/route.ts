import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';

// ============================================
// ADMIN MARKETS API — OPTIMIZED FOR SPEED
// Splits heavy queries to avoid 30s timeout
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Query 1: Markets only (fast - small table)
    const markets = await query<any>(`
      SELECT 
        market_id, market_name, state, latitude, longitude,
        radius_meters, opening_hours, status, region_id,
        coordinate_source, created_at
      FROM dbo.Markets
      ORDER BY state, market_name
    `);

    // Query 2: Summary stats (fast)
    const stats = await query<any>(`
      SELECT
        COUNT(*) AS total_markets,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_markets,
        COUNT(DISTINCT state) AS states_covered
      FROM dbo.Markets
    `);

    // Query 3: Trader counts per market (fast - indexed)
    const traderCounts = await query<any>(`
      SELECT assigned_market_id AS market_id, COUNT(*) AS trader_count
      FROM dbo.Traders_register
      WHERE registration_status = 'APPROVED' AND assigned_market_id IS NOT NULL
      GROUP BY assigned_market_id
    `);

    // Query 4: Total traders
    const traderTotal = await query<any>(`
      SELECT COUNT(*) AS total_traders
      FROM dbo.Traders_register
      WHERE registration_status = 'APPROVED'
    `);

    // Query 5: Submission stats per market (using TOP for speed)
    const submissionStats = await query<any>(`
      SELECT 
        market_id,
        COUNT(*) AS total_submissions,
        ROUND(AVG(CAST(ISNULL(confidence_score, 80) AS FLOAT)), 1) AS avg_confidence,
        COUNT(DISTINCT item_name) AS item_count
      FROM dbo.Daily_Prices
      GROUP BY market_id
    `);

    // Query 6: Today's submissions (fast - filtered by date)
    const todayStats = await query<any>(`
      SELECT 
        market_id,
        COUNT(*) AS submission_count
      FROM dbo.Daily_Prices
      WHERE CAST(price_date AS DATE) = CAST(GETDATE() AS DATE)
      GROUP BY market_id
    `);

    // Query 7: Markets by state (fast)
    const byState = await query<any>(`
      SELECT state, COUNT(*) AS count
      FROM dbo.Markets
      WHERE status = 'ACTIVE'
      GROUP BY state
      ORDER BY count DESC
    `);

    // Query 8: Activity last 7 days (fast - date filtered)
    const activity7d = await query<any>(`
      SELECT 
        CAST(price_date AS DATE) AS [date],
        COUNT(*) AS submissions
      FROM dbo.Daily_Prices
      WHERE price_date >= DATEADD(day, -7, GETDATE())
      GROUP BY CAST(price_date AS DATE)
      ORDER BY CAST(price_date AS DATE)
    `);

    // Build lookup maps
    const traderMap = new Map(traderCounts.map((t: any) => [t.market_id, t.trader_count]));
    const subMap = new Map(submissionStats.map((s: any) => [s.market_id, s]));
    const todayMap = new Map(todayStats.map((t: any) => [t.market_id, t.submission_count]));

    // Merge data
    const enrichedMarkets = markets.map((m: any) => {
      const sub = subMap.get(m.market_id) || {};
      return {
        ...m,
        trader_count: traderMap.get(m.market_id) || 0,
        submissions_today: todayMap.get(m.market_id) || 0,
        total_submissions: sub.total_submissions || 0,
        accuracy_pct: sub.avg_confidence || 0,
        items_tracked: sub.item_count || 0,
      };
    });

    const totalSubmissionsToday = todayStats.reduce((s: number, t: any) => s + t.submission_count, 0);
    const activeMarketsToday = todayStats.length;

    return NextResponse.json({
      success: true,
      data: {
        markets: enrichedMarkets,
        summary: {
          total_markets: stats[0]?.total_markets || 0,
          active_markets: stats[0]?.active_markets || 0,
          states_covered: stats[0]?.states_covered || 0,
          total_traders: traderTotal[0]?.total_traders || 0,
          submissions_today: totalSubmissionsToday,
          active_markets_today: activeMarketsToday,
        },
        by_state: byState,
        activity_7d: activity7d,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Markets API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { market_name, state, latitude, longitude, radius_meters, opening_hours, region_id } = body;

    if (!market_name || !state || !latitude || !longitude) {
      return NextResponse.json({ success: false, error: 'market_name, state, latitude, longitude required' }, { status: 400 });
    }

    const lastId = await query<any>(`SELECT TOP 1 market_id FROM dbo.Markets ORDER BY market_id DESC`);
    const lastNum = lastId.length > 0 ? parseInt(lastId[0].market_id.replace('M', '')) : 0;
    const newId = 'M' + String(lastNum + 1).padStart(3, '0');

    await execute(`
      INSERT INTO dbo.Markets (market_id, market_name, state, latitude, longitude, radius_meters, opening_hours, region_id, status, coordinate_source)
      VALUES (@market_id, @market_name, @state, @latitude, @longitude, @radius_meters, @opening_hours, @region_id, 'ACTIVE', 'admin_dashboard')
    `, {
      market_id: newId, market_name, state,
      latitude: parseFloat(latitude), longitude: parseFloat(longitude),
      radius_meters: parseInt(radius_meters) || 500,
      opening_hours: opening_hours || '6:00 AM - 6:00 PM',
      region_id: region_id || null,
    });

    return NextResponse.json({ success: true, market_id: newId, message: `Market ${market_name} created` });
  } catch (error: any) {
    console.error('[Markets API] POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { market_id, status, market_name, state, latitude, longitude, radius_meters, opening_hours } = body;

    if (!market_id) {
      return NextResponse.json({ success: false, error: 'market_id required' }, { status: 400 });
    }

    if (status && Object.keys(body).length === 2) {
      await execute(`UPDATE dbo.Markets SET status = @status WHERE market_id = @market_id`, { market_id, status });
      return NextResponse.json({ success: true, message: `Market ${market_id} status → ${status}` });
    }

    await execute(`
      UPDATE dbo.Markets SET
        market_name = ISNULL(@market_name, market_name),
        state = ISNULL(@state, state),
        latitude = ISNULL(@latitude, latitude),
        longitude = ISNULL(@longitude, longitude),
        radius_meters = ISNULL(@radius_meters, radius_meters),
        opening_hours = ISNULL(@opening_hours, opening_hours),
        status = ISNULL(@status, status)
      WHERE market_id = @market_id
    `, {
      market_id,
      market_name: market_name || null, state: state || null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      radius_meters: radius_meters ? parseInt(radius_meters) : null,
      opening_hours: opening_hours || null, status: status || null,
    });

    return NextResponse.json({ success: true, message: `Market ${market_id} updated` });
  } catch (error: any) {
    console.error('[Markets API] PUT Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
