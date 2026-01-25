// ============================================================================
// src/app/api/bulk-calculator/route.ts
// NaijaMarket Intel - Bulk Buyer Calculator API
// Bloomberg Equivalent: PMON <GO> (Portfolio Monitor)
// Version: 1.0.0 - Hybrid Data (Azure SQL → Google Sheets → Mock)
// Date: 2026-01-25
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";

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
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
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

// Tier limits
const TIER_LIMITS: Record<string, { maxItems: number; showSavings: boolean; showOptimal: boolean; canExport: boolean }> = {
  FREE: { maxItems: 3, showSavings: false, showOptimal: false, canExport: false },
  SILVER: { maxItems: 5, showSavings: true, showOptimal: false, canExport: false },
  GOLD: { maxItems: 10, showSavings: true, showOptimal: true, canExport: true },
  BUSINESS: { maxItems: 20, showSavings: true, showOptimal: true, canExport: true },
  CORPORATE: { maxItems: 50, showSavings: true, showOptimal: true, canExport: true },
  ENTERPRISE: { maxItems: 100, showSavings: true, showOptimal: true, canExport: true },
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface PriceRecord {
  item: string;
  itemId: string;
  market: string;
  marketId: string;
  state: string;
  region: string;
  price: number;
  unit: string;
  date: string;
}

interface CartItem {
  item: string;
  quantity: number;
  unit: string;
}

interface MarketQuote {
  market: string;
  marketId: string;
  state: string;
  region: string;
  unitPrice: number;
  totalPrice: number;
  available: boolean;
  priceRank: number;
  savingsVsAvg: number;
  savingsPercent: number;
}

interface ItemBreakdown {
  item: string;
  quantity: number;
  unit: string;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  priceRange: number;
  marketQuotes: MarketQuote[];
  bestMarket: { market: string; price: number; savings: number } | null;
  worstMarket: { market: string; price: number; premium: number } | null;
}

interface OptimalStrategy {
  totalCost: number;
  totalSavings: number;
  savingsPercent: number;
  purchases: {
    item: string;
    quantity: number;
    market: string;
    unitPrice: number;
    totalPrice: number;
  }[];
  marketBreakdown: {
    market: string;
    items: number;
    subtotal: number;
  }[];
}

interface BulkCalculatorResponse {
  success: boolean;
  timestamp: string;
  cartSummary: {
    totalItems: number;
    totalQuantity: number;
    estimatedCost: number;
    potentialSavings: number;
    savingsPercent: number;
  };
  itemBreakdowns: ItemBreakdown[];
  optimalStrategy: OptimalStrategy | null;
  singleMarketComparison: {
    market: string;
    totalCost: number;
    vsOptimal: number;
    itemsAvailable: number;
  }[];
  insights: {
    type: string;
    message: string;
    impact: "high" | "medium" | "low";
  }[];
  tierLimits: {
    tier: string;
    maxItems: number;
    showSavings: boolean;
    showOptimal: boolean;
    canExport: boolean;
  };
  dataSource: string;
  recordCount: number;
}

// ============================================================================
// DATA FETCHING FUNCTIONS
// ============================================================================

async function fetchFromAzureSQL(items: string[]): Promise<{ data: PriceRecord[]; success: boolean }> {
  if (!SQL_CONFIG.user || !SQL_CONFIG.password) {
    console.log("Azure SQL credentials not configured, skipping...");
    return { data: [], success: false };
  }

  let pool: sql.ConnectionPool | null = null;
  
  try {
    console.log("Connecting to Azure SQL for bulk calculator...");
    pool = await sql.connect(SQL_CONFIG);
    
    // Build item filter
    const itemKeywords = items.map(item => (item.split(" ")[0] ?? item).toLowerCase());
    const itemConditions = itemKeywords.map((_, idx) => `LOWER(item_name) LIKE @item${idx}`).join(" OR ");
    
    const request = pool.request();
    itemKeywords.forEach((keyword, idx) => {
      request.input(`item${idx}`, sql.NVarChar, `%${keyword}%`);
    });
    
    const result = await request.query(`
      WITH LatestPrices AS (
        SELECT 
          item_name, item_id, market_name, market_id, state, unit,
          price_naira, price_date,
          ROW_NUMBER() OVER (PARTITION BY item_id, market_id ORDER BY price_date DESC) as rn
        FROM dbo.Daily_Prices
        WHERE price_date >= DATEADD(day, -7, GETDATE())
          AND price_naira > 0
          AND (${itemConditions})
      )
      SELECT item_name, item_id, market_name, market_id, state, unit, price_naira, price_date
      FROM LatestPrices WHERE rn = 1
      ORDER BY item_name, price_naira
    `);
    
    console.log(`Azure SQL returned ${result.recordset.length} bulk calculator records`);
    
    const data: PriceRecord[] = result.recordset.map((row: {
      item_name: string; item_id: string; market_name: string; market_id: string;
      state: string; unit: string; price_naira: number; price_date: Date;
    }) => ({
      item: row.item_name,
      itemId: row.item_id,
      market: row.market_name,
      marketId: row.market_id,
      state: row.state,
      region: getRegionFromState(row.state),
      price: row.price_naira,
      unit: row.unit || "unit",
      date: row.price_date instanceof Date ? row.price_date.toISOString().split("T")[0] ?? "" : String(row.price_date),
    }));
    
    return { data, success: data.length >= 5 };
  } catch (error) {
    console.error("Azure SQL error:", error);
    return { data: [], success: false };
  } finally {
    if (pool) await pool.close();
  }
}

async function fetchFromGoogleSheets(items: string[]): Promise<{ data: PriceRecord[]; success: boolean }> {
  if (!GOOGLE_API_KEY) {
    console.log("Google Sheets API key not configured, skipping...");
    return { data: [], success: false };
  }

  try {
    console.log("Fetching from Google Sheets for bulk calculator...");
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
    const unitIdx = headers.findIndex((h: string) => h?.toLowerCase().includes("unit"));
    
    const itemKeywords = items.map(item => (item.split(" ")[0] ?? item).toLowerCase());
    const data: PriceRecord[] = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] ?? [];
      const rowItem = row[itemIdx] ?? "";
      const rowItemLower = rowItem.toLowerCase();
      
      if (itemKeywords.some(keyword => rowItemLower.includes(keyword))) {
        const price = parseFloat(row[priceIdx] ?? "0") || 0;
        const market = row[marketIdx] ?? "";
        const state = row[stateIdx] ?? "";
        
        if (price > 0 && market) {
          data.push({
            item: rowItem,
            itemId: `ITM${String(i).padStart(5, "0")}`,
            market,
            marketId: `MKT${String(i % 20).padStart(4, "0")}`,
            state,
            region: getRegionFromState(state),
            price,
            unit: row[unitIdx] ?? "unit",
            date: new Date().toISOString().split("T")[0] ?? "",
          });
        }
      }
    }
    
    console.log(`Google Sheets returned ${data.length} bulk calculator records`);
    return { data, success: data.length >= 5 };
  } catch (error) {
    console.error("Google Sheets error:", error);
    return { data: [], success: false };
  }
}

