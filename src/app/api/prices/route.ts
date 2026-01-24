// ============================================================================
// src/app/api/prices/route.ts
// NaijaMarket Intel - Live Prices API
// PRIMARY: Google Sheets | BACKUP: Azure SQL | FALLBACK: Mock Data
// Price Priority: Daily_Prices → Price_History_NBS → Validated_Prices
// Version: 4.0.0 - Google Sheets as default database
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// CONFIGURATION
// ============================================================================

const GOOGLE_SHEET_ID = "1n-7MXdoqvIoSHteBJaUYBmIPLjJBNtrE_jVuUxO5kr8";

// Sheet names in priority order for prices
const PRICE_SHEETS = [
  "Daily_Prices",
  "Price_History_NBS", 
  "Validated_Prices",
];

// Reference sheets for filters
const REFERENCE_SHEETS = {
  categories: "Categories",
  markets: "Markets",
  states: "States_Reference",
};

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
// CSV PARSER
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
// GOOGLE SHEETS FETCHER
// ============================================================================

async function fetchSheetAsCSV(sheetName: string): Promise<string[][]> {
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    
    const response = await fetch(csvUrl, {
      next: { revalidate: 60 }, // Cache 60 seconds
    });

    if (!response.ok) {
      console.log(`Failed to fetch sheet: ${sheetName}`);
      return [];
    }

    const csvText = await response.text();
    const lines = csvText.split("\n").filter(line => line.trim());
    
    if (lines.length < 1) return [];

    return lines.map(line => parseCSVLine(line));
  } catch (error) {
    console.error(`Error fetching sheet ${sheetName}:`, error);
    return [];
  }
}

// ============================================================================
// FETCH FILTER OPTIONS FROM GOOGLE SHEETS
// ============================================================================

async function fetchFilterOptions(): Promise<FilterOptions> {
  const options: FilterOptions = {
    categories: [],
    states: [],
    markets: [],
  };

  // Fetch Categories
  try {
    const catRows = await fetchSheetAsCSV(REFERENCE_SHEETS.categories);
    if (catRows.length > 1) {
      const headers = catRows[0] || [];
      const nameIdx = headers.findIndex(h => 
        h.toLowerCase().includes("category") || h.toLowerCase().includes("name")
      );
      const idx = nameIdx >= 0 ? nameIdx : 0;
      
      for (let i = 1; i < catRows.length; i++) {
        const row = catRows[i];
        if (row && row[idx]) {
          options.categories.push(row[idx]);
        }
      }
    }
  } catch (e) {
    console.log("Could not fetch categories from sheet");
  }

  // Fetch States
  try {
    const stateRows = await fetchSheetAsCSV(REFERENCE_SHEETS.states);
    if (stateRows.length > 1) {
      const headers = stateRows[0] || [];
      const nameIdx = headers.findIndex(h => 
        h.toLowerCase().includes("state") || h.toLowerCase().includes("name")
      );
      const idx = nameIdx >= 0 ? nameIdx : 0;
      
      for (let i = 1; i < stateRows.length; i++) {
        const row = stateRows[i];
        if (row && row[idx]) {
          options.states.push(row[idx]);
        }
      }
    }
  } catch (e) {
    console.log("Could not fetch states from sheet");
  }

  // Fetch Markets
  try {
    const marketRows = await fetchSheetAsCSV(REFERENCE_SHEETS.markets);
    if (marketRows.length > 1) {
      const headers = marketRows[0] || [];
      const nameIdx = headers.findIndex(h => 
        h.toLowerCase().includes("market") || h.toLowerCase().includes("name")
      );
      const idx = nameIdx >= 0 ? nameIdx : 0;
      
      for (let i = 1; i < marketRows.length; i++) {
        const row = marketRows[i];
        if (row && row[idx]) {
          options.markets.push(row[idx]);
        }
      }
    }
  } catch (e) {
    console.log("Could not fetch markets from sheet");
  }

  // Remove duplicates
  options.categories = [...new Set(options.categories)].filter(Boolean).sort();
  options.states = [...new Set(options.states)].filter(Boolean).sort();
  options.markets = [...new Set(options.markets)].filter(Boolean).sort();

  return options;
}

