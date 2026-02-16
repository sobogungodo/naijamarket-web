// ============================================================================
// src/app/api/prices/route.ts
// NaijaMarket Intel - Live Prices API
// Version: 9.2.0 - Single tagged template (no Prisma.join/Prisma.empty)
// ============================================================================
// v9.1 crashed because Prisma.join/Prisma.empty aren't reliable on all
// Prisma versions with SQL Server. v9.2 uses a SINGLE $queryRaw tagged
// template with "OR @param = ''" pattern to disable unused filters.
// Zero dynamic SQL building = zero crash risk.
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

// Category ID → Name mapping
const CATEGORY_MAP: Record<string, string> = {
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

// Reverse: category display name → first matching category_id
const CATEGORY_NAME_TO_ID: Record<string, string> = {};
for (const [id, name] of Object.entries(CATEGORY_MAP)) {
  const key = name.toLowerCase();
  // Only store the first (numeric) ID for each name
  if (!CATEGORY_NAME_TO_ID[key]) {
    CATEGORY_NAME_TO_ID[key] = id;
  }
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
  const categoryName = CATEGORY_MAP[categoryId] || "General";
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
// FETCH FILTER OPTIONS (always full list)
// ============================================================================

async function fetchFilterOptions(): Promise<FilterOptions> {
  try {
    const prisma = await getPrisma();

    const filtersData = await prisma.$queryRaw`
      SELECT DISTINCT category_id, state, market_name
      FROM Daily_Prices WITH (NOLOCK)
      WHERE price_date >= DATEADD(day, -7, CAST(GETDATE() AS DATE))
        AND price_naira > 0
        AND state IS NOT NULL
        AND market_name IS NOT NULL
    ` as any[];

    const categoriesSet = new Set<string>();
    const statesSet = new Set<string>();
    const marketsSet = new Set<string>();

    for (const row of filtersData) {
      const catName = CATEGORY_MAP[String(row.category_id || "")];
      if (catName) categoriesSet.add(catName);
      if (row.state) statesSet.add(String(row.state));
      if (row.market_name) marketsSet.add(String(row.market_name));
    }

    return {
      categories: [...categoriesSet].sort(),
      states: [...statesSet].sort(),
      markets: [...marketsSet].sort(),
    };
  } catch (error) {
    console.error("Filter options error:", error);
    return {
      categories: ["Grains & Cereals", "Tubers", "Vegetables", "Fruits", "Oils & Fats", "Protein", "Fish & Seafood", "Building Materials"],
      states: ["Lagos", "Kano", "FCT", "Rivers", "Oyo", "Anambra", "Kaduna", "Ogun", "Enugu", "Delta"],
      markets: ["Mile 12 Market", "Alaba International Market", "Onitsha Main Market", "Wuse Market", "Bodija Market", "Ariaria Market"],
    };
  }
}

// ============================================================================
// FETCH FROM SUMMARY TABLE — SINGLE TAGGED TEMPLATE
// ============================================================================
// KEY: All filters baked into ONE query. Empty string = filter disabled.
// Pattern: (${param} = '' OR column LIKE ${paramLike})
// This avoids ALL dynamic SQL, Prisma.join, Prisma.empty, $queryRawUnsafe
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
      WHERE 1=1
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
// FETCH FROM DAILY PRICES (fallback) — SINGLE TAGGED TEMPLATE
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
        AND (${search} = '' OR item_name LIKE ${searchLike} OR market_name LIKE ${searchLike} OR state LIKE ${searchLike})
        AND (${categoryId} = '' OR category_id = ${categoryId})
        AND (${state} = '' OR state = ${state})
        AND (${market} = '' OR market_name LIKE ${marketLike})
      ORDER BY price_date DESC, item_name
    ` as any[];

    if (!data || data.length === 0) {
      return { prices: [], success: false };
    }

    // Deduplicate
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
// MOCK DATA
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

    // Map category display name → category_id for SQL
    const categoryId = category ? (CATEGORY_NAME_TO_ID[category.toLowerCase()] || "") : "";

    let prices: PriceRecord[] = [];
    let filters: FilterOptions = { categories: [], states: [], markets: [] };
    let source = "Demo_Data";

    // Fetch filter options (always full list)
    filters = await fetchFilterOptions();
    console.log(`[v9.2] Filters loaded: ${filters.categories.length} cats, ${filters.states.length} states, ${filters.markets.length} markets`);

    // Try Summary Table (search/state/category/market in SQL WHERE)
    const summaryResult = await fetchFromSummaryTable(search, categoryId, state, market);
    if (summaryResult.success && summaryResult.prices.length > 0) {
      prices = summaryResult.prices;
      source = "Latest_Prices_Summary";
      console.log(`[v9.2] Summary: ${prices.length} results (search="${search}" cat="${categoryId}" state="${state}" market="${market}")`);
    }

    // Fallback: Daily_Prices
    if (prices.length === 0) {
      const dailyResult = await fetchFromDailyPrices(search, categoryId, state, market);
      if (dailyResult.success) {
        prices = dailyResult.prices;
        source = "Daily_Prices";
        console.log(`[v9.2] Daily: ${prices.length} results`);
      }
    }

    // Final fallback: mock (only when no filters and DB empty)
    if (prices.length === 0 && !search && !category && !state && !market) {
      const mock = generateMockData();
      prices = mock.prices;
      filters = mock.filters;
      source = "Demo_Data";
      console.log(`[v9.2] Mock data`);
    }

    // Trend filter + sort (lightweight, post-fetch)
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
    console.error("[v9.2] Error:", error);
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
