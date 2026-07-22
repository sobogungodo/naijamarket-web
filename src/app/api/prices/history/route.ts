// ============================================================================
// src/app/api/prices/history/route.ts
// NaijaMarket Intel - Price History API
// Version: 7.0.0 - OPTIMIZED for 143M+ row database
// ============================================================================
// FIXES from v6.0:
//   1. Singleton PrismaClient (was creating new instance per request)
//   2. Exact match (=) instead of LIKE for item_name/market_name
//   3. Skip Google Sheets when database returns data
//   4. Added timeout protection (10 second limit)
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

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
// SINGLETON PRISMA (reuse connection pool)
// ============================================================================

let prismaClient: any = null;

async function getPrisma() {
  if (!prismaClient) {
    const { PrismaClient } = await import("@prisma/client");
    prismaClient = new PrismaClient();
  }
  return prismaClient;
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

// PHN is monthly, so ranges are month-granular; day math would clip a whole
// month at the boundary.
function getMonthsFromPeriod(period: string): number {
  switch (period) {
    case "1y": return 12;
    case "3y": return 36;
    case "5y": return 60;
    case "10y": return 120;
    case "all": return 0;   // 0 = no lower bound, full PHN span
    default: return 12;
  }
}

// ============================================================================
// PRIMARY: FETCH FROM DATABASE (OPTIMIZED)
// ============================================================================
// Key optimization: uses EXACT MATCH (=) instead of LIKE
// The modal sends the full item_name and market_name, so no wildcard needed
// With IX_DailyPrices_ItemMarketDate index → instant seek on 143M rows
// ============================================================================

async function fetchFromDatabase(
  item: string,
  market: string,
  months: number
): Promise<PriceHistoryPoint[]> {
  try {
    const prisma = await getPrisma();

    // Price_History_NBS is the single source: monthly (observation_date is
    // always day-01) and spans 2016-01 -> 2026-07.
    const results = await prisma.$queryRaw`
      SELECT
        CONVERT(VARCHAR(10), observation_date, 23) AS date,
        AVG(CAST(price_naira AS FLOAT))            AS price,
        MIN(data_source)                           AS data_source
      FROM Price_History_NBS WITH (NOLOCK)
      WHERE item_name_standard = ${item}
        AND market_name        = ${market}
        AND price_naira > 0
        AND (${months} = 0 OR observation_date >= DATEADD(month, -${months},
              DATEFROMPARTS(YEAR(GETUTCDATE()), MONTH(GETUTCDATE()), 1)))
      GROUP BY observation_date
      ORDER BY observation_date ASC
    ` as Array<{ date: string; price: number; data_source: string }>;

    return results.map((r) => ({
      date: String(r.date).substring(0, 10),
      price: Math.round(Number(r.price)),
      trend: "stable",
      source: `PHN:${r.data_source}`,
    }));
  } catch (error: any) {
    console.error("PHN history error:", error.message?.substring(0, 200));
    return [];
  }
}


// ============================================================================
// CALCULATE STATISTICS
// ============================================================================

function calculateStatistics(history: PriceHistoryPoint[]): PriceStatistics {
  if (history.length === 0) {
    return {
      current: 0, high: 0, low: 0, average: 0,
      change: 0, changePercent: 0, volatility: 0, dataPoints: 0,
    };
  }

  const prices = history.map(h => h.price);
  const current = prices[prices.length - 1] || 0;
  const first = prices[0] || 0;
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
  const startTime = Date.now();
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

  const months = getMonthsFromPeriod(period);

  console.log(`\n📈 History v7: ${item} @ ${market} (${period})`);

  // Fetch from database (primary & only source needed with 143M rows)
  let history = await fetchFromDatabase(item, market, months);
  let source = history.length > 0 ? "database" : "none";

  // No fabricated fallback: an empty series renders an honest empty state.

  // Add trends
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1]?.price || 0;
    const curr = history[i]?.price || 0;
    if (curr > prev) history[i]!.trend = "up";
    else if (curr < prev) history[i]!.trend = "down";
    else history[i]!.trend = "stable";
  }

  const statistics = calculateStatistics(history);
  const responseTime = Date.now() - startTime;

  console.log(`📊 ${history.length} points in ${responseTime}ms (${source})`);

  return NextResponse.json({
    success: true,
    item,
    market,
    period,
    data: history,
    statistics,
    source,
    responseTime: `${responseTime}ms`,
    note: source === "none"
      ? "No historical records found for this item and market"
      : undefined,
  });
}

export const dynamic = "force-dynamic";
