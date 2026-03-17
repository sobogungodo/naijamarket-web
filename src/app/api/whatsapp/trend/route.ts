// src/app/api/whatsapp/trend/route.ts
// GET /api/whatsapp/trend?item=rice&market=mile+12&period=30d
// Returns price history formatted for WhatsApp
// Used by VercelIntegration.gs → getVercelTrend_()

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic    = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const item   = (searchParams.get('item')   || '').trim()
  const market = (searchParams.get('market') || '').trim()
  const period = (searchParams.get('period') || '30d').trim()

  if (!item) {
    return NextResponse.json({ success: false, error: 'item required' }, { status: 400 })
  }

  // Parse period: 7d, 30d, 90d, 12m, 3m, 6m
  const months = periodToMonths(period)

  try {
    const safeItem   = item.replace(/'/g, "''")
    const safeMarket = market.replace(/'/g, "''")

    // Get historical monthly averages from Historical_Monthly_Summary
    const histRows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT TOP ${months * 2}
        yr, mth,
        CAST(AVG(avg_price) AS FLOAT) AS avg_price,
        CAST(MIN(avg_price) AS FLOAT) AS min_price,
        CAST(MAX(avg_price) AS FLOAT) AS max_price,
        COUNT(*)                       AS data_points
      FROM dbo.Historical_Monthly_Summary
      WHERE item_name LIKE '%${safeItem}%'
        ${safeMarket ? `AND (market_name LIKE '%${safeMarket}%' OR state LIKE '%${safeMarket}%')` : ''}
        AND avg_price > 0
      GROUP BY yr, mth
      ORDER BY yr DESC, mth DESC
    `).catch(() => [])

    // Also get latest from Daily_Prices
    const latestRows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT TOP 1
        item_name,
        CAST(AVG(price_naira) AS FLOAT) AS current_price,
        MAX(price_date) AS latest_date
      FROM dbo.Daily_Prices
      WHERE item_name LIKE '%${safeItem}%'
        ${safeMarket ? `AND (market_name LIKE '%${safeMarket}%' OR state LIKE '%${safeMarket}%')` : ''}
        AND price_naira > 0
        AND price_date >= DATEADD(day, -7, CAST(GETDATE() AS DATE))
      GROUP BY item_name
    `).catch(() => [])

    if ((!histRows || histRows.length === 0) && (!latestRows || latestRows.length === 0)) {
      return NextResponse.json({
        success: false, count: 0,
        formatted: `❌ No trend data for *${item}*${market ? ` at ${market}` : ''}.`,
        history: []
      })
    }

    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const currentPrice = latestRows?.[0] ? Number(latestRows[0].current_price) : 0
    const itemName     = latestRows?.[0]?.item_name || item

    // Build trend table (last 6 months)
    const recent = histRows.slice(0, 6).reverse()
    const lines: string[] = [
      `📈 *${itemName.toUpperCase()}* — Price Trend`,
      `━━━━━━━━━━━━━━━━━━━━━━`
    ]

    if (currentPrice > 0) {
      lines.push(`*Current:* ₦${fmt(currentPrice)}`)
      lines.push('')
    }

    if (recent.length > 0) {
      lines.push('*Monthly Averages:*')
      let prevPrice: number | null = null
      recent.forEach(r => {
        const price = Number(r.avg_price)
        const label = `${MONTH_NAMES[(r.mth - 1)]} ${r.yr}`
        const arrow = prevPrice === null ? '' : price > prevPrice * 1.02 ? ' ↗️' : price < prevPrice * 0.98 ? ' ↘️' : ' ➡️'
        lines.push(`  ${label}: *₦${fmt(price)}*${arrow}`)
        prevPrice = price
      })
    }

    // Calculate overall trend
    if (recent.length >= 2) {
      const oldest = Number(recent[0].avg_price)
      const newest = Number(recent[recent.length - 1].avg_price)
      const changePct = ((newest - oldest) / oldest * 100).toFixed(1)
      const direction = Number(changePct) > 0 ? '📈 Rising' : Number(changePct) < 0 ? '📉 Falling' : '➡️ Stable'
      lines.push('')
      lines.push(`*${period} trend:* ${direction} (${changePct}%)`)
    }

    lines.push(`━━━━━━━━━━━━━━━━━━━━━━`)
    lines.push(`_${histRows.length} data points · NBS + Crowdsourced_`)

    return NextResponse.json({
      success:   true,
      count:     histRows.length,
      item:      itemName,
      formatted: lines.join('\n'),
      current_price: currentPrice,
      history: recent.map(r => ({
        year:      r.yr,
        month:     r.mth,
        avg_price: Number(r.avg_price),
        min_price: Number(r.min_price),
        max_price: Number(r.max_price),
      }))
    })

  } catch (err) {
    console.error('[/api/whatsapp/trend]', err)
    return NextResponse.json({ success: false, error: String(err), useSheets: true }, { status: 500 })
  }
}

function periodToMonths(period: string): number {
  const m = period.match(/^(\d+)(d|m)$/)
  if (!m) return 3
  const n = parseInt(m[1])
  return m[2] === 'd' ? Math.ceil(n / 30) : n
}

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-NG')
}