// ============================================================================
// FETCH PRICES FROM GOOGLE SHEETS (Priority Order)
// ============================================================================

async function fetchPricesFromSheets(): Promise<{ prices: PriceRecord[]; source: string }> {
  // Try each sheet in priority order
  for (const sheetName of PRICE_SHEETS) {
    console.log(`Trying to fetch from: ${sheetName}`);
    
    const rows = await fetchSheetAsCSV(sheetName);
    if (rows.length < 2) continue;

    const headers = rows[0];
    if (!headers) continue;

    // Find column indices (flexible matching)
    const findCol = (names: string[]): number => {
      for (const name of names) {
        const idx = headers.findIndex(h => 
          h && h.toLowerCase().includes(name.toLowerCase())
        );
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const itemIdx = findCol(["item_name", "item", "commodity"]);
    const marketIdx = findCol(["market_name", "market"]);
    const priceIdx = findCol(["price_naira", "price", "validated_price", "average_price"]);
    const categoryIdx = findCol(["category", "category_name"]);
    const stateIdx = findCol(["state", "state_name"]);
    const unitIdx = findCol(["unit", "variant", "item_variant"]);
    const dateIdx = findCol(["price_date", "validated_at", "created_at", "observation_date", "timestamp"]);
    const changeIdx = findCol(["change_percent", "change", "price_change"]);
    const trendIdx = findCol(["trend"]);

    // Need at least item and price columns
    if (itemIdx < 0 || priceIdx < 0) {
      console.log(`Sheet ${sheetName} missing required columns (item or price)`);
      continue;
    }

    const prices: PriceRecord[] = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      const itemName = row[itemIdx];
      const priceStr = row[priceIdx];
      const priceValue = parseFloat(priceStr || "0");

      if (!itemName || isNaN(priceValue) || priceValue <= 0) continue;

      // Calculate change
      let change = 0;
      if (changeIdx >= 0 && row[changeIdx]) {
        change = parseFloat(row[changeIdx]) || 0;
      } else if (trendIdx >= 0) {
        const trend = row[trendIdx]?.toLowerCase();
        if (trend === "up") change = Math.random() * 5;
        else if (trend === "down") change = -Math.random() * 5;
      } else {
        change = (Math.random() - 0.5) * 6; // Random ±3%
      }

      prices.push({
        id: `${sheetName.toLowerCase()}-${i}`,
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
        confidence: Math.floor(80 + Math.random() * 15),
        validators: Math.floor(2 + Math.random() * 2),
        updated_at: dateIdx >= 0 && row[dateIdx] ? row[dateIdx] : new Date().toISOString(),
        source: sheetName,
      });
    }

    if (prices.length > 0) {
      console.log(`✅ Fetched ${prices.length} prices from ${sheetName}`);
      return { prices, source: sheetName };
    }
  }

  return { prices: [], source: "none" };
}

// ============================================================================
// AZURE SQL DATABASE FETCHER (BACKUP ONLY)
// ============================================================================

async function fetchFromDatabase(): Promise<PriceRecord[]> {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const dbPrices = await prisma.approved_Prices.findMany({
      take: 200,
    });

    await prisma.$disconnect();

    if (dbPrices.length === 0) return [];

    console.log(`✅ Fetched ${dbPrices.length} prices from Azure SQL (backup)`);

    return dbPrices.map((p: Record<string, unknown>, index: number) => ({
      id: `db-${p.id || index}`,
      item_name: String(p.item_name || p.item || "Unknown"),
      item_variant: p.unit ? String(p.unit) : null,
      category: String(p.category || "General"),
      market_name: String(p.market_name || p.market || "Unknown"),
      state: String(p.state || "Lagos"),
      price_naira: Number(p.price_naira || p.price || 0),
      change_percent: Number(p.change_percent || 0),
      change_amount: Number(p.change_amount || 0),
      low_24h: Number(p.price_naira || 0) * 0.96,
      high_24h: Number(p.price_naira || 0) * 1.04,
      confidence: Number(p.confidence || 85),
      validators: Number(p.validators || 3),
      updated_at: new Date().toISOString(),
      source: "Azure_SQL",
    }));

  } catch (error) {
    console.error("Azure SQL backup fetch error:", error);
    return [];
  }
}

