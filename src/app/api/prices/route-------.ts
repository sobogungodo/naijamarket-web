// ============================================================================
// src/app/api/prices/route.ts
// NaijaMarket Intel - Live Prices API
// Version: 8.2.0 - Fixed for NVARCHAR category_id (CAT001, CAT002, etc.)
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// TYPES
// ============================================================================

interface PriceRecord {
  id: string;
  item_name: string;
  item_variant: string | null;
  category: string;
  market_name: string;
  state: string;
  price_naira: number;
  change_percent: number;
  change_amount: number;
  low_24h: number;
  high_24h: number;
  confidence: number;
  validators: number;
  updated_at: string;
  source: string;
  unit: string;
  trend: string;
}

interface FilterOptions {
  categories: string[];
  states: string[];
  markets: string[];
}

// Category mapping - supports BOTH integer and string IDs
const CATEGORY_MAP: Record<string, string> = {
  // Integer IDs (as strings)
  "1": "Grains & Cereals",
  "2": "Tubers",
  "3": "Vegetables",
  "4": "Fruits",
  "5": "Oils & Fats",
  "6": "Protein",
  "7": "Dairy",
  "8": "Sweeteners",
  "9": "Beverages",
  "10": "Building Materials",
  "11": "Livestock",
  "12": "Fish & Seafood",
  "13": "Condiments",
  "14": "Processed Foods",
  // String IDs (CAT001, CAT002, etc.)
  "CAT001": "Grains & Cereals",
  "CAT002": "Tubers",
  "CAT003": "Vegetables",
  "CAT004": "Fruits",
  "CAT005": "Oils & Fats",
  "CAT006": "Protein",
  "CAT007": "Dairy",
  "CAT008": "Sweeteners",
  "CAT009": "Beverages",
  "CAT010": "Building Materials",
  "CAT011": "Livestock",
  "CAT012": "Fish & Seafood",
  "CAT013": "Condiments",
  "CAT014": "Processed Foods",
};

// ============================================================================
// MOCK DATA FALLBACK
// ============================================================================

function generateMockData(): { prices: PriceRecord[]; filters: FilterOptions } {
  const items = [
    { name: "Rice", variant: "Foreign 50kg", category: "Grains & Cereals", basePrice: 82000 },
    { name: "Rice", variant: "Local 50kg", category: "Grains & Cereals", basePrice: 65000 },
    { name: "Beans", variant: "Brown 50kg", category: "Grains & Cereals", basePrice: 120000 },
    { name: "Garri", variant: "White 50kg", category: "Tubers", basePrice: 45000 },
    { name: "Yam", variant: "Single Tuber", category: "Tubers", basePrice: 2500 },
    { name: "Palm Oil", variant: "25 Litres", category: "Oils & Fats", basePrice: 45000 },
    { name: "Groundnut Oil", variant: "25 Litres", category: "Oils & Fats", basePrice: 55000 },
    { name: "Tomatoes", variant: "Big Basket", category: "Vegetables", basePrice: 35000 },
    { name: "Pepper", variant: "Big Basket", category: "Vegetables", basePrice: 28000 },
    { name: "Onions", variant: "Big Bag", category: "Vegetables", basePrice: 85000 },
    { name: "Chicken", variant: "Whole (1kg)", category: "Protein", basePrice: 5500 },
    { name: "Beef", variant: "1kg", category: "Protein", basePrice: 4800 },
    { name: "Fish (Catfish)", variant: "1kg", category: "Fish & Seafood", basePrice: 3500 },
    { name: "Cement", variant: "Dangote 50kg", category: "Building Materials", basePrice: 6500 },
    { name: "Eggs", variant: "1 Crate", category: "Protein", basePrice: 3200 },
  ];

  const markets = [
    { name: "Mile 12 Market", state: "Lagos" },
    { name: "Alaba International Market", state: "Lagos" },
    { name: "Kano Main Market", state: "Kano" },
    { name: "Onitsha Main Market", state: "Anambra" },
    { name: "Wuse Market", state: "FCT" },
    { name: "Bodija Market", state: "Oyo" },
  ];

  const prices: PriceRecord[] = [];
  let id = 1;

  for (const item of items) {
    for (const market of markets) {
      const variation = (Math.random() - 0.5) * 0.15;
      const price = Math.round(item.basePrice * (1 + variation));
      const change = (Math.random() - 0.45) * 8;

      prices.push({
        id: `mock-${id++}`,
        item_name: item.name,
        item_variant: item.variant,
        category: item.category,
        market_name: market.name,
        state: market.state,
        price_naira: price,
        change_percent: Number(change.toFixed(2)),
        change_amount: Math.round(price * change / 100),
        low_24h: Math.round(price * 0.96),
        high_24h: Math.round(price * 1.04),
        confidence: Math.floor(75 + Math.random() * 20),
        validators: Math.floor(2 + Math.random() * 3),
        updated_at: new Date().toISOString(),
        source: "Demo_Data",
        unit: item.variant,
        trend: change > 0 ? "↑" : change < 0 ? "↓" : "→",
      });
    }
  }

  return {
    prices,
    filters: {
      categories: [...new Set(items.map(i => i.category))].sort(),
      states: [...new Set(markets.map(m => m.state))].sort(),
      markets: markets.map(m => m.name).sort(),
    },
  };
}

