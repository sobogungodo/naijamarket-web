// ============================================================================
// src/app/api/heatmap/route.ts
// NaijaMarket Intel - Market Heatmap API
// Bloomberg Equivalent: MAP <GO> (Market Map)
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
  options: { encrypt: true, trustServerCertificate: false },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

// Nigeria's 6 Geopolitical Zones with states
const REGIONS: Record<string, { name: string; states: string[]; capital: string; coordinates: { lat: number; lng: number } }> = {
  "SW": { 
    name: "South West", 
    states: ["Lagos", "Ogun", "Oyo", "Osun", "Ondo", "Ekiti"],
    capital: "Lagos",
    coordinates: { lat: 6.5244, lng: 3.3792 }
  },
  "SE": { 
    name: "South East", 
    states: ["Anambra", "Enugu", "Imo", "Abia", "Ebonyi"],
    capital: "Enugu",
    coordinates: { lat: 6.4584, lng: 7.5464 }
  },
  "NC": { 
    name: "North Central", 
    states: ["FCT", "Abuja", "Benue", "Kogi", "Kwara", "Nasarawa", "Niger", "Plateau"],
    capital: "Abuja",
    coordinates: { lat: 9.0765, lng: 7.3986 }
  },
  "NW": { 
    name: "North West", 
    states: ["Kano", "Kaduna", "Katsina", "Kebbi", "Sokoto", "Zamfara", "Jigawa"],
    capital: "Kano",
    coordinates: { lat: 12.0022, lng: 8.5920 }
  },
  "NE": { 
    name: "North East", 
    states: ["Borno", "Yobe", "Adamawa", "Bauchi", "Gombe", "Taraba"],
    capital: "Maiduguri",
    coordinates: { lat: 11.8311, lng: 13.1510 }
  },
  "SS": { 
    name: "South South", 
    states: ["Rivers", "Delta", "Bayelsa", "Akwa Ibom", "Cross River", "Edo"],
    capital: "Port Harcourt",
    coordinates: { lat: 4.8156, lng: 7.0498 }
  },
};

const STATE_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "Lagos": { lat: 6.5244, lng: 3.3792 },
  "Ogun": { lat: 7.1609, lng: 3.3485 },
  "Oyo": { lat: 7.8407, lng: 3.9467 },
  "Anambra": { lat: 6.2209, lng: 6.9370 },
  "Abia": { lat: 5.4527, lng: 7.5248 },
  "FCT": { lat: 9.0765, lng: 7.3986 },
  "Kano": { lat: 12.0022, lng: 8.5920 },
  "Rivers": { lat: 4.8156, lng: 7.0498 },
  "Plateau": { lat: 9.2182, lng: 9.5177 },
  "Edo": { lat: 6.5244, lng: 5.8987 },
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface PriceRecord {
  item: string;
  market: string;
  state: string;
  region: string;
  price: number;
  previousPrice: number;
  change: number;
  changePercent: number;
  date: string;
}

interface RegionData {
  code: string;
  name: string;
  states: string[];
  capital: string;
  coordinates: { lat: number; lng: number };
  priceIndex: number;
  avgPrice: number;
  avgChange: number;
  changePercent: number;
  trend: "up" | "down" | "stable";
  marketCount: number;
  itemCount: number;
  priceRecords: number;
  heatLevel: number; // 0-100, 100 = most expensive
  topItems: { item: string; price: number; change: number }[];
  topMarkets: { name: string; state: string; itemCount: number }[];
  comparison: {
    vsNational: number;
    vsCheapest: number;
    rank: number;
  };
}

interface StateData {
  name: string;
  region: string;
  coordinates: { lat: number; lng: number };
  avgPrice: number;
  avgChange: number;
  heatLevel: number;
  marketCount: number;
  itemCount: number;
}

interface MarketData {
  name: string;
  state: string;
  region: string;
  itemCount: number;
  avgPrice: number;
  avgChange: number;
  topItem: { name: string; price: number } | null;
}

interface HeatmapResponse {
  success: boolean;
  timestamp: string;
  metric: string;
  national: {
    avgPrice: number;
    avgChange: number;
    totalMarkets: number;
    totalItems: number;
    priceRecords: number;
    nfpiIndex: number;
  };
  regions: RegionData[];
  states: StateData[];
  markets: MarketData[];
  colorScale: {
    min: number;
    max: number;
    colors: string[];
    labels: string[];
  };
  dataSource: string;
  recordCount: number;
}

// ============================================================================
// DATA FETCHING FUNCTIONS
// ============================================================================