function generateMockPriceData(items: string[]): PriceRecord[] {
  console.log("Generating synthetic bulk calculator data...");
  const data: PriceRecord[] = [];
  const today = new Date().toISOString().split("T")[0] ?? "";
  
  const basePrices: Record<string, { price: number; unit: string }> = {
    "Rice": { price: 78500, unit: "50kg bag" },
    "Tomatoes": { price: 45000, unit: "basket" },
    "Onions": { price: 38500, unit: "bag" },
    "Beans": { price: 62000, unit: "bag" },
    "Garri": { price: 28000, unit: "bag" },
    "Palm Oil": { price: 52000, unit: "25L" },
    "Yam": { price: 2800, unit: "tuber" },
    "Pepper": { price: 32000, unit: "basket" },
    "Plantain": { price: 4500, unit: "bunch" },
    "Groundnut Oil": { price: 58000, unit: "25L" },
    "Cement": { price: 6500, unit: "bag" },
    "Sugar": { price: 85000, unit: "50kg" },
    "Flour": { price: 42000, unit: "50kg" },
    "Semovita": { price: 18000, unit: "10kg" },
    "Spaghetti": { price: 12000, unit: "carton" },
  };
  
  const markets = [
    { name: "Mile 12 Market", id: "MKT0001", state: "Lagos" },
    { name: "Alaba International", id: "MKT0002", state: "Lagos" },
    { name: "Onitsha Main Market", id: "MKT0003", state: "Anambra" },
    { name: "Ariaria Market", id: "MKT0004", state: "Abia" },
    { name: "Wuse Market", id: "MKT0005", state: "FCT" },
    { name: "Kano Main Market", id: "MKT0006", state: "Kano" },
    { name: "Jos Main Market", id: "MKT0007", state: "Plateau" },
    { name: "Port Harcourt Market", id: "MKT0008", state: "Rivers" },
  ];
  
  let idx = 0;
  for (const requestedItem of items) {
    const keyword = (requestedItem.split(" ")[0] ?? requestedItem).toLowerCase();
    const baseInfo = Object.entries(basePrices).find(([k]) => k.toLowerCase().includes(keyword));
    
    if (baseInfo) {
      const [itemName, info] = baseInfo;
      
      for (const market of markets) {
        idx++;
        const variation = 0.85 + Math.random() * 0.30; // ±15% variation
        const price = Math.round(info.price * variation);
        
        data.push({
          item: `${itemName} (${info.unit})`,
          itemId: `ITM${String(idx).padStart(5, "0")}`,
          market: market.name,
          marketId: market.id,
          state: market.state,
          region: getRegionFromState(market.state),
          price,
          unit: info.unit,
          date: today,
        });
      }
    }
  }
  
  console.log(`Generated ${data.length} synthetic bulk calculator records`);
  return data;
}

