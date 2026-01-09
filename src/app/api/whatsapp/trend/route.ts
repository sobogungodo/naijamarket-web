/**
 * ============================================================================
 * NAIJAMARKET INTEL - WHATSAPP TREND API
 * ============================================================================
 * Endpoint: GET /api/whatsapp/trend
 * Purpose: Get price history and trends for an item
 * Called by: Apps Script Consumer WebApp
 * 
 * Query Parameters:
 *   - item: Item name (required)
 *   - market: Market name (optional - if not specified, shows national average)
 *   - period: Time period - 7d, 30d, 90d, 1y (default: 30d)
 *   - state: State filter (optional)
 * 
 * Response:
 *   - success: boolean
 *   - data: array of historical prices
 *   - stats: min, max, avg, change
 *   - formatted: WhatsApp-ready text message
 * ============================================================================
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Period to days mapping
const PERIOD_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
  'week': 7,
  'month': 30,
  'quarter': 90,
  'year': 365
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
    month: 'short'
  });
}

// Calculate trend direction
function getTrendIndicator(change: number): string {
  if (change > 5) return '📈 Strongly Up';
  if (change > 0) return '📈 Up';
  if (change < -5) return '📉 Strongly Down';
  if (change < 0) return '📉 Down';
  return '➡️ Stable';
}

// Generate simple ASCII chart
function generateSparkline(prices: number[]): string {
  if (prices.length < 2) return '';
  
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  
  const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  
  return prices.map(p => {
    const normalized = (p - min) / range;
    const index = Math.min(Math.floor(normalized * 8), 7);
    return blocks[index];
  }).join('');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const item = searchParams.get("item");
    const market = searchParams.get("market");
    const state = searchParams.get("state");
    const periodParam = searchParams.get("period") || "30d";
    
    // Validate required parameters
    if (!item) {
      return NextResponse.json({
        success: false,
        error: "Missing 'item' parameter",
        hint: "Example: /api/whatsapp/trend?item=rice&period=30d"
      }, { status: 400 });
    }

    // Parse period
    const days = PERIOD_DAYS[periodParam.toLowerCase()] || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build WHERE clause
    let whereClause = `WHERE validation_status = 'APPROVED' AND item_name LIKE @p1 AND submission_date >= @p2`;
    const params: any[] = [`%${item}%`, startDate.toISOString()];
    let paramIndex = 3;

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

    // Query historical prices
    const historicalPrices = await prisma.$queryRawUnsafe(`
      SELECT 
        item_name,
        market_name,
        state,
        price,
        unit,
        submission_date,
        price_trend
      FROM Approved_Prices
      ${whereClause}
      ORDER BY submission_date ASC
    `, ...params) as any[];

    // Also check Price_History_NBS for more historical data
    let nbsHistory: any[] = [];
    try {
      nbsHistory = await prisma.$queryRawUnsafe(`
        SELECT TOP 100
          item_name,
          price,
          price_date,
          state,
          market_name
        FROM Price_History_NBS
        WHERE item_name LIKE @p1 
          AND price_date >= @p2
        ORDER BY price_date ASC
      `, `%${item}%`, startDate.toISOString()) as any[];
    } catch (e) {
      // Table might not exist yet or be empty - continue with Approved_Prices only
      console.log("NBS history not available:", e);
    }

    // Combine and process data
    const allPrices = [
      ...historicalPrices.map((p: any) => ({
        ...p,
        priceNum: typeof p.price === 'string' ? parseFloat(p.price.replace(/[₦,]/g, '')) : p.price,
        date: new Date(p.submission_date),
        source: 'crowdsourced'
      })),
      ...nbsHistory.map((p: any) => ({
        ...p,
        priceNum: typeof p.price === 'string' ? parseFloat(p.price.replace(/[₦,]/g, '')) : p.price,
        date: new Date(p.price_date),
        source: 'nbs'
      }))
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    // Handle no results
    if (allPrices.length === 0) {
      return NextResponse.json({
        success: false,
        data: [],
        formatted: `❌ No price history found for "${item}" in the last ${days} days\n\n💡 Try:\n• Different time period: trend ${item} 90d\n• Check spelling of item name`,
        count: 0
      });
    }

    // Calculate statistics
    const prices = allPrices.map(p => p.priceNum);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const changePercent = ((lastPrice - firstPrice) / firstPrice * 100).toFixed(1);
    const changeAmount = lastPrice - firstPrice;

    // Get unique markets for context
    const uniqueMarkets = [...new Set(allPrices.map(p => p.market_name))];
    const uniqueStates = [...new Set(allPrices.map(p => p.state))];

    // Generate sparkline
    const sparkline = generateSparkline(prices.slice(-20)); // Last 20 data points

    // Format for WhatsApp
    const header = market 
      ? `📈 *PRICE TREND: ${item.toUpperCase()}*\n📍 ${market}\n⏱️ Last ${days} days\n${'━'.repeat(25)}\n`
      : `📈 *PRICE TREND: ${item.toUpperCase()}*\n🇳🇬 National Average\n⏱️ Last ${days} days\n${'━'.repeat(25)}\n`;

    const statsSection = [
      `\n📊 *STATISTICS*`,
      `├ Current: ${formatPrice(lastPrice)}`,
      `├ Average: ${formatPrice(avgPrice)}`,
      `├ Lowest:  ${formatPrice(minPrice)}`,
      `├ Highest: ${formatPrice(maxPrice)}`,
      `└ Change:  ${changeAmount >= 0 ? '+' : ''}${formatPrice(changeAmount)} (${changeAmount >= 0 ? '+' : ''}${changePercent}%)`
    ].join('\n');

    const trendSection = [
      `\n📉 *TREND*`,
      `${sparkline}`,
      `${getTrendIndicator(parseFloat(changePercent))}`
    ].join('\n');

    const coverageSection = uniqueMarkets.length > 1 
      ? `\n\n📍 *COVERAGE*\n${uniqueMarkets.length} markets across ${uniqueStates.length} state${uniqueStates.length > 1 ? 's' : ''}`
      : '';

    const dataSourceNote = nbsHistory.length > 0 
      ? `\n\n📚 Data: ${historicalPrices.length} crowdsourced + ${nbsHistory.length} NBS records`
      : `\n\n📚 Data: ${allPrices.length} price records`;

    const footer = `\n${'━'.repeat(25)}\n💡 Type "compare ${item}" to see market differences`;

    const formatted = header + statsSection + trendSection + coverageSection + dataSourceNote + footer;

    return NextResponse.json({
      success: true,
      data: allPrices.slice(-50), // Return last 50 data points
      stats: {
        min: minPrice,
        max: maxPrice,
        avg: Math.round(avgPrice),
        first: firstPrice,
        last: lastPrice,
        change_percent: parseFloat(changePercent),
        change_amount: changeAmount,
        data_points: allPrices.length,
        period_days: days
      },
      formatted: formatted,
      count: allPrices.length,
      markets: uniqueMarkets,
      states: uniqueStates
    });

  } catch (error) {
    console.error("WhatsApp Trend API Error:", error);
    
    return NextResponse.json({
      success: false,
      error: "Database query failed",
      formatted: "⚠️ Sorry, we couldn't fetch trend data right now. Please try again later.",
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
    if (body.market) url.searchParams.set('market', body.market);
    if (body.state) url.searchParams.set('state', body.state);
    if (body.period) url.searchParams.set('period', body.period);
    
    const newRequest = new NextRequest(url, { method: 'GET' });
    return GET(newRequest);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Invalid request body"
    }, { status: 400 });
  }
}
