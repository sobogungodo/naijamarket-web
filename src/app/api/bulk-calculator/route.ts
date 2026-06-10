// src/app/api/bulk-calculator/route.ts
// NaijaMarket Intel — Bulk Buyer Calculator API
// GET  /api/bulk-calculator?tier=GOLD   → items list + tier limits
// POST /api/bulk-calculator             → cart calculation across all markets

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

// ============================================================================
// TIER LIMITS
// ============================================================================

interface TierLimits {
  tier: string
  maxItems: number
  showSavings: boolean
  showOptimal: boolean
  canExport: boolean
}

function getTierLimits(tier: string): TierLimits {
  const t = (tier || 'FREE').toUpperCase()
  if (['CORPORATE', 'ENTERPRISE', 'OGA_BOSS', 'GOVERNMENT'].includes(t))
    return { tier: t, maxItems: 999, showSavings: true, showOptimal: true, canExport: true }
  if (t === 'BUSINESS')
    return { tier: t, maxItems: 20, showSavings: true, showOptimal: true, canExport: true }
  if (t === 'GOLD')
    return { tier: t, maxItems: 10, showSavings: true, showOptimal: true, canExport: true }
  if (t === 'SILVER')
    return { tier: t, maxItems: 5, showSavings: false, showOptimal: false, canExport: false }
  return { tier: 'FREE', maxItems: 3, showSavings: false, showOptimal: false, canExport: false }
}

// ============================================================================
// GET — items list for the item picker
// ============================================================================

export async function GET(req: NextRequest) {
  const tier = req.nextUrl.searchParams.get('tier') || 'FREE'
  const limits = getTierLimits(tier)

  try {
    const rows = await prisma.$queryRaw<{
      item_id: string
      item_name: string
      category_name: string | null
      unit: string | null
    }[]>(
      Prisma.sql`
        SELECT DISTINCT
          item_id,
          item_name,
          COALESCE(category_name, category_id) AS category_name,
          unit
        FROM dbo.Latest_Prices_Summary
        WHERE is_nbs_ref = 0
          AND is_food = 1
          AND item_name IS NOT NULL
          AND item_name != ''
          AND price_naira > 0
        ORDER BY category_name, item_name
      `
    )

    return NextResponse.json({
      success: true,
      items: rows.map(r => ({
        id: r.item_id,
        name: r.item_name,
        category: r.category_name ?? 'Other',
        unit: r.unit ?? 'unit',
      })),
      tierLimits: limits,
    })
  } catch (err) {
    console.error('[bulk-calculator] GET error:', err)
    return NextResponse.json({ success: false, error: 'Failed to load items' }, { status: 500 })
  }
}

// ============================================================================
// POST — calculate bulk order
// ============================================================================

interface CartItem {
  item: string
  quantity: number
  unit: string
}

interface MarketRow {
  market_name: string
  market_id: string
  state: string
  price_naira: number
}

const nairaFmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const cart: CartItem[] = body.cart || []
    const tier: string = body.tier || 'FREE'
    const limits = getTierLimits(tier)

    if (!cart.length) {
      return NextResponse.json({ success: false, error: 'Cart is empty' }, { status: 400 })
    }

    // Enforce tier item cap
    const cappedCart = cart.slice(0, limits.maxItems)

    // ── Parallel: fetch market prices per cart item ──
    const allMarketPrices: MarketRow[][] = await Promise.all(
      cappedCart.map(cartItem =>
        prisma.$queryRaw<{ market_name: string; market_id: string; state: string; price_naira: unknown }[]>(
          Prisma.sql`
            SELECT market_name, market_id, state, price_naira
            FROM dbo.Latest_Prices_Summary
            WHERE item_name = ${cartItem.item}
              AND is_nbs_ref = 0
              AND is_food = 1
              AND price_naira > 0
            ORDER BY price_naira ASC
          `
        ).then(rows =>
          rows.map(r => ({
            market_name: r.market_name,
            market_id: r.market_id,
            state: r.state,
            price_naira: Number(r.price_naira),
          }))
        )
      )
    )

    // ── Build item breakdowns ──
    type Breakdown = {
      item: string
      quantity: number
      unit: string
      avgPrice: number
      minPrice: number
      maxPrice: number
      priceRange: number
      marketQuotes: {
        market: string; marketId: string; state: string; region: string
        unitPrice: number; totalPrice: number; available: boolean
        priceRank: number; savingsVsAvg: number; savingsPercent: number
      }[]
      bestMarket: { market: string; price: number; savings: number } | null
      worstMarket: { market: string; price: number; premium: number } | null
    }

    const itemBreakdowns: Breakdown[] = []

    for (let i = 0; i < cappedCart.length; i++) {
      const cartItem = cappedCart[i]!
      const marketPrices = allMarketPrices[i] ?? []
      if (!marketPrices.length) continue

      const prices = marketPrices.map(m => m.price_naira)
      const minPrice = prices[0]!                                   // already sorted ASC
      const maxPrice = prices[prices.length - 1]!
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length

      const marketQuotes = marketPrices.map((m, qIdx) => ({
        market: m.market_name,
        marketId: m.market_id,
        state: m.state,
        region: m.state,                                            // state used as region proxy
        unitPrice: m.price_naira,
        totalPrice: m.price_naira * cartItem.quantity,
        available: true,
        priceRank: qIdx + 1,
        savingsVsAvg: (avgPrice - m.price_naira) * cartItem.quantity,
        savingsPercent: avgPrice > 0 ? ((avgPrice - m.price_naira) / avgPrice) * 100 : 0,
      }))

      const cheapest = marketPrices[0]!
      const mostExpensive = marketPrices[marketPrices.length - 1]!

      itemBreakdowns.push({
        item: cartItem.item,
        quantity: cartItem.quantity,
        unit: cartItem.unit,
        avgPrice,
        minPrice,
        maxPrice,
        priceRange: maxPrice - minPrice,
        marketQuotes,
        bestMarket: {
          market: cheapest.market_name,
          price: cheapest.price_naira,
          savings: (avgPrice - cheapest.price_naira) * cartItem.quantity,
        },
        worstMarket: mostExpensive !== cheapest ? {
          market: mostExpensive.market_name,
          price: mostExpensive.price_naira,
          premium: (mostExpensive.price_naira - avgPrice) * cartItem.quantity,
        } : null,
      })
    }

    // ── Cart summary ──
    const totalQuantity = cappedCart.reduce((s, c) => s + c.quantity, 0)
    const estimatedCost = itemBreakdowns.reduce((s, b) => s + b.avgPrice * b.quantity, 0)
    const minCost = itemBreakdowns.reduce((s, b) => s + b.minPrice * b.quantity, 0)
    const potentialSavings = estimatedCost - minCost

    // ── Optimal strategy ──
    type OptimalPurchase = { item: string; quantity: number; market: string; unitPrice: number; totalPrice: number }
    let optimalStrategy = null

    if (limits.showOptimal && itemBreakdowns.length) {
      const purchases: OptimalPurchase[] = itemBreakdowns.map(b => ({
        item: b.item,
        quantity: b.quantity,
        market: b.marketQuotes[0]!.market,
        unitPrice: b.marketQuotes[0]!.unitPrice,
        totalPrice: b.marketQuotes[0]!.totalPrice,
      }))

      const marketMap: Record<string, { items: number; subtotal: number }> = {}
      for (const p of purchases) {
        if (!marketMap[p.market]) marketMap[p.market] = { items: 0, subtotal: 0 }
        marketMap[p.market]!.items++
        marketMap[p.market]!.subtotal += p.totalPrice
      }

      const totalOptimalCost = purchases.reduce((s, p) => s + p.totalPrice, 0)
      optimalStrategy = {
        totalCost: totalOptimalCost,
        totalSavings: estimatedCost - totalOptimalCost,
        savingsPercent: estimatedCost > 0
          ? Math.round(((estimatedCost - totalOptimalCost) / estimatedCost) * 100) : 0,
        purchases,
        marketBreakdown: Object.entries(marketMap)
          .map(([market, d]) => ({ market, items: d.items, subtotal: d.subtotal }))
          .sort((a, b) => b.subtotal - a.subtotal),
      }
    }

    // ── Single-market comparison ──
    const marketCoverage: Record<string, { total: number; count: number }> = {}
    for (const b of itemBreakdowns) {
      for (const q of b.marketQuotes) {
        if (!marketCoverage[q.market]) marketCoverage[q.market] = { total: 0, count: 0 }
        marketCoverage[q.market]!.total += q.totalPrice
        marketCoverage[q.market]!.count++
      }
    }

    const optimalTotal = optimalStrategy?.totalCost ?? minCost
    const singleMarketComparison = Object.entries(marketCoverage)
      .map(([market, d]) => ({
        market,
        totalCost: d.total,
        itemsAvailable: d.count,
        vsOptimal: Math.max(0, d.total - optimalTotal),
      }))
      .sort((a, b) => a.totalCost - b.totalCost)
      .slice(0, 10)

    // Best single market gets vsOptimal = 0
    if (singleMarketComparison[0]) singleMarketComparison[0].vsOptimal = 0

    // ── Insights ──
    const insights: { type: string; message: string; impact: 'high' | 'medium' | 'low' }[] = []

    if (limits.showSavings && itemBreakdowns.length) {
      // Highest variance item
      const highestVar = [...itemBreakdowns]
        .sort((a, b) => (b.priceRange / b.avgPrice) - (a.priceRange / a.avgPrice))[0]
      if (highestVar && highestVar.avgPrice > 0 && (highestVar.priceRange / highestVar.avgPrice) > 0.15) {
        insights.push({
          type: 'variance',
          message: `${highestVar.item} varies by ${Math.round((highestVar.priceRange / highestVar.avgPrice) * 100)}% across markets — from ${nairaFmt(highestVar.minPrice)} to ${nairaFmt(highestVar.maxPrice)}. Always shop around for this one.`,
          impact: 'high',
        })
      }

      // Optimal savings summary
      if (optimalStrategy && optimalStrategy.totalSavings > 0) {
        insights.push({
          type: 'savings',
          message: `Buying each item from its cheapest market saves you ${nairaFmt(optimalStrategy.totalSavings)} (${optimalStrategy.savingsPercent}%) vs average prices across all markets.`,
          impact: 'high',
        })
      }

      // Convenience vs optimal trade-off
      const best1 = singleMarketComparison[0]
      if (best1 && optimalStrategy && best1.itemsAvailable >= cappedCart.length) {
        const extraCost = best1.totalCost - optimalStrategy.totalCost
        if (extraCost > 0) {
          insights.push({
            type: 'convenience',
            message: `${best1.market} has all your items. One-stop shopping costs ${nairaFmt(extraCost)} more than the optimal split-market strategy.`,
            impact: 'medium',
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      cartSummary: {
        totalItems: itemBreakdowns.length,
        totalQuantity,
        estimatedCost,
        potentialSavings,
        savingsPercent: estimatedCost > 0
          ? Math.round((potentialSavings / estimatedCost) * 100) : 0,
      },
      itemBreakdowns,
      optimalStrategy,
      singleMarketComparison,
      insights,
      tierLimits: limits,
      dataSource: 'Latest_Prices_Summary',
      recordCount: itemBreakdowns.reduce((s, b) => s + b.marketQuotes.length, 0),
    })
  } catch (err) {
    console.error('[bulk-calculator] POST error:', err)
    return NextResponse.json({ success: false, error: 'Calculation failed' }, { status: 500 })
  }
}
