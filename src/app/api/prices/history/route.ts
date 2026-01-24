// ============================================================================
// src/app/api/prices/history/route.ts
// NaijaMarket Intel - Price History API (HYBRID)
// STRATEGY: MERGE Google Sheets (recent) + Azure SQL (historical)
// Version: 5.0.1 - Fixed TypeScript strict mode errors
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// CONFIGURATION
// ============================================================================

const GOOGLE_SHEET_ID = "1n-7MXdoqvIoSHteBJaUYBmIPLjJBNtrE_jVuUxO5kr8";

const SHEETS_PRIORITY = [
  "Daily_Prices",
  "Price_History_NBS",
  "Validated_Prices",
];

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
  return result.map(v => v.replace(/^"|"$/g, "").trim());
}

// Safe string matching helper
function flexibleMatch(source: string, target: string): boolean {
  if (!source || !target) return false;
  const sourceLower = source.toLowerCase();
  const targetLower = target.toLowerCase();
  
  // Direct includes
  if (sourceLower.includes(targetLower) || targetLower.includes(sourceLower)) {
    return true;
  }
  
  // Split and match first part (e.g., "Rice (50kg)" matches "Rice")
  const sourceParts = sourceLower.split(/[\s(]/);
  const targetParts = targetLower.split(/[\s(]/);
  const sourceFirst = sourceParts[0] || sourceLower;
  const targetFirst = targetParts[0] || targetLower;
  
  return sourceFirst.includes(targetFirst) || targetFirst.includes(sourceFirst);
}

// ============================================================================
// FETCH SHEET AS CSV
// ============================================================================

async function fetchSheetAsCSV(sheetName: string): Promise<string[][]> {
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    
    const response = await fetch(csvUrl, {
      next: { revalidate: 300 },
    });

    if (!response.ok) return [];

    const csvText = await response.text();
    const lines = csvText.split("\n").filter(line => line.trim());
    
    return lines.map(line => parseCSVLine(line));
  } catch (error) {
    console.error(`Error fetching ${sheetName}:`, error);
    return [];
  }
}

// ============================================================================
// FETCH HISTORY FROM GOOGLE SHEETS
// ============================================================================

async function fetchFromGoogleSheets(
  item: string,
  market: string,
  days: number
): Promise<PriceHistoryPoint[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const allHistory: PriceHistoryPoint[] = [];

  for (const sheetName of SHEETS_PRIORITY) {
    const rows = await fetchSheetAsCSV(sheetName);
    if (rows.length < 2) continue;

    const headers = rows[0];
    if (!headers) continue;

    const findCol = (names: string[]): number => {
      for (const name of names) {
        const idx = headers.findIndex(h => 
          h && h.toLowerCase().includes(name.toLowerCase())
        );
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const itemIdx = findCol(["item_name", "item", "commodity"]);
    const marketIdx = findCol(["market_name", "market"]);
    const priceIdx = findCol(["price_naira", "price", "validated_price", "average_price"]);
    const dateIdx = findCol(["price_date", "date", "observation_date", "validated_at", "created_at"]);
    const trendIdx = findCol(["trend"]);

    if (itemIdx < 0 || priceIdx < 0) continue;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      const rowItem = itemIdx >= 0 ? (row[itemIdx] || "") : "";
      const rowMarket = marketIdx >= 0 ? (row[marketIdx] || "") : "";

      // Use safe flexible matching
      const itemMatch = flexibleMatch(rowItem, item);
      const marketMatch = marketIdx < 0 || flexibleMatch(rowMarket, market);

      if (!itemMatch || !marketMatch) continue;

      const dateStr = dateIdx >= 0 ? row[dateIdx] : null;
      let rowDate: Date;
      
      if (dateStr) {
        rowDate = new Date(dateStr);
        if (isNaN(rowDate.getTime())) continue;
        if (rowDate < cutoffDate) continue;
      } else {
        continue;
      }

      const priceStr = priceIdx >= 0 ? row[priceIdx] : null;
      const price = parseFloat(priceStr || "0");
      if (isNaN(price) || price <= 0) continue;

      let trend = "stable";
      if (trendIdx >= 0 && row[trendIdx]) {
        trend = row[trendIdx].toLowerCase();
      }

      allHistory.push({
        date: rowDate.toISOString().substring(0, 10),
        price: price,
        trend: trend,
        source: `Sheets:${sheetName}`,
      });
    }
  }

  console.log(`📊 Google Sheets: Found ${allHistory.length} history points`);
  return allHistory;
}

// ============================================================================
// FETCH HISTORY FROM AZURE SQL
// ============================================================================

async function fetchFromAzureSQL(
  item: string,
  market: string,
  days: number
): Promise<PriceHistoryPoint[]> {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let results: Array<{ date: Date | string; price: number }> = [];
    
    try {
      results = await prisma.$queryRaw`
        SELECT 
          CAST(price_date AS DATE) as date,
          AVG(CAST(price_naira AS FLOAT)) as price
        FROM Daily_Prices
        WHERE item_name LIKE ${`%${item}%`}
          AND market_name LIKE ${`%${market}%`}
          AND price_date >= ${cutoffDate}
        GROUP BY CAST(price_date AS DATE)
        ORDER BY date ASC
      `;
    } catch (e) {
      console.log("Daily_Prices query failed...");
    }

    if (results.length === 0) {
      try {
        results = await prisma.$queryRaw`
          SELECT 
            CAST(observation_date AS DATE) as date,
            AVG(CAST(price_naira AS FLOAT)) as price
          FROM Price_History_NBS
          WHERE item_name LIKE ${`%${item}%`}
            AND market_name LIKE ${`%${market}%`}
            AND observation_date >= ${cutoffDate}
          GROUP BY CAST(observation_date AS DATE)
          ORDER BY date ASC
        `;
      } catch (e) {
        console.log("Price_History_NBS query failed...");
      }
    }

    if (results.length === 0) {
      try {
        results = await prisma.$queryRaw`
          SELECT 
            CAST(validated_at AS DATE) as date,
            AVG(CAST(price_naira AS FLOAT)) as price
          FROM Validated_Prices
          WHERE item_name LIKE ${`%${item}%`}
            AND market_name LIKE ${`%${market}%`}
            AND validated_at >= ${cutoffDate}
          GROUP BY CAST(validated_at AS DATE)
          ORDER BY date ASC
        `;
      } catch (e) {
        console.log("Validated_Prices query failed...");
      }
    }

    await prisma.$disconnect();

    if (!results || results.length === 0) {
      console.log("📊 Azure SQL: No historical data found");
      return [];
    }

    console.log(`📊 Azure SQL: Found ${results.length} historical points`);

    return results.map((r) => ({
      date: r.date instanceof Date ? r.date.toISOString().substring(0, 10) : String(r.date).substring(0, 10),
      price: Number(r.price),
      trend: "stable",
      source: "Azure:Historical",
    }));

  } catch (error) {
    console.error("Azure SQL error:", error);
    return [];
  }
}

// ============================================================================
// MOCK DATA GENERATOR
// ============================================================================

function generateMockHistory(item: string, _market: string, days: number): PriceHistoryPoint[] {
  const basePrices: Record<string, number> = {
    "rice": 78000, "beans": 62000, "garri": 28000, "palm oil": 52000,
    "tomatoes": 45000, "onions": 38500, "cement": 6500, "yam": 35000,
    "pepper": 32000, "groundnut": 48000, "sugar": 85000, "plantain": 4500,
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
    
    const changePercent = (Math.random() - 0.45) * 0.05;
    currentPrice = currentPrice * (1 + changePercent);
    currentPrice = Math.max(basePrice * 0.7, Math.min(basePrice * 1.3, currentPrice));
    
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 1) currentPrice *= 1.01;
    if (dayOfWeek === 5) currentPrice *= 0.99;
    
    history.push({
      date: date.toISOString().substring(0, 10),
      price: Math.round(currentPrice),
      trend: changePercent > 0.01 ? "up" : changePercent < -0.01 ? "down" : "stable",
      source: "Mock:Simulated",
    });
  }

  return history;
}

