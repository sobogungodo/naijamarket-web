// ============================================================================
// src/app/api/prices/route.ts
// NaijaMarket Intel - Live Prices API
// Version: 7.1.0 - Improved error handling with guaranteed fallback
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// TYPE DEFINITIONS
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

// Category mapping
const CATEGORY_MAP: Record<number, string> = {
  1: "Grains & Cereals",
  2: "Tubers",
  3: "Vegetables",
  4: "Fruits",
  5: "Oils & Fats",
  6: "Protein",
  7: "Dairy",
  8: "Sweeteners",
  9: "Beverages",
  10: "Building Materials",
  11: "Livestock",
  12: "Fish & Seafood",
  13: "Condiments",
  14: "Processed Foods",
};

// ============================================================================
// MOCK DATA GENERATOR (GUARANTEED FALLBACK)
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
    { name: "Sugar", variant: "50kg Bag", category: "Sweeteners", basePrice: 85000 },
    { name: "Bread", variant: "Sliced Loaf", category: "Processed Foods", basePrice: 1800 },
    { name: "Maize", variant: "100kg Bag", category: "Grains & Cereals", basePrice: 55000 },
    { name: "Cassava", variant: "1 Bag", category: "Tubers", basePrice: 25000 },
    { name: "Plantain", variant: "1 Bunch", category: "Fruits", basePrice: 3500 },
    { name: "Eggs", variant: "1 Crate", category: "Protein", basePrice: 3200 },
  ];

  const markets = [
    { name: "Mile 12 Market", state: "Lagos" },
    { name: "Alaba International Market", state: "Lagos" },
    { name: "Iddo Market", state: "Lagos" },
    { name: "Kano Main Market", state: "Kano" },
    { name: "Onitsha Main Market", state: "Anambra" },
    { name: "Wuse Market", state: "FCT" },
    { name: "Ariaria Market", state: "Abia" },
    { name: "Bodija Market", state: "Oyo" },
    { name: "Jos Main Market", state: "Plateau" },
    { name: "Port Harcourt Main Market", state: "Rivers" },
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
        updated_at: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        source: "Demo_Data",
        unit: item.variant,
        trend: change > 0 ? "↑" : change < 0 ? "↓" : "→",
      });
    }
  }

  const filters: FilterOptions = {
    categories: [...new Set(items.map(i => i.category))].sort(),
    states: [...new Set(markets.map(m => m.state))].sort(),
    markets: markets.map(m => m.name).sort(),
  };

  return { prices, filters };
}

// ============================================================================
// PRIMARY: FETCH FROM DAILY_PRICES (Azure SQL)
// ============================================================================

