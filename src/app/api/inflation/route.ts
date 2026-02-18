// ============================================================================
// src/app/api/inflation/route.ts
// NaijaMarket Intel - Inflation Tracker API
// Bloomberg Equivalent: ECST <GO> (Economic Statistics)
// Version: 3.0.0 - NBS Jan 2026 post-rebase CPI, proper YoY calculation, fixed time_slot
// Date: 2026-02-18
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
  database: process.env.AZURE_SQL_DATABASE || "naijafoodmarket",
  user: process.env.AZURE_SQL_USER || "",
  password: process.env.AZURE_SQL_PASSWORD || "",
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

// Time period configurations
const TIME_PERIODS: Record<string, { months: number; label: string }> = {
  "1m": { months: 1, label: "1 Month" },
  "3m": { months: 3, label: "3 Months" },
  "6m": { months: 6, label: "6 Months" },
  "12m": { months: 12, label: "12 Months" },
};

// NBS Official Food Inflation Data (Monthly YoY %)
// REBASED: NBS switched from 2009 to 2024 base year in mid-2025
// Pre-rebase rates were 29-40%, post-rebase rates are 8-29%
const NBS_OFFICIAL_INFLATION: Record<string, number> = {
  // 2024 rates (pre-rebase methodology, kept for historical reference)
  "2024-01": 29.5, "2024-02": 30.1, "2024-03": 30.8, "2024-04": 31.2,
  "2024-05": 31.8, "2024-06": 32.4, "2024-07": 32.8, "2024-08": 33.1,
  "2024-09": 33.4, "2024-10": 33.6, "2024-11": 33.5, "2024-12": 33.6,
  // 2025 rates (REBASED to 2024 base year)
  "2025-01": 29.63, "2025-02": 27.50, "2025-03": 25.22, "2025-04": 24.80,
  "2025-05": 24.55, "2025-06": 23.50, "2025-07": 22.80, "2025-08": 21.50,
  "2025-09": 20.16, "2025-10": 16.30, "2025-11": 14.21, "2025-12": 10.84,
  // 2026 rates (post-rebase)
  "2026-01": 8.89, "2026-02": 8.89,  // Feb uses Jan until NBS publishes
};

// NFPI Basket weights (must sum to 100)
const BASKET_WEIGHTS: Record<string, { weight: number; category: string }> = {
  "rice": { weight: 18, category: "Grains & Cereals" },
  "beans": { weight: 8, category: "Grains & Cereals" },
  "garri": { weight: 12, category: "Grains & Cereals" },
  "yam": { weight: 6, category: "Tubers" },
  "tomatoes": { weight: 10, category: "Vegetables" },
  "onions": { weight: 7, category: "Vegetables" },
  "pepper": { weight: 8, category: "Vegetables" },
  "palm oil": { weight: 10, category: "Oils & Fats" },
  "groundnut oil": { weight: 5, category: "Oils & Fats" },
  "plantain": { weight: 4, category: "Fruits" },
  "eggs": { weight: 5, category: "Protein" },
  "fish": { weight: 4, category: "Protein" },
  "beef": { weight: 3, category: "Protein" },
};

