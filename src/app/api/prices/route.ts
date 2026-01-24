// ============================================================================
// src/app/api/prices/route.ts
// NaijaMarket Intel - Live Prices API
// Data Source Priority: Google Sheets → Azure SQL → Mock Data
// Version: 3.0.0 - Google Sheets Primary
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// CONFIGURATION
// ============================================================================

const GOOGLE_SHEET_ID = "1n-7MXdoqvIoSHteBJaUYBmIPLjJBNtrE_jVuUxO5kr8";
const SHEET_NAME = "Approved_Prices"; // or "Validated_Prices"
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";

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

// ============================================================================
// GOOGLE SHEETS FETCHER
// ============================================================================

async function fetchFromGoogleSheets(): Promise<PriceRecord[]> {
  try {
    // Using Google Sheets API v4 with API key (public read access)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${SHEET_NAME}?key=${GOOGLE_API_KEY}`;
    
    const response = await fetch(url, {
      next: { revalidate: 60 }, // Cache for 60 seconds
    });

    if (!response.ok) {
      console.log("Google Sheets API failed, trying alternative method...");
      return await fetchFromGoogleSheetsCSV();
    }

    const data = await response.json();
    const rows = data.values || [];

    if (rows.length < 2) {
      console.log("No data in Google Sheet");
      return [];
    }

    // First row is headers
    const headers = rows[0] as string[];
    const dataRows = rows.slice(1);

    // Map column indices
    const colIndex = (name: string) => {
      const variations = [name, name.toLowerCase(), name.replace(/_/g, " ")];
      for (const v of variations) {
        const idx = headers.findIndex(h => 
          h && h.toString().toLowerCase().includes(v.toLowerCase())
        );
        if (idx >= 0) return idx;
      }
      return -1;
    };

    // Find column indices
    const itemIdx = colIndex("item");
    const marketIdx = colIndex("market");
    const priceIdx = colIndex("price");
    const categoryIdx = colIndex("category");
    const stateIdx = colIndex("state");
    const validatedAtIdx = colIndex("validated") >= 0 ? colIndex("validated") : colIndex("created");
    const unitIdx = colIndex("unit");
    const changeIdx = colIndex("change");

    // Transform rows to PriceRecord
    const prices: PriceRecord[] = dataRows
      .filter((row: string[]) => row[itemIdx] && row[priceIdx])
      .map((row: string[], index: number) => {
        const price = parseFloat(row[priceIdx]) || 0;
        const change = parseFloat(row[changeIdx]) || (Math.random() - 0.5) * 10;
        
        return {
          id: `gsheet-${index + 1}`,
          item_name: row[itemIdx] || "Unknown Item",
          item_variant: row[unitIdx] || null,
          category: row[categoryIdx] || "General",
          market_name: row[marketIdx] || "Unknown Market",
          state: row[stateIdx] || "Lagos",
          price_naira: price,
          change_percent: Number(change.toFixed(2)),
          change_amount: Math.round(price * change / 100),
          low_24h: Math.round(price * 0.95),
          high_24h: Math.round(price * 1.05),
          confidence: Math.floor(75 + Math.random() * 20),
          validators: Math.floor(2 + Math.random() * 2),
          updated_at: row[validatedAtIdx] || new Date().toISOString(),
          source: "sheets",
        };
      });

    console.log(`✅ Fetched ${prices.length} prices from Google Sheets`);
    return prices;

  } catch (error) {
    console.error("Google Sheets fetch error:", error);
    return [];
  }
}

