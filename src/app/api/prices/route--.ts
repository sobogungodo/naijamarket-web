// ============================================================================
// src/app/api/prices/route.ts
// NaijaFood Intel - Live Prices API
// Version: 9.3.0 - FOOD-ONLY filter on all queries
// ============================================================================
// Changes from v9.2:
// - Added FOOD FILTER clause to Summary + Daily + Filters queries
// - Fixed CATEGORY_MAP to use CAT### keys with correct names
// - Removed non-food items from mock data + fallback filters
// - Only 15 food categories visible to consumers
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// FOOD-ONLY CATEGORY MAP (15 categories)
// ============================================================================

const CATEGORY_MAP: Record<string, string> = {
  CAT001: "Grains & Cereals",
  CAT002: "Vegetables & Peppers",
  CAT003: "Oils & Fats",
  CAT004: "Frozen Foods & Poultry",
  CAT005: "Beverages",
  CAT006: "Plantain",
  CAT007: "Seasoning & Spices",
  CAT008: "Dried Fish & Stockfish",
  CAT009: "Flour & Bakery",
  CAT010: "Bread",
  CAT013: "Dairy & Milk",
  CAT014: "Tubers & Yam",
  CAT015: "Beans & Legumes",
  CAT070: "Poultry & Livestock",
  CAT103: "Fish (NBS)",
};

// Reverse: display name → category_id
const CATEGORY_NAME_TO_ID: Record<string, string> = {};
for (const [id, name] of Object.entries(CATEGORY_MAP)) {
  CATEGORY_NAME_TO_ID[name.toLowerCase()] = id;
}

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
  stateMarkets: Record<string, string[]>;
}

// ============================================================================
// SINGLETON PRISMA
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
// MAP ROW → PriceRecord
// ============================================================================

function mapRow(p: any, prefix: string): PriceRecord {
  const price = Number(p.price_naira) || 0;
  const prevPrice = Number(p.previous_price) || price;
  const changePercent = Number(p.price_change_pct) || 0;
  const categoryId = String(p.category_id || "");
  const categoryName = CATEGORY_MAP[categoryId] || "Food";
  const idVal = p.id || p.price_id || Math.random();

  return {
    id: `${prefix}-${idVal}`,
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
    source: prefix === "lps" ? "Latest_Prices_Summary" : "Daily_Prices",
    unit: p.unit || "",
    trend: p.trend || (changePercent > 0 ? "↑" : changePercent < 0 ? "↓" : "→"),
  };
}

// ============================================================================
// FETCH FILTER OPTIONS — FOOD ONLY
// ============================================================================

async function fetchFilterOptions(): Promise<FilterOptions> {
  try {
    const prisma = await getPrisma();

    const filtersData = await prisma.$queryRaw`
      SELECT DISTINCT category_id, state, market_name
      FROM Latest_Prices_Summary WITH (NOLOCK)
      WHERE price_naira > 0
        AND state IS NOT NULL
        AND market_name IS NOT NULL
        AND category_id IN ('CAT001','CAT002','CAT003','CAT004','CAT005','CAT006','CAT007','CAT008','CAT009','CAT010','CAT013','CAT014','CAT015','CAT070','CAT103')
    ` as any[];

    const categoriesSet = new Set<string>();
    const statesSet = new Set<string>();
    const marketsSet = new Set<string>();
    const stateMarketsMap: Record<string, string[]> = {};

    for (const row of filtersData) {
      const catName = CATEGORY_MAP[String(row.category_id || "")];
      if (catName) categoriesSet.add(catName);
      if (row.state) {
        const st = String(row.state);
        statesSet.add(st);
        if (row.market_name) {
          const mk = String(row.market_name);
          marketsSet.add(mk);
          if (!stateMarketsMap[st]) stateMarketsMap[st] = [];
          if (!stateMarketsMap[st].includes(mk)) stateMarketsMap[st].push(mk);
        }
      }
    }

    for (const st of Object.keys(stateMarketsMap)) {
      stateMarketsMap[st].sort();
    }

    return {
      categories: [...categoriesSet].sort(),
      states: [...statesSet].sort(),
      markets: [...marketsSet].sort(),
      stateMarkets: stateMarketsMap,
    };
  } catch (error) {
    console.error("Filter options error:", error);
    return {
      categories: Object.values(CATEGORY_MAP).sort(),
      states: ["Lagos", "Kano", "FCT", "Rivers", "Oyo", "Anambra", "Kaduna", "Ogun", "Enugu", "Delta"],
      markets: ["Mile 12 Market", "Onitsha Main Market", "Wuse Market", "Bodija Market"],
      stateMarkets: {},
    };
  }
}

