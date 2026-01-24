// ============================================================================
// src/app/api/prices/history/route.ts
// NaijaMarket Intel - Price History API
// Data Source Priority: Google Sheets → Azure SQL → Mock Data
// Bloomberg Equivalent: HP <GO>
// Version: 3.0.0 - Google Sheets Primary
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// CONFIGURATION
// ============================================================================

const GOOGLE_SHEET_ID = "1n-7MXdoqvIoSHteBJaUYBmIPLjJBNtrE_jVuUxO5kr8";
const HISTORY_SHEET = "Daily_Prices"; // or "Price_History_NBS"

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface PriceHistoryPoint {
  date: string;
  price: number;
  trend: string;
  source: string;
}

interface PriceStatistics {
  current: number;
  high: number;
  low: number;
  average: number;
  change: number;
  changePercent: number;
  volatility: number;
  dataPoints: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const squaredDiffs = prices.map(price => Math.pow(price - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / prices.length;
  return Number(((Math.sqrt(avgSquaredDiff) / mean) * 100).toFixed(2));
}

function getDaysFromPeriod(period: string): number {
  switch (period) {
    case "7d": return 7;
    case "30d": return 30;
    case "90d": return 90;
    case "1y": return 365;
    default: return 30;
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result.map(v => v.replace(/^"|"$/g, ""));
}

// ============================================================================
// GOOGLE SHEETS FETCHER
// ============================================================================

async function fetchHistoryFromSheets(
  item: string,
  market: string,
  days: number
): Promise<PriceHistoryPoint[]> {
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(HISTORY_SHEET)}`;
    
    const response = await fetch(csvUrl, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      console.log("Google Sheets History fetch failed");
      return [];
    }

    const csvText = await response.text();
    const lines = csvText.split("\n").filter(line => line.trim());
    
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]);
    
    // Find column indices
    const findCol = (names: string[]) => {
      for (const name of names) {
        const idx = headers.findIndex(h => 
          h.toLowerCase().includes(name.toLowerCase())
        );
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const itemIdx = findCol(["item_name", "item"]);
    const marketIdx = findCol(["market_name", "market"]);
    const priceIdx = findCol(["price_naira", "price"]);
    const dateIdx = findCol(["price_date", "date", "observation_date"]);
    const trendIdx = findCol(["trend"]);

    const itemLower = item.toLowerCase();
    const marketLower = market.toLowerCase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const history: PriceHistoryPoint[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      
      // Match item and market
      const rowItem = (row[itemIdx] || "").toLowerCase();
      const rowMarket = (row[marketIdx] || "").toLowerCase();
      
      if (!rowItem.includes(itemLower) || !rowMarket.includes(marketLower)) {
        continue;
      }

      // Parse date
      const dateStr = row[dateIdx];
      if (!dateStr) continue;
      
      const rowDate = new Date(dateStr);
      if (isNaN(rowDate.getTime()) || rowDate < cutoffDate) continue;

      // Parse price
      const price = parseFloat(row[priceIdx]);
      if (isNaN(price) || price <= 0) continue;

      history.push({
        date: rowDate.toISOString().substring(0, 10),
        price: price,
        trend: row[trendIdx] || "stable",
        source: "sheets",
      });
    }

    // Sort by date
    history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    console.log(`✅ Found ${history.length} history points from Google Sheets`);
    return history;

  } catch (error) {
    console.error("Google Sheets History error:", error);
    return [];
  }
}

// ============================================================================
// DATABASE FETCHER (BACKUP)
// ============================================================================

async function fetchHistoryFromDatabase(
  item: string,
  market: string,
  days: number
): Promise<PriceHistoryPoint[]> {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Try to fetch from a historical prices table
    // This assumes you have a daily_prices or similar table
    const results = await prisma.$queryRaw`
      SELECT 
        CAST(price_date AS DATE) as date,
        AVG(price_naira) as price,
        'database' as source
      FROM Daily_Prices
      WHERE item_name LIKE ${`%${item}%`}
        AND market_name LIKE ${`%${market}%`}
        AND price_date >= ${cutoffDate}
      GROUP BY CAST(price_date AS DATE)
      ORDER BY date ASC
    ` as any[];

    await prisma.$disconnect();

    if (!results || results.length === 0) return [];

    return results.map((r: any) => ({
      date: r.date instanceof Date ? r.date.toISOString().substring(0, 10) : String(r.date).substring(0, 10),
      price: Number(r.price),
      trend: "stable",
      source: "database",
    }));

  } catch (error) {
    console.error("Database History error:", error);
    return [];
  }
}

// ============================================================================
// MOCK DATA GENERATOR (FALLBACK)
// ============================================================================

function generateMockHistory(item: string, _market: string, days: number): PriceHistoryPoint[] {
  const basePrices: Record<string, number> = {
    "rice": 78000,
    "beans": 62000,
    "garri": 28000,
    "palm oil": 52000,
    "palm": 52000,
    "tomatoes": 45000,
    "tomato": 45000,
    "onions": 38500,
    "onion": 38500,
    "cement": 6500,
    "yam": 35000,
    "pepper": 32000,
    "groundnut": 48000,
    "sugar": 85000,
    "plantain": 4500,
  };

  const itemLower = item.toLowerCase();
  let basePrice = 50000;
  
  for (const [key, value] of Object.entries(basePrices)) {
    if (itemLower.includes(key)) {
      basePrice = value;
      break;
    }
  }

  const history: PriceHistoryPoint[] = [];
  const today = new Date();
  let currentPrice = basePrice * 0.92;
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Realistic daily change
    const changePercent = (Math.random() - 0.45) * 0.05;
    currentPrice = currentPrice * (1 + changePercent);
    currentPrice = Math.max(basePrice * 0.7, Math.min(basePrice * 1.3, currentPrice));
    
    // Weekly seasonality
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 1) currentPrice *= 1.01;
    if (dayOfWeek === 5) currentPrice *= 0.99;
    
    history.push({
      date: date.toISOString().substring(0, 10),
      price: Math.round(currentPrice),
      trend: changePercent > 0.01 ? "up" : changePercent < -0.01 ? "down" : "stable",
      source: "mock",
    });
  }

  return history;
}

// ============================================================================
// CALCULATE STATISTICS
// ============================================================================

function calculateStatistics(history: PriceHistoryPoint[]): PriceStatistics {
  if (history.length === 0) {
    return {
      current: 0,
      high: 0,
      low: 0,
      average: 0,
      change: 0,
      changePercent: 0,
      volatility: 0,
      dataPoints: 0,
    };
  }

  const prices = history.map(h => h.price);
  const current = prices[prices.length - 1];
  const first = prices[0];
  const change = current - first;
  const changePercent = first > 0 ? (change / first) * 100 : 0;

  return {
    current,
    high: Math.max(...prices),
    low: Math.min(...prices),
    average: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    change: Math.round(change),
    changePercent: Number(changePercent.toFixed(2)),
    volatility: calculateVolatility(prices),
    dataPoints: history.length,
  };
}

// ============================================================================
// GET HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const item = searchParams.get("item") || "";
  const market = searchParams.get("market") || "";
  const period = searchParams.get("period") || "30d";

  if (!item || !market) {
    return NextResponse.json(
      { success: false, error: "Item and market are required" },
      { status: 400 }
    );
  }

  const days = getDaysFromPeriod(period);
  let history: PriceHistoryPoint[] = [];
  let source = "unknown";

  // PRIORITY 1: Try Google Sheets
  history = await fetchHistoryFromSheets(item, market, days);
  if (history.length > 0) {
    source = "sheets";
  }

  // PRIORITY 2: Try Database
  if (history.length === 0) {
    history = await fetchHistoryFromDatabase(item, market, days);
    if (history.length > 0) {
      source = "database";
    }
  }

  // PRIORITY 3: Use Mock Data
  if (history.length === 0) {
    history = generateMockHistory(item, market, days);
    source = "mock";
  }

  const statistics = calculateStatistics(history);

  return NextResponse.json({
    success: true,
    item,
    market,
    period,
    data: history,
    statistics,
    source,
    note: source === "mock" 
      ? "Showing simulated data for demonstration" 
      : undefined,
  });
}

// Force dynamic rendering
export const dynamic = "force-dynamic";