function getRegionFromState(state: string): string {
  const stateLower = state.toLowerCase();
  for (const [code, info] of Object.entries(REGIONS)) {
    if (info.states.some(s => stateLower.includes(s.toLowerCase()))) return code;
  }
  return "SW";
}

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

function calculateItemBreakdowns(cart: CartItem[], priceData: PriceRecord[]): ItemBreakdown[] {
  const breakdowns: ItemBreakdown[] = [];
  
  for (const cartItem of cart) {
    const keyword = (cartItem.item.split(" ")[0] ?? cartItem.item).toLowerCase();
    const itemPrices = priceData.filter(p => p.item.toLowerCase().includes(keyword));
    
    if (itemPrices.length === 0) continue;
    
    const prices = itemPrices.map(p => p.price);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    const marketQuotes: MarketQuote[] = itemPrices
      .map((p, idx) => ({
        market: p.market,
        marketId: p.marketId,
        state: p.state,
        region: p.region,
        unitPrice: p.price,
        totalPrice: p.price * cartItem.quantity,
        available: true,
        priceRank: idx + 1,
        savingsVsAvg: Math.round((avgPrice - p.price) * cartItem.quantity),
        savingsPercent: Math.round(((avgPrice - p.price) / avgPrice) * 100 * 10) / 10,
      }))
      .sort((a, b) => a.unitPrice - b.unitPrice)
      .map((q, idx) => ({ ...q, priceRank: idx + 1 }));
    
    const bestQuote = marketQuotes[0];
    const worstQuote = marketQuotes[marketQuotes.length - 1];
    
    breakdowns.push({
      item: cartItem.item,
      quantity: cartItem.quantity,
      unit: cartItem.unit || itemPrices[0]?.unit || "unit",
      avgPrice: Math.round(avgPrice),
      minPrice,
      maxPrice,
      priceRange: maxPrice - minPrice,
      marketQuotes,
      bestMarket: bestQuote ? {
        market: bestQuote.market,
        price: bestQuote.unitPrice,
        savings: Math.round((avgPrice - bestQuote.unitPrice) * cartItem.quantity),
      } : null,
      worstMarket: worstQuote ? {
        market: worstQuote.market,
        price: worstQuote.unitPrice,
        premium: Math.round((worstQuote.unitPrice - avgPrice) * cartItem.quantity),
      } : null,
    });
  }
  
  return breakdowns;
}

function calculateOptimalStrategy(breakdowns: ItemBreakdown[]): OptimalStrategy {
  const purchases: OptimalStrategy["purchases"] = [];
  let totalCost = 0;
  let avgCost = 0;
  
  for (const breakdown of breakdowns) {
    const best = breakdown.marketQuotes[0];
    if (best) {
      purchases.push({
        item: breakdown.item,
        quantity: breakdown.quantity,
        market: best.market,
        unitPrice: best.unitPrice,
        totalPrice: best.totalPrice,
      });
      totalCost += best.totalPrice;
    }
    avgCost += breakdown.avgPrice * breakdown.quantity;
  }
  
  const totalSavings = avgCost - totalCost;
  const savingsPercent = avgCost > 0 ? Math.round((totalSavings / avgCost) * 100 * 10) / 10 : 0;
  
  // Group by market
  const marketMap = new Map<string, { items: number; subtotal: number }>();
  for (const purchase of purchases) {
    const existing = marketMap.get(purchase.market) || { items: 0, subtotal: 0 };
    existing.items++;
    existing.subtotal += purchase.totalPrice;
    marketMap.set(purchase.market, existing);
  }
  
  const marketBreakdown = Array.from(marketMap.entries())
    .map(([market, data]) => ({ market, ...data }))
    .sort((a, b) => b.subtotal - a.subtotal);
  
  return {
    totalCost,
    totalSavings: Math.round(totalSavings),
    savingsPercent,
    purchases,
    marketBreakdown,
  };
}

