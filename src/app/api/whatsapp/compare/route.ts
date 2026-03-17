// src/app/api/whatsapp/compare/route.ts
// GET /api/whatsapp/compare?item=rice&state=Lagos&limit=5
// Compares prices across markets for same item
// Used by VercelIntegration.gs → getVercelCompare_()

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic    = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const item  = (searchParams.get('item')  || '').trim()
  const state = (searchParams.get('state') || '').trim()
  const limit = Math.min(10, Math.max(2, parseInt(searchParams.get('limit') || '5')))

  if (!item) {
    return NextResponse.json({ success: false, error: 'item required' }, { status: 400 })
  }

  try {
    const safeItem  = item.replace(/'/g, "''")
    const safeState = state.replace(/'/g, "''")

    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT TOP ${limit}
        item_name, market_name, state,
        CAST(price_naira AS FLOAT) AS price,
        unit, price_date,
        CAST(confidence_score AS FLOAT) AS confidence
      FROM dbo.Latest_Prices_Summary
      WHERE item_name LIKE '%${safeItem}%'
        AND price_naira > 0
        ${safeState ? `AND state LIKE '%${safeState}%'` : ''}
      ORDER BY price_naira ASC
    `)

    if (!rows || rows.length < 2) {
      return NextResponse.json({
        success: false, count: rows?.length || 0,
        formatted: `❌ Not enough markets found for *${item}*${state ? ` in ${state}` : ''}.`,
        markets: []
      })
    }

    const itemName = rows[0].item_name
    const minPrice = Number(rows[0].price)
    const maxPrice = Number(rows[rows.length - 1].price)
    const spread   = maxPrice - minPrice
    const spreadPct = ((spread / minPrice) * 100).toFixed(1)

    const lines: string[] = [
      `🔍 *${itemName.toUpperCase()}* — Market Compare`,
      state ? `📍 ${state}` : '📍 All States',
      `━━━━━━━━━━━━━━━━━━━━━━`
    ]

    rows.forEach((r, i) => {
      const price = Number(r.price)
      const badge = i === 0 ? '🟢 CHEAPEST' : i === rows.length - 1 ? '🔴 PRICIEST' : '⚪'
      const diff  = i === 0 ? '' : ` (+₦${fmt(price - minPrice)})`
      lines.push(
        `${badge} *${r.market_name}*\n` +
        `   ${r.state} — *₦${fmt(price)}* ${r.unit || ''}${diff}`
      )
    })

    lines.push(`━━━━━━━━━━━━━━━━━━━━━━`)
    lines.push(`💡 Spread: ₦${fmt(spread)} (${spreadPct}%) across ${rows.length} markets`)
    if (Number(spreadPct) > 15) {
      lines.push(`✅ Arbitrage opportunity detected!`)
    }

    return NextResponse.json({
      success:   true,
      count:     rows.length,
      item:      itemName,
      formatted: lines.join('\n'),
      spread:    spread,
      spread_pct: Number(spreadPct),
      markets: rows.map(r => ({
        market_name: r.market_name,
        state:       r.state,
        price:       Number(r.price),
        unit:        r.unit,
        price_date:  r.price_date,
      }))
    })

  } catch (err) {
    console.error('[/api/whatsapp/compare]', err)
    return NextResponse.json({ success: false, error: String(err), useSheets: true }, { status: 500 })
  }
}

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-NG')
}
