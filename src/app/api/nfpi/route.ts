// src/app/api/nfpi/route.ts
// NaijaMarket Food Price Index — website API
// Source: dbo.NFPI_Monthly (2016-2025, 120 months)
// Used by: /dashboard/inflation (comparison chart) + future /dashboard/nfpi page

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import sql from 'mssql'

const sqlConfig: sql.config = {
  user:     process.env.AZURE_SQL_USER!,
  password: process.env.AZURE_SQL_PASSWORD!,
  server:   process.env.AZURE_SQL_SERVER!,
  database: process.env.AZURE_SQL_DATABASE!,
  options:  { encrypt: true, trustServerCertificate: false },
  pool:     { max: 5, min: 0, idleTimeoutMillis: 30000 },
}

async function getPool(): Promise<sql.ConnectionPool> {
  return sql.connect(sqlConfig)
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const view    = searchParams.get('view') || 'headline'   // headline | trend | basket | divergence
  const months  = Math.min(parseInt(searchParams.get('months') || '24'), 120)
  const tier    = (session.user as any).subscription_tier || 'FREE'

  const silverTiers = new Set(['SILVER', 'GOLD', 'BUSINESS', 'CORPORATE', 'ENTERPRISE'])
  const isSilver    = silverTiers.has(tier.toUpperCase())

  try {
    const pool = await getPool()

    // ── Headline — current index + YoY + NBS + divergence ──
    const headlineResult = await pool.request().query(`
      SELECT TOP 1
        period_label,
        CAST(index_value        AS FLOAT) AS index_value,
        CAST(prev_index_value   AS FLOAT) AS prev_index_value,
        CAST(mom_change_pct     AS FLOAT) AS mom_change_pct,
        CAST(yoy_change_pct     AS FLOAT) AS yoy_change_pct,
        CAST(nbs_yoy_inflation  AS FLOAT) AS nbs_yoy_inflation,
        CAST(divergence_pct     AS FLOAT) AS divergence_pct,
        CAST(basket_value_naira AS FLOAT) AS basket_value_naira,
        commodities_in_basket,
        markets_covered,
        computed_at
      FROM dbo.NFPI_Monthly
      ORDER BY yr DESC, mth DESC
    `)
    const headline = headlineResult.recordset[0] || null

    if (view === 'headline') {
      return NextResponse.json({ headline, tier })
    }

    // ── Trend — time series for chart (SILVER+ gets full range, FREE gets 6mo) ──
    if (view === 'trend') {
      const limit = isSilver ? months : 6
      const trendResult = await pool.request()
        .input('limit', sql.Int, limit)
        .query(`
          SELECT TOP (@limit)
            period_label,
            yr, mth,
            CAST(index_value        AS FLOAT) AS index_value,
            CAST(mom_change_pct     AS FLOAT) AS mom_change_pct,
            CAST(yoy_change_pct     AS FLOAT) AS yoy_change_pct,
            CAST(nbs_yoy_inflation  AS FLOAT) AS nbs_yoy_inflation,
            CAST(divergence_pct     AS FLOAT) AS divergence_pct,
            CAST(basket_value_naira AS FLOAT) AS basket_value_naira
          FROM dbo.NFPI_Monthly
          ORDER BY yr DESC, mth DESC
        `)
      // Return in chronological order for charting
      const trend = trendResult.recordset.reverse()
      return NextResponse.json({ headline, trend, tier, months_returned: trend.length })
    }

    // ── Divergence summary — NFPI vs NBS (SILVER+ only) ──
    if (view === 'divergence') {
      if (!isSilver) {
        return NextResponse.json({ error: 'SILVER subscription required', tier }, { status: 403 })
      }
      const divResult = await pool.request().query(`
        SELECT
          period_label,
          CAST(yoy_change_pct     AS FLOAT) AS nfpi_yoy,
          CAST(nbs_yoy_inflation  AS FLOAT) AS nbs_yoy,
          CAST(divergence_pct     AS FLOAT) AS divergence_pct,
          CASE
            WHEN divergence_pct > 3  THEN 'HIGH'
            WHEN divergence_pct > 1  THEN 'MODERATE'
            WHEN divergence_pct < -3 THEN 'NBS_HIGH'
            ELSE 'ALIGNED'
          END AS signal
        FROM dbo.NFPI_Monthly
        WHERE nbs_yoy_inflation IS NOT NULL
        ORDER BY yr DESC, mth DESC
      `)
      return NextResponse.json({
        headline,
        divergence: divResult.recordset,
        peak_divergence: divResult.recordset.reduce((max: any, r: any) =>
          (!max || r.divergence_pct > max.divergence_pct) ? r : max, null),
        tier
      })
    }

    // ── Basket — commodity-level detail for current period (SILVER+ only) ──
    if (view === 'basket') {
      if (!isSilver) {
        return NextResponse.json({ error: 'SILVER subscription required', tier }, { status: 403 })
      }
      const basketResult = await pool.request().query(`
        SELECT
          c.commodity_name,
          c.commodity_code,
          c.retail_unit,
          AVG(h.avg_price) AS avg_price,
          MIN(h.avg_price) AS min_price,
          MAX(h.avg_price) AS max_price,
          COUNT(DISTINCT h.market_id) AS market_count
        FROM dbo.Historical_Monthly_Summary h
        JOIN catalog.Commodities c ON h.commodity_id = c.commodity_id
        WHERE c.is_nbs_tracked = 1
          AND c.is_active = 1
          AND h.price_year  = (SELECT MAX(price_year)  FROM dbo.Historical_Monthly_Summary)
          AND h.price_month = (
              SELECT MAX(price_month) FROM dbo.Historical_Monthly_Summary
              WHERE price_year = (SELECT MAX(price_year) FROM dbo.Historical_Monthly_Summary)
          )
        GROUP BY c.commodity_name, c.commodity_code, c.retail_unit
        ORDER BY avg_price DESC
      `)
      return NextResponse.json({
        headline,
        basket: basketResult.recordset,
        tier
      })
    }

    return NextResponse.json({ error: 'Invalid view parameter' }, { status: 400 })

  } catch (err: any) {
    console.error('[/api/nfpi]', err?.message || err)
    return NextResponse.json({ error: 'Database error', detail: err?.message }, { status: 500 })
  }
}