// ============================================================================
// MOCK DATA GENERATOR (LAST RESORT FALLBACK)
// ============================================================================

function generateMockData(): PriceRecord[] {
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
    { name: "Mile 12", state: "Lagos" },
    { name: "Iddo", state: "Lagos" },
    { name: "Kano Main", state: "Kano" },
    { name: "Onitsha Main", state: "Anambra" },
    { name: "Wuse", state: "FCT" },
    { name: "Ariaria", state: "Abia" },
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
        source: "Mock_Data",
      });
    }
  }

  return prices;
}

// ============================================================================
// FILTER & SORT HELPER
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
    filtered = filtered.filter(p => 
      p.category.toLowerCase() === category.toLowerCase()
    );
  }

  if (state) {
    filtered = filtered.filter(p => 
      p.state.toLowerCase() === state.toLowerCase()
    );
  }

  if (market) {
    filtered = filtered.filter(p => 
      p.market_name.toLowerCase().includes(market.toLowerCase())
    );
  }

  if (trend === "up") {
    filtered = filtered.filter(p => p.change_percent > 0);
  } else if (trend === "down") {
    filtered = filtered.filter(p => p.change_percent < 0);
  }

  // Remove duplicates (same item + market)
  const seen = new Set<string>();
  filtered = filtered.filter(p => {
    const key = `${p.item_name.toLowerCase()}-${p.market_name.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort
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
    case "updated":
    default:
      filtered.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
  }

  return filtered;
}

// ============================================================================
// EXTRACT FILTER OPTIONS FROM PRICES (Fallback if reference sheets fail)
// ============================================================================

function extractFiltersFromPrices(prices: PriceRecord[]): FilterOptions {
  const categories = [...new Set(prices.map(p => p.category))].filter(Boolean).sort();
  const states = [...new Set(prices.map(p => p.state))].filter(Boolean).sort();
  const markets = [...new Set(prices.map(p => p.market_name))].filter(Boolean).sort();
  
  return { categories, states, markets };
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
  let source = "unknown";
  let filterOptions: FilterOptions = { categories: [], states: [], markets: [] };

  // =========================================
  // STEP 1: Fetch filter options from sheets
  // =========================================
  if (includeFilters) {
    filterOptions = await fetchFilterOptions();
  }

  // =========================================
  // STEP 2: PRIMARY - Google Sheets
  // Priority: Daily_Prices → Price_History_NBS → Validated_Prices
  // =========================================
  const sheetsResult = await fetchPricesFromSheets();
  if (sheetsResult.prices.length > 0) {
    prices = sheetsResult.prices;
    source = `sheets:${sheetsResult.source}`;
  }

  // =========================================
  // STEP 3: BACKUP - Azure SQL Database
  // =========================================
  if (prices.length === 0) {
    console.log("Google Sheets empty, trying Azure SQL backup...");
    prices = await fetchFromDatabase();
    if (prices.length > 0) {
      source = "azure_sql_backup";
    }
  }

  // =========================================
  // STEP 4: FALLBACK - Mock Data
  // =========================================
  if (prices.length === 0) {
    console.log("All sources failed, using mock data...");
    prices = generateMockData();
    source = "mock_fallback";
  }

  // =========================================
  // STEP 5: Extract filters from prices if reference sheets failed
  // =========================================
  if (includeFilters && 
      (filterOptions.categories.length === 0 || 
       filterOptions.states.length === 0 || 
       filterOptions.markets.length === 0)) {
    const extractedFilters = extractFiltersFromPrices(prices);
    if (filterOptions.categories.length === 0) filterOptions.categories = extractedFilters.categories;
    if (filterOptions.states.length === 0) filterOptions.states = extractedFilters.states;
    if (filterOptions.markets.length === 0) filterOptions.markets = extractedFilters.markets;
  }

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

  // Include filter options if requested
  if (includeFilters) {
    response.filters = filterOptions;
  }

  return NextResponse.json(response);
}

export const dynamic = "force-dynamic";
