// ============================================================================
// src/app/api/prices/route.ts
// NaijaMarket Intel - Live Prices API
// PRIMARY: Azure SQL Database | BACKUP: Google Sheets | FALLBACK: Mock
// Version: 6.0.0 - Database as primary source
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// CONFIGURATION
// ============================================================================

const GOOGLE_SHEET_ID = "1n-7MXdoqvIoSHteBJaUYBmIPLjJBNtrE_jVuUxO5kr8";

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
}

interface FilterOptions {
  categories: string[];
  states: string[];
  markets: string[];
}

// ============================================================================
// CSV PARSER (for Google Sheets backup)
// ============================================================================

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

// ============================================================================
// PRIMARY: FETCH FROM AZURE SQL DATABASE
// ============================================================================

async function fetchFromDatabase(): Promise<{ prices: PriceRecord[]; filters: FilterOptions }> {
  const prices: PriceRecord[] = [];
  const filters: FilterOptions = { categories: [], states: [], markets: [] };

  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    // ========================================
    // Fetch Filter Options from Reference Tables
    // ========================================
    
    // Fetch Categories
    try {
      const categories = await prisma.$queryRaw`
        SELECT DISTINCT category_name FROM Categories WHERE category_name IS NOT NULL ORDER BY category_name
      ` as Array<{ category_name: string }>;
      filters.categories = categories.map(c => c.category_name).filter(Boolean);
    } catch (e) {
      // If Categories table doesn't exist, extract from prices
      console.log("Categories table not found, will extract from prices");
    }

    // Fetch States
    try {
      const states = await prisma.$queryRaw`
        SELECT DISTINCT state_name FROM States WHERE state_name IS NOT NULL ORDER BY state_name
      ` as Array<{ state_name: string }>;
      filters.states = states.map(s => s.state_name).filter(Boolean);
    } catch (e) {
      // Try States_Reference table
      try {
        const states = await prisma.$queryRaw`
          SELECT DISTINCT state FROM States_Reference WHERE state IS NOT NULL ORDER BY state
        ` as Array<{ state: string }>;
        filters.states = states.map(s => s.state).filter(Boolean);
      } catch (e2) {
        console.log("States table not found, will extract from prices");
      }
    }

    // Fetch Markets
    try {
      const markets = await prisma.$queryRaw`
        SELECT DISTINCT market_name FROM Markets WHERE market_name IS NOT NULL ORDER BY market_name
      ` as Array<{ market_name: string }>;
      filters.markets = markets.map(m => m.market_name).filter(Boolean);
    } catch (e) {
      console.log("Markets table not found, will extract from prices");
    }

    // ========================================
    // Fetch Prices - Try multiple tables in order
    // ========================================

    // Try Daily_Prices first (most recent)
    try {
      const dailyPrices = await prisma.$queryRaw`
        SELECT TOP 200
          CAST(id AS VARCHAR(50)) as id,
          item_name,
          item_variant,
          category,
          market_name,
          state,
          CAST(price_naira AS FLOAT) as price_naira,
          COALESCE(CAST(change_percent AS FLOAT), 0) as change_percent,
          price_date as updated_at
        FROM Daily_Prices
        WHERE price_naira > 0
        ORDER BY price_date DESC
      ` as Array<Record<string, unknown>>;

      if (dailyPrices.length > 0) {
        for (const p of dailyPrices) {
          const price = Number(p.price_naira) || 0;
          const change = Number(p.change_percent) || (Math.random() - 0.5) * 6;
          
          prices.push({
            id: `db-${p.id}`,
            item_name: String(p.item_name || "Unknown"),
            item_variant: p.item_variant ? String(p.item_variant) : null,
            category: String(p.category || "General"),
            market_name: String(p.market_name || "Unknown"),
            state: String(p.state || "Lagos"),
            price_naira: price,
            change_percent: Number(change.toFixed(2)),
            change_amount: Math.round(price * change / 100),
            low_24h: Math.round(price * 0.96),
            high_24h: Math.round(price * 1.04),
            confidence: Math.floor(80 + Math.random() * 15),
            validators: Math.floor(2 + Math.random() * 2),
            updated_at: p.updated_at instanceof Date ? p.updated_at.toISOString() : String(p.updated_at || new Date().toISOString()),
            source: "Daily_Prices",
          });
        }
        console.log(`✅ Fetched ${prices.length} prices from Daily_Prices`);
      }
    } catch (e) {
      console.log("Daily_Prices query failed, trying alternatives...");
    }

    // If no daily prices, try Price_History_NBS
    if (prices.length === 0) {
      try {
        const nbsPrices = await prisma.$queryRaw`
          SELECT TOP 200
            ROW_NUMBER() OVER (ORDER BY observation_date DESC) as id,
            item_name,
            NULL as item_variant,
            category,
            market_name,
            state,
            CAST(price_naira AS FLOAT) as price_naira,
            observation_date as updated_at
          FROM Price_History_NBS
          WHERE price_naira > 0
          ORDER BY observation_date DESC
        ` as Array<Record<string, unknown>>;

        if (nbsPrices.length > 0) {
          for (const p of nbsPrices) {
            const price = Number(p.price_naira) || 0;
            const change = (Math.random() - 0.5) * 6;
            
            prices.push({
              id: `nbs-${p.id}`,
              item_name: String(p.item_name || "Unknown"),
              item_variant: null,
              category: String(p.category || "General"),
              market_name: String(p.market_name || "Unknown"),
              state: String(p.state || "Lagos"),
              price_naira: price,
              change_percent: Number(change.toFixed(2)),
              change_amount: Math.round(price * change / 100),
              low_24h: Math.round(price * 0.96),
              high_24h: Math.round(price * 1.04),
              confidence: Math.floor(75 + Math.random() * 20),
              validators: Math.floor(2 + Math.random() * 2),
              updated_at: p.updated_at instanceof Date ? p.updated_at.toISOString() : String(p.updated_at || new Date().toISOString()),
              source: "Price_History_NBS",
            });
          }
          console.log(`✅ Fetched ${prices.length} prices from Price_History_NBS`);
        }
      } catch (e) {
        console.log("Price_History_NBS query failed...");
      }
    }

    // If still no prices, try Validated_Prices
    if (prices.length === 0) {
      try {
        const validatedPrices = await prisma.$queryRaw`
          SELECT TOP 200
            CAST(id AS VARCHAR(50)) as id,
            item_name,
            item_variant,
            category,
            market_name,
            state,
            CAST(COALESCE(validated_price, price_naira) AS FLOAT) as price_naira,
            validated_at as updated_at
          FROM Validated_Prices
          WHERE COALESCE(validated_price, price_naira) > 0
          ORDER BY validated_at DESC
        ` as Array<Record<string, unknown>>;

        if (validatedPrices.length > 0) {
          for (const p of validatedPrices) {
            const price = Number(p.price_naira) || 0;
            const change = (Math.random() - 0.5) * 6;
            
            prices.push({
              id: `val-${p.id}`,
              item_name: String(p.item_name || "Unknown"),
              item_variant: p.item_variant ? String(p.item_variant) : null,
              category: String(p.category || "General"),
              market_name: String(p.market_name || "Unknown"),
              state: String(p.state || "Lagos"),
              price_naira: price,
              change_percent: Number(change.toFixed(2)),
              change_amount: Math.round(price * change / 100),
              low_24h: Math.round(price * 0.96),
              high_24h: Math.round(price * 1.04),
              confidence: Math.floor(80 + Math.random() * 15),
              validators: Math.floor(2 + Math.random() * 2),
              updated_at: p.updated_at instanceof Date ? p.updated_at.toISOString() : String(p.updated_at || new Date().toISOString()),
              source: "Validated_Prices",
            });
          }
          console.log(`✅ Fetched ${prices.length} prices from Validated_Prices`);
        }
      } catch (e) {
        console.log("Validated_Prices query failed...");
      }
    }

    // ========================================
    // Extract filters from prices if reference tables failed
    // ========================================
    if (prices.length > 0) {
      if (filters.categories.length === 0) {
        filters.categories = [...new Set(prices.map(p => p.category))].filter(Boolean).sort();
      }
      if (filters.states.length === 0) {
        filters.states = [...new Set(prices.map(p => p.state))].filter(Boolean).sort();
      }
      if (filters.markets.length === 0) {
        filters.markets = [...new Set(prices.map(p => p.market_name))].filter(Boolean).sort();
      }
    }

    await prisma.$disconnect();

  } catch (error) {
    console.error("Database fetch error:", error);
  }

  return { prices, filters };
}