function calculateSingleMarketComparison(
  breakdowns: ItemBreakdown[],
  optimalCost: number
): BulkCalculatorResponse["singleMarketComparison"] {
  const marketTotals = new Map<string, { total: number; items: number }>();
  
  for (const breakdown of breakdowns) {
    for (const quote of breakdown.marketQuotes) {
      const existing = marketTotals.get(quote.market) || { total: 0, items: 0 };
      existing.total += quote.totalPrice;
      existing.items++;
      marketTotals.set(quote.market, existing);
    }
  }
  
  return Array.from(marketTotals.entries())
    .map(([market, data]) => ({
      market,
      totalCost: data.total,
      vsOptimal: data.total - optimalCost,
      itemsAvailable: data.items,
    }))
    .sort((a, b) => a.totalCost - b.totalCost);
}

function generateInsights(
  breakdowns: ItemBreakdown[],
  optimal: OptimalStrategy
): BulkCalculatorResponse["insights"] {
  const insights: BulkCalculatorResponse["insights"] = [];
  
  // Savings insight
  if (optimal.savingsPercent > 10) {
    insights.push({
      type: "savings",
      message: `Shopping optimally saves you ₦${optimal.totalSavings.toLocaleString()} (${optimal.savingsPercent}%) compared to average prices!`,
      impact: "high",
    });
  } else if (optimal.savingsPercent > 5) {
    insights.push({
      type: "savings",
      message: `You can save ₦${optimal.totalSavings.toLocaleString()} (${optimal.savingsPercent}%) by choosing the cheapest markets for each item.`,
      impact: "medium",
    });
  }
  
  // High variance items
  const highVarianceItems = breakdowns.filter(b => {
    const variancePercent = (b.priceRange / b.avgPrice) * 100;
    return variancePercent > 20;
  });
  
  if (highVarianceItems.length > 0) {
    const itemNames = highVarianceItems.slice(0, 2).map(i => i.item.split(" ")[0]).join(", ");
    insights.push({
      type: "variance",
      message: `${itemNames} have high price variance (>20%) across markets. Shop around for best deals!`,
      impact: "medium",
    });
  }
  
  // Consolidation opportunity
  if (optimal.marketBreakdown.length <= 2 && breakdowns.length >= 3) {
    const markets = optimal.marketBreakdown.map(m => m.market).join(" and ");
    insights.push({
      type: "consolidation",
      message: `You can get all items from just ${optimal.marketBreakdown.length} market(s): ${markets}. Saves transport costs!`,
      impact: "medium",
    });
  }
  
  // Best market overall
  const topMarket = optimal.marketBreakdown[0];
  if (topMarket && topMarket.items >= Math.ceil(breakdowns.length / 2)) {
    insights.push({
      type: "recommendation",
      message: `${topMarket.market} has the best prices for ${topMarket.items} of your ${breakdowns.length} items.`,
      impact: "low",
    });
  }
  
  return insights;
}

