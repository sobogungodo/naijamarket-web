import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';

// ============================================
// ADMIN MARKETS API — naijafoodmarket-live
// GET  /api/markets — List all markets with live stats
// POST /api/markets — Add new market
// PUT  /api/markets — Update market
// ============================================

export async function GET(request: NextRequest) {
  try {
    // 1. All markets with real stats
    const markets = await query<any>(`
      SELECT 
        m.market_id,
        m.market_name,
        m.state,
        m.latitude,
        m.longitude,
        m.radius_meters,
        m.opening_hours,
        m.status,
        m.region_id,
        m.coordinate_source,
        m.created_at,

        -- Trader count for this market
        ISNULL(t.trader_count, 0) AS trader_count,

        -- Today's submissions
        ISNULL(sub_today.submission_count, 0) AS submissions_today,

        -- Total submissions all time
        ISNULL(sub_all.total_submissions, 0) AS total_submissions,

        -- Avg confidence score as accuracy proxy
        ISNULL(sub_all.avg_confidence, 0) AS accuracy_pct,

        -- Latest submission timestamp
        sub_all.latest_submission,

        -- Distinct commodities tracked in this market
        ISNULL(items.item_count, 0) AS items_tracked

      FROM dbo.Markets m

      -- Traders per market (using assigned_market_id)
      LEFT JOIN (
        SELECT assigned_market_id, COUNT(*) AS trader_count
        FROM dbo.Traders_register
        WHERE registration_status = 'APPROVED'
        GROUP BY assigned_market_id
      ) t ON t.assigned_market_id = m.market_id

      -- Today's submissions
      LEFT JOIN (
        SELECT market_id, COUNT(*) AS submission_count
        FROM dbo.Daily_Prices
        WHERE CAST(price_date AS DATE) = CAST(GETDATE() AS DATE)
        GROUP BY market_id
      ) sub_today ON sub_today.market_id = m.market_id

      -- All-time submissions + avg confidence
      LEFT JOIN (
        SELECT 
          market_id, 
          COUNT(*) AS total_submissions,
          ROUND(AVG(CAST(confidence_score AS FLOAT)), 1) AS avg_confidence,
          MAX(price_date) AS latest_submission
        FROM dbo.Daily_Prices
        GROUP BY market_id
      ) sub_all ON sub_all.market_id = m.market_id

      -- Distinct items in this market
      LEFT JOIN (
        SELECT market_id, COUNT(DISTINCT item_name) AS item_count
        FROM dbo.Daily_Prices
        GROUP BY market_id
      ) items ON items.market_id = m.market_id

      ORDER BY m.state, m.market_name
    `);

    // 2. Summary stats
    const stats = await query<any>(`
      SELECT
        COUNT(*) AS total_markets,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_markets,
        COUNT(DISTINCT state) AS states_covered
      FROM dbo.Markets
    `);

    const traderStats = await query<any>(`
      SELECT COUNT(*) AS total_traders
      FROM dbo.Traders_register
      WHERE registration_status = 'APPROVED'
    `);

    const todayStats = await query<any>(`
      SELECT 
        COUNT(*) AS submissions_today,
        COUNT(DISTINCT market_id) AS active_markets_today
      FROM dbo.Daily_Prices
      WHERE CAST(price_date AS DATE) = CAST(GETDATE() AS DATE)
    `);

    // 3. Markets by state (for pie chart)
    const byState = await query<any>(`
      SELECT state, COUNT(*) AS count
      FROM dbo.Markets
      WHERE status = 'ACTIVE'
      GROUP BY state
      ORDER BY count DESC
    `);

    // 4. Submission activity last 7 days (for bar chart)
    const activity7d = await query<any>(`
      SELECT 
        CAST(price_date AS DATE) AS [date],
        COUNT(*) AS submissions,
        COUNT(DISTINCT market_id) AS markets_active
      FROM dbo.Daily_Prices
      WHERE price_date >= DATEADD(day, -7, GETDATE())
      GROUP BY CAST(price_date AS DATE)
      ORDER BY CAST(price_date AS DATE)
    `);

    return NextResponse.json({
      success: true,
      data: {
        markets,
        summary: {
          total_markets: stats[0]?.total_markets || 0,
          active_markets: stats[0]?.active_markets || 0,
          states_covered: stats[0]?.states_covered || 0,
          total_traders: traderStats[0]?.total_traders || 0,
          submissions_today: todayStats[0]?.submissions_today || 0,
          active_markets_today: todayStats[0]?.active_markets_today || 0,
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

    // Generate next market_id
    const lastId = await query<any>(`
      SELECT TOP 1 market_id FROM dbo.Markets ORDER BY market_id DESC
    `);
    const lastNum = lastId.length > 0 ? parseInt(lastId[0].market_id.replace('M', '')) : 0;
    const newId = 'M' + String(lastNum + 1).padStart(3, '0');

    await execute(`
      INSERT INTO dbo.Markets (market_id, market_name, state, latitude, longitude, radius_meters, opening_hours, region_id, status, coordinate_source)
      VALUES (@market_id, @market_name, @state, @latitude, @longitude, @radius_meters, @opening_hours, @region_id, 'ACTIVE', 'admin_dashboard')
    `, {
      market_id: newId,
      market_name,
      state,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
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

    // Toggle status shortcut
    if (status && Object.keys(body).length === 2) {
      await execute(`
        UPDATE dbo.Markets SET status = @status WHERE market_id = @market_id
      `, { market_id, status });
      return NextResponse.json({ success: true, message: `Market ${market_id} status updated to ${status}` });
    }

    // Full update
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
      market_name: market_name || null,
      state: state || null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      radius_meters: radius_meters ? parseInt(radius_meters) : null,
      opening_hours: opening_hours || null,
      status: status || null,
    });

    return NextResponse.json({ success: true, message: `Market ${market_id} updated` });
  } catch (error: any) {
    console.error('[Markets API] PUT Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
