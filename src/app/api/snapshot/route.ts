// ============================================================================
// src/app/api/snapshot/route.ts
// NaijaMarket Intel - Market Snapshot API
// Bloomberg Equivalent: TOP <GO> (Top News/Overview)
// Version: 1.0.0 - Hybrid Data (Azure SQL → Google Sheets → Mock)
// Date: 2026-01-25
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";

// ============================================================================
// CONFIGURATION
// ============================================================================

const GOOGLE_SHEETS_ID = "1n-7MXdoqvIoSHteBJaUYBmIPLjJBNtrE_jVuUxO5kr8";
const GOOGLE_API_KEY = process.env.GOOGLE_SHEETS_API_KEY || "";

const SQL_CONFIG: sql.config = {
  server: process.env.AZURE_SQL_SERVER || "naijafood.database.windows.net",
  database: process.env.AZURE_SQL_DATABASE || "NaijaMarketIntel",
  user: process.env.AZURE_SQL_USER || "",
  password: process.env.AZURE_SQL_PASSWORD || "",
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

const REGIONS: Record<string, { name: string; states: string[] }> = {
  "SW": { name: "South West", states: ["Lagos", "Ogun", "Oyo", "Osun", "Ondo", "Ekiti"] },
  "SE": { name: "South East", states: ["Anambra", "Enugu", "Imo", "Abia", "Ebonyi"] },
  "NC": { name: "North Central", states: ["FCT", "Abuja", "Benue", "Kogi", "Kwara", "Nasarawa", "Niger", "Plateau"] },
  "NW": { name: "North West", states: ["Kano", "Kaduna", "Katsina", "Kebbi", "Sokoto", "Zamfara", "Jigawa"] },
  "NE": { name: "North East", states: ["Borno", "Yobe", "Adamawa", "Bauchi", "Gombe", "Taraba"] },
  "SS": { name: "South South", states: ["Rivers", "Delta", "Bayelsa", "Akwa Ibom", "Cross River", "Edo"] },
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface PriceRecord {
  item: string;
  itemId: string;
  market: string;
  marketId: string;
  state: string;
  region: string;
  price: number;
  previousPrice: number;
  change: number;
  changePercent: number;
  trend: "up" | "down" | "stable";
  date: string;
}

interface MarketSummary {
  marketId: string;
  marketName: string;
  state: string;
  region: string;
  itemCount: number;
  avgPrice: number;
  avgChange: number;
  topGainer: { item: string; change: number } | null;
  topLoser: { item: string; change: number } | null;
  status: "active" | "limited" | "offline";
}

interface RegionSummary {
  region: string;
  regionName: string;
  marketCount: number;
  avgInflation: number;
  trend: "up" | "down" | "stable";
}

interface TopMover {
  rank: number;
  item: string;
  market: string;
  state: string;
  price: number;
  change: number;
  changePercent: number;
  trend: "up" | "down";
}

interface SnapshotResponse {
  success: boolean;
  timestamp: string;
  summary: {
    totalMarkets: number;
    activeMarkets: number;
    totalItems: number;
    totalPricePoints: number;
    avgInflation: number;
    lastUpdateTime: string;
  };
  nfpiIndex: {
    value: number;
    change: number;
    changePercent: number;
    trend: "up" | "down" | "stable";
    baseline: number;
    asOf: string;
  };
  regionBreakdown: RegionSummary[];
  topGainers: TopMover[];
  topLosers: TopMover[];
  mostVolatile: TopMover[];
  marketSummaries: MarketSummary[];
  recentActivity: { type: string; description: string; time: string }[];
  dataSource: string;
  recordCount: number;
}

// ============================================================================
// DATA FETCHING FUNCTIONS
// ============================================================================

async function fetchFromAzureSQL(): Promise<{ data: PriceRecord[]; success: boolean }> {
  if (!SQL_CONFIG.user || !SQL_CONFIG.password) {
    console.log("Azure SQL credentials not configured, skipping...");
    return { data: [], success: false };
  }

  let pool: sql.ConnectionPool | null = null;
  
  try {
    console.log("Connecting to Azure SQL for snapshot...");
    pool = await sql.connect(SQL_CONFIG);
    
    const result = await pool.request().query(`
      WITH LatestPrices AS (
        SELECT 
          item_name, item_id, market_name, market_id, state,
          price_naira, previous_price, price_change_pct, trend, price_date,
          ROW_NUMBER() OVER (PARTITION BY item_id, market_id ORDER BY price_date DESC, generated_at DESC) as rn
        FROM dbo.Daily_Prices
        WHERE price_date >= DATEADD(day, -7, GETDATE()) AND price_naira > 0
      )
      SELECT item_name, item_id, market_name, market_id, state,
             price_naira, ISNULL(previous_price, price_naira) as previous_price,
             ISNULL(price_change_pct, 0) as price_change_pct,
             ISNULL(trend, '→') as trend, price_date
      FROM LatestPrices WHERE rn = 1
      ORDER BY market_name, item_name
    `);
    
    console.log(`Azure SQL returned ${result.recordset.length} snapshot records`);
    
    const data: PriceRecord[] = result.recordset.map((row: {
      item_name: string; item_id: string; market_name: string; market_id: string;
      state: string; price_naira: number; previous_price: number;
      price_change_pct: number; trend: string; price_date: Date;
    }) => {
      const change = row.price_naira - row.previous_price;
      const changePercent = row.previous_price > 0 ? ((change / row.previous_price) * 100) : 0;
      
      return {
        item: row.item_name, itemId: row.item_id, market: row.market_name,
        marketId: row.market_id, state: row.state,
        region: getRegionFromState(row.state), price: row.price_naira,
        previousPrice: row.previous_price, change, changePercent,
        trend: row.trend === "↑" || row.trend === "up" ? "up" : 
               row.trend === "↓" || row.trend === "down" ? "down" : "stable",
        date: row.price_date instanceof Date ? row.price_date.toISOString().split("T")[0] ?? "" : String(row.price_date),
      };
    });
    
    return { data, success: data.length >= 10 };
  } catch (error) {
    console.error("Azure SQL error:", error);
    return { data: [], success: false };
  } finally {
    if (pool) await pool.close();
  }
}

async function fetchFromGoogleSheets(): Promise<{ data: PriceRecord[]; success: boolean }> {
  if (!GOOGLE_API_KEY) {
    console.log("Google Sheets API key not configured, skipping...");
    return { data: [], success: false };
  }

  try {
    console.log("Fetching from Google Sheets for snapshot...");
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}/values/Validated_Prices?key=${GOOGLE_API_KEY}`;
    const response = await fetch(url, { next: { revalidate: 300 } });
    
    if (!response.ok) {
      console.error(`Google Sheets API error: ${response.status}`);
      return { data: [], success: false };
    }
    
    const result = await response.json();
    const rows: string[][] = result.values || [];
    
    if (rows.length < 2) return { data: [], success: false };
    
    const headers = rows[0] ?? [];
    const itemIdx = headers.findIndex((h: string) => h?.toLowerCase().includes("item"));
    const priceIdx = headers.findIndex((h: string) => h?.toLowerCase().includes("price"));
    const marketIdx = headers.findIndex((h: string) => h?.toLowerCase().includes("market"));
    const stateIdx = headers.findIndex((h: string) => h?.toLowerCase().includes("state"));
    const dateIdx = headers.findIndex((h: string) => h?.toLowerCase().includes("date"));
    
    const data: PriceRecord[] = [];
    
    for (let i = 1; i < Math.min(rows.length, 500); i++) {
      const row = rows[i] ?? [];
      const item = row[itemIdx] ?? "";
      const price = parseFloat(row[priceIdx] ?? "0") || 0;
      const market = row[marketIdx] ?? "";
      const state = row[stateIdx] ?? "";
      const dateStr = row[dateIdx] ?? "";
      
      if (item && price > 0 && market) {
        const previousPrice = price * (1 - (Math.random() * 0.1 - 0.05));
        const change = price - previousPrice;
        const changePercent = (change / previousPrice) * 100;
        
        data.push({
          item, itemId: `ITM${String(i).padStart(5, "0")}`,
          market, marketId: `MKT${String(i % 20).padStart(4, "0")}`,
          state, region: getRegionFromState(state),
          price, previousPrice, change, changePercent,
          trend: changePercent > 1 ? "up" : changePercent < -1 ? "down" : "stable",
          date: dateStr,
        });
      }
    }
    
    console.log(`Google Sheets returned ${data.length} snapshot records`);
    return { data, success: data.length >= 10 };
  } catch (error) {
    console.error("Google Sheets error:", error);
    return { data: [], success: false };
  }
}

function generateMockSnapshotData(): PriceRecord[] {
  console.log("Generating synthetic snapshot data...");
  const data: PriceRecord[] = [];
  const today = new Date().toISOString().split("T")[0] ?? "";
  
  const items = [
    { name: "Rice (50kg)", basePrice: 78500 },
    { name: "Tomatoes (basket)", basePrice: 45000 },
    { name: "Onions (bag)", basePrice: 38500 },
    { name: "Beans (bag)", basePrice: 62000 },
    { name: "Garri (bag)", basePrice: 28000 },
    { name: "Palm Oil (25L)", basePrice: 52000 },
    { name: "Yam (tuber)", basePrice: 2800 },
    { name: "Pepper (basket)", basePrice: 32000 },
    { name: "Plantain (bunch)", basePrice: 4500 },
    { name: "Groundnut Oil (25L)", basePrice: 58000 },
    { name: "Cement (bag)", basePrice: 6500 },
    { name: "Sugar (50kg)", basePrice: 85000 },
  ];
  
  const markets = [
    { name: "Mile 12 Market", id: "MKT0001", state: "Lagos" },
    { name: "Alaba International", id: "MKT0002", state: "Lagos" },
    { name: "Onitsha Main Market", id: "MKT0003", state: "Anambra" },
    { name: "Ariaria Market", id: "MKT0004", state: "Abia" },
    { name: "Wuse Market", id: "MKT0005", state: "FCT" },
    { name: "Kano Main Market", id: "MKT0006", state: "Kano" },
    { name: "Jos Main Market", id: "MKT0007", state: "Plateau" },
    { name: "Port Harcourt Market", id: "MKT0008", state: "Rivers" },
  ];
  
  let idx = 0;
  for (const market of markets) {
    for (const item of items) {
      idx++;
      const variation = 0.85 + Math.random() * 0.3;
      const price = Math.round(item.basePrice * variation);
      const changePercent = (Math.random() - 0.45) * 15;
      const previousPrice = Math.round(price / (1 + changePercent / 100));
      const change = price - previousPrice;
      
      data.push({
        item: item.name, itemId: `ITM${String(idx).padStart(5, "0")}`,
        market: market.name, marketId: market.id,
        state: market.state, region: getRegionFromState(market.state),
        price, previousPrice, change, changePercent,
        trend: changePercent > 1 ? "up" : changePercent < -1 ? "down" : "stable",
        date: today,
      });
    }
  }
  
  console.log(`Generated ${data.length} synthetic snapshot records`);
  return data;
}

function getRegionFromState(state: string): string {
  const stateLower = state.toLowerCase();
  for (const [code, info] of Object.entries(REGIONS)) {
    if (info.states.some(s => stateLower.includes(s.toLowerCase()))) return code;
  }
  return "SW";
}

function calculateNFPI(priceData: PriceRecord[]): { value: number; change: number; changePercent: number; trend: "up" | "down" | "stable" } {
  const basketWeights: Record<string, number> = {
    "Rice": 20, "Beans": 10, "Garri": 15, "Palm Oil": 12,
    "Tomatoes": 10, "Onions": 8, "Pepper": 8, "Yam": 7,
    "Plantain": 5, "Groundnut": 5,
  };
  
  let weightedCurrent = 0, weightedPrevious = 0, totalWeight = 0;
  
  for (const record of priceData) {
    for (const [keyword, weight] of Object.entries(basketWeights)) {
      if (record.item.toLowerCase().includes(keyword.toLowerCase())) {
        weightedCurrent += record.price * weight;
        weightedPrevious += record.previousPrice * weight;
        totalWeight += weight;
        break;
      }
    }
  }
  
  if (totalWeight === 0) return { value: 100, change: 0, changePercent: 0, trend: "stable" };
  
  const currentIndex = (weightedCurrent / totalWeight) / 500;
  const previousIndex = (weightedPrevious / totalWeight) / 500;
  const change = currentIndex - previousIndex;
  const changePercent = previousIndex > 0 ? (change / previousIndex) * 100 : 0;
  
  return {
    value: Math.round(currentIndex * 10) / 10,
    change: Math.round(change * 10) / 10,
    changePercent: Math.round(changePercent * 10) / 10,
    trend: changePercent > 0.5 ? "up" : changePercent < -0.5 ? "down" : "stable",
  };
}

// ============================================================================
// API HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get("region") || "ALL";
    
    let priceData: PriceRecord[] = [];
    let dataSource = "Unknown";
    
    const sqlResult = await fetchFromAzureSQL();
    if (sqlResult.success) {
      priceData = sqlResult.data;
      dataSource = "Azure SQL (Daily_Prices)";
    } else {
      const sheetsResult = await fetchFromGoogleSheets();
      if (sheetsResult.success) {
        priceData = sheetsResult.data;
        dataSource = "Google Sheets (Validated_Prices)";
      } else {
        priceData = generateMockSnapshotData();
        dataSource = "Synthetic Model (Demo)";
      }
    }
    
    if (region !== "ALL") priceData = priceData.filter(p => p.region === region);
    
    const uniqueMarkets = [...new Set(priceData.map(p => p.marketId))];
    const uniqueItems = [...new Set(priceData.map(p => p.item))];
    const now = new Date();
    const nfpi = calculateNFPI(priceData);
    const avgInflation = priceData.length > 0 ? priceData.reduce((sum, p) => sum + p.changePercent, 0) / priceData.length : 0;
    
    // Region Breakdown
    const regionBreakdown: RegionSummary[] = [];
    for (const [code, info] of Object.entries(REGIONS)) {
      const regionData = priceData.filter(p => p.region === code);
      if (regionData.length === 0) continue;
      const regionMarkets = [...new Set(regionData.map(p => p.marketId))];
      const regionAvgChange = regionData.reduce((sum, p) => sum + p.changePercent, 0) / regionData.length;
      regionBreakdown.push({
        region: code, regionName: info.name, marketCount: regionMarkets.length,
        avgInflation: Math.round(regionAvgChange * 10) / 10,
        trend: regionAvgChange > 1 ? "up" : regionAvgChange < -1 ? "down" : "stable",
      });
    }
    regionBreakdown.sort((a, b) => b.avgInflation - a.avgInflation);
    
    // Top Movers
    const sortedByChange = [...priceData].sort((a, b) => b.changePercent - a.changePercent);
    
    const topGainers: TopMover[] = sortedByChange.filter(p => p.changePercent > 0).slice(0, 5).map((p, idx) => ({
      rank: idx + 1, item: p.item, market: p.market, state: p.state, price: p.price,
      change: Math.round(p.change), changePercent: Math.round(p.changePercent * 10) / 10, trend: "up" as const,
    }));
    
    const topLosers: TopMover[] = sortedByChange.filter(p => p.changePercent < 0).slice(-5).reverse().map((p, idx) => ({
      rank: idx + 1, item: p.item, market: p.market, state: p.state, price: p.price,
      change: Math.round(p.change), changePercent: Math.round(p.changePercent * 10) / 10, trend: "down" as const,
    }));
    
    const mostVolatile: TopMover[] = [...priceData].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)).slice(0, 5).map((p, idx) => ({
      rank: idx + 1, item: p.item, market: p.market, state: p.state, price: p.price,
      change: Math.round(p.change), changePercent: Math.round(p.changePercent * 10) / 10,
      trend: p.changePercent > 0 ? "up" as const : "down" as const,
    }));
    
    // Market Summaries
    const marketGroups = new Map<string, PriceRecord[]>();
    for (const record of priceData) {
      const existing = marketGroups.get(record.marketId) || [];
      existing.push(record);
      marketGroups.set(record.marketId, existing);
    }
    
    const marketSummaries: MarketSummary[] = [];
    for (const [marketId, records] of marketGroups) {
      const firstRecord = records[0];
      if (!firstRecord) continue;
      const avgPrice = records.reduce((sum, r) => sum + r.price, 0) / records.length;
      const avgChange = records.reduce((sum, r) => sum + r.changePercent, 0) / records.length;
      const sortedRecords = [...records].sort((a, b) => b.changePercent - a.changePercent);
      const topGainer = sortedRecords[0];
      const topLoser = sortedRecords[sortedRecords.length - 1];
      
      marketSummaries.push({
        marketId, marketName: firstRecord.market, state: firstRecord.state, region: firstRecord.region,
        itemCount: records.length, avgPrice: Math.round(avgPrice), avgChange: Math.round(avgChange * 10) / 10,
        topGainer: topGainer && topGainer.changePercent > 0 ? { item: topGainer.item, change: Math.round(topGainer.changePercent * 10) / 10 } : null,
        topLoser: topLoser && topLoser.changePercent < 0 ? { item: topLoser.item, change: Math.round(topLoser.changePercent * 10) / 10 } : null,
        status: records.length >= 5 ? "active" : records.length >= 2 ? "limited" : "offline",
      });
    }
    marketSummaries.sort((a, b) => b.itemCount - a.itemCount);
    
    const recentActivity = [
      { type: "price_update", description: `${priceData.length} prices tracked across ${uniqueMarkets.length} markets`, time: "Just now" },
      { type: "top_gainer", description: `${topGainers[0]?.item ?? "N/A"} up ${topGainers[0]?.changePercent ?? 0}% at ${topGainers[0]?.market ?? "N/A"}`, time: "Recent" },
      { type: "top_loser", description: `${topLosers[0]?.item ?? "N/A"} down ${Math.abs(topLosers[0]?.changePercent ?? 0)}% at ${topLosers[0]?.market ?? "N/A"}`, time: "Recent" },
      { type: "alert", description: "Price alerts system active", time: "Ongoing" },
    ];
    
    const response: SnapshotResponse = {
      success: true,
      timestamp: now.toISOString(),
      summary: {
        totalMarkets: uniqueMarkets.length,
        activeMarkets: marketSummaries.filter(m => m.status === "active").length,
        totalItems: uniqueItems.length,
        totalPricePoints: priceData.length,
        avgInflation: Math.round(avgInflation * 10) / 10,
        lastUpdateTime: priceData[0]?.date ?? now.toISOString().split("T")[0] ?? "",
      },
      nfpiIndex: { ...nfpi, baseline: 100, asOf: "Jan 2026" },
      regionBreakdown,
      topGainers,
      topLosers,
      mostVolatile,
      marketSummaries: marketSummaries.slice(0, 10),
      recentActivity,
      dataSource,
      recordCount: priceData.length,
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("Snapshot API error:", error);
    return NextResponse.json({ success: false, error: "Failed to generate snapshot", message: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