async function fetchFromDailyPrices(): Promise<{ prices: PriceRecord[]; filters: FilterOptions; success: boolean }> {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    console.log("📊 Fetching from Daily_Prices (PRIMARY)...");

    const dailyPrices = await prisma.$queryRaw`
      SELECT TOP 500
        price_id,
        price_date,
        time_slot,
        time_slot_name,
        item_id,
        item_name,
        market_id,
        market_name,
        state,
        category_id,
        unit,
        CAST(price_naira AS FLOAT) as price_naira,
        CAST(COALESCE(previous_price, price_naira) AS FLOAT) as previous_price,
        CAST(COALESCE(price_change_pct, 0) AS FLOAT) as price_change_pct,
        trend,
        CAST(COALESCE(confidence_score, 85) AS FLOAT) as confidence_score,
        data_source,
        generated_at
      FROM Daily_Prices
      WHERE price_naira > 0
      ORDER BY price_date DESC, time_slot DESC, item_name
    ` as any[];

    await prisma.$disconnect();

    if (!dailyPrices || dailyPrices.length === 0) {
      console.log("⚠️ Daily_Prices returned no data");
      return { prices: [], filters: { categories: [], states: [], markets: [] }, success: false };
    }

    const prices: PriceRecord[] = [];
    const seen = new Set<string>();

    for (const p of dailyPrices) {
      const key = `${String(p.item_name || "").toLowerCase()}-${String(p.market_name || "").toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const price = Number(p.price_naira) || 0;
      const prevPrice = Number(p.previous_price) || price;
      const changePercent = Number(p.price_change_pct) || ((price - prevPrice) / prevPrice * 100);
      const changeAmount = Math.round(price - prevPrice);
      const categoryName = CATEGORY_MAP[Number(p.category_id)] || "General";

      const volatility = Math.abs(changePercent) / 100;
      const low24h = Math.round(price * (1 - Math.max(volatility, 0.02)));
      const high24h = Math.round(price * (1 + Math.max(volatility, 0.02)));

      let dateStr: string;
      try {
        dateStr = p.price_date instanceof Date 
          ? p.price_date.toISOString() 
          : new Date(p.price_date || Date.now()).toISOString();
      } catch {
        dateStr = new Date().toISOString();
      }

      prices.push({
        id: `dp-${p.price_id}`,
        item_name: String(p.item_name || "Unknown"),
        item_variant: p.unit || null,
        category: categoryName,
        market_name: String(p.market_name || "Unknown"),
        state: String(p.state || "Lagos"),
        price_naira: price,
        change_percent: Number(changePercent.toFixed(2)),
        change_amount: changeAmount,
        low_24h: low24h,
        high_24h: high24h,
        confidence: Math.round(Number(p.confidence_score) || 85),
        validators: Math.floor(3 + Math.random() * 2),
        updated_at: dateStr,
        source: "Daily_Prices",
        unit: p.unit || "",
        trend: p.trend || (changePercent > 0 ? "↑" : changePercent < 0 ? "↓" : "→"),
      });
    }

    const filters: FilterOptions = {
      categories: [...new Set(prices.map(p => p.category))].filter(Boolean).sort(),
      states: [...new Set(prices.map(p => p.state))].filter(Boolean).sort(),
      markets: [...new Set(prices.map(p => p.market_name))].filter(Boolean).sort(),
    };

    console.log(`✅ Daily_Prices: ${prices.length} prices`);
    return { prices, filters, success: prices.length >= 10 };

  } catch (error: any) {
    console.error("❌ Daily_Prices error:", error.message || error);
    return { prices: [], filters: { categories: [], states: [], markets: [] }, success: false };
  }
}

// ============================================================================
// BACKUP: FETCH FROM VALIDATED_PRICES (Azure SQL)
// ============================================================================

async function fetchFromValidatedPrices(): Promise<{ prices: PriceRecord[]; filters: FilterOptions; success: boolean }> {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    console.log("📊 Fetching from Validated_Prices (BACKUP)...");

    const validatedPrices = await prisma.$queryRaw`
      SELECT TOP 500
        CAST(id AS VARCHAR(50)) as id,
        item_name,
        unit as item_variant,
        market_name,
        state,
        CAST(COALESCE(price_naira, 0) AS FLOAT) as price_naira,
        validated_at as updated_at
      FROM Validated_Prices
      WHERE price_naira > 0 AND validation_status = 'APPROVED'
      ORDER BY validated_at DESC
    ` as any[];

    await prisma.$disconnect();

    if (!validatedPrices || validatedPrices.length === 0) {
      console.log("⚠️ Validated_Prices returned no data");
      return { prices: [], filters: { categories: [], states: [], markets: [] }, success: false };
    }

    const prices: PriceRecord[] = [];

    for (const p of validatedPrices) {
      const price = Number(p.price_naira) || 0;
      const change = (Math.random() - 0.45) * 5;

      let dateStr: string;
      try {
        dateStr = p.updated_at instanceof Date 
          ? p.updated_at.toISOString() 
          : new Date(p.updated_at || Date.now()).toISOString();
      } catch {
        dateStr = new Date().toISOString();
      }

      prices.push({
        id: `vp-${p.id}`,
        item_name: String(p.item_name || "Unknown"),
        item_variant: p.item_variant || null,
        category: "General",
        market_name: String(p.market_name || "Unknown"),
        state: String(p.state || "Lagos"),
        price_naira: price,
        change_percent: Number(change.toFixed(2)),
        change_amount: Math.round(price * change / 100),
        low_24h: Math.round(price * 0.97),
        high_24h: Math.round(price * 1.03),
        confidence: 80,
        validators: 3,
        updated_at: dateStr,
        source: "Validated_Prices",
        unit: p.item_variant || "",
        trend: change > 0 ? "↑" : change < 0 ? "↓" : "→",
      });
    }

    const filters: FilterOptions = {
      categories: [...new Set(prices.map(p => p.category))].filter(Boolean).sort(),
      states: [...new Set(prices.map(p => p.state))].filter(Boolean).sort(),
      markets: [...new Set(prices.map(p => p.market_name))].filter(Boolean).sort(),
    };

    console.log(`✅ Validated_Prices: ${prices.length} prices`);
    return { prices, filters, success: prices.length >= 10 };

  } catch (error: any) {
    console.error("❌ Validated_Prices error:", error.message || error);
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
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(p =>
      p.item_name.toLowerCase().includes(searchLower) ||
      p.market_name.toLowerCase().includes(searchLower) ||
      p.category.toLowerCase().includes(searchLower) ||
      p.state.toLowerCase().includes(searchLower) ||
      (p.item_variant && p.item_variant.toLowerCase().includes(searchLower))
    );
  }

  if (category) {
    filtered = filtered.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }

  if (state) {
    filtered = filtered.filter(p => p.state.toLowerCase() === state.toLowerCase());
  }

  if (market) {
    filtered = filtered.filter(p => p.market_name.toLowerCase().includes(market.toLowerCase()));
  }

  if (trend === "up") {
    filtered = filtered.filter(p => p.change_percent > 0);
  } else if (trend === "down") {
    filtered = filtered.filter(p => p.change_percent < 0);
  }

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
    case "change_asc":
      filtered.sort((a, b) => a.change_percent - b.change_percent);
      break;
    case "name":
      filtered.sort((a, b) => a.item_name.localeCompare(b.item_name));
      break;
    case "confidence":
      filtered.sort((a, b) => b.confidence - a.confidence);
      break;
    default:
      filtered.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  return filtered;
}

// ============================================================================
// GET HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const state = searchParams.get("state") || "";
    const market = searchParams.get("market") || "";
    const trend = searchParams.get("trend") || "";
    const sort = searchParams.get("sort") || "updated";
    const limit = parseInt(searchParams.get("limit") || "200");

    let prices: PriceRecord[] = [];
    let filters: FilterOptions = { categories: [], states: [], markets: [] };
    let source = "unknown";

    console.log("\n" + "═".repeat(50));
    console.log("📊 PRICES API REQUEST");
    console.log("═".repeat(50));

    // Try PRIMARY: Daily_Prices
    try {
      const dailyResult = await fetchFromDailyPrices();
      if (dailyResult.success && dailyResult.prices.length >= 10) {
        prices = dailyResult.prices;
        filters = dailyResult.filters;
        source = "Daily_Prices";
        console.log(`✅ Using Daily_Prices: ${prices.length} prices`);
      }
    } catch (e: any) {
      console.error("❌ Daily_Prices failed:", e.message);
    }

    // Try BACKUP: Validated_Prices
    if (prices.length < 10) {
      try {
        const validatedResult = await fetchFromValidatedPrices();
        if (validatedResult.success && validatedResult.prices.length >= 10) {
          prices = validatedResult.prices;
          filters = validatedResult.filters;
          source = "Validated_Prices";
          console.log(`✅ Using Validated_Prices: ${prices.length} prices`);
        }
      } catch (e: any) {
        console.error("❌ Validated_Prices failed:", e.message);
      }
    }

    // FALLBACK: Mock Data (GUARANTEED)
    if (prices.length < 10) {
      console.log("⚠️ Using mock data fallback...");
      const mockResult = generateMockData();
      prices = mockResult.prices;
      filters = mockResult.filters;
      source = "Demo_Data";
      console.log(`✅ Using Demo_Data: ${prices.length} prices`);
    }

    console.log("═".repeat(50));

    // Apply filters and sorting
    const filtered = filterAndSort(prices, search, category, state, market, trend, sort);
    const limited = filtered.slice(0, limit);

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
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    // ULTIMATE FALLBACK - even if everything fails, return mock data
    console.error("❌ CRITICAL ERROR in prices API:", error.message || error);
    
    const mockResult = generateMockData();
    
    return NextResponse.json({
      success: true,
      data: mockResult.prices.slice(0, 200),
      pagination: {
        total: mockResult.prices.length,
        limit: 200,
        offset: 0,
        hasMore: false,
      },
      filters: mockResult.filters,
      source: "Demo_Data_Fallback",
      timestamp: new Date().toISOString(),
      warning: "Database unavailable, showing demo data",
    });
  }
}

export const dynamic = "force-dynamic";
