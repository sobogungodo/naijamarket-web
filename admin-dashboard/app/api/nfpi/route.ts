import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// ============================================================
// NFPI & INFLATION API
// GET /api/nfpi
// Confirmed NFPI_Monthly columns:
//   nfpi_id, yr, mth, period_label, index_value, prev_index_value,
//   mom_change_pct, yoy_change_pct, nbs_yoy_inflation, divergence_pct,
//   basket_value_naira, commodities_in_basket, markets_covered, computed_at
// Confirmed NBS_Inflation_Rates columns: yr, mth, yoy_inflation
// ============================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const view   = searchParams.get('view') || 'dashboard';
  const months = Math.min(120, parseInt(searchParams.get('months') || '24'));

  try {
    if (view === 'dashboard') {
      // Latest NFPI reading
      const latest = await query<any>(`
        SELECT TOP 1
          yr, mth, period_label, index_value, prev_index_value,
          mom_change_pct, yoy_change_pct, nbs_yoy_inflation,
          divergence_pct, basket_value_naira,
          commodities_in_basket, markets_covered, computed_at
        FROM dbo.NFPI_Monthly
        ORDER BY yr DESC, mth DESC
      `);

      // Full time series for chart
      const timeSeries = await query<any>(`
        SELECT
          yr, mth, period_label, index_value,
          mom_change_pct, yoy_change_pct,
          nbs_yoy_inflation, divergence_pct,
          basket_value_naira, computed_at
        FROM dbo.NFPI_Monthly
        WHERE yr >= 2016
        ORDER BY yr, mth
      `);

      // YoY comparison last 24 months
      const yoyComparison = await query<any>(`
        SELECT TOP ${months}
          yr, mth, period_label,
          yoy_change_pct     AS naijamarket_yoy,
          nbs_yoy_inflation  AS nbs_yoy,
          divergence_pct,
          index_value,
          basket_value_naira
        FROM dbo.NFPI_Monthly
        ORDER BY yr DESC, mth DESC
      `);

      // Stats summary
      const stats = await query<any>(`
        SELECT
          MIN(index_value)        AS index_min,
          MAX(index_value)        AS index_max,
          AVG(yoy_change_pct)     AS avg_yoy,
          AVG(divergence_pct)     AS avg_divergence,
          MAX(divergence_pct)     AS max_divergence,
          MIN(divergence_pct)     AS min_divergence,
          COUNT(*)                AS months_of_data,
          MIN(period_label)       AS earliest_period,
          MAX(period_label)       AS latest_period
        FROM dbo.NFPI_Monthly
      `);

      // Divergence alerts — months where NaijaMarket diverged > 3pp from NBS
      const divergenceAlerts = await query<any>(`
        SELECT TOP 10
          period_label, yr, mth,
          yoy_change_pct, nbs_yoy_inflation, divergence_pct,
          index_value
        FROM dbo.NFPI_Monthly
        WHERE ABS(divergence_pct) > 3
        ORDER BY ABS(divergence_pct) DESC
      `);

      // Current Live price inflation proxy from Latest_Prices_Summary
      const liveInflation = await query<any>(`
        SELECT
          AVG(price_change_pct)     AS avg_daily_change,
          AVG(month_change_pct)     AS avg_monthly_change,
          AVG(quarter_change_pct)   AS avg_quarterly_change,
          SUM(CASE WHEN trend = 'UP'   THEN 1 ELSE 0 END) * 100.0
            / NULLIF(COUNT(*), 0)   AS pct_items_rising,
          COUNT(DISTINCT item_id)   AS items_tracked,
          MAX(price_date)           AS as_of_date
        FROM dbo.Latest_Prices_Summary
        WHERE is_nbs_ref = 0 AND is_food = 1
      `);

      // NBS rates table
      const nbsRates = await query<any>(`
        SELECT yr, mth, yoy_inflation
        FROM dbo.NBS_Inflation_Rates
        ORDER BY yr DESC, mth DESC
      `).catch(() => []);

      return NextResponse.json({
        success: true,
        data: {
          latest: latest[0] || null,
          time_series: timeSeries,
          yoy_comparison: yoyComparison.reverse(),
          stats: stats[0] || {},
          divergence_alerts: divergenceAlerts,
          live_inflation: liveInflation[0] || {},
          nbs_rates: nbsRates,
        },
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid view' }, { status: 400 });
  } catch (error: any) {
    console.error('[NFPI API]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