// ============================================================================
// MERGE HISTORY
// ============================================================================

function mergeHistory(
  sheetsData: PriceHistoryPoint[],
  azureData: PriceHistoryPoint[]
): PriceHistoryPoint[] {
  const dateMap = new Map<string, PriceHistoryPoint>();

  for (const point of azureData) {
    dateMap.set(point.date, point);
  }

  for (const point of sheetsData) {
    dateMap.set(point.date, point);
  }

  const merged = Array.from(dateMap.values());
  merged.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return merged;
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
  
  console.log(`\n📈 Price History: ${item} @ ${market} (${period})`);

  const sheetsData = await fetchFromGoogleSheets(item, market, days);
  const azureData = await fetchFromAzureSQL(item, market, days);

  let history: PriceHistoryPoint[] = [];
  let source = "unknown";

  if (sheetsData.length > 0 && azureData.length > 0) {
    history = mergeHistory(sheetsData, azureData);
    source = "hybrid:sheets+azure";
    console.log(`✅ HYBRID: ${sheetsData.length} Sheets + ${azureData.length} Azure = ${history.length} total`);
  } else if (sheetsData.length > 0) {
    history = sheetsData;
    source = "sheets";
  } else if (azureData.length > 0) {
    history = azureData;
    source = "azure";
  }

  if (history.length === 0) {
    console.log("⚠️ No data found, using mock...");
    history = generateMockHistory(item, market, days);
    source = "mock";
  }

  const statistics = calculateStatistics(history);

  const sourceBreakdown = {
    sheets: history.filter(h => h.source.includes("Sheets")).length,
    azure: history.filter(h => h.source.includes("Azure")).length,
    mock: history.filter(h => h.source.includes("Mock")).length,
  };

  return NextResponse.json({
    success: true,
    item,
    market,
    period,
    data: history,
    statistics,
    source,
    sourceBreakdown,
    note: source === "mock" 
      ? "Showing simulated data - no historical records found" 
      : source === "hybrid:sheets+azure"
      ? `Combined: ${sourceBreakdown.sheets} recent (Sheets) + ${sourceBreakdown.azure} historical (Azure)`
      : undefined,
  });
}

export const dynamic = "force-dynamic";