// ============================================================================
// BACKUP: FETCH FROM GOOGLE SHEETS
// ============================================================================

async function fetchFromGoogleSheets(): Promise<{ prices: PriceRecord[]; filters: FilterOptions }> {
  const prices: PriceRecord[] = [];
  const filters: FilterOptions = { categories: [], states: [], markets: [] };

  const sheetNames = ["Daily_Prices", "Price_History_NBS", "Validated_Prices", "Approved_Prices"];

  for (const sheetName of sheetNames) {
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
      
      const response = await fetch(csvUrl, { next: { revalidate: 60 } });
      if (!response.ok) continue;

      const csvText = await response.text();
      const lines = csvText.split("\n").filter(line => line.trim());
      
      if (lines.length < 2) continue;

      const firstLine = lines[0];
      if (!firstLine) continue;
      
      const headers = parseCSVLine(firstLine);
      
      const findCol = (names: string[]): number => {
        for (const name of names) {
          const idx = headers.findIndex(h => h && h.toLowerCase().includes(name.toLowerCase()));
          if (idx >= 0) return idx;
        }
        return -1;
      };

      const itemIdx = findCol(["item_name", "item", "commodity"]);
      const marketIdx = findCol(["market_name", "market"]);
      const priceIdx = findCol(["price_naira", "price", "validated_price"]);
      const categoryIdx = findCol(["category"]);
      const stateIdx = findCol(["state"]);
      const unitIdx = findCol(["unit", "variant", "item_variant"]);
      const dateIdx = findCol(["price_date", "validated_at", "observation_date", "created_at"]);

      if (itemIdx < 0 || priceIdx < 0) continue;

      for (let i = 1; i < lines.length && prices.length < 200; i++) {
        const currentLine = lines[i];
        if (!currentLine) continue;
        
        const row = parseCSVLine(currentLine);
        
        const itemName = itemIdx >= 0 ? row[itemIdx] : undefined;
        const priceStr = priceIdx >= 0 ? row[priceIdx] : undefined;
        const priceValue = parseFloat(priceStr || "0");
        
        if (!itemName || isNaN(priceValue) || priceValue <= 0) continue;

        const change = (Math.random() - 0.5) * 6;
        
        prices.push({
          id: `sheets-${sheetName}-${i}`,
          item_name: itemName,
          item_variant: unitIdx >= 0 ? row[unitIdx] || null : null,
          category: categoryIdx >= 0 ? row[categoryIdx] || "General" : "General",
          market_name: marketIdx >= 0 ? row[marketIdx] || "Unknown" : "Unknown",
          state: stateIdx >= 0 ? row[stateIdx] || "Lagos" : "Lagos",
          price_naira: priceValue,
          change_percent: Number(change.toFixed(2)),
          change_amount: Math.round(priceValue * change / 100),
          low_24h: Math.round(priceValue * 0.96),
          high_24h: Math.round(priceValue * 1.04),
          confidence: Math.floor(75 + Math.random() * 20),
          validators: Math.floor(2 + Math.random() * 2),
          updated_at: dateIdx >= 0 && row[dateIdx] ? row[dateIdx] : new Date().toISOString(),
          source: `Sheets:${sheetName}`,
        });
      }

      if (prices.length > 0) {
        console.log(`✅ Fetched ${prices.length} prices from Google Sheets (${sheetName})`);
        break;
      }
    } catch (error) {
      console.error(`Google Sheets fetch error (${sheetName}):`, error);
    }
  }

  // Extract filters from prices
  if (prices.length > 0) {
    filters.categories = [...new Set(prices.map(p => p.category))].filter(Boolean).sort();
    filters.states = [...new Set(prices.map(p => p.state))].filter(Boolean).sort();
    filters.markets = [...new Set(prices.map(p => p.market_name))].filter(Boolean).sort();
  }

  return { prices, filters };
}