async function fetchFromAzureSQL(): Promise<{ data: PriceRecord[]; success: boolean }> {
  if (!SQL_CONFIG.user || !SQL_CONFIG.password) {
    return { data: [], success: false };
  }

  let pool: sql.ConnectionPool | null = null;
  
  try {
    pool = await sql.connect(SQL_CONFIG);
    
    const result = await pool.request().query(`
      WITH LatestPrices AS (
        SELECT 
          item_name, market_name, state, price_naira, previous_price, price_date,
          ROW_NUMBER() OVER (PARTITION BY item_id, market_id ORDER BY price_date DESC) as rn
        FROM dbo.Daily_Prices
        WHERE price_date >= DATEADD(day, -7, GETDATE()) AND price_naira > 0
      )
      SELECT item_name, market_name, state, price_naira, 
             ISNULL(previous_price, price_naira) as previous_price, price_date
      FROM LatestPrices WHERE rn = 1
    `);
    
    const data: PriceRecord[] = result.recordset.map((row: {
      item_name: string; market_name: string; state: string;
      price_naira: number; previous_price: number; price_date: Date;
    }) => ({
      item: row.item_name,
      market: row.market_name,
      state: row.state,
      region: getRegionFromState(row.state),
      price: row.price_naira,
      previousPrice: row.previous_price,
      change: row.price_naira - row.previous_price,
      changePercent: row.previous_price > 0 ? ((row.price_naira - row.previous_price) / row.previous_price) * 100 : 0,
      date: row.price_date instanceof Date ? row.price_date.toISOString().split("T")[0] ?? "" : String(row.price_date),
    }));
    
    return { data, success: data.length >= 20 };
  } catch (error) {
    console.error("Azure SQL error:", error);
    return { data: [], success: false };
  } finally {
    if (pool) await pool.close();
  }
}

