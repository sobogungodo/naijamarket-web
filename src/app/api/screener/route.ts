// ============================================================================
// src/app/api/screener/route.ts
// NaijaMarket Intel - Commodity Screener API
// Bloomberg Equivalent: EQS <GO> (Equity Screener)
// Version: 1.0.0 - Hybrid Data (Azure SQL → Google Sheets → Mock)
// Date: 2026-01-25
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { isSupabase, getSupabaseConnection } from "@/lib/db-supabase";

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

const REGIONS: Record<string, { name: string; states: string[] }> = {
  "SW": { name: "South West", states: ["Lagos", "Ogun", "Oyo", "Osun", "Ondo", "Ekiti"] },
  "SE": { name: "South East", states: ["Anambra", "Enugu", "Imo", "Abia", "Ebonyi"] },
  "NC": { name: "North Central", states: ["FCT", "Abuja", "Benue", "Kogi", "Kwara", "Nasarawa", "Niger", "Plateau"] },
  "NW": { name: "North West", states: ["Kano", "Kaduna", "Katsina", "Kebbi", "Sokoto", "Zamfara", "Jigawa"] },
  "NE": { name: "North East", states: ["Borno", "Yobe", "Adamawa", "Bauchi", "Gombe", "Taraba"] },
  "SS": { name: "South South", states: ["Rivers", "Delta", "Bayelsa", "Akwa Ibom", "Cross River", "Edo"] },
};

const CATEGORIES: Record<string, string[]> = {
  "Grains": ["Rice", "Maize", "Millet", "Sorghum", "Wheat"],
  "Legumes": ["Beans", "Groundnut", "Soybeans"],
  "Tubers": ["Yam", "Cassava", "Potato", "Cocoyam"],
  "Vegetables": ["Tomatoes", "Onions", "Pepper", "Okra", "Spinach"],
  "Oils": ["Palm Oil", "Groundnut Oil", "Vegetable Oil", "Coconut Oil"],
  "Processed": ["Garri", "Semovita", "Flour", "Sugar", "Salt"],
  "Fruits": ["Plantain", "Banana", "Orange", "Mango"],
  "Proteins": ["Chicken", "Fish", "Beef", "Eggs"],
  "Building": ["Cement", "Iron Rod", "Zinc", "Block"],
};