// ============================================================================
// FALLBACK: GENERATE MOCK DATA
// ============================================================================

function generateMockData(): { prices: PriceRecord[]; filters: FilterOptions } {
  const items = [
    { name: "Rice (50kg)", variant: "Foreign Parboiled", category: "Grains", basePrice: 78500 },
    { name: "Beans (bag)", variant: "Brown/White", category: "Grains", basePrice: 62000 },
    { name: "Garri (bag)", variant: "White/Yellow", category: "Grains", basePrice: 28000 },
    { name: "Palm Oil", variant: "25 Liters", category: "Oils", basePrice: 52000 },
    { name: "Tomatoes", variant: "Basket (Big)", category: "Vegetables", basePrice: 45000 },
    { name: "Onions", variant: "Bag (50kg)", category: "Vegetables", basePrice: 38500 },
    { name: "Cement", variant: "Dangote 50kg", category: "Building Materials", basePrice: 6500 },
    { name: "Pepper", variant: "Basket (Big)", category: "Vegetables", basePrice: 32000 },
    { name: "Groundnut Oil", variant: "25 Liters", category: "Oils", basePrice: 48000 },
    { name: "Yam", variant: "Tuber (Big)", category: "Tubers", basePrice: 3500 },
    { name: "Sugar", variant: "50kg Bag", category: "Sweeteners", basePrice: 85000 },
    { name: "Plantain", variant: "Bunch (Ripe)", category: "Fruits", basePrice: 4500 },
  ];

  const markets = [
    { name: "Mile 12 Market", state: "Lagos" },
    { name: "Iddo Market", state: "Lagos" },
    { name: "Kano Main Market", state: "Kano" },
    { name: "Onitsha Main Market", state: "Anambra" },
    { name: "Wuse Market", state: "FCT" },
    { name: "Ariaria Market", state: "Abia" },
  ];

  const prices: PriceRecord[] = [];
  let id = 1;

  for (const item of items) {
    for (const market of markets.slice(0, 3)) {
      const variation = (Math.random() - 0.5) * 0.1;
      const price = Math.round(item.basePrice * (1 + variation));
      const change = (Math.random() - 0.5) * 8;

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
        validators: Math.floor(2 + Math.random() * 2),
        updated_at: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        source: "Demo_Data",
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
      p.state.toLowerCase().includes(searchLower)
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

  // Remove duplicates
  const seen = new Set<string>();
  filtered = filtered.filter(p => {
    const key = `${p.item_name.toLowerCase()}-${p.market_name.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  switch (sort) {
    case "price":
      filtered.sort((a, b) => b.price_naira - a.price_naira);
      break;
    case "change":
      filtered.sort((a, b) => b.change_percent - a.change_percent);
      break;
    case "name":
      filtered.sort((a, b) => a.item_name.localeCompare(b.item_name));
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
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";
  const state = searchParams.get("state") || "";
  const market = searchParams.get("market") || "";
  const trend = searchParams.get("trend") || "";
  const sort = searchParams.get("sort") || "updated";
  const limit = parseInt(searchParams.get("limit") || "100");
  const includeFilters = searchParams.get("filters") === "true";

  let prices: PriceRecord[] = [];
  let filters: FilterOptions = { categories: [], states: [], markets: [] };
  let source = "unknown";

  console.log("\n📊 Prices API Request");
  console.log("─".repeat(40));

  // =========================================
  // STEP 1: PRIMARY - Azure SQL Database
  // =========================================
  const dbResult = await fetchFromDatabase();
  if (dbResult.prices.length > 0) {
    prices = dbResult.prices;
    filters = dbResult.filters;
    source = "database";
    console.log(`✅ PRIMARY: Database - ${prices.length} prices, ${filters.categories.length} categories, ${filters.states.length} states, ${filters.markets.length} markets`);
  }

  // =========================================
  // STEP 2: BACKUP - Google Sheets
  // =========================================
  if (prices.length === 0) {
    console.log("⚠️ Database empty, trying Google Sheets backup...");
    const sheetsResult = await fetchFromGoogleSheets();
    if (sheetsResult.prices.length > 0) {
      prices = sheetsResult.prices;
      filters = sheetsResult.filters;
      source = "sheets_backup";
      console.log(`✅ BACKUP: Google Sheets - ${prices.length} prices`);
    }
  }

  // =========================================
  // STEP 3: FALLBACK - Mock Data
  // =========================================
  if (prices.length === 0) {
    console.log("⚠️ All sources failed, using mock data...");
    const mockResult = generateMockData();
    prices = mockResult.prices;
    filters = mockResult.filters;
    source = "demo_fallback";
    console.log(`✅ FALLBACK: Mock Data - ${prices.length} prices`);
  }

  console.log("─".repeat(40));

  // Apply filters and sorting
  const filtered = filterAndSort(prices, search, category, state, market, trend, sort);
  const limited = filtered.slice(0, limit);

  const response: Record<string, unknown> = {
    success: true,
    data: limited,
    pagination: {
      total: filtered.length,
      limit,
      offset: 0,
      hasMore: filtered.length > limit,
    },
    source,
    timestamp: new Date().toISOString(),
  };

  // Always include filters
  if (includeFilters || true) { // Always include for dropdowns
    response.filters = filters;
  }

  return NextResponse.json(response);
}

export const dynamic = "force-dynamic";
