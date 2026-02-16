// ============================================================================
// src/app/api/prices/route.ts
// NaijaMarket Intel - Live Prices API
// Version: 9.1.0 - Server-side search using Prisma.sql tagged templates
// ============================================================================
// FIX: v9.0 used $queryRawUnsafe with ? params which fails on SQL Server.
//      v9.1 uses Prisma.sql tagged templates (same pattern as working v8.3)
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

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

// Reverse: category name → all matching category_id values
const CATEGORY_NAME_TO_IDS: Record<string, string[]> = {};
for (const [id, name] of Object.entries(CATEGORY_MAP)) {
  const key = name.toLowerCase();
  if (!CATEGORY_NAME_TO_IDS[key]) CATEGORY_NAME_TO_IDS[key] = [];
  CATEGORY_NAME_TO_IDS[key].push(id);
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
// FETCH ALL FILTER OPTIONS (always full list, no filtering)
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
// MAP DB ROW → PriceRecord
// ============================================================================

function mapRowToPrice(p: any, idPrefix: string): PriceRecord {
  const price = Number(p.price_naira) || 0;
  const prevPrice = Number(p.previous_price) || price;
  const changePercent = Number(p.price_change_pct) || 0;
  const categoryId = String(p.category_id || "");
  const categoryName = CATEGORY_MAP[categoryId] || "General";
  const idField = p.id || p.price_id || Math.random();

  return {
    id: `${idPrefix}-${idField}`,
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
    source: idPrefix === "lps" ? "Latest_Prices_Summary" : "Daily_Prices",
    unit: p.unit || "",
    trend: p.trend || (changePercent > 0 ? "↑" : changePercent < 0 ? "↓" : "→"),
  };
}

// ============================================================================
// FETCH FROM SUMMARY TABLE — WITH SERVER-SIDE SEARCH
// ============================================================================

async function fetchFromSummaryTable(
  search: string,
  category: string,
  state: string,
  market: string
): Promise<{ prices: PriceRecord[]; success: boolean }> {
  try {
    const prisma = await getPrisma();
    const hasFilters = search || category || state || market;

    let data: any[];

    if (hasFilters) {
      // Build dynamic WHERE using Prisma.sql tagged templates
      const conditions: Prisma.Sql[] = [];

      if (search) {
        const term = `%${search}%`;
        conditions.push(
          Prisma.sql`AND (item_name LIKE ${term} OR market_name LIKE ${term} OR state LIKE ${term})`
        );
      }

      if (category) {
        const catIds = CATEGORY_NAME_TO_IDS[category.toLowerCase()];
        if (catIds && catIds.length > 0) {
          conditions.push(
            Prisma.sql`AND category_id IN (${Prisma.join(catIds)})`
          );
        }
      }

      if (state) {
        conditions.push(Prisma.sql`AND state = ${state}`);
      }

      if (market) {
        const marketTerm = `%${market}%`;
        conditions.push(Prisma.sql`AND market_name LIKE ${marketTerm}`);
      }

      const whereExtra = conditions.length > 0
        ? Prisma.join(conditions, Prisma.sql` `)
        : Prisma.empty;

      data = await prisma.$queryRaw`
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
        WHERE 1=1 ${whereExtra}
        ORDER BY item_name, market_name
      ` as any[];

    } else {
      // No filters: fast default load
      data = await prisma.$queryRaw`
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
    }

    if (!data || data.length === 0) {
      return { prices: [], success: false };
    }

    const prices: PriceRecord[] = data.map((p: any) => mapRowToPrice(p, "lps"));
    return { prices, success: true };

  } catch (error: any) {
    console.error("Summary table error:", error.message);
    return { prices: [], success: false };
  }
}

// ============================================================================
// FETCH FROM DAILY PRICES (fallback) — WITH SERVER-SIDE SEARCH
// ============================================================================

async function fetchFromDailyPrices(
  search: string,
  category: string,
  state: string,
  market: string
): Promise<{ prices: PriceRecord[]; success: boolean }> {
  try {
    const prisma = await getPrisma();
    const hasFilters = search || category || state || market;

    let data: any[];

    if (hasFilters) {
      const conditions: Prisma.Sql[] = [];

      if (search) {
        const term = `%${search}%`;
        conditions.push(
          Prisma.sql`AND (item_name LIKE ${term} OR market_name LIKE ${term} OR state LIKE ${term})`
        );
      }

      if (category) {
        const catIds = CATEGORY_NAME_TO_IDS[category.toLowerCase()];
        if (catIds && catIds.length > 0) {
          conditions.push(
            Prisma.sql`AND category_id IN (${Prisma.join(catIds)})`
          );
        }
      }

      if (state) {
        conditions.push(Prisma.sql`AND state = ${state}`);
      }

      if (market) {
        const marketTerm = `%${market}%`;
        conditions.push(Prisma.sql`AND market_name LIKE ${marketTerm}`);
      }

      const whereExtra = conditions.length > 0
        ? Prisma.join(conditions, Prisma.sql` `)
        : Prisma.empty;

      data = await prisma.$queryRaw`
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
          ${whereExtra}
        ORDER BY price_date DESC, item_name
      ` as any[];

    } else {
      data = await prisma.$queryRaw`
        SELECT TOP 500
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
    }

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
      prices.push(mapRowToPrice(p, "dp"));
    }

    return { prices, success: prices.length >= 1 };
  } catch (error: any) {
    console.error("Daily_Prices error:", error.message);
    return { prices: [], success: false };
  }
}

