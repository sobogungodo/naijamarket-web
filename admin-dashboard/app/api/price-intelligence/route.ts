import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// ============================================================
// PRICE INTELLIGENCE API
// GET /api/price-intelligence
// Confirmed table: Latest_Prices_Summary
// Confirmed columns: summary_id, item_name, item_id, market_name,
//   market_id, state, category_id, category_name, unit, price_naira,
//   price_date, previous_price, price_change_pct, trend,
//   week_high, week_low, week_avg, month_high, month_low, month_avg,
//   month_change_pct, quarter_avg, quarter_change_pct,
//   confidence_score, data_source, last_updated,
//   is_nbs_ref (computed bit), is_food (computed bit)
// ============================================================

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const view      = searchParams.get('view') || 'overview';
  const search    = searchParams.get('search') || '';
  const state     = searchParams.get('state') || '';
  const category  = searchParams.get('category') || '';
  const trend     = searchParams.get('trend') || '';
  const page      = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit     = Math.min(200, parseInt(searchParams.get('limit') || '50'));
  const offset    = (page - 1) * limit;
  const sortBy    = searchParams.get('sort') || 'price_change_pct';
  const sortDir   = searchParams.get('dir') === 'asc' ? 'ASC' : 'DESC';

  // Always filter out NBS reference items for consumer display
  const baseFilter = `WHERE is_nbs_ref = 0 AND is_food = 1`;

  const searchClause  = search   ? `AND (item_name LIKE '%${search}%' OR market_name LIKE '%${search}%')` : '';
  const stateClause   = state    ? `AND state = '${state.replace(/'/g, "''")}'` : '';
  const catClause     = category ? `AND category_name LIKE '%${category.replace(/'/g, "''")}%'` : '';
  const trendClause   = trend    ? `AND trend = '${trend.replace(/'/g, "''")}' ` : '';

  const filters = `${baseFilter} ${searchClause} ${stateClause} ${catClause} ${trendClause}`;

  const validSorts: Record<string, string> = {
    price_change_pct: 'price_change_pct',
    price_naira: 'price_naira',
    month_change_pct: 'month_change_pct',
    confidence_score: 'confidence_score',
    item_name: 'item_name',
    week_avg: 'week_avg',
  };
  const safeSort = validSorts[sortBy] || 'price_change_pct';

  try {
    if (view === 'overview') {
      // Headline KPIs
      const kpis = await query<any>(`
        SELECT
          COUNT(DISTINCT item_id)   AS total_items,
          COUNT(DISTINCT market_id) AS total_markets,
          COUNT(DISTINCT state)     AS total_states,
          COUNT(*)                  AS total_price_points,
          SUM(CASE WHEN trend = 'UP'    THEN 1 ELSE 0 END) AS trending_up,
          SUM(CASE WHEN trend = 'DOWN'  THEN 1 ELSE 0 END) AS trending_down,
          SUM(CASE WHEN trend = 'STABLE' THEN 1 ELSE 0 END) AS stable,
          AVG(CAST(confidence_score AS FLOAT)) AS avg_confidence,
          AVG(price_change_pct)     AS avg_daily_change,
          AVG(month_change_pct)     AS avg_monthly_change,
          MAX(price_date)           AS latest_price_date,
          MAX(last_updated)         AS last_refreshed
        FROM dbo.Latest_Prices_Summary
        ${baseFilter}
      `);

      // Top movers (biggest gainers)
      const gainers = await query<any>(`
        SELECT TOP 10
          item_name, market_name, state, category_name, unit,
          price_naira, previous_price, price_change_pct,
          month_change_pct, week_high, week_low, trend,
          confidence_score, data_source, price_date
        FROM dbo.Latest_Prices_Summary
        ${baseFilter}
        AND price_change_pct > 0
        ORDER BY price_change_pct DESC
      `);

      // Top losers
      const losers = await query<any>(`
        SELECT TOP 10
          item_name, market_name, state, category_name, unit,
          price_naira, previous_price, price_change_pct,
          month_change_pct, week_high, week_low, trend,
          confidence_score, data_source, price_date
        FROM dbo.Latest_Prices_Summary
        ${baseFilter}
        AND price_change_pct < 0
        ORDER BY price_change_pct ASC
      `);

      // Category summary
      const categories = await query<any>(`
        SELECT
          category_name,
          COUNT(DISTINCT item_id)   AS items,
          COUNT(DISTINCT market_id) AS markets,
          AVG(price_naira)          AS avg_price,
          AVG(price_change_pct)     AS avg_daily_change,
          AVG(month_change_pct)     AS avg_monthly_change,
          SUM(CASE WHEN trend = 'UP' THEN 1 ELSE 0 END) * 100.0
            / NULLIF(COUNT(*), 0)   AS pct_rising
        FROM dbo.Latest_Prices_Summary
        ${baseFilter}
        GROUP BY category_name
        ORDER BY avg_monthly_change DESC
      `);

      // State heatmap
      const stateMap = await query<any>(`
        SELECT
          state,
          COUNT(DISTINCT item_id)   AS items_tracked,
          AVG(price_naira)          AS avg_price,
          AVG(price_change_pct)     AS avg_daily_change,
          AVG(month_change_pct)     AS avg_monthly_change,
          AVG(CAST(confidence_score AS FLOAT)) AS avg_confidence
        FROM dbo.Latest_Prices_Summary
        ${baseFilter}
        GROUP BY state
        ORDER BY avg_monthly_change DESC
      `);

      return NextResponse.json({
        success: true,
        data: { kpis: kpis[0], gainers, losers, categories, state_map: stateMap },
        timestamp: new Date().toISOString(),
      });
    }

    if (view === 'prices') {
      // Full price table with pagination
      const total = await query<any>(`
        SELECT COUNT(*) AS cnt FROM dbo.Latest_Prices_Summary ${filters}
      `);

      const prices = await query<any>(`
        SELECT
          summary_id, item_name, item_id, market_name, market_id,
          state, category_name, unit, price_naira, previous_price,
          price_change_pct, trend, week_high, week_low, week_avg,
          month_high, month_low, month_avg, month_change_pct,
          quarter_avg, quarter_change_pct, confidence_score,
          data_source, price_date, last_updated
        FROM dbo.Latest_Prices_Summary
        ${filters}
        ORDER BY ${safeSort} ${sortDir}
        OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
      `);

      return NextResponse.json({
        success: true,
        data: {
          prices,
          total: total[0]?.cnt || 0,
          page, limit,
          pages: Math.ceil((total[0]?.cnt || 0) / limit),
        },
        timestamp: new Date().toISOString(),
      });
    }

    if (view === 'item') {
      const itemId = searchParams.get('item_id') || '';
      if (!itemId) return NextResponse.json({ success: false, error: 'item_id required' }, { status: 400 });

      const itemPrices = await query<any>(`
        SELECT
          item_name, market_name, state, unit, price_naira,
          previous_price, price_change_pct, trend,
          week_high, week_low, week_avg,
          month_high, month_low, month_avg, month_change_pct,
          quarter_avg, confidence_score, data_source, price_date
        FROM dbo.Latest_Prices_Summary
        WHERE item_id = '${itemId.replace(/'/g, "''")}' AND is_nbs_ref = 0
        ORDER BY price_naira ASC
      `);

      // Price history from Daily_Prices (last 30 days)
      const history = await query<any>(`
        SELECT
          price_date,
          time_slot_name,
          AVG(price_naira) AS avg_price,
          MIN(price_naira) AS min_price,
          MAX(price_naira) AS max_price,
          COUNT(DISTINCT market_id) AS market_count
        FROM dbo.Daily_Prices
        WHERE item_id = '${itemId.replace(/'/g, "''")}' AND nbs_adjusted = 0
          AND price_date >= DATEADD(day, -30, GETUTCDATE())
        GROUP BY price_date, time_slot_name
        ORDER BY price_date, time_slot_name
      `);

      return NextResponse.json({
        success: true,
        data: { item_prices: itemPrices, history },
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid view' }, { status: 400 });
  } catch (error: any) {
    console.error('[PriceIntelligence API]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