// ============================================================================
// FETCH FROM SUMMARY TABLE — FOOD ONLY
// ============================================================================

async function fetchFromSummaryTable(
  search: string,
  categoryId: string,
  state: string,
  market: string
): Promise<{ prices: PriceRecord[]; success: boolean }> {
  try {
    const prisma = await getPrisma();
    const searchLike = `%${search}%`;
    const marketLike = `%${market}%`;

    const data = await prisma.$queryRaw`
      SELECT TOP 1000
        id, item_name, market_name, state, category_id, unit,
        CAST(price_naira AS FLOAT) as price_naira,
        CAST(COALESCE(previous_price, price_naira) AS FLOAT) as previous_price,
        CAST(COALESCE(price_change_pct, 0) AS FLOAT) as price_change_pct,
        trend,
        CAST(COALESCE(confidence_score, 85) AS FLOAT) as confidence_score,
        price_date
      FROM Latest_Prices_Summary WITH (NOLOCK)
      WHERE price_naira > 0
        AND category_id IN ('CAT001','CAT002','CAT003','CAT004','CAT005','CAT006','CAT007','CAT008','CAT009','CAT010','CAT013','CAT014','CAT015','CAT070','CAT103')
        AND (${search} = '' OR item_name LIKE ${searchLike} OR market_name LIKE ${searchLike} OR state LIKE ${searchLike})
        AND (${categoryId} = '' OR category_id = ${categoryId})
        AND (${state} = '' OR state = ${state})
        AND (${market} = '' OR market_name LIKE ${marketLike})
      ORDER BY item_name, market_name
    ` as any[];

    if (!data || data.length === 0) {
      return { prices: [], success: false };
    }

    const prices = data.map((p: any) => mapRow(p, "lps"));
    return { prices, success: true };
  } catch (error: any) {
    console.error("Summary table error:", error.message?.substring(0, 300));
    return { prices: [], success: false };
  }
}

// ============================================================================
// FETCH FROM DAILY PRICES (fallback) — FOOD ONLY
// ============================================================================

