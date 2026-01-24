// ============================================================================
// src/app/api/prices/history/route.ts
// NaijaMarket Intel - Price History API
// Bloomberg Equivalent: HP <GO>
// Version: 1.0.1 - Fixed TypeScript unused parameter error
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
  const squaredDiffs = prices.map(price => Math.pow(price - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / prices.length;
  const stdDev = Math.sqrt(avgSquaredDiff);
  
  // Return as percentage of mean
  return Number(((stdDev / mean) * 100).toFixed(2));
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

// ============================================================================
// GET HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const item = searchParams.get("item") || "";
  const market = searchParams.get("market") || "";
  const period = searchParams.get("period") || "30d";
  
  const days = getDaysFromPeriod(period);
  let pool: sql.ConnectionPool | null = null;

  try {
    // Connect to database
    pool = await sql.connect(dbConfig);
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Query 1: Try Daily_Prices table first (aggregated daily data)
    const dailyQuery = `
      SELECT 
        price_date,
        price_naira,
        trend,
        'daily' as source
      FROM Daily_Prices
      WHERE item_name LIKE @item
        AND market_name LIKE @market
        AND price_date >= @startDate
        AND price_date <= @endDate
      ORDER BY price_date ASC
    `;

    const dailyResult = await pool.request()
      .input("item", sql.NVarChar, `%${item}%`)
      .input("market", sql.NVarChar, `%${market}%`)
      .input("startDate", sql.Date, startDate)
      .input("endDate", sql.Date, endDate)
      .query(dailyQuery);

    let data = dailyResult.recordset;

    // Query 2: If no daily data, try Approved_Prices (real-time submissions)
    if (data.length === 0) {
      const approvedQuery = `
        SELECT 
          CAST(created_at AS DATE) as price_date,
          AVG(price_naira) as price_naira,
          'stable' as trend,
          'validated' as source
        FROM Approved_Prices
        WHERE item_name LIKE @item
          AND market_name LIKE @market
          AND created_at >= @startDate
          AND created_at <= @endDate
        GROUP BY CAST(created_at AS DATE)
        ORDER BY price_date ASC
      `;

      const approvedResult = await pool.request()
        .input("item", sql.NVarChar, `%${item}%`)
        .input("market", sql.NVarChar, `%${market}%`)
        .input("startDate", sql.DateTime2, startDate)
        .input("endDate", sql.DateTime2, endDate)
        .query(approvedQuery);

      data = approvedResult.recordset;
    }

    // Query 3: If still no data, try Validated_Prices
    if (data.length === 0) {
      const validatedQuery = `
        SELECT 
          CAST(validated_at AS DATE) as price_date,
          AVG(validated_price) as price_naira,
          'stable' as trend,
          'crowd' as source
        FROM Validated_Prices
        WHERE item_name LIKE @item
          AND market_name LIKE @market
          AND validated_at >= @startDate
          AND validated_at <= @endDate
        GROUP BY CAST(validated_at AS DATE)
        ORDER BY price_date ASC
      `;

      const validatedResult = await pool.request()
        .input("item", sql.NVarChar, `%${item}%`)
        .input("market", sql.NVarChar, `%${market}%`)
        .input("startDate", sql.DateTime2, startDate)
        .input("endDate", sql.DateTime2, endDate)
        .query(validatedQuery);

      data = validatedResult.recordset;
    }

    // If no data found in any table, return mock data for demo
    if (data.length === 0) {
      const mockResult = generateMockHistory(item, market, days);
      return NextResponse.json({
        success: true,
        item,
        market,
        period,
        data: mockResult.history,
        statistics: mockResult.statistics,
        source: "mock"
      });
    }

    // Transform database results to response format
    const history: PriceHistoryPoint[] = data.map((row: {
      price_date: Date | string;
      price_naira: number;
      trend?: string;
      source?: string;
    }) => {
      // Safely extract date string
      let dateStr: string;
      if (row.price_date instanceof Date) {
        const isoStr = row.price_date.toISOString();
        dateStr = isoStr.substring(0, 10);
      } else if (typeof row.price_date === "string") {
        dateStr = row.price_date.substring(0, 10);
      } else {
        // Fallback to current date if all else fails
        dateStr = new Date().toISOString().substring(0, 10);
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
// FIX: Added underscore prefix to 'market' parameter to indicate it's 
// intentionally unused (prevents TypeScript "declared but never read" error)

function generateMockHistory(item: string, _market: string, days: number) {
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
    
    const trend = changePercent > 0.01 ? "up" : changePercent < -0.01 ? "down" : "stable";
    
    history.push({
      date: date.toISOString().substring(0, 10),
      price: Math.round(currentPrice),
      trend,
      source: "simulated"
    });
  }

  // Calculate statistics
  const prices = history.map(h => h.price);
  const current = prices[prices.length - 1] || 0;
  const first = prices[0] || current;
  
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
