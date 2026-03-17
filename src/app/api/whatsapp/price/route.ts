// src/app/api/whatsapp/price/route.ts
// GET /api/whatsapp/price?item=rice&market=mile+12&state=Lagos&limit=5
// Returns pre-formatted WhatsApp message + raw data
// Used by VercelIntegration.gs → getVercelPrice_()

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic    = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const item   = (searchParams.get('item')   || '').trim()
  const market = (searchParams.get('market') || '').trim()
  const state  = (searchParams.get('state')  || '').trim()
  const limit  = Math.min(10, Math.max(1, parseInt(searchParams.get('limit') || '5')))

  if (!item) {
    return NextResponse.json({ success: false, error: 'item required' }, { status: 400 })
  }

  try {
    const safeItem   = item.replace(/'/g, "''")
    const safeMarket = market.replace(/'/g, "''")
    const safeState  = state.replace(/'/g, "''")

    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT TOP ${limit}
        item_name, market_name, state,
        CAST(price_naira AS FLOAT) AS price,
        unit, price_date, data_source,
        CAST(confidence_score AS FLOAT) AS confidence
      FROM dbo.Latest_Prices_Summary
      WHERE item_name LIKE '%${safeItem}%'
        AND price_naira > 0
        ${safeMarket ? `AND market_name LIKE '%${safeMarket}%'` : ''}
        ${safeState  ? `AND state       LIKE '%${safeState}%'`  : ''}
      ORDER BY price_date DESC, confidence_score DESC
    `)

    if (!rows || rows.length === 0) {
      return NextResponse.json({
        success: false, count: 0,
        formatted: `❌ No prices found for *${item}*${market ? ` at ${market}` : ''}.`,
        prices: []
      })
    }

    // Format for WhatsApp
    const lines: string[] = [
      `💰 *${rows[0].item_name.toUpperCase()}* — Live Prices`,
      `━━━━━━━━━━━━━━━━━━━━━━`
    ]
    rows.forEach((r, i) => {
      const freshness = getFreshness(r.price_date)
      lines.push(
        `*${i + 1}.* ${r.market_name}\n` +
        `   ${r.state} — *₦${fmt(r.price)}* ${r.unit || ''}\n` +
        `   ${freshness} · ${r.data_source || 'Verified'}`
      )
    })
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━`)
    lines.push(`_Data: NaijaMarket Intel_`)

    return NextResponse.json({
      success: true,
      count: rows.length,
      item: rows[0].item_name,
      formatted: lines.join('\n'),
      prices: rows.map(r => ({
        market_name: r.market_name,
        state:       r.state,
        price:       Number(r.price),
        unit:        r.unit,
        price_date:  r.price_date,
        confidence:  Number(r.confidence),
      }))
    })

  } catch (err) {
    console.error('[/api/whatsapp/price]', err)
    return NextResponse.json({ success: false, error: String(err), useSheets: true }, { status: 500 })
  }
}

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-NG')
}

function getFreshness(dateVal: any): string {
  if (!dateVal) return '🟡 Unknown'
  const days = (Date.now() - new Date(dateVal).getTime()) / 86400000
  if (days < 1)  return '🟢 Today'
  if (days < 3)  return '🟢 ' + Math.floor(days) + 'd ago'
  if (days < 7)  return '🟡 ' + Math.floor(days) + 'd ago'
  return '🔴 ' + Math.floor(days) + 'd ago'
}
