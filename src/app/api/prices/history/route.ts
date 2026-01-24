// ============================================================================
// src/app/api/prices/history/route.ts
// NaijaMarket Intel - Price History API
// Bloomberg Equivalent: HP <GO>
// Version: 1.0.0
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";

// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================

const dbConfig: sql.config = {
  server: process.env.DATABASE_SERVER || "naijafood.database.windows.net",
  database: process.env.DATABASE_NAME || "naijafoodmarket",
  user: process.env.DATABASE_USER || "",
  password: process.env.DATABASE_PASSWORD || "",
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

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
  const squaredDiffs = prices.map(p => Math.pow(p - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  return Number(((stdDev / mean) * 100).toFixed(2));
}

function getPeriodDays(period: string): number {
  switch (period) {
    case "7d": return 7;
    case "30d": return 30;
    case "90d": return 90;
    case "180d": return 180;
    case "1y": return 365;
    default: return 30;
  }
}

// ============================================================================
// GET - Fetch Price History
// ============================================================================

export async function GET(request: NextRequest) {
  let pool: sql.ConnectionPool | null = null;

  try {
    const { searchParams } = new URL(request.url);
    const item = searchParams.get("item");
    const market = searchParams.get("market");
    const period = searchParams.get("period") || "30d";

    // Validate required parameters
    if (!item || !market) {
      return NextResponse.json(
        { error: "Missing required parameters: item and market" },
        { status: 400 }
      );
    }

    const days = getPeriodDays(period);
    
    pool = await sql.connect(dbConfig);

    // Query historical prices from Daily_Prices table
    const result = await pool.request()
      .input("item", sql.NVarChar(255), `%${item}%`)
      .input("market", sql.NVarChar(255), `%${market}%`)
      .input("days", sql.Int, days)
      .query(`
        SELECT 
          price_date,
          price_naira,
          trend,
          'daily' as source
        FROM Daily_Prices
        WHERE item_name LIKE @item
          AND market_name LIKE @market
          AND price_date >= DATEADD(day, -@days, GETDATE())
        ORDER BY price_date ASC
      `);

    // If no data in Daily_Prices, try Validated_Prices with created_at
    let historyData = result.recordset;
    
    if (historyData.length === 0) {
      const validatedResult = await pool.request()
        .input("item", sql.NVarChar(255), `%${item}%`)
        .input("market", sql.NVarChar(255), `%${market}%`)
        .input("days", sql.Int, days)
        .query(`
          SELECT 
            CAST(created_at AS DATE) as price_date,
            price_naira,
            'stable' as trend,
            'validated' as source
          FROM Approved_Prices
          WHERE item_name LIKE @item
            AND market_name LIKE @market
            AND created_at >= DATEADD(day, -@days, GETDATE())
          ORDER BY created_at ASC
        `);
      
      historyData = validatedResult.recordset;
    }

    // If still no data, generate mock data for demo
    if (historyData.length === 0) {
      const mockData = generateMockHistory(item, market, days);
      return NextResponse.json({
        success: true,
        item,
        market,
        period,
        data: mockData.history,
        statistics: mockData.statistics,
        source: "mock",
        message: "Using simulated data - no historical records found"
      });
    }

    // Format the data
    const history: PriceHistoryPoint[] = historyData.map((row: {
      price_date: Date | string;
      price_naira: number;
      trend: string;
      source: string;
    }) => {
      let dateStr: string;
      if (row.price_date instanceof Date) {
        dateStr = row.price_date.toISOString().split("T")[0];
      } else if (typeof row.price_date === "string") {
        dateStr = row.price_date.split("T")[0];
      } else {
        dateStr = String(row.price_date);
      }
      
      return {
        date: dateStr,
        price: Number(row.price_naira),
        trend: row.trend || "stable",
        source: row.source || "daily"
      };
    });

    // Calculate statistics
    const prices = history.map(h => h.price);
    const current = prices[prices.length - 1] || 0;
    const first = prices[0] || current;
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const average = prices.reduce((a, b) => a + b, 0) / prices.length;
    const change = current - first;
    const changePercent = first > 0 ? ((change / first) * 100) : 0;
    const volatility = calculateVolatility(prices);

    const statistics: PriceStatistics = {
      current: Number(current.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      average: Number(average.toFixed(2)),
      change: Number(change.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      volatility,
      dataPoints: history.length
    };

    return NextResponse.json({
      success: true,
      item,
      market,
      period,
      data: history,
      statistics,
      source: "database"
    });

  } catch (error) {
    console.error("Price history API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch price history" },
      { status: 500 }
    );
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

// ============================================================================
// MOCK DATA GENERATOR (for demo when no historical data exists)
// ============================================================================

function generateMockHistory(item: string, market: string, days: number) {
  const history: PriceHistoryPoint[] = [];
  
  // Base price based on item (realistic Nigerian prices)
  const basePrices: Record<string, number> = {
    "rice": 78000,
    "beans": 62000,
    "garri": 28000,
    "palm oil": 52000,
    "tomatoes": 45000,
    "onions": 38500,
    "cement": 6500,
    "yam": 35000,
    "pepper": 32000,
    "groundnut": 48000
  };

  const itemLower = item.toLowerCase();
  let basePrice = 50000;
  
  for (const [key, value] of Object.entries(basePrices)) {
    if (itemLower.includes(key)) {
      basePrice = value;
      break;
    }
  }

  // Generate price history with realistic fluctuations
  const today = new Date();
  let currentPrice = basePrice;
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Random daily change between -3% and +3%
    const changePercent = (Math.random() - 0.5) * 0.06;
    currentPrice = currentPrice * (1 + changePercent);
    
    // Keep price within reasonable bounds
    currentPrice = Math.max(basePrice * 0.7, Math.min(basePrice * 1.3, currentPrice));
    
    const trend = changePercent > 0.01 ? "↑" : changePercent < -0.01 ? "↓" : "→";
    
    history.push({
      date: date.toISOString().split("T")[0],
      price: Math.round(currentPrice),
      trend,
      source: "simulated"
    });
  }

  // Calculate statistics
  const prices = history.map(h => h.price);
  const current = prices[prices.length - 1];
  const first = prices[0];
  
  const statistics: PriceStatistics = {
    current,
    high: Math.max(...prices),
    low: Math.min(...prices),
    average: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    change: current - first,
    changePercent: Number((((current - first) / first) * 100).toFixed(2)),
    volatility: calculateVolatility(prices),
    dataPoints: history.length
  };

  return { history, statistics };
}

// Force dynamic rendering
export const dynamic = "force-dynamic";
