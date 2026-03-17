// src/app/api/whatsapp/snapshot/route.ts
// GET /api/whatsapp/snapshot?market=mile+12&state=Lagos&limit=5
// Full market snapshot — all items at a given market
// Used by VercelIntegration.gs → getVercelSnapshot_()

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic    = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const market = (searchParams.get('market') || '').trim()
  const state  = (searchParams.get('state')  || '').trim()
  const limit  = Math.min(20, Math.max(3, parseInt(searchParams.get('limit') || '5')))

  if (!market && !state) {
    return NextResponse.json({ success: false, error: 'market or state required' }, { status: 400 })
  }

  try {
    const safeMarket = market.replace(/'/g, "''")
    const safeState  = state.replace(/'/g, "''")

    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT TOP ${limit}
        item_name, market_name, state,
        CAST(price_naira AS FLOAT)        AS price,
        CAST(price_change_pct AS FLOAT)   AS change_pct,
        unit, price_date,
        CAST(confidence_score AS FLOAT)   AS confidence,
        data_source
      FROM dbo.Latest_Prices_Summary
      WHERE price_naira > 0
        ${safeMarket ? `AND market_name LIKE '%${safeMarket}%'` : ''}
        ${safeState  ? `AND state       LIKE '%${safeState}%'`  : ''}
      ORDER BY confidence_score DESC, price_date DESC
    `)

    if (!rows || rows.length === 0) {
      return NextResponse.json({
        success: false, count: 0,
        formatted: `❌ No data for *${market || state}*. Check the market name and try again.`,
        items: []
      })
    }

    const marketName = rows[0].market_name
    const stateName  = rows[0].state
    const freshest   = rows.reduce((a: any, b: any) =>
      new Date(a.price_date) > new Date(b.price_date) ? a : b)
    const updatedStr = getFreshness(freshest.price_date)

    // Group by category (simple heuristic)
    const lines: string[] = [
      `📸 *MARKET SNAPSHOT*`,
      `🏪 ${marketName}`,
      `📍 ${stateName} · ${updatedStr}`,
      `━━━━━━━━━━━━━━━━━━━━━━`
    ]

    rows.forEach(r => {
      const price     = Number(r.price)
      const changePct = Number(r.change_pct || 0)
      const arrow     = changePct > 1 ? '↗️' : changePct < -1 ? '↘️' : '➡️'
      const changeStr = Math.abs(changePct) > 0.5
        ? ` ${arrow} ${changePct > 0 ? '+' : ''}${changePct.toFixed(1)}%`
        : ''
      lines.push(`• *${r.item_name}*: ₦${fmt(price)} ${r.unit || ''}${changeStr}`)
    })

    lines.push(`━━━━━━━━━━━━━━━━━━━━━━`)
    lines.push(`_${rows.length} items · Type *price [item]* for detail_`)

    return NextResponse.json({
      success:      true,
      count:        rows.length,
      market:       marketName,
      state:        stateName,
      formatted:    lines.join('\n'),
      items: rows.map(r => ({
        item_name:  r.item_name,
        price:      Number(r.price),
        change_pct: Number(r.change_pct || 0),
        unit:       r.unit,
        price_date: r.price_date,
        confidence: Number(r.confidence),
      }))
    })

  } catch (err) {
    console.error('[/api/whatsapp/snapshot]', err)
    return NextResponse.json({ success: false, error: String(err), useSheets: true }, { status: 500 })
  }
}

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-NG')
}

function getFreshness(dateVal: any): string {
  if (!dateVal) return 'Unknown'
  const days = (Date.now() - new Date(dateVal).getTime()) / 86400000
  if (days < 1) return 'Updated today'
  if (days < 2) return 'Updated yesterday'
  return `Updated ${Math.floor(days)}d ago`
}