const REGIONS: Record<string, { name: string; states: string[] }> = {
  "SW": { name: "South West", states: ["Lagos", "Ogun", "Oyo", "Osun", "Ondo", "Ekiti"] },
  "SE": { name: "South East", states: ["Anambra", "Enugu", "Imo", "Abia", "Ebonyi"] },
  "NC": { name: "North Central", states: ["FCT", "Abuja", "Benue", "Kogi", "Kwara", "Nasarawa", "Niger", "Plateau"] },
  "NW": { name: "North West", states: ["Kano", "Kaduna", "Katsina", "Kebbi", "Sokoto", "Zamfara", "Jigawa"] },
  "NE": { name: "North East", states: ["Borno", "Yobe", "Adamawa", "Bauchi", "Gombe", "Taraba"] },
  "SS": { name: "South South", states: ["Rivers", "Delta", "Bayelsa", "Akwa Ibom", "Cross River", "Edo"] },
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface PriceRecord {
  itemId: number;
  itemName: string;
  marketId: number;
  marketName: string;
  state: string;
  region: string;
  category: string;
  price: number;
  date: string;
  year: number;
  month: number;
}

interface MonthlyInflation {
  month: string;
  monthName: string;
  year: number;
  naijaMarketRate: number;
  nbsRate: number | null;
  difference: number | null;
  avgPrice: number;
  prevAvgPrice: number;
  priceChange: number;
}

interface RegionalInflation {
  region: string;
  regionName: string;
  inflationRate: number;
  monthOverMonth: number;
  trend: "up" | "down" | "stable";
  marketCount: number;
  topInflator: string | null;
}

interface ItemInflation {
  item: string;
  category: string;
  currentPrice: number;
  previousPrice: number;
  priceChange: number;
  inflationRate: number;
  contribution: number;
  trend: "up" | "down" | "stable";
}

interface BasketItem {
  item: string;
  category: string;
  weight: number;
  currentPrice: number;
  previousPrice: number;
  inflationRate: number;
  contribution: number;
}

interface InflationResponse {
  success: boolean;
  timestamp: string;
  period: string;
  periodLabel: string;
  currentInflation: {
    rate: number;
    monthOverMonth: number;
    yearOverYear: number;
    trend: "up" | "down" | "stable";
    asOf: string;
  };
  monthlyTrend: MonthlyInflation[];
  regionalBreakdown: RegionalInflation[];
  nbsComparison: {
    naijaMarket: number;
    nbs: number;
    difference: number;
    interpretation: string;
  };
  topInflators: ItemInflation[];
  topDeflators: ItemInflation[];
  basketComposition: BasketItem[];
  categoryBreakdown: {
    category: string;
    weight: number;
    inflationRate: number;
    contribution: number;
  }[];
  dataSource: string;
  recordCount: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getRegionFromState(state: string): string {
  if (!state) return "SW";
  const stateLower = state.toLowerCase();
  for (const [code, info] of Object.entries(REGIONS)) {
    if (info.states.some(s => stateLower.includes(s.toLowerCase()))) return code;
  }
  return "SW";
}

function getMonthName(month: number): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[month - 1] || "Unknown";
}

function getBasketKeyword(itemName: string): string | null {
  const itemLower = itemName.toLowerCase();
  for (const keyword of Object.keys(BASKET_WEIGHTS)) {
    if (itemLower.includes(keyword)) return keyword;
  }
  return null;
}

// ============================================================================
// DATA FETCHING FUNCTIONS
// ============================================================================

async function fetchFromDailyPrices(months: number): Promise<{ data: PriceRecord[]; success: boolean }> {
  if (!SQL_CONFIG.user || !SQL_CONFIG.password) {
    console.log("Azure SQL credentials not configured, skipping Daily_Prices...");
    return { data: [], success: false };
  }

  let pool: sql.ConnectionPool | null = null;
  
  try {
    console.log(`Connecting to Azure SQL for inflation data (${months} months)...`);
    pool = await sql.connect(SQL_CONFIG);
    
    const result = await pool.request()
      .input('months', sql.Int, months)
      .query(`
        DECLARE @EndDate DATE = (SELECT MAX(price_date) FROM dbo.Daily_Prices WHERE price_naira > 0);
        DECLARE @StartDate DATE = DATEADD(month, -@months - 12, @EndDate);

        -- Aggregate in SQL: ~15K rows instead of millions
        SELECT 
          item_name,
          state,
          category_id,
          YEAR(price_date) as price_year,
          MONTH(price_date) as price_month,
          AVG(CAST(price_naira AS FLOAT)) as avg_price,
          COUNT(*) as record_count
        FROM dbo.Daily_Prices WITH (NOLOCK)
        WHERE price_date >= @StartDate 
          AND price_date <= @EndDate
          AND price_naira > 0
          AND time_slot = '13:00'
        GROUP BY item_name, state, category_id, 
          YEAR(price_date), MONTH(price_date)
        ORDER BY price_year, price_month, item_name
      `);
    
    console.log(`Daily_Prices returned ${result.recordset.length} aggregated records for inflation`);
    
    const data: PriceRecord[] = result.recordset.map((row: {
      item_name: string;
      state: string;
      category_id: number;
      avg_price: number;
      price_year: number;
      price_month: number;
      record_count: number;
    }) => {
      return {
        itemId: 0,
        itemName: row.item_name || "",
        marketId: 0,
        marketName: "",
        state: row.state || "",
        region: getRegionFromState(row.state || ""),
        category: String(row.category_id || ""),
        price: row.avg_price || 0,
        date: `${row.price_year}-${String(row.price_month).padStart(2, "0")}-15`,
        year: row.price_year || 0,
        month: row.price_month || 0,
      };
    });
    
    return { data, success: data.length >= 100 };
  } catch (error) {
    console.error("Daily_Prices inflation query error:", error);
    return { data: [], success: false };
  } finally {
    if (pool) {
      try {
        await pool.close();
      } catch (closeError) {
        console.error("Error closing pool:", closeError);
      }
    }
  }
}

async function fetchFromValidatedPrices(months: number): Promise<{ data: PriceRecord[]; success: boolean }> {
  if (!SQL_CONFIG.user || !SQL_CONFIG.password) {
    console.log("Azure SQL credentials not configured, skipping Validated_Prices...");
    return { data: [], success: false };
  }

  let pool: sql.ConnectionPool | null = null;
  
  try {
    console.log(`Fetching Validated_Prices for inflation (${months} months)...`);
    pool = await sql.connect(SQL_CONFIG);
    
    const result = await pool.request()
      .input('months', sql.Int, months)
      .query(`
        DECLARE @EndDate DATETIME2 = (SELECT MAX(validated_at) FROM dbo.Validated_Prices WHERE validation_status = 'APPROVED');
        DECLARE @StartDate DATETIME2 = DATEADD(month, -@months - 12, @EndDate);

        SELECT 
          item_id, item_name, market_id, market_name, state,
          price_naira, validated_at,
          YEAR(validated_at) as price_year,
          MONTH(validated_at) as price_month
        FROM dbo.Validated_Prices
        WHERE validated_at >= @StartDate 
          AND validated_at <= @EndDate
          AND validation_status = 'APPROVED'
          AND price_naira > 0
        ORDER BY validated_at, item_name, market_name
      `);
    
    console.log(`Validated_Prices returned ${result.recordset.length} records for inflation`);
    
    const data: PriceRecord[] = result.recordset.map((row: {
      item_id: number;
      item_name: string;
      market_id: number;
      market_name: string;
      state: string;
      price_naira: number;
      validated_at: Date;
      price_year: number;
      price_month: number;
    }) => {
      const dateStr = row.validated_at instanceof Date 
        ? row.validated_at.toISOString().split("T")[0] ?? "" 
        : String(row.validated_at);
      
      return {
        itemId: row.item_id || 0,
        itemName: row.item_name || "",
        marketId: row.market_id || 0,
        marketName: row.market_name || "",
        state: row.state || "",
        region: getRegionFromState(row.state || ""),
        category: "",
        price: row.price_naira || 0,
        date: dateStr,
        year: row.price_year || 0,
        month: row.price_month || 0,
      };
    });
    
    return { data, success: data.length >= 100 };
  } catch (error) {
    console.error("Validated_Prices inflation query error:", error);
    return { data: [], success: false };
  } finally {
    if (pool) {
      try {
        await pool.close();
      } catch (closeError) {
        console.error("Error closing pool:", closeError);
      }
    }
  }
}

async function fetchFromGoogleSheets(): Promise<{ data: PriceRecord[]; success: boolean }> {
  if (!GOOGLE_API_KEY) {
    console.log("Google Sheets API key not configured, skipping...");
    return { data: [], success: false };
  }

  try {
    console.log("Fetching from Google Sheets for inflation...");
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}/values/Validated_Prices?key=${GOOGLE_API_KEY}`;
    const response = await fetch(url, { next: { revalidate: 300 } });
    
    if (!response.ok) {
      console.error(`Google Sheets API error: ${response.status}`);
      return { data: [], success: false };
    }
    
    const result = await response.json();
    const rows: string[][] = result.values || [];
    
    if (rows.length < 2) return { data: [], success: false };
    
    const headers = rows[0] ?? [];
    const itemIdx = headers.findIndex((h: string) => h?.toLowerCase().includes("item"));
    const priceIdx = headers.findIndex((h: string) => h?.toLowerCase().includes("price"));
    const marketIdx = headers.findIndex((h: string) => h?.toLowerCase().includes("market"));
    const stateIdx = headers.findIndex((h: string) => h?.toLowerCase().includes("state"));
    const dateIdx = headers.findIndex((h: string) => h?.toLowerCase().includes("date"));
    
    const data: PriceRecord[] = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] ?? [];
      const item = row[itemIdx] ?? "";
      const price = parseFloat(row[priceIdx] ?? "0") || 0;
      const market = row[marketIdx] ?? "";
      const state = row[stateIdx] ?? "";
      const dateStr = row[dateIdx] ?? "";
      
      if (item && price > 0 && market && dateStr) {
        const dateParts = dateStr.split(/[-/]/);
        const year = parseInt(dateParts[0] || "2026");
        const month = parseInt(dateParts[1] || "1");
        
        data.push({
          itemId: i,
          itemName: item,
          marketId: i % 50,
          marketName: market,
          state,
          region: getRegionFromState(state),
          category: "",
          price,
          date: dateStr,
          year,
          month,
        });
      }
    }
    
    console.log(`Google Sheets returned ${data.length} records for inflation`);
    return { data, success: data.length >= 100 };
  } catch (error) {
    console.error("Google Sheets inflation error:", error);
    return { data: [], success: false };
  }
}

function generateMockInflationData(months: number): PriceRecord[] {
  console.log(`Generating synthetic inflation data for ${months} months...`);
  const data: PriceRecord[] = [];
  
  const items = [
    { id: 1, name: "Rice (50kg) - Foreign", basePrice: 65000 },
    { id: 2, name: "Beans (bag)", basePrice: 55000 },
    { id: 3, name: "Garri (bag)", basePrice: 22000 },
    { id: 4, name: "Yam (tuber)", basePrice: 2200 },
    { id: 5, name: "Tomatoes (basket)", basePrice: 35000 },
    { id: 6, name: "Onions (bag)", basePrice: 30000 },
    { id: 7, name: "Pepper (basket)", basePrice: 25000 },
    { id: 8, name: "Palm Oil (25L)", basePrice: 42000 },
    { id: 9, name: "Groundnut Oil (25L)", basePrice: 48000 },
    { id: 10, name: "Plantain (bunch)", basePrice: 3500 },
    { id: 11, name: "Eggs (crate)", basePrice: 2800 },
    { id: 12, name: "Fish (kg)", basePrice: 4500 },
    { id: 13, name: "Beef (kg)", basePrice: 5500 },
  ];
  
  const markets = [
    { id: 1, name: "Mile 12 Market", state: "Lagos" },
    { id: 2, name: "Onitsha Main Market", state: "Anambra" },
    { id: 3, name: "Wuse Market", state: "FCT" },
    { id: 4, name: "Kano Main Market", state: "Kano" },
    { id: 5, name: "Port Harcourt Main Market", state: "Rivers" },
    { id: 6, name: "Bodija Market", state: "Oyo" },
  ];
  
  const now = new Date();
  const totalMonths = months + 12; // Need extra 12 months for YoY comparison
  
  for (let m = 0; m < totalMonths; m++) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - m);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const dateStr = `${year}-${String(month).padStart(2, "0")}-15`;
    
    // Inflation factor: prices increase over time
    const monthsAgo = m;
    const inflationFactor = Math.pow(1.0071, monthsAgo); // ~8.89% annual inflation (post-rebase)
    
    for (const market of markets) {
      for (const item of items) {
        // Add some randomness and seasonal variation
        const seasonalFactor = 1 + 0.1 * Math.sin((month - 1) * Math.PI / 6);
        const randomFactor = 0.95 + Math.random() * 0.1;
        const price = Math.round(item.basePrice * inflationFactor * seasonalFactor * randomFactor);
        
        data.push({
          itemId: item.id,
          itemName: item.name,
          marketId: market.id,
          marketName: market.name,
          state: market.state,
          region: getRegionFromState(market.state),
          category: "",
          price,
          date: dateStr,
          year,
          month,
        });
      }
    }
  }
  
  console.log(`Generated ${data.length} synthetic inflation records`);
  return data;
}

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

function calculateMonthlyInflation(data: PriceRecord[], months: number): MonthlyInflation[] {
  // Group by year-month
  const monthlyData = new Map<string, PriceRecord[]>();
  
  for (const record of data) {
    const key = `${record.year}-${String(record.month).padStart(2, "0")}`;
    const existing = monthlyData.get(key) || [];
    existing.push(record);
    monthlyData.set(key, existing);
  }
  
  // Calculate weighted average price per month
  const monthlyAvg = new Map<string, number>();
  for (const [key, records] of monthlyData) {
    let totalWeightedPrice = 0;
    let totalWeight = 0;
    for (const record of records) {
      const keyword = getBasketKeyword(record.itemName);
      if (keyword && BASKET_WEIGHTS[keyword]) {
        const weight = BASKET_WEIGHTS[keyword]?.weight ?? 0;
        totalWeightedPrice += record.price * weight;
        totalWeight += weight;
      }
    }
    if (totalWeight > 0) {
      monthlyAvg.set(key, totalWeightedPrice / totalWeight);
    }
  }
  
  // Sort keys and get last N months (display period)
  const allKeys = [...monthlyAvg.keys()].sort();
  const displayKeys = allKeys.slice(-months);
  
  const result: MonthlyInflation[] = [];
  let prevAvgPrice = 0;
  
  for (const key of displayKeys) {
    const [yearStr, monthStr] = key.split("-");
    const year = parseInt(yearStr || "2026");
    const month = parseInt(monthStr || "1");
    const avgPrice = monthlyAvg.get(key) || 0;
    
    // YoY: compare to same month last year
    const yearAgoKey = `${year - 1}-${monthStr}`;
    const yearAgoPrice = monthlyAvg.get(yearAgoKey) || 0;
    
    // Proper YoY inflation rate
    const yoyRate = yearAgoPrice > 0 
      ? ((avgPrice - yearAgoPrice) / yearAgoPrice) * 100 
      : 0;
    
    // MoM change (for trend direction)
    const momChange = prevAvgPrice > 0 
      ? ((avgPrice - prevAvgPrice) / prevAvgPrice) * 100 
      : 0;
    
    // Get NBS rate for this month
    const nbsRate = NBS_OFFICIAL_INFLATION[key] ?? null;
    
    result.push({
      month: key,
      monthName: `${getMonthName(month)} ${year}`,
      year,
      naijaMarketRate: Math.round(yoyRate * 10) / 10,
      nbsRate,
      difference: nbsRate !== null ? Math.round((yoyRate - nbsRate) * 10) / 10 : null,
      avgPrice: Math.round(avgPrice),
      prevAvgPrice: Math.round(yearAgoPrice > 0 ? yearAgoPrice : prevAvgPrice),
      priceChange: Math.round(avgPrice - (yearAgoPrice > 0 ? yearAgoPrice : prevAvgPrice)),
    });
    
    prevAvgPrice = avgPrice;
  }
  
  return result;
}

function calculateRegionalInflation(data: PriceRecord[]): RegionalInflation[] {
  const result: RegionalInflation[] = [];
  
  // Get current and previous month data
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevDate = new Date(now);
  prevDate.setMonth(prevDate.getMonth() - 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
  const yearAgoDate = new Date(now);
  yearAgoDate.setFullYear(yearAgoDate.getFullYear() - 1);
  const yearAgoMonth = `${yearAgoDate.getFullYear()}-${String(yearAgoDate.getMonth() + 1).padStart(2, "0")}`;
  
  for (const [regionCode, regionInfo] of Object.entries(REGIONS)) {
    const regionData = data.filter(d => d.region === regionCode);
    
    // Current month prices
    const currentData = regionData.filter(d => 
      `${d.year}-${String(d.month).padStart(2, "0")}` === currentMonth ||
      `${d.year}-${String(d.month).padStart(2, "0")}` >= currentMonth.slice(0, 7)
    );
    
    // Year ago prices
    const yearAgoData = regionData.filter(d => 
      `${d.year}-${String(d.month).padStart(2, "0")}` === yearAgoMonth ||
      `${d.year}-${String(d.month).padStart(2, "0")}`.startsWith(yearAgoMonth.slice(0, 7))
    );
    
    // Previous month prices
    const prevData = regionData.filter(d => 
      `${d.year}-${String(d.month).padStart(2, "0")}` === prevMonth ||
      `${d.year}-${String(d.month).padStart(2, "0")}`.startsWith(prevMonth.slice(0, 7))
    );
    
    // Calculate average prices
    const avgCurrent = currentData.length > 0 
      ? currentData.reduce((sum, d) => sum + d.price, 0) / currentData.length 
      : 0;
    const avgYearAgo = yearAgoData.length > 0 
      ? yearAgoData.reduce((sum, d) => sum + d.price, 0) / yearAgoData.length 
      : avgCurrent;
    const avgPrev = prevData.length > 0 
      ? prevData.reduce((sum, d) => sum + d.price, 0) / prevData.length 
      : avgCurrent;
    
    // YoY inflation
    const yoyInflation = avgYearAgo > 0 ? ((avgCurrent - avgYearAgo) / avgYearAgo) * 100 : 0;
    // MoM change
    const momChange = avgPrev > 0 ? ((avgCurrent - avgPrev) / avgPrev) * 100 : 0;
    
    // Find top inflator in region
    const itemChanges = new Map<string, { current: number; prev: number; count: number }>();
    for (const d of currentData) {
      const existing = itemChanges.get(d.itemName) || { current: 0, prev: 0, count: 0 };
      existing.current += d.price;
      existing.count++;
      itemChanges.set(d.itemName, existing);
    }
    for (const d of yearAgoData) {
      const existing = itemChanges.get(d.itemName);
      if (existing) existing.prev += d.price;
    }
    
    let topInflator: string | null = null;
    let maxInflation = 0;
    for (const [item, data] of itemChanges) {
      if (data.prev > 0 && data.count > 0) {
        const inflation = ((data.current / data.count) - (data.prev / data.count)) / (data.prev / data.count) * 100;
        if (inflation > maxInflation) {
          maxInflation = inflation;
          topInflator = item;
        }
      }
    }
    
    const uniqueMarkets = [...new Set(regionData.map(d => d.marketId))];
    
    result.push({
      region: regionCode,
      regionName: regionInfo.name,
      inflationRate: Math.round(yoyInflation * 10) / 10,
      monthOverMonth: Math.round(momChange * 10) / 10,
      trend: momChange > 0.5 ? "up" : momChange < -0.5 ? "down" : "stable",
      marketCount: uniqueMarkets.length,
      topInflator,
    });
  }
  
  return result.sort((a, b) => b.inflationRate - a.inflationRate);
}

function calculateItemInflation(data: PriceRecord[]): { inflators: ItemInflation[]; deflators: ItemInflation[] } {
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const yearAgo = new Date(now);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const yearAgoKey = `${yearAgo.getFullYear()}-${String(yearAgo.getMonth() + 1).padStart(2, "0")}`;
  
  // Group by item
  const itemData = new Map<string, { current: number[]; yearAgo: number[]; category: string }>();
  
  for (const record of data) {
    const monthKey = `${record.year}-${String(record.month).padStart(2, "0")}`;
    const existing = itemData.get(record.itemName) || { current: [], yearAgo: [], category: "" };
    
    if (monthKey >= currentKey.slice(0, 7)) {
      existing.current.push(record.price);
    } else if (monthKey.startsWith(yearAgoKey.slice(0, 7)) || monthKey === yearAgoKey) {
      existing.yearAgo.push(record.price);
    }
    
    const keyword = getBasketKeyword(record.itemName);
    if (keyword && BASKET_WEIGHTS[keyword]) {
      existing.category = BASKET_WEIGHTS[keyword]?.category ?? "";
    }
    
    itemData.set(record.itemName, existing);
  }
  
  const items: ItemInflation[] = [];
  
  for (const [item, data] of itemData) {
    if (data.current.length === 0) continue;
    
    const currentPrice = data.current.reduce((a, b) => a + b, 0) / data.current.length;
    const prevPrice = data.yearAgo.length > 0 
      ? data.yearAgo.reduce((a, b) => a + b, 0) / data.yearAgo.length 
      : currentPrice;
    
    const priceChange = currentPrice - prevPrice;
    const inflationRate = prevPrice > 0 ? (priceChange / prevPrice) * 100 : 0;
    
    // Calculate contribution to overall inflation
    const keyword = getBasketKeyword(item);
    const weight = keyword && BASKET_WEIGHTS[keyword] ? BASKET_WEIGHTS[keyword]?.weight ?? 0 : 0;
    const contribution = (inflationRate * weight) / 100;
    
    items.push({
      item,
      category: data.category || "Other",
      currentPrice: Math.round(currentPrice),
      previousPrice: Math.round(prevPrice),
      priceChange: Math.round(priceChange),
      inflationRate: Math.round(inflationRate * 10) / 10,
      contribution: Math.round(contribution * 10) / 10,
      trend: inflationRate > 2 ? "up" : inflationRate < -2 ? "down" : "stable",
    });
  }
  
  items.sort((a, b) => b.inflationRate - a.inflationRate);
  
  return {
    inflators: items.filter(i => i.inflationRate > 0).slice(0, 10),
    deflators: items.filter(i => i.inflationRate < 0).slice(0, 10).reverse(),
  };
}

function calculateBasketComposition(data: PriceRecord[]): BasketItem[] {
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const yearAgo = new Date(now);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const yearAgoKey = `${yearAgo.getFullYear()}-${String(yearAgo.getMonth() + 1).padStart(2, "0")}`;
  
  const basket: BasketItem[] = [];
  
  for (const [keyword, config] of Object.entries(BASKET_WEIGHTS)) {
    const itemRecords = data.filter(d => d.itemName.toLowerCase().includes(keyword));
    
    const currentRecords = itemRecords.filter(d => 
      `${d.year}-${String(d.month).padStart(2, "0")}` >= currentKey.slice(0, 7)
    );
    const yearAgoRecords = itemRecords.filter(d => 
      `${d.year}-${String(d.month).padStart(2, "0")}`.startsWith(yearAgoKey.slice(0, 7))
    );
    
    const currentPrice = currentRecords.length > 0 
      ? currentRecords.reduce((sum, d) => sum + d.price, 0) / currentRecords.length 
      : 0;
    const prevPrice = yearAgoRecords.length > 0 
      ? yearAgoRecords.reduce((sum, d) => sum + d.price, 0) / yearAgoRecords.length 
      : currentPrice;
    
    const inflationRate = prevPrice > 0 ? ((currentPrice - prevPrice) / prevPrice) * 100 : 0;
    const contribution = (inflationRate * config.weight) / 100;
    
    basket.push({
      item: keyword.charAt(0).toUpperCase() + keyword.slice(1),
      category: config.category,
      weight: config.weight,
      currentPrice: Math.round(currentPrice),
      previousPrice: Math.round(prevPrice),
      inflationRate: Math.round(inflationRate * 10) / 10,
      contribution: Math.round(contribution * 10) / 10,
    });
  }
  
  return basket.sort((a, b) => b.contribution - a.contribution);
}

function calculateCategoryBreakdown(basket: BasketItem[]): { category: string; weight: number; inflationRate: number; contribution: number }[] {
  const categories = new Map<string, { weight: number; weightedInflation: number }>();
  
  for (const item of basket) {
    const existing = categories.get(item.category) || { weight: 0, weightedInflation: 0 };
    existing.weight += item.weight;
    existing.weightedInflation += item.inflationRate * item.weight;
    categories.set(item.category, existing);
  }
  
  const result: { category: string; weight: number; inflationRate: number; contribution: number }[] = [];
  
  for (const [category, data] of categories) {
    const avgInflation = data.weight > 0 ? data.weightedInflation / data.weight : 0;
    const contribution = (avgInflation * data.weight) / 100;
    
    result.push({
      category,
      weight: data.weight,
      inflationRate: Math.round(avgInflation * 10) / 10,
      contribution: Math.round(contribution * 10) / 10,
    });
  }
  
  return result.sort((a, b) => b.contribution - a.contribution);
}

// ============================================================================
// API HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "12m";
    const region = searchParams.get("region") || "ALL";
    
    // Validate period
    const periodConfig = TIME_PERIODS[period] || TIME_PERIODS["12m"];
    const periodMonths = periodConfig?.months ?? 12;
    const periodLabel = periodConfig?.label ?? "12 Months";
    
    let priceData: PriceRecord[] = [];
    let dataSource = "Unknown";
    
    // HYBRID DATA APPROACH
    console.log(`Fetching inflation data for period: ${period} (${periodMonths} months)`);
    
    // Step 1: Try Daily_Prices (Primary)
    const dailyResult = await fetchFromDailyPrices(periodMonths);
    if (dailyResult.success) {
      priceData = dailyResult.data;
      dataSource = `Azure SQL (Daily_Prices - ${periodLabel})`;
      console.log(`Using Daily_Prices: ${priceData.length} records`);
    } else {
      // Step 2: Try Validated_Prices (Backup)
      const validatedResult = await fetchFromValidatedPrices(periodMonths);
      if (validatedResult.success) {
        priceData = validatedResult.data;
        dataSource = `Azure SQL (Validated_Prices - ${periodLabel})`;
        console.log(`Using Validated_Prices: ${priceData.length} records`);
      } else {
        // Step 3: Try Google Sheets
        const sheetsResult = await fetchFromGoogleSheets();
        if (sheetsResult.success) {
          priceData = sheetsResult.data;
          dataSource = `Google Sheets (${periodLabel})`;
          console.log(`Using Google Sheets: ${priceData.length} records`);
        } else {
          // Step 4: Use Mock Data
          priceData = generateMockInflationData(periodMonths);
          dataSource = `Synthetic Model (Demo - ${periodLabel})`;
          console.log(`Using Mock Data: ${priceData.length} records`);
        }
      }
    }
    
    // Filter by region if specified
    if (region !== "ALL") {
      priceData = priceData.filter(p => p.region === region);
    }
    
    // Calculate all inflation metrics
    const monthlyTrend = calculateMonthlyInflation(priceData, periodMonths);
    const regionalBreakdown = calculateRegionalInflation(priceData);
    const { inflators, deflators } = calculateItemInflation(priceData);
    const basketComposition = calculateBasketComposition(priceData);
    const categoryBreakdown = calculateCategoryBreakdown(basketComposition);
    
    // Current inflation (latest month)
    const latestMonth = monthlyTrend[monthlyTrend.length - 1];
    const prevMonth = monthlyTrend[monthlyTrend.length - 2];
    
    const currentRate = latestMonth?.naijaMarketRate ?? 0;
    const momChange = latestMonth && prevMonth 
      ? latestMonth.naijaMarketRate - prevMonth.naijaMarketRate 
      : 0;
    
    // Get latest NBS rate for comparison
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const latestNBS = NBS_OFFICIAL_INFLATION[currentMonthKey] ?? 
                      NBS_OFFICIAL_INFLATION[`${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`] ?? 
                      8.89;  // NBS Jan 2026 food inflation (post-rebase)
    
    const nbsDifference = currentRate - latestNBS;
    let interpretation = "NaijaMarket data closely aligns with official NBS statistics";
    if (nbsDifference > 2) {
      interpretation = `NaijaMarket shows ${Math.abs(nbsDifference).toFixed(1)}pp higher inflation than NBS - real-time market prices may be rising faster than official surveys capture`;
    } else if (nbsDifference < -2) {
      interpretation = `NaijaMarket shows ${Math.abs(nbsDifference).toFixed(1)}pp lower inflation than NBS - market prices may be stabilizing faster than official data reflects`;
    } else {
      interpretation = `NaijaMarket and NBS data are within ${Math.abs(nbsDifference).toFixed(1)}pp - strong alignment between real-time and official statistics`;
    }
    
    const response: InflationResponse = {
      success: true,
      timestamp: now.toISOString(),
      period,
      periodLabel,
      currentInflation: {
        rate: Math.round(currentRate * 10) / 10,
        monthOverMonth: Math.round(momChange * 10) / 10,
        yearOverYear: Math.round(currentRate * 10) / 10,
        trend: momChange > 0.5 ? "up" : momChange < -0.5 ? "down" : "stable",
        asOf: latestMonth?.monthName ?? `${getMonthName(now.getMonth() + 1)} ${now.getFullYear()}`,
      },
      monthlyTrend,
      regionalBreakdown,
      nbsComparison: {
        naijaMarket: Math.round(currentRate * 10) / 10,
        nbs: latestNBS,
        difference: Math.round(nbsDifference * 10) / 10,
        interpretation,
      },
      topInflators: inflators,
      topDeflators: deflators,
      basketComposition,
      categoryBreakdown,
      dataSource,
      recordCount: priceData.length,
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("Inflation API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to calculate inflation",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