// ============================================================================
// FAST: Query Summary Table (< 100ms)
// ============================================================================

async function fetchFromSummaryTable(): Promise<{ prices: PriceRecord[]; filters: FilterOptions; success: boolean }> {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const data = await prisma.$queryRaw`
      SELECT TOP 500
        id,
        item_name,
        market_name,
        state,
        category_id,
        unit,
        CAST(price_naira AS FLOAT) as price_naira,
        CAST(COALESCE(previous_price, price_naira) AS FLOAT) as previous_price,
        CAST(COALESCE(price_change_pct, 0) AS FLOAT) as price_change_pct,
        trend,
        CAST(COALESCE(confidence_score, 85) AS FLOAT) as confidence_score,
        price_date
      FROM Latest_Prices_Summary WITH (NOLOCK)
      ORDER BY item_name, market_name
    ` as any[];

    await prisma.$disconnect();

    if (!data || data.length === 0) {
      return { prices: [], filters: { categories: [], states: [], markets: [] }, success: false };
    }

    const prices: PriceRecord[] = data.map((p: any) => {
      const price = Number(p.price_naira) || 0;
      const prevPrice = Number(p.previous_price) || price;
      const changePercent = Number(p.price_change_pct) || 0;
      
      // Handle both integer and string category IDs
      const categoryId = String(p.category_id || "");
      const categoryName = CATEGORY_MAP[categoryId] || "General";

      return {
        id: `lps-${p.id}`,
        item_name: String(p.item_name || "Unknown"),
        item_variant: p.unit || null,
        category: categoryName,
        market_name: String(p.market_name || "Unknown"),
        state: String(p.state || "Lagos"),
        price_naira: price,
        change_percent: Number(changePercent.toFixed(2)),
        change_amount: Math.round(price - prevPrice),
        low_24h: Math.round(price * 0.97),
        high_24h: Math.round(price * 1.03),
        confidence: Math.round(Number(p.confidence_score) || 85),
        validators: 3,
        updated_at: p.price_date instanceof Date ? p.price_date.toISOString() : new Date().toISOString(),
        source: "Latest_Prices_Summary",
        unit: p.unit || "",
        trend: p.trend || (changePercent > 0 ? "↑" : changePercent < 0 ? "↓" : "→"),
      };
    });

    return {
      prices,
      filters: {
        categories: [...new Set(prices.map(p => p.category))].filter(Boolean).sort(),
        states: [...new Set(prices.map(p => p.state))].filter(Boolean).sort(),
        markets: [...new Set(prices.map(p => p.market_name))].filter(Boolean).sort(),
      },
      success: true,
    };
  } catch (error: any) {
    console.error("Summary table error:", error.message);
    return { prices: [], filters: { categories: [], states: [], markets: [] }, success: false };
  }
}

// ============================================================================
// SLOW FALLBACK: Query Daily_Prices
// ============================================================================