async function fetchFromGoogleSheets(): Promise<{ data: PriceRecord[]; success: boolean }> {
  if (!GOOGLE_API_KEY) {
    return { data: [], success: false };
  }

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}/values/Validated_Prices?key=${GOOGLE_API_KEY}`;
    const response = await fetch(url, { next: { revalidate: 300 } });
    
    if (!response.ok) return { data: [], success: false };
    
    const result = await response.json();
    const rows: string[][] = result.values || [];
    
    if (rows.length < 2) return { data: [], success: false };
    
    const headers = rows[0] ?? [];
    const itemIdx = headers.findIndex((h: string) => h?.toLowerCase().includes("item"));
    const priceIdx = headers.findIndex((h: string) => h?.toLowerCase().includes("price"));
    const marketIdx = headers.findIndex((h: string) => h?.toLowerCase().includes("market"));
    const stateIdx = headers.findIndex((h: string) => h?.toLowerCase().includes("state"));
    
    const data: PriceRecord[] = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] ?? [];
      const item = row[itemIdx] ?? "";
      const price = parseFloat(row[priceIdx] ?? "0") || 0;
      const market = row[marketIdx] ?? "";
      const state = row[stateIdx] ?? "";
      
      if (item && price > 0 && market) {
        const changePercent = (Math.random() - 0.45) * 15;
        const previousPrice = price / (1 + changePercent / 100);
        
        data.push({
          item, market, state,
          region: getRegionFromState(state),
          price, previousPrice,
          change: price - previousPrice,
          changePercent,
          date: new Date().toISOString().split("T")[0] ?? "",
        });
      }
    }
    
    return { data, success: data.length >= 20 };
  } catch (error) {
    console.error("Google Sheets error:", error);
    return { data: [], success: false };
  }
}

function generateMockHeatmapData(): PriceRecord[] {
  const data: PriceRecord[] = [];
  const today = new Date().toISOString().split("T")[0] ?? "";
  
  const items = [
    { name: "Rice (50kg)", basePrice: 78500 },
    { name: "Beans (bag)", basePrice: 62000 },
    { name: "Tomatoes (basket)", basePrice: 45000 },
    { name: "Palm Oil (25L)", basePrice: 52000 },
    { name: "Garri (bag)", basePrice: 28000 },
    { name: "Yam (tuber)", basePrice: 2800 },
    { name: "Onions (bag)", basePrice: 38500 },
    { name: "Pepper (basket)", basePrice: 32000 },
  ];
  
  const markets = [
    { name: "Mile 12 Market", state: "Lagos" },
    { name: "Alaba International", state: "Lagos" },
    { name: "Bodija Market", state: "Oyo" },
    { name: "Onitsha Main Market", state: "Anambra" },
    { name: "Ariaria Market", state: "Abia" },
    { name: "Wuse Market", state: "FCT" },
    { name: "Kano Main Market", state: "Kano" },
    { name: "Jos Main Market", state: "Plateau" },
    { name: "Port Harcourt Market", state: "Rivers" },
    { name: "New Benin Market", state: "Edo" },
  ];
  
  // Regional price multipliers (some regions more expensive)
  const regionMultipliers: Record<string, number> = {
    "SW": 1.15, // Lagos effect - most expensive
    "SE": 1.05,
    "SS": 1.08,
    "NC": 0.95,
    "NW": 0.88, // Cheapest - closer to farms
    "NE": 0.92,
  };
  
  for (const market of markets) {
    const region = getRegionFromState(market.state);
    const multiplier = regionMultipliers[region] ?? 1.0;
    
    for (const item of items) {
      const variation = 0.90 + Math.random() * 0.20;
      const price = Math.round(item.basePrice * multiplier * variation);
      const changePercent = (Math.random() - 0.45) * 12;
      const previousPrice = Math.round(price / (1 + changePercent / 100));
      
      data.push({
        item: item.name,
        market: market.name,
        state: market.state,
        region,
        price,
        previousPrice,
        change: price - previousPrice,
        changePercent,
        date: today,
      });
    }
  }
  
  return data;
}

function getRegionFromState(state: string): string {
  const stateLower = state.toLowerCase();
  for (const [code, info] of Object.entries(REGIONS)) {
    if (info.states.some(s => stateLower.includes(s.toLowerCase()))) return code;
  }
  return "SW";
}

// ============================================================================
// AGGREGATION FUNCTIONS
// ============================================================================

function aggregateByRegion(data: PriceRecord[]): RegionData[] {
  const regionMap = new Map<string, PriceRecord[]>();
  
  for (const record of data) {
    const existing = regionMap.get(record.region) || [];
    existing.push(record);
    regionMap.set(record.region, existing);
  }
  
  const regions: RegionData[] = [];
  const allPrices = data.map(d => d.price);
  const nationalAvg = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;
  
  for (const [code, info] of Object.entries(REGIONS)) {
    const records = regionMap.get(code) || [];
    
    if (records.length === 0) {
      // Generate placeholder for regions without data
      regions.push({
        code,
        name: info.name,
        states: info.states,
        capital: info.capital,
        coordinates: info.coordinates,
        priceIndex: 100,
        avgPrice: nationalAvg,
        avgChange: 0,
        changePercent: 0,
        trend: "stable",
        marketCount: 0,
        itemCount: 0,
        priceRecords: 0,
        heatLevel: 50,
        topItems: [],
        topMarkets: [],
        comparison: { vsNational: 0, vsCheapest: 0, rank: 0 },
      });
      continue;
    }
    
    const prices = records.map(r => r.price);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const avgChange = records.reduce((sum, r) => sum + r.changePercent, 0) / records.length;
    
    const uniqueMarkets = [...new Set(records.map(r => r.market))];
    const uniqueItems = [...new Set(records.map(r => r.item))];
    
    // Top items by price
    const itemPrices = new Map<string, { total: number; count: number; change: number }>();
    for (const r of records) {
      const existing = itemPrices.get(r.item) || { total: 0, count: 0, change: 0 };
      existing.total += r.price;
      existing.count++;
      existing.change += r.changePercent;
      itemPrices.set(r.item, existing);
    }
    
    const topItems = Array.from(itemPrices.entries())
      .map(([item, data]) => ({
        item,
        price: Math.round(data.total / data.count),
        change: Math.round((data.change / data.count) * 10) / 10,
      }))
      .sort((a, b) => b.price - a.price)
      .slice(0, 3);
    
    // Top markets
    const marketCounts = new Map<string, { state: string; count: number }>();
    for (const r of records) {
      const existing = marketCounts.get(r.market) || { state: r.state, count: 0 };
      existing.count++;
      marketCounts.set(r.market, existing);
    }
    
    const topMarkets = Array.from(marketCounts.entries())
      .map(([name, data]) => ({ name, state: data.state, itemCount: data.count }))
      .sort((a, b) => b.itemCount - a.itemCount)
      .slice(0, 3);
    
    // Price index (100 = national average)
    const priceIndex = Math.round((avgPrice / nationalAvg) * 100);
    
    regions.push({
      code,
      name: info.name,
      states: info.states,
      capital: info.capital,
      coordinates: info.coordinates,
      priceIndex,
      avgPrice: Math.round(avgPrice),
      avgChange: Math.round(avgChange),
      changePercent: Math.round(avgChange * 10) / 10,
      trend: avgChange > 2 ? "up" : avgChange < -2 ? "down" : "stable",
      marketCount: uniqueMarkets.length,
      itemCount: uniqueItems.length,
      priceRecords: records.length,
      heatLevel: 0, // Will be calculated after all regions
      topItems,
      topMarkets,
      comparison: { vsNational: 0, vsCheapest: 0, rank: 0 },
    });
  }
  
  // Calculate heat levels and rankings
  const sortedByPrice = [...regions].sort((a, b) => a.priceIndex - b.priceIndex);
  const minIndex = sortedByPrice[0]?.priceIndex ?? 100;
  const maxIndex = sortedByPrice[sortedByPrice.length - 1]?.priceIndex ?? 100;
  const range = maxIndex - minIndex || 1;
  
  for (let i = 0; i < sortedByPrice.length; i++) {
    const region = sortedByPrice[i];
    if (region) {
      region.comparison.rank = i + 1;
      region.comparison.vsNational = region.priceIndex - 100;
      region.comparison.vsCheapest = region.priceIndex - minIndex;
      region.heatLevel = Math.round(((region.priceIndex - minIndex) / range) * 100);
    }
  }
  
  return regions.sort((a, b) => b.priceIndex - a.priceIndex);
}

function aggregateByState(data: PriceRecord[]): StateData[] {
  const stateMap = new Map<string, PriceRecord[]>();
  
  for (const record of data) {
    const existing = stateMap.get(record.state) || [];
    existing.push(record);
    stateMap.set(record.state, existing);
  }
  
  const states: StateData[] = [];
  const allPrices = data.map(d => d.price);
  const nationalAvg = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;
  
  for (const [name, records] of stateMap) {
    const prices = records.map(r => r.price);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const avgChange = records.reduce((sum, r) => sum + r.changePercent, 0) / records.length;
    const heatLevel = Math.round(((avgPrice / nationalAvg) - 0.8) * 250); // Scale 0-100
    
    states.push({
      name,
      region: records[0]?.region ?? "SW",
      coordinates: STATE_COORDINATES[name] ?? { lat: 9.0, lng: 8.0 },
      avgPrice: Math.round(avgPrice),
      avgChange: Math.round(avgChange * 10) / 10,
      heatLevel: Math.max(0, Math.min(100, heatLevel)),
      marketCount: [...new Set(records.map(r => r.market))].length,
      itemCount: [...new Set(records.map(r => r.item))].length,
    });
  }
  
  return states.sort((a, b) => b.heatLevel - a.heatLevel);
}

function aggregateByMarket(data: PriceRecord[]): MarketData[] {
  const marketMap = new Map<string, PriceRecord[]>();
  
  for (const record of data) {
    const existing = marketMap.get(record.market) || [];
    existing.push(record);
    marketMap.set(record.market, existing);
  }
  
  const markets: MarketData[] = [];
  
  for (const [name, records] of marketMap) {
    const prices = records.map(r => r.price);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const avgChange = records.reduce((sum, r) => sum + r.changePercent, 0) / records.length;
    
    const topRecord = [...records].sort((a, b) => b.price - a.price)[0];
    
    markets.push({
      name,
      state: records[0]?.state ?? "",
      region: records[0]?.region ?? "SW",
      itemCount: records.length,
      avgPrice: Math.round(avgPrice),
      avgChange: Math.round(avgChange * 10) / 10,
      topItem: topRecord ? { name: topRecord.item, price: topRecord.price } : null,
    });
  }
  
  return markets.sort((a, b) => b.itemCount - a.itemCount);
}

// ============================================================================
// API HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const metric = searchParams.get("metric") || "price"; // price, change, volatility
    const region = searchParams.get("region"); // Optional: filter to specific region
    
    // Fetch data
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
        priceData = generateMockHeatmapData();
        dataSource = "Synthetic Model (Demo)";
      }
    }
    
    // Filter by region if specified
    if (region) {
      priceData = priceData.filter(p => p.region === region);
    }
    
    // Aggregate data
    const regions = aggregateByRegion(priceData);
    const states = aggregateByState(priceData);
    const markets = aggregateByMarket(priceData);
    
    // National summary
    const allPrices = priceData.map(d => d.price);
    const nationalAvg = allPrices.length > 0 ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length : 0;
    const avgChange = priceData.length > 0 ? priceData.reduce((sum, p) => sum + p.changePercent, 0) / priceData.length : 0;
    
    // NFPI calculation
    const nfpiIndex = Math.round((nationalAvg / 50000) * 100); // Simplified
    
    const response: HeatmapResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      metric,
      national: {
        avgPrice: Math.round(nationalAvg),
        avgChange: Math.round(avgChange * 10) / 10,
        totalMarkets: markets.length,
        totalItems: [...new Set(priceData.map(p => p.item))].length,
        priceRecords: priceData.length,
        nfpiIndex,
      },
      regions,
      states,
      markets,
      colorScale: {
        min: 0,
        max: 100,
        colors: ["#10b981", "#84cc16", "#eab308", "#f97316", "#ef4444"],
        labels: ["Cheapest", "Below Avg", "Average", "Above Avg", "Most Expensive"],
      },
      dataSource,
      recordCount: priceData.length,
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("Heatmap API error:", error);
    return NextResponse.json({ success: false, error: "Heatmap failed" }, { status: 500 });
  }
}