// ============================================================================
// SORT & TREND FILTER (lightweight post-processing)
// ============================================================================

function sortAndFilter(
  prices: PriceRecord[],
  trend: string,
  sort: string
): PriceRecord[] {
  let filtered = [...prices];

  // Trend filter
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
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const state = searchParams.get("state") || "";
    const market = searchParams.get("market") || "";
    const trend = searchParams.get("trend") || "";
    const sort = searchParams.get("sort") || "updated";
    const limit = Math.min(parseInt(searchParams.get("limit") || "500"), 1000);

    let prices: PriceRecord[] = [];
    let filters: FilterOptions = { categories: [], states: [], markets: [] };
    let source = "Demo_Data";

    // ALWAYS fetch full filter options (no search applied to dropdowns)
    filters = await fetchFilterOptions();
    console.log(`[Prices API v9.1] Filters: ${filters.categories.length} cats, ${filters.states.length} states, ${filters.markets.length} markets`);

    // Try Summary Table first — search/filters go INTO the SQL WHERE clause
    const summaryResult = await fetchFromSummaryTable(search, category, state, market);
    if (summaryResult.success && summaryResult.prices.length > 0) {
      prices = summaryResult.prices;
      source = "Latest_Prices_Summary";
      console.log(`[Prices API v9.1] ${prices.length} from Summary (search="${search}", cat="${category}", state="${state}", market="${market}")`);
    }

    // Fallback to Daily_Prices — also with SQL-level filtering
    if (prices.length === 0) {
      const dailyResult = await fetchFromDailyPrices(search, category, state, market);
      if (dailyResult.success) {
        prices = dailyResult.prices;
        source = "Daily_Prices";
        console.log(`[Prices API v9.1] ${prices.length} from Daily_Prices`);
      }
    }

    // Final fallback to mock data (only if NO filters active and DB empty)
    if (prices.length === 0 && !search && !category && !state && !market) {
      const mock = generateMockData();
      prices = mock.prices;
      filters = mock.filters;
      source = "Demo_Data";
      console.log(`[Prices API v9.1] Using mock data`);
    }

    // Apply trend filter and sorting (lightweight)
    const sorted = sortAndFilter(prices, trend, sort);
    const limited = sorted.slice(0, limit);

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: limited,
      pagination: {
        total: sorted.length,
        limit,
        offset: 0,
        hasMore: sorted.length > limit,
      },
      filters,
      source,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error("[Prices API v9.1] Error:", error);

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