async function fetchFromDailyPrices(): Promise<{ prices: PriceRecord[]; filters: FilterOptions; success: boolean }> {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const data = await prisma.$queryRaw`
      SELECT TOP 300
        price_id,
        item_name,
        market_name,
        state,
        category_id,
        unit,
        CAST(price_naira AS FLOAT) as price_naira,
        CAST(COALESCE(previous_price, price_naira) AS FLOAT) as previous_price,
        CAST(COALESCE(price_change_pct, 0) AS FLOAT) as price_change_pct,
        trend,
        CAST(COALESCE(confidence_score, 85) AS FLOAT) as confidence_score,
        price_date
      FROM Daily_Prices WITH (NOLOCK)
      WHERE price_date >= DATEADD(day, -2, CAST(GETDATE() AS DATE))
        AND price_naira > 0
      ORDER BY price_date DESC, item_name
    ` as any[];

    await prisma.$disconnect();

    if (!data || data.length === 0) {
      return { prices: [], filters: { categories: [], states: [], markets: [] }, success: false };
    }

    const seen = new Set<string>();
    const prices: PriceRecord[] = [];

    for (const p of data) {
      const key = `${String(p.item_name).toLowerCase()}-${String(p.market_name).toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const price = Number(p.price_naira) || 0;
      const prevPrice = Number(p.previous_price) || price;
      const changePercent = Number(p.price_change_pct) || 0;
      
      // Handle both integer and string category IDs
      const categoryId = String(p.category_id || "");
      const categoryName = CATEGORY_MAP[categoryId] || "General";

      prices.push({
        id: `dp-${p.price_id}`,
        item_name: String(p.item_name || "Unknown"),
        item_variant: p.unit || null,
        category: categoryName,
        market_name: String(p.market_name || "Unknown"),
        state: String(p.state || "Lagos"),
        price_naira: price,
        change_percent: Number(changePercent.toFixed(2)),
        change_amount: Math.round(price - prevPrice),
        low_24h: Math.round(price * 0.97),
        high_24h: Math.round(price * 1.03),
        confidence: Math.round(Number(p.confidence_score) || 85),
        validators: 3,
        updated_at: p.price_date instanceof Date ? p.price_date.toISOString() : new Date().toISOString(),
        source: "Daily_Prices",
        unit: p.unit || "",
        trend: p.trend || (changePercent > 0 ? "↑" : changePercent < 0 ? "↓" : "→"),
      });
    }

    return {
      prices,
      filters: {
        categories: [...new Set(prices.map(p => p.category))].filter(Boolean).sort(),
        states: [...new Set(prices.map(p => p.state))].filter(Boolean).sort(),
        markets: [...new Set(prices.map(p => p.market_name))].filter(Boolean).sort(),
      },
      success: prices.length >= 10,
    };
  } catch (error: any) {
    console.error("Daily_Prices error:", error.message);
    return { prices: [], filters: { categories: [], states: [], markets: [] }, success: false };
  }
}

// ============================================================================
// FILTER & SORT
// ============================================================================

function filterAndSort(
  prices: PriceRecord[],
  search: string,
  category: string,
  state: string,
  market: string,
  trend: string,
  sort: string
): PriceRecord[] {
  let filtered = [...prices];

  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(p =>
      p.item_name.toLowerCase().includes(s) ||
      p.market_name.toLowerCase().includes(s) ||
      p.state.toLowerCase().includes(s)
    );
  }

  if (category) filtered = filtered.filter(p => p.category.toLowerCase() === category.toLowerCase());
  if (state) filtered = filtered.filter(p => p.state.toLowerCase() === state.toLowerCase());
  if (market) filtered = filtered.filter(p => p.market_name.toLowerCase().includes(market.toLowerCase()));
  if (trend === "up") filtered = filtered.filter(p => p.change_percent > 0);
  if (trend === "down") filtered = filtered.filter(p => p.change_percent < 0);

  switch (sort) {
    case "price": filtered.sort((a, b) => b.price_naira - a.price_naira); break;
    case "price_asc": filtered.sort((a, b) => a.price_naira - b.price_naira); break;
    case "change": filtered.sort((a, b) => b.change_percent - a.change_percent); break;
    case "name": filtered.sort((a, b) => a.item_name.localeCompare(b.item_name)); break;
    default: filtered.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  return filtered;
}

// ============================================================================
// GET HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const state = searchParams.get("state") || "";
    const market = searchParams.get("market") || "";
    const trend = searchParams.get("trend") || "";
    const sort = searchParams.get("sort") || "updated";
    const limit = Math.min(parseInt(searchParams.get("limit") || "200"), 500);

    let prices: PriceRecord[] = [];
    let filters: FilterOptions = { categories: [], states: [], markets: [] };
    let source = "Demo_Data";

    // Try Summary Table first (fastest)
    const summaryResult = await fetchFromSummaryTable();
    if (summaryResult.success) {
      prices = summaryResult.prices;
      filters = summaryResult.filters;
      source = "Latest_Prices_Summary";
    }

    // Fallback to Daily_Prices
    if (prices.length < 10) {
      const dailyResult = await fetchFromDailyPrices();
      if (dailyResult.success) {
        prices = dailyResult.prices;
        filters = dailyResult.filters;
        source = "Daily_Prices";
      }
    }

    // Final fallback to mock data
    if (prices.length < 10) {
      const mock = generateMockData();
      prices = mock.prices;
      filters = mock.filters;
      source = "Demo_Data";
    }

    const filtered = filterAndSort(prices, search, category, state, market, trend, sort);
    const limited = filtered.slice(0, limit);

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: limited,
      pagination: { total: filtered.length, limit, offset: 0, hasMore: filtered.length > limit },
      filters,
      source,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    const mock = generateMockData();
    return NextResponse.json({
      success: true,
      data: mock.prices,
      filters: mock.filters,
      source: "Demo_Data_Fallback",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

export const dynamic = "force-dynamic";
