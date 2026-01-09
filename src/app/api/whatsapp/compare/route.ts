/**
 * ============================================================================
 * NAIJAMARKET INTEL - WHATSAPP COMPARE API
 * ============================================================================
 * Endpoint: GET /api/whatsapp/compare
 * Purpose: Compare prices for an item across different markets
 * Called by: Apps Script Consumer WebApp
 * 
 * Query Parameters:
 *   - item: Item name (required)
 *   - markets: Comma-separated market names (optional - if not specified, shows top markets)
 *   - state: Filter by state (optional)
 *   - limit: Max markets to compare (default 5, max 10)
 * 
 * Response:
 *   - success: boolean
 *   - data: array of market prices sorted by price
 *   - stats: cheapest, expensive, savings potential
 *   - formatted: WhatsApp-ready text message
 * ============================================================================
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Format price with Naira symbol
function formatPrice(price: number | string): string {
  const numPrice = typeof price === 'string' 
    ? parseFloat(price.replace(/[₦,]/g, '')) 
    : price;
  return `₦${numPrice.toLocaleString('en-NG')}`;
}

// Get medal emoji based on rank
function getMedal(rank: number): string {
  switch(rank) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return `${rank}.`;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const item = searchParams.get("item");
    const marketsParam = searchParams.get("markets");
    const state = searchParams.get("state");
    const limit = Math.min(parseInt(searchParams.get("limit") || "5"), 10);

    // Validate required parameters
    if (!item) {
      return NextResponse.json({
        success: false,
        error: "Missing 'item' parameter",
        hint: "Example: /api/whatsapp/compare?item=rice&limit=5"
      }, { status: 400 });
    }

    // Build WHERE clause
    let whereClause = `WHERE validation_status = 'APPROVED' AND item_name LIKE @p1`;
    const params: any[] = [`%${item}%`];
    let paramIndex = 2;

    // Filter by specific markets if provided
    if (marketsParam) {
      const markets = marketsParam.split(',').map(m => m.trim());
      const marketConditions = markets.map((_, i) => `market_name LIKE @p${paramIndex + i}`);
      whereClause += ` AND (${marketConditions.join(' OR ')})`;
      markets.forEach(m => params.push(`%${m}%`));
      paramIndex += markets.length;
    }

    // Filter by state if provided
    if (state) {
      whereClause += ` AND state LIKE @p${paramIndex}`;
      params.push(`%${state}%`);
      paramIndex++;
    }

    // Query: Get latest price per market (using subquery for most recent)
    const marketPrices = await prisma.$queryRawUnsafe(`
      WITH LatestPrices AS (
        SELECT 
          market_name,
          state,
          item_name,
          price,
          unit,
          price_trend,
          price_change_percent,
          validated_at,
          ROW_NUMBER() OVER (PARTITION BY market_name ORDER BY validated_at DESC) as rn
        FROM Approved_Prices
        ${whereClause}
      )
      SELECT TOP ${limit}
        market_name,
        state,
        item_name,
        price,
        unit,
        price_trend,
        price_change_percent,
        validated_at
      FROM LatestPrices
      WHERE rn = 1
      ORDER BY 
        CAST(REPLACE(REPLACE(price, '₦', ''), ',', '') AS DECIMAL(18,2)) ASC
    `, ...params) as any[];

    // Handle no results
    if (!marketPrices || marketPrices.length === 0) {
      return NextResponse.json({
        success: false,
        data: [],
        formatted: `❌ No prices found for "${item}" to compare\n\n💡 Try:\n• Check item spelling\n• Use broader search: compare rice\n• Specify state: compare rice lagos`,
        count: 0
      });
    }

    // Calculate statistics
    const prices = marketPrices.map((p: any) => 
      typeof p.price === 'string' ? parseFloat(p.price.replace(/[₦,]/g, '')) : p.price
    );
    
    const cheapest = Math.min(...prices);
    const expensive = Math.max(...prices);
    const average = prices.reduce((a, b) => a + b, 0) / prices.length;
    const savings = expensive - cheapest;
    const savingsPercent = ((savings / expensive) * 100).toFixed(1);

    // Find best and worst markets
    const cheapestMarket = marketPrices[0];
    const expensiveMarket = marketPrices[marketPrices.length - 1];

    // Format for WhatsApp
    const header = state 
      ? `🏪 *MARKET COMPARISON: ${item.toUpperCase()}*\n📍 ${state} State\n${'━'.repeat(25)}\n`
      : `🏪 *MARKET COMPARISON: ${item.toUpperCase()}*\n🇳🇬 Nationwide\n${'━'.repeat(25)}\n`;

    const rankingSection = marketPrices.map((p: any, idx: number) => {
      const priceNum = typeof p.price === 'string' ? parseFloat(p.price.replace(/[₦,]/g, '')) : p.price;
      const diffFromCheapest = priceNum - cheapest;
      const diffText = diffFromCheapest > 0 ? ` (+${formatPrice(diffFromCheapest)})` : ' ✨ CHEAPEST';
      
      return [
        `${getMedal(idx + 1)} *${p.market_name}*`,
        `   📍 ${p.state}`,
        `   💵 ${formatPrice(priceNum)}/${p.unit}${diffText}`
      ].join('\n');
    }).join('\n\n');

    const statsSection = [
      `\n${'━'.repeat(25)}`,
      `📊 *PRICE ANALYSIS*`,
      `├ Cheapest: ${formatPrice(cheapest)} @ ${cheapestMarket.market_name}`,
      `├ Highest:  ${formatPrice(expensive)} @ ${expensiveMarket.market_name}`,
      `├ Average:  ${formatPrice(average)}`,
      `└ Spread:   ${formatPrice(savings)} (${savingsPercent}%)`
    ].join('\n');

    const savingsNote = savings > 0 
      ? `\n\n💡 *SAVINGS TIP*\nBuy from ${cheapestMarket.market_name} to save ${formatPrice(savings)} per ${cheapestMarket.unit}!`
      : '';

    const footer = `\n${'━'.repeat(25)}\n🔍 Type "price ${item} ${cheapestMarket.market_name}" for more details`;

    const formatted = header + rankingSection + statsSection + savingsNote + footer;

    return NextResponse.json({
      success: true,
      data: marketPrices,
      stats: {
        cheapest: {
          price: cheapest,
          market: cheapestMarket.market_name,
          state: cheapestMarket.state
        },
        expensive: {
          price: expensive,
          market: expensiveMarket.market_name,
          state: expensiveMarket.state
        },
        average: Math.round(average),
        savings: savings,
        savings_percent: parseFloat(savingsPercent),
        markets_compared: marketPrices.length
      },
      formatted: formatted,
      count: marketPrices.length
    });

  } catch (error) {
    console.error("WhatsApp Compare API Error:", error);
    
    return NextResponse.json({
      success: false,
      error: "Database query failed",
      formatted: "⚠️ Sorry, we couldn't compare prices right now. Please try again later.",
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// POST support for Apps Script
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = new URL(request.url);
    
    if (body.item) url.searchParams.set('item', body.item);
    if (body.markets) url.searchParams.set('markets', body.markets);
    if (body.state) url.searchParams.set('state', body.state);
    if (body.limit) url.searchParams.set('limit', String(body.limit));
    
    const newRequest = new NextRequest(url, { method: 'GET' });
    return GET(newRequest);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Invalid request body"
    }, { status: 400 });
  }
}
