/**
 * ============================================================================
 * NAIJAMARKET INTEL - WHATSAPP PRICE API
 * ============================================================================
 * Endpoint: GET /api/whatsapp/price
 * Purpose: Get current prices for item + market combination
 * Called by: Apps Script Consumer WebApp
 * 
 * Query Parameters:
 *   - item: Item name (partial match supported)
 *   - market: Market name (partial match supported)
 *   - state: State name (optional filter)
 *   - limit: Max results (default 5, max 20)
 * 
 * Response:
 *   - success: boolean
 *   - data: array of price records
 *   - formatted: WhatsApp-ready text message
 *   - count: number of results
 * ============================================================================
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Price trend emoji mapping
const TREND_EMOJI: Record<string, string> = {
  '↑': '📈',
  '↓': '📉',
  '→': '➡️',
  'UP': '📈',
  'DOWN': '📉',
  'STABLE': '➡️'
};

// Format price with Naira symbol
function formatPrice(price: number | string): string {
  const numPrice = typeof price === 'string' 
    ? parseFloat(price.replace(/[₦,]/g, '')) 
    : price;
  return `₦${numPrice.toLocaleString('en-NG')}`;
}

// Format date for display
function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-NG', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const item = searchParams.get("item");
    const market = searchParams.get("market");
    const state = searchParams.get("state");
    const limit = Math.min(parseInt(searchParams.get("limit") || "5"), 20);

    // Validate required parameters
    if (!item) {
      return NextResponse.json({
        success: false,
        error: "Missing 'item' parameter",
        hint: "Example: /api/whatsapp/price?item=rice&market=mile%2012"
      }, { status: 400 });
    }

    // Build dynamic WHERE clause
    let whereClause = `WHERE validation_status = 'APPROVED'`;
    const params: any[] = [];
    let paramIndex = 1;

    // Item filter (required)
    whereClause += ` AND item_name LIKE @p${paramIndex}`;
    params.push(`%${item}%`);
    paramIndex++;

    // Market filter (optional)
    if (market) {
      whereClause += ` AND market_name LIKE @p${paramIndex}`;
      params.push(`%${market}%`);
      paramIndex++;
    }

    // State filter (optional)
    if (state) {
      whereClause += ` AND state LIKE @p${paramIndex}`;
      params.push(`%${state}%`);
      paramIndex++;
    }

    // Execute query using raw SQL for Azure SQL Server compatibility
    const prices = await prisma.$queryRawUnsafe(`
      SELECT TOP ${limit}
        price_id,
        item_name,
        market_name,
        state,
        category_name,
        price,
        unit,
        price_trend,
        price_change_percent,
        submission_date,
        validated_at,
        confidence_score
      FROM Approved_Prices
      ${whereClause}
      ORDER BY validated_at DESC
    `, ...params) as any[];

    // Handle no results
    if (!prices || prices.length === 0) {
      const noResultMsg = market 
        ? `❌ No prices found for "${item}" in "${market}"\n\n💡 Try:\n• Check spelling\n• Use shorter names\n• Type "price rice" for all rice prices`
        : `❌ No prices found for "${item}"\n\n💡 Available items include:\nRice, Beans, Garri, Palm Oil, Tomatoes, Onions, Yam, Pepper`;
      
      return NextResponse.json({
        success: false,
        data: [],
        formatted: noResultMsg,
        count: 0,
        query: { item, market, state }
      });
    }

    // Format for WhatsApp
    const header = market 
      ? `💰 *PRICES: ${item.toUpperCase()}*\n📍 ${market}\n${'━'.repeat(25)}\n`
      : `💰 *PRICES: ${item.toUpperCase()}*\n${'━'.repeat(25)}\n`;

    const priceLines = prices.map((p: any, idx: number) => {
      const trendEmoji = TREND_EMOJI[p.price_trend] || '➡️';
      const changeText = p.price_change_percent 
        ? ` (${p.price_change_percent > 0 ? '+' : ''}${p.price_change_percent}%)`
        : '';
      
      return [
        `${idx + 1}. *${p.item_name}*`,
        `   📍 ${p.market_name}, ${p.state}`,
        `   💵 ${formatPrice(p.price)}/${p.unit}`,
        `   ${trendEmoji} ${p.price_trend}${changeText}`,
        `   📅 ${formatDate(p.validated_at)}`
      ].join('\n');
    }).join('\n\n');

    const footer = `\n${'━'.repeat(25)}\n📊 ${prices.length} result${prices.length > 1 ? 's' : ''} | Type "trend ${item}" for history`;

    const formatted = header + priceLines + footer;

    return NextResponse.json({
      success: true,
      data: prices,
      formatted: formatted,
      count: prices.length,
      query: { item, market, state, limit }
    });

  } catch (error) {
    console.error("WhatsApp Price API Error:", error);
    
    return NextResponse.json({
      success: false,
      error: "Database query failed",
      formatted: "⚠️ Sorry, we couldn't fetch prices right now. Please try again later.",
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// Also support POST for Apps Script compatibility
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = new URL(request.url);
    
    // Convert POST body to query params
    if (body.item) url.searchParams.set('item', body.item);
    if (body.market) url.searchParams.set('market', body.market);
    if (body.state) url.searchParams.set('state', body.state);
    if (body.limit) url.searchParams.set('limit', String(body.limit));
    
    // Create new request with params
    const newRequest = new NextRequest(url, { method: 'GET' });
    return GET(newRequest);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Invalid request body",
      formatted: "⚠️ Invalid request format"
    }, { status: 400 });
  }
}