// ============================================================================
// API HANDLERS
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tier = (searchParams.get("tier") || "FREE").toUpperCase();
    
    const defaultLimits = { maxItems: 3, showSavings: false, showOptimal: false, canExport: false };
    const limits = TIER_LIMITS[tier] ?? defaultLimits;
    
    // Return available items for the calculator
    const availableItems = [
      { id: "rice", name: "Rice (50kg)", category: "Grains", unit: "bag" },
      { id: "beans", name: "Beans (bag)", category: "Legumes", unit: "bag" },
      { id: "garri", name: "Garri (bag)", category: "Processed", unit: "bag" },
      { id: "tomatoes", name: "Tomatoes (basket)", category: "Vegetables", unit: "basket" },
      { id: "onions", name: "Onions (bag)", category: "Vegetables", unit: "bag" },
      { id: "pepper", name: "Pepper (basket)", category: "Vegetables", unit: "basket" },
      { id: "palm-oil", name: "Palm Oil (25L)", category: "Oils", unit: "25L" },
      { id: "groundnut-oil", name: "Groundnut Oil (25L)", category: "Oils", unit: "25L" },
      { id: "yam", name: "Yam (tuber)", category: "Tubers", unit: "tuber" },
      { id: "plantain", name: "Plantain (bunch)", category: "Fruits", unit: "bunch" },
      { id: "cement", name: "Cement (bag)", category: "Building", unit: "bag" },
      { id: "sugar", name: "Sugar (50kg)", category: "Sweeteners", unit: "bag" },
      { id: "flour", name: "Flour (50kg)", category: "Grains", unit: "bag" },
      { id: "semovita", name: "Semovita (10kg)", category: "Processed", unit: "pack" },
      { id: "spaghetti", name: "Spaghetti (carton)", category: "Pasta", unit: "carton" },
    ];
    
    return NextResponse.json({
      success: true,
      items: availableItems,
      tierLimits: { tier, ...limits },
    });
  } catch (error) {
    console.error("Bulk calculator GET error:", error);
    return NextResponse.json({ success: false, error: "Failed to load items" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cart, tier: tierParam } = body as { cart: CartItem[]; tier?: string };
    const tier = (tierParam || "FREE").toUpperCase();
    
    const defaultLimits = { maxItems: 3, showSavings: false, showOptimal: false, canExport: false };
    const limits = TIER_LIMITS[tier] ?? defaultLimits;
    
    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return NextResponse.json({ success: false, error: "Cart is empty" }, { status: 400 });
    }
    
    // Enforce tier limits
    const limitedCart = cart.slice(0, limits.maxItems);
    const itemNames = limitedCart.map(c => c.item);
    
    // Fetch price data
    let priceData: PriceRecord[] = [];
    let dataSource = "Unknown";
    
    const sqlResult = await fetchFromAzureSQL(itemNames);
    if (sqlResult.success) {
      priceData = sqlResult.data;
      dataSource = "Azure SQL (Daily_Prices)";
    } else {
      const sheetsResult = await fetchFromGoogleSheets(itemNames);
      if (sheetsResult.success) {
        priceData = sheetsResult.data;
        dataSource = "Google Sheets (Validated_Prices)";
      } else {
        priceData = generateMockPriceData(itemNames);
        dataSource = "Synthetic Model (Demo)";
      }
    }
    
    // Calculate breakdowns
    const itemBreakdowns = calculateItemBreakdowns(limitedCart, priceData);
    
    // Calculate optimal strategy
    const optimalStrategy = limits.showOptimal ? calculateOptimalStrategy(itemBreakdowns) : null;
    
    // Calculate single market comparison
    const singleMarketComparison = limits.showSavings
      ? calculateSingleMarketComparison(itemBreakdowns, optimalStrategy?.totalCost ?? 0)
      : [];
    
    // Generate insights
    const insights = limits.showSavings && optimalStrategy
      ? generateInsights(itemBreakdowns, optimalStrategy)
      : [];
    
    // Cart summary
    const totalQuantity = limitedCart.reduce((sum, c) => sum + c.quantity, 0);
    const estimatedCost = optimalStrategy?.totalCost ?? 
      itemBreakdowns.reduce((sum, b) => sum + b.avgPrice * b.quantity, 0);
    const potentialSavings = optimalStrategy?.totalSavings ?? 0;
    
    const response: BulkCalculatorResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      cartSummary: {
        totalItems: itemBreakdowns.length,
        totalQuantity,
        estimatedCost,
        potentialSavings: limits.showSavings ? potentialSavings : 0,
        savingsPercent: limits.showSavings ? (optimalStrategy?.savingsPercent ?? 0) : 0,
      },
      itemBreakdowns: limits.showSavings ? itemBreakdowns : itemBreakdowns.map(b => ({
        ...b,
        marketQuotes: b.marketQuotes.map(q => ({ ...q, savingsVsAvg: 0, savingsPercent: 0 })),
        bestMarket: null,
        worstMarket: null,
      })),
      optimalStrategy,
      singleMarketComparison,
      insights,
      tierLimits: { tier, ...limits },
      dataSource,
      recordCount: priceData.length,
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("Bulk calculator POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to calculate", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