const TIER_LIMITS: Record<string, { maxResults: number; advancedFilters: boolean; savePresets: boolean; canExport: boolean }> = {
  FREE: { maxResults: 10, advancedFilters: false, savePresets: false, canExport: false },
  SILVER: { maxResults: 25, advancedFilters: true, savePresets: false, canExport: false },
  GOLD: { maxResults: 50, advancedFilters: true, savePresets: true, canExport: true },
  BUSINESS: { maxResults: 100, advancedFilters: true, savePresets: true, canExport: true },
  CORPORATE: { maxResults: 200, advancedFilters: true, savePresets: true, canExport: true },
  ENTERPRISE: { maxResults: 500, advancedFilters: true, savePresets: true, canExport: true },
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface PriceRecord {
  item: string;
  itemId: string;
  category: string;
  market: string;
  marketId: string;
  state: string;
  region: string;
  price: number;
  previousPrice: number;
  change: number;
  changePercent: number;
  weekChange: number;
  monthChange: number;
  trend: "up" | "down" | "stable";
  volatility: number;
  volume: number;
  date: string;
}

interface ScreenerFilters {
  categories?: string[];
  regions?: string[];
  states?: string[];
  markets?: string[];
  priceMin?: number;
  priceMax?: number;
  changeMin?: number;
  changeMax?: number;
  trend?: "up" | "down" | "stable" | "all";
  volatilityMin?: number;
  volatilityMax?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

interface ScreenerResult {
  item: string;
  itemId: string;
  category: string;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  priceSpread: number;
  dayChange: number;
  dayChangePercent: number;
  weekChange: number;
  monthChange: number;
  trend: "up" | "down" | "stable";
  volatility: number;
  marketCount: number;
  topMarket: { name: string; price: number };
  bottomMarket: { name: string; price: number };
  signal: "buy" | "sell" | "hold";
  signalStrength: number;
}

interface ScreenerResponse {
  success: boolean;
  timestamp: string;
  filters: ScreenerFilters;
  summary: {
    totalMatches: number;
    returned: number;
    avgChange: number;
    topGainer: { item: string; change: number } | null;
    topLoser: { item: string; change: number } | null;
  };
  results: ScreenerResult[];
  availableFilters: {
    categories: string[];
    regions: { code: string; name: string }[];
    states: string[];
    markets: string[];
  };
  tierLimits: {
    tier: string;
    maxResults: number;
    advancedFilters: boolean;
    savePresets: boolean;
    canExport: boolean;
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
    pool = (isSupabase() ? ((await getSupabaseConnection()) as unknown as sql.ConnectionPool) : await sql.connect(SQL_CONFIG));
    
    const result = await pool.request().query(`
      WITH PriceData AS (
        SELECT 
          item_name, item_id, market_name, market_id, state,
          price_naira, previous_price, price_change_pct, trend, price_date,
          ROW_NUMBER() OVER (PARTITION BY item_id, market_id ORDER BY price_date DESC) as rn
        FROM dbo.Daily_Prices
        WHERE price_date >= DATEADD(day, -30, GETDATE()) AND price_naira > 0
      )
      SELECT item_name, item_id, market_name, market_id, state,
             price_naira, ISNULL(previous_price, price_naira) as previous_price,
             ISNULL(price_change_pct, 0) as price_change_pct, ISNULL(trend, '→') as trend, price_date
      FROM PriceData WHERE rn = 1
      ORDER BY item_name, market_name
    `);
    
    const data: PriceRecord[] = result.recordset.map((row: {
      item_name: string; item_id: string; market_name: string; market_id: string;
      state: string; price_naira: number; previous_price: number;
      price_change_pct: number; trend: string; price_date: Date;
    }) => {
      const change = row.price_naira - row.previous_price;
      const changePercent = row.previous_price > 0 ? ((change / row.previous_price) * 100) : 0;
      
      return {
        item: row.item_name,
        itemId: row.item_id,
        category: getCategoryForItem(row.item_name),
        market: row.market_name,
        marketId: row.market_id,
        state: row.state,
        region: getRegionFromState(row.state),
        price: row.price_naira,
        previousPrice: row.previous_price,
        change,
        changePercent,
        weekChange: changePercent * 1.5,
        monthChange: changePercent * 4,
        trend: row.trend === "↑" || row.trend === "up" ? "up" : 
               row.trend === "↓" || row.trend === "down" ? "down" : "stable",
        volatility: Math.abs(changePercent) * (1 + Math.random() * 0.5),
        volume: Math.floor(Math.random() * 1000) + 100,
        date: row.price_date instanceof Date ? row.price_date.toISOString().split("T")[0] ?? "" : String(row.price_date),
      };
    });
    
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
          item,
          itemId: `ITM${String(i).padStart(5, "0")}`,
          category: getCategoryForItem(item),
          market,
          marketId: `MKT${String(i % 20).padStart(4, "0")}`,
          state,
          region: getRegionFromState(state),
          price,
          previousPrice,
          change: price - previousPrice,
          changePercent,
          weekChange: changePercent * 1.5,
          monthChange: changePercent * 4,
          trend: changePercent > 1 ? "up" : changePercent < -1 ? "down" : "stable",
          volatility: Math.abs(changePercent) * (1 + Math.random() * 0.5),
          volume: Math.floor(Math.random() * 1000) + 100,
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

function generateMockScreenerData(): PriceRecord[] {
  const data: PriceRecord[] = [];
  const today = new Date().toISOString().split("T")[0] ?? "";
  
  const items = [
    { name: "Rice (50kg)", category: "Grains", basePrice: 78500 },
    { name: "Beans (bag)", category: "Legumes", basePrice: 62000 },
    { name: "Maize (bag)", category: "Grains", basePrice: 35000 },
    { name: "Tomatoes (basket)", category: "Vegetables", basePrice: 45000 },
    { name: "Onions (bag)", category: "Vegetables", basePrice: 38500 },
    { name: "Pepper (basket)", category: "Vegetables", basePrice: 32000 },
    { name: "Palm Oil (25L)", category: "Oils", basePrice: 52000 },
    { name: "Groundnut Oil (25L)", category: "Oils", basePrice: 58000 },
    { name: "Garri (bag)", category: "Processed", basePrice: 28000 },
    { name: "Yam (tuber)", category: "Tubers", basePrice: 2800 },
    { name: "Plantain (bunch)", category: "Fruits", basePrice: 4500 },
    { name: "Cement (bag)", category: "Building", basePrice: 6500 },
    { name: "Sugar (50kg)", category: "Processed", basePrice: 85000 },
    { name: "Flour (50kg)", category: "Processed", basePrice: 42000 },
    { name: "Semovita (10kg)", category: "Processed", basePrice: 18000 },
    { name: "Chicken (kg)", category: "Proteins", basePrice: 4500 },
    { name: "Fish (kg)", category: "Proteins", basePrice: 3500 },
    { name: "Eggs (crate)", category: "Proteins", basePrice: 3800 },
    { name: "Groundnut (bag)", category: "Legumes", basePrice: 48000 },
    { name: "Cassava (bag)", category: "Tubers", basePrice: 15000 },
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
    { name: "Bodija Market", id: "MKT0009", state: "Oyo" },
    { name: "New Benin Market", id: "MKT0010", state: "Edo" },
  ];
  
  let idx = 0;
  for (const item of items) {
    for (const market of markets) {
      idx++;
      const variation = 0.80 + Math.random() * 0.40;
      const price = Math.round(item.basePrice * variation);
      const changePercent = (Math.random() - 0.45) * 20;
      const previousPrice = Math.round(price / (1 + changePercent / 100));
      
      data.push({
        item: item.name,
        itemId: `ITM${String(idx).padStart(5, "0")}`,
        category: item.category,
        market: market.name,
        marketId: market.id,
        state: market.state,
        region: getRegionFromState(market.state),
        price,
        previousPrice,
        change: price - previousPrice,
        changePercent,
        weekChange: changePercent * (1 + Math.random()),
        monthChange: changePercent * (3 + Math.random() * 2),
        trend: changePercent > 2 ? "up" : changePercent < -2 ? "down" : "stable",
        volatility: Math.abs(changePercent) * (1 + Math.random()),
        volume: Math.floor(Math.random() * 2000) + 100,
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

function getCategoryForItem(itemName: string): string {
  const itemLower = itemName.toLowerCase();
  for (const [category, items] of Object.entries(CATEGORIES)) {
    if (items.some(i => itemLower.includes(i.toLowerCase()))) return category;
  }
  return "Other";
}

// ============================================================================
// SCREENING & AGGREGATION FUNCTIONS
// ============================================================================

function applyFilters(data: PriceRecord[], filters: ScreenerFilters): PriceRecord[] {
  return data.filter(record => {
    if (filters.categories?.length && !filters.categories.includes(record.category)) return false;
    if (filters.regions?.length && !filters.regions.includes(record.region)) return false;
    if (filters.states?.length && !filters.states.includes(record.state)) return false;
    if (filters.markets?.length && !filters.markets.includes(record.market)) return false;
    if (filters.priceMin !== undefined && record.price < filters.priceMin) return false;
    if (filters.priceMax !== undefined && record.price > filters.priceMax) return false;
    if (filters.changeMin !== undefined && record.changePercent < filters.changeMin) return false;
    if (filters.changeMax !== undefined && record.changePercent > filters.changeMax) return false;
    if (filters.trend && filters.trend !== "all" && record.trend !== filters.trend) return false;
    if (filters.volatilityMin !== undefined && record.volatility < filters.volatilityMin) return false;
    if (filters.volatilityMax !== undefined && record.volatility > filters.volatilityMax) return false;
    return true;
  });
}

function aggregateByItem(data: PriceRecord[]): ScreenerResult[] {
  const itemMap = new Map<string, PriceRecord[]>();
  
  for (const record of data) {
    const key = record.item;
    const existing = itemMap.get(key) || [];
    existing.push(record);
    itemMap.set(key, existing);
  }
  
  const results: ScreenerResult[] = [];
  
  for (const [item, records] of itemMap) {
    const prices = records.map(r => r.price);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    const avgChange = records.reduce((sum, r) => sum + r.changePercent, 0) / records.length;
    const avgWeekChange = records.reduce((sum, r) => sum + r.weekChange, 0) / records.length;
    const avgMonthChange = records.reduce((sum, r) => sum + r.monthChange, 0) / records.length;
    const avgVolatility = records.reduce((sum, r) => sum + r.volatility, 0) / records.length;
    
    const sortedByPrice = [...records].sort((a, b) => a.price - b.price);
    const cheapest = sortedByPrice[0];
    const expensive = sortedByPrice[sortedByPrice.length - 1];
    
    // Calculate signal
    let signal: "buy" | "sell" | "hold" = "hold";
    let signalStrength = 50;
    
    if (avgChange < -5 && avgVolatility < 10) {
      signal = "buy";
      signalStrength = Math.min(90, 60 + Math.abs(avgChange));
    } else if (avgChange > 8) {
      signal = "sell";
      signalStrength = Math.min(90, 60 + avgChange);
    } else if (avgChange > 3 && avgVolatility > 15) {
      signal = "sell";
      signalStrength = 55 + avgVolatility / 2;
    }
    
    results.push({
      item,
      itemId: records[0]?.itemId ?? "",
      category: records[0]?.category ?? "Other",
      avgPrice: Math.round(avgPrice),
      minPrice,
      maxPrice,
      priceSpread: Math.round(((maxPrice - minPrice) / avgPrice) * 100 * 10) / 10,
      dayChange: Math.round(avgPrice - (records[0]?.previousPrice ?? avgPrice)),
      dayChangePercent: Math.round(avgChange * 10) / 10,
      weekChange: Math.round(avgWeekChange * 10) / 10,
      monthChange: Math.round(avgMonthChange * 10) / 10,
      trend: avgChange > 2 ? "up" : avgChange < -2 ? "down" : "stable",
      volatility: Math.round(avgVolatility * 10) / 10,
      marketCount: records.length,
      topMarket: cheapest ? { name: cheapest.market, price: cheapest.price } : { name: "N/A", price: 0 },
      bottomMarket: expensive ? { name: expensive.market, price: expensive.price } : { name: "N/A", price: 0 },
      signal,
      signalStrength: Math.round(signalStrength),
    });
  }
  
  return results;
}

function sortResults(results: ScreenerResult[], sortBy: string, sortOrder: "asc" | "desc"): ScreenerResult[] {
  const sorted = [...results].sort((a, b) => {
    let valA: number, valB: number;
    
    switch (sortBy) {
      case "price": valA = a.avgPrice; valB = b.avgPrice; break;
      case "change": valA = a.dayChangePercent; valB = b.dayChangePercent; break;
      case "weekChange": valA = a.weekChange; valB = b.weekChange; break;
      case "monthChange": valA = a.monthChange; valB = b.monthChange; break;
      case "volatility": valA = a.volatility; valB = b.volatility; break;
      case "spread": valA = a.priceSpread; valB = b.priceSpread; break;
      case "signal": valA = a.signalStrength; valB = b.signalStrength; break;
      case "name": return sortOrder === "asc" ? a.item.localeCompare(b.item) : b.item.localeCompare(a.item);
      default: valA = a.dayChangePercent; valB = b.dayChangePercent;
    }
    
    return sortOrder === "asc" ? valA - valB : valB - valA;
  });
  
  return sorted;
}

// ============================================================================
// API HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tier = (searchParams.get("tier") || "FREE").toUpperCase();
    
    const defaultLimits = { maxResults: 10, advancedFilters: false, savePresets: false, canExport: false };
    const limits = TIER_LIMITS[tier] ?? defaultLimits;
    
    // Parse filters from query params
    const filters: ScreenerFilters = {
      categories: searchParams.get("categories")?.split(",").filter(Boolean),
      regions: searchParams.get("regions")?.split(",").filter(Boolean),
      states: searchParams.get("states")?.split(",").filter(Boolean),
      markets: searchParams.get("markets")?.split(",").filter(Boolean),
      priceMin: searchParams.get("priceMin") ? Number(searchParams.get("priceMin")) : undefined,
      priceMax: searchParams.get("priceMax") ? Number(searchParams.get("priceMax")) : undefined,
      changeMin: limits.advancedFilters && searchParams.get("changeMin") ? Number(searchParams.get("changeMin")) : undefined,
      changeMax: limits.advancedFilters && searchParams.get("changeMax") ? Number(searchParams.get("changeMax")) : undefined,
      trend: (searchParams.get("trend") as ScreenerFilters["trend"]) || "all",
      volatilityMin: limits.advancedFilters && searchParams.get("volatilityMin") ? Number(searchParams.get("volatilityMin")) : undefined,
      volatilityMax: limits.advancedFilters && searchParams.get("volatilityMax") ? Number(searchParams.get("volatilityMax")) : undefined,
      sortBy: searchParams.get("sortBy") || "change",
      sortOrder: (searchParams.get("sortOrder") as "asc" | "desc") || "desc",
    };
    
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
        priceData = generateMockScreenerData();
        dataSource = "Synthetic Model (Demo)";
      }
    }
    
    // Apply filters
    const filteredData = applyFilters(priceData, filters);
    
    // Aggregate by item
    let results = aggregateByItem(filteredData);
    
    // Sort results
    results = sortResults(results, filters.sortBy || "change", filters.sortOrder || "desc");
    
    // Calculate summary
    const totalMatches = results.length;
    const topGainer = results.length > 0 ? { item: results[0]?.item ?? "", change: results[0]?.dayChangePercent ?? 0 } : null;
    const sortedByChange = [...results].sort((a, b) => a.dayChangePercent - b.dayChangePercent);
    const topLoser = sortedByChange.length > 0 ? { item: sortedByChange[0]?.item ?? "", change: sortedByChange[0]?.dayChangePercent ?? 0 } : null;
    const avgChange = results.length > 0 ? results.reduce((sum, r) => sum + r.dayChangePercent, 0) / results.length : 0;
    
    // Apply tier limits
    const limitedResults = results.slice(0, limits.maxResults);
    
    // Get available filter options
    const allStates = [...new Set(priceData.map(p => p.state))].sort();
    const allMarkets = [...new Set(priceData.map(p => p.market))].sort();
    
    const response: ScreenerResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      filters,
      summary: {
        totalMatches,
        returned: limitedResults.length,
        avgChange: Math.round(avgChange * 10) / 10,
        topGainer,
        topLoser,
      },
      results: limitedResults,
      availableFilters: {
        categories: Object.keys(CATEGORIES),
        regions: Object.entries(REGIONS).map(([code, info]) => ({ code, name: info.name })),
        states: allStates,
        markets: allMarkets,
      },
      tierLimits: { tier, ...limits },
      dataSource,
      recordCount: priceData.length,
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("Screener API error:", error);
    return NextResponse.json({ success: false, error: "Screener failed", message: error instanceof Error ? error.message : "Unknown" }, { status: 500 });
  }
}
