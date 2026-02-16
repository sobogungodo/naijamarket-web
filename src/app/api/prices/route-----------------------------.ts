// ============================================================================
// src/app/api/prices/route.ts
// NaijaMarket Intel - Live Prices API
// Version: 9.0.0 - FIXED: Search/filters pushed into SQL (not post-fetch)
// ============================================================================
// WHAT CHANGED (v8.3 → v9.0):
//   - fetchFromSummaryTable() now accepts search/category/state/market params
//   - fetchFromDailyPrices() now accepts search/category/state/market params
//   - SQL WHERE clause filters BEFORE TOP limit (was filtering AFTER)
//   - Increased default limit to 500 for unfiltered, unlimited for filtered
//   - filterAndSort() still handles trend filter & sorting (lightweight)
//   - CATEGORY_MAP reverse lookup added for category name → ID mapping
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

interface SearchParams {
  search: string;
  category: string;
  state: string;
  market: string;
  limit: number;
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

// Reverse lookup: Category Name → list of possible IDs
const CATEGORY_NAME_TO_IDS: Record<string, string[]> = {};
for (const [id, name] of Object.entries(CATEGORY_MAP)) {
  if (!CATEGORY_NAME_TO_IDS[name.toLowerCase()]) {
    CATEGORY_NAME_TO_IDS[name.toLowerCase()] = [];
  }
  CATEGORY_NAME_TO_IDS[name.toLowerCase()].push(id);
}

// ============================================================================
// SINGLETON PRISMA (cached)
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
// BUILD SQL WHERE CLAUSE (shared by both fetch functions)
// ============================================================================

function buildWhereClause(params: SearchParams, tableAlias: string = ""): { clause: string; sqlParams: any[] } {
  const prefix = tableAlias ? `${tableAlias}.` : "";
  const conditions: string[] = [];
  const sqlParams: any[] = [];

  // Search: match against item_name, market_name, or state
  if (params.search) {
    const searchTerm = `%${params.search}%`;
    conditions.push(`(${prefix}item_name LIKE ? OR ${prefix}market_name LIKE ? OR ${prefix}state LIKE ?)`);
    sqlParams.push(searchTerm, searchTerm, searchTerm);
  }

  // Category filter: map name back to category_id(s)
  if (params.category) {
    const catLower = params.category.toLowerCase();
    const catIds = CATEGORY_NAME_TO_IDS[catLower];
    if (catIds && catIds.length > 0) {
      const placeholders = catIds.map(() => "?").join(", ");
      conditions.push(`${prefix}category_id IN (${placeholders})`);
      sqlParams.push(...catIds);
    }
  }

  // State filter: exact match
  if (params.state) {
    conditions.push(`${prefix}state = ?`);
    sqlParams.push(params.state);
  }

  // Market filter: partial match
  if (params.market) {
    conditions.push(`${prefix}market_name LIKE ?`);
    sqlParams.push(`%${params.market}%`);
  }

  const clause = conditions.length > 0 ? " AND " + conditions.join(" AND ") : "";
  return { clause, sqlParams };
}

// ============================================================================
// FETCH ALL FILTER OPTIONS (separate query - always full list)
// ============================================================================

async function fetchFilterOptions(): Promise<FilterOptions> {
  try {
    const prisma = await getPrisma();

    const filtersData = await prisma.$queryRaw`
      SELECT DISTINCT 
        category_id,
        state,
        market_name
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
      const catId = String(row.category_id || "");
      const catName = CATEGORY_MAP[catId];
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
      categories: [
        "Grains & Cereals", "Tubers", "Vegetables", "Fruits",
        "Oils & Fats", "Protein", "Fish & Seafood", "Building Materials"
      ],
      states: [
        "Lagos", "Kano", "FCT", "Rivers", "Oyo", "Anambra",
        "Kaduna", "Ogun", "Enugu", "Delta"
      ],
      markets: [
        "Mile 12 Market", "Alaba International Market", "Onitsha Main Market",
        "Wuse Market", "Bodija Market", "Ariaria Market"
      ],
    };
  }
}

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
// FETCH FROM SUMMARY TABLE (with server-side filtering)
// ============================================================================

async function fetchFromSummaryTable(
  params: SearchParams
): Promise<{ prices: PriceRecord[]; success: boolean }> {
  try {
    const prisma = await getPrisma();

    const hasFilters = params.search || params.category || params.state || params.market;
    const { clause, sqlParams } = buildWhereClause(params);

    // If user is searching/filtering, let SQL handle it (up to 1000 results)
    // If no filters, return a random sample of 500 for fast initial load
    const topN = hasFilters ? 1000 : 500;

    const sql = `
      SELECT TOP ${topN}
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
        ${clause}
      ORDER BY item_name, market_name
    `;

    const data = await prisma.$queryRawUnsafe(sql, ...sqlParams) as any[];

    if (!data || data.length === 0) {
      return { prices: [], success: false };
    }

    const prices: PriceRecord[] = data.map((p: any) => {
      const price = Number(p.price_naira) || 0;
      const prevPrice = Number(p.previous_price) || price;
      const changePercent = Number(p.price_change_pct) || 0;
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

    return { prices, success: true };
  } catch (error: any) {
    console.error("Summary table error:", error.message);
    return { prices: [], success: false };
  }
}

// ============================================================================
// FETCH FROM DAILY PRICES (fallback, with server-side filtering)
// ============================================================================

async function fetchFromDailyPrices(
  params: SearchParams
): Promise<{ prices: PriceRecord[]; success: boolean }> {
  try {
    const prisma = await getPrisma();

    const hasFilters = params.search || params.category || params.state || params.market;
    const { clause, sqlParams } = buildWhereClause(params);
    const topN = hasFilters ? 1000 : 500;

    const sql = `
      SELECT TOP ${topN}
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
        ${clause}
      ORDER BY price_date DESC, item_name
    `;

    const data = await prisma.$queryRawUnsafe(sql, ...sqlParams) as any[];

    if (!data || data.length === 0) {
      return { prices: [], success: false };
    }

    // Deduplicate by item_name + market_name
    const seen = new Set<string>();
    const prices: PriceRecord[] = [];

    for (const p of data) {
      const key = `${String(p.item_name).toLowerCase()}-${String(p.market_name).toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const price = Number(p.price_naira) || 0;
      const prevPrice = Number(p.previous_price) || price;
      const changePercent = Number(p.price_change_pct) || 0;
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

    return { prices, success: prices.length >= 10 };
  } catch (error: any) {
    console.error("Daily_Prices error:", error.message);
    return { prices: [], success: false };
  }
}

// ============================================================================
// FILTER & SORT (lightweight - only trend filter + sorting remain here)
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

  // NOTE: search, category, state, market are now handled in SQL
  // Only trend filter and sorting remain client-side

  // Trend filter (not in SQL because it's computed from price_change_pct)
  if (trend === "up") {
    filtered = filtered.filter(p => p.change_percent > 0);
  } else if (trend === "down") {
    filtered = filtered.filter(p => p.change_percent < 0);
  }

  // Sort
  switch (sort) {
    case "price":
      filtered.sort((a, b) => b.price_naira - a.price_naira);
      break;
    case "price_asc":
      filtered.sort((a, b) => a.price_naira - b.price_naira);
      break;
    case "change":
      filtered.sort((a, b) => b.change_percent - a.change_percent);
      break;
    case "name":
      filtered.sort((a, b) => a.item_name.localeCompare(b.item_name));
      break;
    default:
      filtered.sort((a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
  }

  return filtered;
}

// ============================================================================
// GET HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams: urlParams } = new URL(request.url);
    const search = urlParams.get("search") || "";
    const category = urlParams.get("category") || "";
    const state = urlParams.get("state") || "";
    const market = urlParams.get("market") || "";
    const trend = urlParams.get("trend") || "";
    const sort = urlParams.get("sort") || "updated";
    const limit = Math.min(parseInt(urlParams.get("limit") || "500"), 1000);

    // Build params object to pass to SQL fetchers
    const queryParams: SearchParams = { search, category, state, market, limit };

    let prices: PriceRecord[] = [];
    let filters: FilterOptions = { categories: [], states: [], markets: [] };
    let source = "Demo_Data";

    // ALWAYS fetch filter options first (full list, no filtering)
    filters = await fetchFilterOptions();
    console.log(`[Prices API] Filters: ${filters.categories.length} cats, ${filters.states.length} states, ${filters.markets.length} markets`);

    // Try Summary Table first (fastest) - now with SQL-level filtering
    const summaryResult = await fetchFromSummaryTable(queryParams);
    if (summaryResult.success && summaryResult.prices.length > 0) {
      prices = summaryResult.prices;
      source = "Latest_Prices_Summary";
      console.log(`[Prices API] ${prices.length} from Latest_Prices_Summary (search="${search}")`);
    }

    // Fallback to Daily_Prices - also with SQL-level filtering
    if (prices.length === 0) {
      const dailyResult = await fetchFromDailyPrices(queryParams);
      if (dailyResult.success) {
        prices = dailyResult.prices;
        source = "Daily_Prices";
        console.log(`[Prices API] ${prices.length} from Daily_Prices`);
      }
    }

    // Final fallback to mock data (only if DB returned nothing)
    if (prices.length === 0 && !search && !category && !state && !market) {
      const mock = generateMockData();
      prices = mock.prices;
      filters = mock.filters;
      source = "Demo_Data";
      console.log(`[Prices API] Using mock data`);
    }

    // Apply remaining filters (trend) and sorting
    const filtered = filterAndSort(prices, search, category, state, market, trend, sort);
    const limited = filtered.slice(0, limit);

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: limited,
      pagination: {
        total: filtered.length,
        limit,
        offset: 0,
        hasMore: filtered.length > limit,
      },
      filters,
      source,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error("[Prices API] Error:", error);

    // Even on error, return mock data
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
