// src/app/api/whatsapp/nfpi/route.ts
// GET /api/whatsapp/nfpi?region=ALL&tier=FREE
// NaijaMarket Food Price Index — WhatsApp formatted
// Used by VercelIntegration.gs → getVercelNFPI_()

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic    = 'force-dynamic'
export const revalidate = 0

const REGION_STATES: Record<string, string[]> = {
  SW: ['Lagos','Ogun','Oyo','Osun','Ondo','Ekiti'],
  SE: ['Anambra','Enugu','Ebonyi','Imo','Abia'],
  SS: ['Rivers','Bayelsa','Delta','Edo','Cross River','Akwa Ibom'],
  NW: ['Kano','Kaduna','Katsina','Jigawa','Zamfara','Sokoto','Kebbi'],
  NE: ['Borno','Yobe','Gombe','Bauchi','Taraba','Adamawa'],
  NC: ['Kwara','Niger','Kogi','Benue','Plateau','Nasarawa','FCT'],
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const region = (searchParams.get('region') || 'ALL').toUpperCase()
  const tier   = (searchParams.get('tier')   || 'FREE').toUpperCase()

  try {
    // Core basket: staple food items
    const basket = ['Rice','Beans','Garri','Tomato','Onion','Palm Oil','Yam','Maize','Pepper']
    const safeBasket = basket.map(b => `'${b}'`).join(',')

    // Build state filter
    let stateFilter = ''
    if (region !== 'ALL' && REGION_STATES[region]) {
      const states = REGION_STATES[region].map(s => `'${s}'`).join(',')
      stateFilter = `AND state IN (${states})`
    }

    // Get current basket prices
    const currentRows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        LEFT(item_name, 20)            AS item_name,
        CAST(AVG(price_naira) AS FLOAT) AS avg_price,
        MIN(state)                      AS sample_state,
        COUNT(DISTINCT market_name)     AS market_count
      FROM dbo.Latest_Prices_Summary
      WHERE price_naira > 0
        AND (${basket.map(b => `item_name LIKE '%${b}%'`).join(' OR ')})
        ${stateFilter}
      GROUP BY LEFT(item_name, 20)
      ORDER BY LEFT(item_name, 20)
    `)

    // Get last month average for comparison
    const prevMonthRows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        CAST(AVG(avg_price) AS FLOAT) AS prev_avg
      FROM dbo.Historical_Monthly_Summary
      WHERE (${basket.map(b => `item_name LIKE '%${b}%'`).join(' OR ')})
        ${stateFilter}
        AND yr = YEAR(DATEADD(month, -1, GETDATE()))
        AND mth = MONTH(DATEADD(month, -1, GETDATE()))
        AND avg_price > 0
    `).catch(() => [])

    if (!currentRows || currentRows.length === 0) {
      return NextResponse.json({
        success: false, count: 0,
        formatted: '❌ NFPI data unavailable. Try again later.',
      })
    }

    // Compute simple index (average of all basket items)
    const totalPrice = currentRows.reduce((s, r) => s + Number(r.avg_price), 0)
    const avgBasket  = totalPrice / currentRows.length
    const prevAvg    = prevMonthRows?.[0] ? Number(prevMonthRows[0].prev_avg) : 0
    const momChange  = prevAvg > 0 ? ((avgBasket - prevAvg) / prevAvg * 100) : 0
    const trendArrow = momChange > 1 ? '📈' : momChange < -1 ? '📉' : '➡️'

    const regionLabel = region === 'ALL' ? 'National' : region + ' Zone'
    const now = new Date()
    const dateStr = now.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })

    const lines: string[] = [
      `📊 *NAIJAMARKET FOOD PRICE INDEX*`,
      `${regionLabel} · ${dateStr}`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `*Basket Average:* ₦${fmt(avgBasket)}`,
      prevAvg > 0 ? `*Month-on-Month:* ${trendArrow} ${momChange > 0 ? '+' : ''}${momChange.toFixed(1)}%` : '',
      ``,
      `*Key Staples:*`
    ]

    // Show basket items (limit based on tier)
    const showCount = tier === 'FREE' ? 4 : tier === 'SILVER' ? 6 : currentRows.length
    currentRows.slice(0, showCount).forEach(r => {
      lines.push(`  • ${r.item_name}: *₦${fmt(Number(r.avg_price))}*`)
    })

    if (currentRows.length > showCount) {
      const hiddenCount = currentRows.length - showCount
      lines.push(`  _+${hiddenCount} more items (upgrade to see all)_`)
    }

    lines.push(`━━━━━━━━━━━━━━━━━━━━━━`)
    lines.push(`_${currentRows.reduce((s, r) => s + (r.market_count || 0), 0)} market readings_`)

    return NextResponse.json({
      success:   true,
      count:     currentRows.length,
      formatted: lines.filter(l => l !== '').join('\n'),
      index: {
        value:       Math.round(avgBasket),
        region:      regionLabel,
        mom_change:  Number(momChange.toFixed(2)),
        basket_size: currentRows.length,
        date:        now.toISOString(),
      },
      basket: currentRows.map(r => ({
        item:   r.item_name,
        price:  Number(r.avg_price),
        markets: r.market_count,
      }))
    })

  } catch (err) {
    console.error('[/api/whatsapp/nfpi]', err)
    return NextResponse.json({ success: false, error: String(err), useSheets: true }, { status: 500 })
  }
}

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-NG')
}
