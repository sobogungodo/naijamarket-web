/**
 * ============================================================================
 * NAIJAMARKET INTEL - WHATSAPP SNAPSHOT API
 * ============================================================================
 * Endpoint: GET /api/whatsapp/snapshot
 * Purpose: Get market snapshot with top gainers/losers and summary stats
 * Called by: Apps Script Consumer WebApp
 * 
 * Query Parameters:
 *   - market: Specific market name (optional - if not specified, shows national)
 *   - state: Filter by state (optional)
 *   - category: Filter by category (optional)
 *   - limit: Number of items in gainers/losers (default 5)
 * 
 * Response:
 *   - success: boolean
 *   - stats: total items, markets, avg price change
 *   - gainers: top price increases
 *   - losers: top price decreases
 *   - formatted: WhatsApp-ready text message
 * ============================================================================
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get("market");
    const state = searchParams.get("state");
    const category = searchParams.get("category");
    const limit = Math.min(parseInt(searchParams.get("limit") || "5"), 10);

    // Build WHERE clause
    let whereClause = `WHERE validation_status = 'APPROVED' AND validated_at >= DATEADD(day, -7, GETDATE())`;
    const params: string[] = [];
    let paramIndex = 1;

    if (market) {
      whereClause += ` AND market_name LIKE @p${paramIndex}`;
      params.push(`%${market}%`);
      paramIndex++;
    }

    if (state) {
      whereClause += ` AND state LIKE @p${paramIndex}`;
      params.push(`%${state}%`);
      paramIndex++;
    }

    if (category) {
      whereClause += ` AND category_name LIKE @p${paramIndex}`;
      params.push(`%${category}%`);
      paramIndex++;
    }

    // Get summary statistics
    const statsResult = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(DISTINCT item_name) as total_items,
        COUNT(DISTINCT market_name) as total_markets,
        COUNT(DISTINCT state) as total_states,
        COUNT(*) as total_prices,
        AVG(CAST(price_change_percent AS DECIMAL(10,2))) as avg_change
      FROM Approved_Prices
      ${whereClause}
    `, ...params) as Array<{
      total_items: number;
      total_markets: number;
      total_states: number;
      total_prices: number;
      avg_change: number | null;
    }>;

    const stats = statsResult[0] || {
      total_items: 0,
      total_markets: 0,
      total_states: 0,
      total_prices: 0,
      avg_change: 0
    };

    // Get top gainers (highest price increases)
    const gainersResult = await prisma.$queryRawUnsafe(`
      SELECT TOP ${limit}
        item_name,
        market_name,
        state,
        price,
        unit,
        price_trend,
        price_change_percent,
        validated_at
      FROM Approved_Prices
      ${whereClause}
        AND price_change_percent > 0
      ORDER BY CAST(price_change_percent AS DECIMAL(10,2)) DESC
    `, ...params) as Array<{
      item_name: string;
      market_name: string;
      state: string;
      price: string;
      unit: string;
      price_trend: string;
      price_change_percent: string;
      validated_at: Date;
    }>;

    // Get top losers (biggest price drops)
    const losersResult = await prisma.$queryRawUnsafe(`
      SELECT TOP ${limit}
        item_name,
        market_name,
        state,
        price,
        unit,
        price_trend,
        price_change_percent,
        validated_at
      FROM Approved_Prices
      ${whereClause}
        AND price_change_percent < 0
      ORDER BY CAST(price_change_percent AS DECIMAL(10,2)) ASC
    `, ...params) as Array<{
      item_name: string;
      market_name: string;
      state: string;
      price: string;
      unit: string;
      price_trend: string;
      price_change_percent: string;
      validated_at: Date;
    }>;

    // Get most active items (most price submissions)
    const activeResult = await prisma.$queryRawUnsafe(`
      SELECT TOP 5
        item_name,
        COUNT(*) as submission_count,
        AVG(CAST(REPLACE(REPLACE(price, '₦', ''), ',', '') AS DECIMAL(18,2))) as avg_price
      FROM Approved_Prices
      ${whereClause}
      GROUP BY item_name
      ORDER BY COUNT(*) DESC
    `, ...params) as Array<{
      item_name: string;
      submission_count: number;
      avg_price: number;
    }>;

    // Get price by category
    const categoryResult = await prisma.$queryRawUnsafe(`
      SELECT 
        category_name,
        COUNT(*) as item_count,
        AVG(CAST(price_change_percent AS DECIMAL(10,2))) as avg_change
      FROM Approved_Prices
      ${whereClause}
      GROUP BY category_name
      ORDER BY avg_change DESC
    `, ...params) as Array<{
      category_name: string;
      item_count: number;
      avg_change: number | null;
    }>;

    // Handle no data
    if (stats.total_prices === 0) {
      return NextResponse.json({
        success: false,
        data: null,
        formatted: `❌ No recent price data found ${market ? `for ${market}` : state ? `in ${state}` : 'nationwide'}\n\n💡 Try:\n• Different market or state\n• Check back later for updates`,
        count: 0
      });
    }

    // Format for WhatsApp
    let formatted = '';
    
    // Header
    const scope = market || state || '🇳🇬 Nigeria';
    formatted += `📸 *MARKET SNAPSHOT*\n`;
    formatted += `📍 ${scope}\n`;
    formatted += `⏱️ Last 7 days\n`;
    formatted += `${'━'.repeat(28)}\n\n`;

    // Overall Stats
    const avgChangeNum = stats.avg_change || 0;
    formatted += `📊 *OVERVIEW*\n`;
    formatted += `├ Items tracked: ${stats.total_items}\n`;
    formatted += `├ Markets: ${stats.total_markets}\n`;
    formatted += `├ States: ${stats.total_states}\n`;
    formatted += `├ Price reports: ${stats.total_prices}\n`;
    formatted += `└ Avg change: ${avgChangeNum >= 0 ? '+' : ''}${avgChangeNum.toFixed(1)}%\n\n`;

    // Top Gainers
    if (gainersResult.length > 0) {
      formatted += `🔥 *TOP GAINERS*\n`;
      gainersResult.forEach((item, idx) => {
        formatted += `${idx + 1}. ${item.item_name}\n`;
        formatted += `   📈 +${parseFloat(item.price_change_percent).toFixed(1)}% @ ${item.market_name}\n`;
      });
      formatted += '\n';
    }

    // Top Losers
    if (losersResult.length > 0) {
      formatted += `📉 *PRICE DROPS*\n`;
      losersResult.forEach((item, idx) => {
        formatted += `${idx + 1}. ${item.item_name}\n`;
        formatted += `   📉 ${parseFloat(item.price_change_percent).toFixed(1)}% @ ${item.market_name}\n`;
      });
      formatted += '\n';
    }

    // Category Performance
    if (categoryResult.length > 0) {
      formatted += `📦 *BY CATEGORY*\n`;
      categoryResult.slice(0, 5).forEach((cat) => {
        const changeNum = cat.avg_change || 0;
        const emoji = changeNum > 0 ? '📈' : changeNum < 0 ? '📉' : '➡️';
        formatted += `├ ${cat.category_name}: ${changeNum >= 0 ? '+' : ''}${changeNum.toFixed(1)}% ${emoji}\n`;
      });
      formatted += '\n';
    }

    // Most Active Items
    if (activeResult.length > 0) {
      formatted += `🔄 *MOST TRADED*\n`;
      activeResult.slice(0, 3).forEach((item, idx) => {
        formatted += `${idx + 1}. ${item.item_name} (${item.submission_count} reports)\n`;
      });
      formatted += '\n';
    }

    // Footer
    formatted += `${'━'.repeat(28)}\n`;
    formatted += `📅 ${new Date().toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}\n`;
    formatted += `💡 Type "price [item]" for details`;

    return NextResponse.json({
      success: true,
      stats: {
        total_items: Number(stats.total_items) || 0,
        total_markets: Number(stats.total_markets) || 0,
        total_states: Number(stats.total_states) || 0,
        total_prices: Number(stats.total_prices) || 0,
        avg_change: Number(stats.avg_change) || 0
      },
      gainers: gainersResult.map((g) => ({
        item: g.item_name,
        market: g.market_name,
        state: g.state,
        price: g.price,
        change_percent: parseFloat(g.price_change_percent)
      })),
      losers: losersResult.map((l) => ({
        item: l.item_name,
        market: l.market_name,
        state: l.state,
        price: l.price,
        change_percent: parseFloat(l.price_change_percent)
      })),
      categories: categoryResult.map((c) => ({
        category: c.category_name,
        count: Number(c.item_count),
        avg_change: Number(c.avg_change) || 0
      })),
      active_items: activeResult.map((a) => ({
        item: a.item_name,
        submissions: Number(a.submission_count),
        avg_price: Number(a.avg_price)
      })),
      formatted: formatted,
      scope: { market, state, category }
    });

  } catch (error) {
    console.error("WhatsApp Snapshot API Error:", error);
    
    return NextResponse.json({
      success: false,
      error: "Snapshot generation failed",
      formatted: "⚠️ Sorry, we couldn't generate the market snapshot right now. Please try again later.",
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
    
    if (body.market) url.searchParams.set('market', body.market);
    if (body.state) url.searchParams.set('state', body.state);
    if (body.category) url.searchParams.set('category', body.category);
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