// Alternative: Fetch as CSV (works without API key for public sheets)
async function fetchFromGoogleSheetsCSV(): Promise<PriceRecord[]> {
  try {
    // Export as CSV (works for public sheets)
    const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;
    
    const response = await fetch(csvUrl, {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      console.log("CSV fetch failed");
      return [];
    }

    const csvText = await response.text();
    const lines = csvText.split("\n").filter(line => line.trim());
    
    if (lines.length < 2) return [];

    // Parse CSV headers
    const headers = parseCSVLine(lines[0]);
    
    // Find column indices (case-insensitive, flexible matching)
    const findCol = (names: string[]) => {
      for (const name of names) {
        const idx = headers.findIndex(h => 
          h.toLowerCase().includes(name.toLowerCase())
        );
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
    const dateIdx = findCol(["validated_at", "created_at", "timestamp"]);

    // Parse data rows
    const prices: PriceRecord[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      
      const itemName = row[itemIdx];
      const priceValue = parseFloat(row[priceIdx]);
      
      if (!itemName || isNaN(priceValue) || priceValue <= 0) continue;

      const change = (Math.random() - 0.5) * 10;
      
      prices.push({
        id: `csv-${i}`,
        item_name: itemName,
        item_variant: row[unitIdx] || null,
        category: row[categoryIdx] || "General",
        market_name: row[marketIdx] || "Unknown",
        state: row[stateIdx] || "Lagos",
        price_naira: priceValue,
        change_percent: Number(change.toFixed(2)),
        change_amount: Math.round(priceValue * change / 100),
        low_24h: Math.round(priceValue * 0.95),
        high_24h: Math.round(priceValue * 1.05),
        confidence: Math.floor(75 + Math.random() * 20),
        validators: Math.floor(2 + Math.random() * 2),
        updated_at: row[dateIdx] || new Date().toISOString(),
        source: "sheets",
      });
    }

    console.log(`✅ Fetched ${prices.length} prices from Google Sheets CSV`);
    return prices;

  } catch (error) {
    console.error("CSV fetch error:", error);
    return [];
  }
}

// Helper: Parse CSV line handling quoted values
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
  
  return result.map(v => v.replace(/^"|"$/g, ""));
}

// ============================================================================
// PRISMA DATABASE FETCHER (BACKUP)
// ============================================================================

async function fetchFromDatabase(): Promise<PriceRecord[]> {
  try {
    // Dynamic import to avoid issues if Prisma is not configured
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const dbPrices = await prisma.approved_Prices.findMany({
      take: 100,
      orderBy: { created_at: "desc" },
    });

    await prisma.$disconnect();

    if (dbPrices.length === 0) return [];

    return dbPrices.map((p: any, index: number) => ({
      id: String(p.id || index),
      item_name: p.item_name || p.item || "Unknown",
      item_variant: p.unit || p.item_variant || null,
      category: p.category || "General",
      market_name: p.market_name || p.market || "Unknown",
      state: p.state || "Lagos",
      price_naira: Number(p.price_naira || p.price || 0),
      change_percent: Number(p.change_percent || 0),
      change_amount: Number(p.change_amount || 0),
      low_24h: Number(p.price_naira || 0) * 0.95,
      high_24h: Number(p.price_naira || 0) * 1.05,
      confidence: Number(p.confidence || 85),
      validators: Number(p.validators || 3),
      updated_at: p.validated_at?.toISOString() || p.created_at?.toISOString() || new Date().toISOString(),
      source: "database",
    }));

  } catch (error) {
    console.error("Database fetch error:", error);
    return [];
  }
}

// ============================================================================
// MOCK DATA GENERATOR (FALLBACK)
// ============================================================================

function generateMockData(): PriceRecord[] {
  const items = [
    { name: "Rice (50kg)", variant: "Foreign Parboiled", category: "Grains", basePrice: 78500 },
    { name: "Beans (bag)", variant: "Brown/White", category: "Grains", basePrice: 62000 },
    { name: "Garri (bag)", variant: "White/Yellow", category: "Grains", basePrice: 28000 },
    { name: "Palm Oil", variant: "25 Liters", category: "Oils", basePrice: 52000 },
    { name: "Tomatoes", variant: "Basket (Big)", category: "Vegetables", basePrice: 45000 },
    { name: "Onions", variant: "Bag (50kg)", category: "Vegetables", basePrice: 38500 },
    { name: "Cement", variant: "Dangote 50kg", category: "Building", basePrice: 6500 },
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
    { name: "Onitsha", state: "Anambra" },
    { name: "Wuse", state: "FCT" },
    { name: "Ariaria", state: "Abia" },
  ];

  const prices: PriceRecord[] = [];
  let id = 1;

  for (const item of items) {
    for (const market of markets.slice(0, 2)) {
      const variation = (Math.random() - 0.5) * 0.1;
      const price = Math.round(item.basePrice * (1 + variation));
      const change = (Math.random() - 0.5) * 10;

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
        low_24h: Math.round(price * 0.95),
        high_24h: Math.round(price * 1.05),
        confidence: Math.floor(75 + Math.random() * 20),
        validators: Math.floor(2 + Math.random() * 2),
        updated_at: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        source: "mock",
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

  // Search filter
  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(p =>
      p.item_name.toLowerCase().includes(searchLower) ||
      p.market_name.toLowerCase().includes(searchLower) ||
      p.category.toLowerCase().includes(searchLower) ||
      p.state.toLowerCase().includes(searchLower)
    );
  }

  // Category filter
  if (category) {
    filtered = filtered.filter(p => 
      p.category.toLowerCase() === category.toLowerCase()
    );
  }

  // State filter
  if (state) {
    filtered = filtered.filter(p => 
      p.state.toLowerCase() === state.toLowerCase()
    );
  }

  // Market filter
  if (market) {
    filtered = filtered.filter(p => 
      p.market_name.toLowerCase().includes(market.toLowerCase())
    );
  }

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
// GET HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Query parameters
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";
  const state = searchParams.get("state") || "";
  const market = searchParams.get("market") || "";
  const trend = searchParams.get("trend") || "";
  const sort = searchParams.get("sort") || "updated";
  const limit = parseInt(searchParams.get("limit") || "100");

  let prices: PriceRecord[] = [];
  let source = "unknown";

  // PRIORITY 1: Try Google Sheets
  prices = await fetchFromGoogleSheets();
  if (prices.length > 0) {
    source = "sheets";
  }

  // PRIORITY 2: Try Database (if Sheets failed or empty)
  if (prices.length === 0) {
    prices = await fetchFromDatabase();
    if (prices.length > 0) {
      source = "database";
    }
  }

  // PRIORITY 3: Use Mock Data (if all else fails)
  if (prices.length === 0) {
    prices = generateMockData();
    source = "mock";
  }

  // Apply filters and sorting
  const filtered = filterAndSort(prices, search, category, state, market, trend, sort);

  // Apply limit
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
    source,
    timestamp: new Date().toISOString(),
  });
}

// Force dynamic rendering
export const dynamic = "force-dynamic";
