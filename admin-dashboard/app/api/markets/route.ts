import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';

// ============================================
// ADMIN MARKETS API
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
        m.market_type,
        m.address,
        m.state,
        m.gps_latitude,
        m.gps_longitude,
        m.radius_meters,
        m.operating_hours,
        m.status,
        m.created_at,
        m.updated_at,

        -- Trader count for this market
        ISNULL(t.trader_count, 0) AS trader_count,

        -- Today's submissions
        ISNULL(sub_today.submission_count, 0) AS submissions_today,

        -- Total submissions all time
        ISNULL(sub_all.total_submissions, 0) AS total_submissions,

        -- Avg price accuracy (% of submissions approved)
        CASE 
          WHEN ISNULL(sub_all.total_submissions, 0) = 0 THEN 0
          ELSE ROUND(ISNULL(sub_all.approved_count, 0) * 100.0 / sub_all.total_submissions, 1)
        END AS accuracy_pct,

        -- Latest submission timestamp
        sub_all.latest_submission,

        -- Distinct commodities tracked in this market
        ISNULL(items.item_count, 0) AS items_tracked

      FROM dbo.Markets m

      -- Traders per market
      LEFT JOIN (
        SELECT market_id, COUNT(*) AS trader_count
        FROM dbo.Traders
        WHERE registration_status = 'APPROVED'
        GROUP BY market_id
      ) t ON t.market_id = m.market_id

      -- Today's submissions
      LEFT JOIN (
        SELECT market_id, COUNT(*) AS submission_count
        FROM dbo.Daily_Prices
        WHERE CAST(price_date AS DATE) = CAST(GETDATE() AS DATE)
        GROUP BY market_id
      ) sub_today ON sub_today.market_id = m.market_id

      -- All-time submissions + approved count
      LEFT JOIN (
        SELECT 
          market_id, 
          COUNT(*) AS total_submissions,
          SUM(CASE WHEN validation_status = 'APPROVED' THEN 1 ELSE 0 END) AS approved_count,
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
      FROM dbo.Traders
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
        CAST(price_date AS DATE) AS date,
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
    const { market_name, market_type, address, state, gps_latitude, gps_longitude, radius_meters, operating_hours } = body;

    if (!market_name || !state || !gps_latitude || !gps_longitude) {
      return NextResponse.json({ success: false, error: 'market_name, state, gps_latitude, gps_longitude required' }, { status: 400 });
    }

    // Generate next market_id
    const lastId = await query<any>(`
      SELECT TOP 1 market_id FROM dbo.Markets ORDER BY market_id DESC
    `);
    const lastNum = lastId.length > 0 ? parseInt(lastId[0].market_id.replace('M', '')) : 0;
    const newId = 'M' + String(lastNum + 1).padStart(3, '0');

    await execute(`
      INSERT INTO dbo.Markets (market_id, market_name, market_type, address, state, gps_latitude, gps_longitude, radius_meters, operating_hours, status)
      VALUES (@market_id, @market_name, @market_type, @address, @state, @gps_latitude, @gps_longitude, @radius_meters, @operating_hours, 'ACTIVE')
    `, {
      market_id: newId,
      market_name,
      market_type: market_type || 'Mixed',
      address: address || '',
      state,
      gps_latitude: parseFloat(gps_latitude),
      gps_longitude: parseFloat(gps_longitude),
      radius_meters: parseInt(radius_meters) || 500,
      operating_hours: operating_hours || '6:00 AM - 6:00 PM',
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
    const { market_id, status, market_name, address, state, gps_latitude, gps_longitude, radius_meters, operating_hours, market_type } = body;

    if (!market_id) {
      return NextResponse.json({ success: false, error: 'market_id required' }, { status: 400 });
    }

    // Toggle status shortcut
    if (status && Object.keys(body).length === 2) {
      await execute(`
        UPDATE dbo.Markets SET status = @status, updated_at = GETDATE() WHERE market_id = @market_id
      `, { market_id, status });
      return NextResponse.json({ success: true, message: `Market ${market_id} status updated to ${status}` });
    }

    // Full update
    await execute(`
      UPDATE dbo.Markets SET
        market_name = ISNULL(@market_name, market_name),
        market_type = ISNULL(@market_type, market_type),
        address = ISNULL(@address, address),
        state = ISNULL(@state, state),
        gps_latitude = ISNULL(@gps_latitude, gps_latitude),
        gps_longitude = ISNULL(@gps_longitude, gps_longitude),
        radius_meters = ISNULL(@radius_meters, radius_meters),
        operating_hours = ISNULL(@operating_hours, operating_hours),
        status = ISNULL(@status, status),
        updated_at = GETDATE()
      WHERE market_id = @market_id
    `, {
      market_id,
      market_name: market_name || null,
      market_type: market_type || null,
      address: address || null,
      state: state || null,
      gps_latitude: gps_latitude ? parseFloat(gps_latitude) : null,
      gps_longitude: gps_longitude ? parseFloat(gps_longitude) : null,
      radius_meters: radius_meters ? parseInt(radius_meters) : null,
      operating_hours: operating_hours || null,
      status: status || null,
    });

    return NextResponse.json({ success: true, message: `Market ${market_id} updated` });
  } catch (error: any) {
    console.error('[Markets API] PUT Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