async function fetchFromDailyPrices(
  search: string,
  categoryId: string,
  state: string,
  market: string
): Promise<{ prices: PriceRecord[]; success: boolean }> {
  try {
    const prisma = await getPrisma();
    const searchLike = `%${search}%`;
    const marketLike = `%${market}%`;

    const data = await prisma.$queryRaw`
      SELECT TOP 1000
        price_id, item_name, market_name, state, category_id, unit,
        CAST(price_naira AS FLOAT) as price_naira,
        CAST(COALESCE(previous_price, price_naira) AS FLOAT) as previous_price,
        CAST(COALESCE(price_change_pct, 0) AS FLOAT) as price_change_pct,
        trend,
        CAST(COALESCE(confidence_score, 85) AS FLOAT) as confidence_score,
        price_date
      FROM Daily_Prices WITH (NOLOCK)
      WHERE price_date >= DATEADD(day, -2, CAST(GETDATE() AS DATE))
        AND price_naira > 0
        AND category_id IN ('CAT001','CAT002','CAT003','CAT004','CAT005','CAT006','CAT007','CAT008','CAT009','CAT010','CAT013','CAT014','CAT015','CAT070','CAT103')
        AND (${search} = '' OR item_name LIKE ${searchLike} OR market_name LIKE ${searchLike} OR state LIKE ${searchLike})
        AND (${categoryId} = '' OR category_id = ${categoryId})
        AND (${state} = '' OR state = ${state})
        AND (${market} = '' OR market_name LIKE ${marketLike})
      ORDER BY price_date DESC, item_name
    ` as any[];

    if (!data || data.length === 0) {
      return { prices: [], success: false };
    }

    const seen = new Set<string>();
    const prices: PriceRecord[] = [];
    for (const p of data) {
      const key = `${String(p.item_name).toLowerCase()}-${String(p.market_name).toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      prices.push(mapRow(p, "dp"));
    }

    return { prices, success: prices.length >= 1 };
  } catch (error: any) {
    console.error("Daily_Prices error:", error.message?.substring(0, 300));
    return { prices: [], success: false };
  }
}

// ============================================================================
// MOCK DATA — FOOD ONLY
// ============================================================================

function generateMockData(): { prices: PriceRecord[]; filters: FilterOptions } {
  const items = [
    { name: "Rice (50kg) - Foreign", variant: "50kg bag", category: "Grains & Cereals", basePrice: 82000 },
    { name: "Rice (50kg) - Local", variant: "50kg bag", category: "Grains & Cereals", basePrice: 65000 },
    { name: "Beans - Brown", variant: "per kg", category: "Beans & Legumes", basePrice: 2800 },
    { name: "Garri - White", variant: "50kg bag", category: "Grains & Cereals", basePrice: 45000 },
    { name: "Yam - Large Tuber", variant: "each", category: "Tubers & Yam", basePrice: 2500 },
    { name: "Palm Oil", variant: "25 Litres", category: "Oils & Fats", basePrice: 45000 },
    { name: "Tomatoes", variant: "Big Basket", category: "Vegetables & Peppers", basePrice: 35000 },
    { name: "Pepper - Rodo", variant: "Big Basket", category: "Vegetables & Peppers", basePrice: 28000 },
    { name: "Frozen Chicken", variant: "Full Carton", category: "Frozen Foods & Poultry", basePrice: 55000 },
    { name: "Plantain - Unripe", variant: "per kg", category: "Plantain", basePrice: 1200 },
    { name: "Stockfish Head", variant: "Bundle", category: "Dried Fish & Stockfish", basePrice: 18000 },
    { name: "Evaporated Milk - Peak", variant: "170g", category: "Dairy & Milk", basePrice: 450 },
    { name: "Bread - Sliced", variant: "500g", category: "Bread", basePrice: 1800 },
  ];

  const markets = [
    { name: "Mile 12 Market", state: "Lagos" },
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
      stateMarkets: markets.reduce((acc, m) => {
        if (!acc[m.state]) acc[m.state] = [];
        acc[m.state].push(m.name);
        return acc;
      }, {} as Record<string, string[]>),
    },
  };
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
    const limit = Math.min(parseInt(searchParams.get("limit") || "500"), 1000);

    // Map category display name → category_id
    const categoryId = category ? (CATEGORY_NAME_TO_ID[category.toLowerCase()] || category) : "";

    let prices: PriceRecord[] = [];
    let filters: FilterOptions = { categories: [], states: [], markets: [], stateMarkets: {} };
    let source = "Demo_Data";

    filters = await fetchFilterOptions();
    console.log(`[v9.3] Filters: ${filters.categories.length} food cats, ${filters.states.length} states`);

    // Summary table (food-filtered)
    const summaryResult = await fetchFromSummaryTable(search, categoryId, state, market);
    if (summaryResult.success && summaryResult.prices.length > 0) {
      prices = summaryResult.prices;
      source = "Latest_Prices_Summary";
    }

    // Fallback: Daily_Prices (food-filtered)
    if (prices.length === 0) {
      const dailyResult = await fetchFromDailyPrices(search, categoryId, state, market);
      if (dailyResult.success) {
        prices = dailyResult.prices;
        source = "Daily_Prices";
      }
    }

    // Final fallback: mock (food-only)
    if (prices.length === 0 && !search && !category && !state && !market) {
      const mock = generateMockData();
      prices = mock.prices;
      filters = mock.filters;
      source = "Demo_Data";
    }

    // Trend filter + sort
    let filtered = [...prices];
    if (trend === "up") filtered = filtered.filter(p => p.change_percent > 0);
    if (trend === "down") filtered = filtered.filter(p => p.change_percent < 0);

    switch (sort) {
      case "price": filtered.sort((a, b) => b.price_naira - a.price_naira); break;
      case "price_asc": filtered.sort((a, b) => a.price_naira - b.price_naira); break;
      case "change": filtered.sort((a, b) => b.change_percent - a.change_percent); break;
      case "name": filtered.sort((a, b) => a.item_name.localeCompare(b.item_name)); break;
      default: filtered.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }

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
    console.error("[v9.3] Error:", error);
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
