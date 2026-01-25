// ============================================================================
// src/app/api/inflation/route.ts
// NaijaMarket Intel - Inflation Tracker API
// Bloomberg Equivalent: ECST <GO> (Economic Statistics)
// Version: 2.0.0 - Hybrid Data (Azure SQL → Google Sheets → Mock)
// Date: 2026-01-25
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";

// ============================================================================
// CONFIGURATION
// ============================================================================

const GOOGLE_SHEETS_ID = "1n-7MXdoqvIoSHteBJaUYBmIPLjJBNtrE_jVuUxO5kr8";
const GOOGLE_API_KEY = process.env.GOOGLE_SHEETS_API_KEY || "";

// Azure SQL Configuration
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

// NBS Official Inflation Data (Food Component)
const NBS_OFFICIAL_INFLATION: Record<string, number> = {
  "2024-01": 29.5, "2024-02": 30.1, "2024-03": 30.8, "2024-04": 31.2,
  "2024-05": 31.8, "2024-06": 32.4, "2024-07": 32.8, "2024-08": 33.1,
  "2024-09": 33.4, "2024-10": 33.6, "2024-11": 33.5, "2024-12": 33.6,
  "2025-01": 33.7, "2025-02": 34.2, "2025-03": 33.9, "2025-04": 33.5,
  "2025-05": 34.1, "2025-06": 34.8, "2025-07": 35.2, "2025-08": 34.6,
  "2025-09": 33.8, "2025-10": 33.2, "2025-11": 32.8, "2025-12": 33.1,
  "2026-01": 33.7,
};

// Tier-based access limits
const TIER_LIMITS: Record<string, {
  monthsBack: number;
  showRegional: boolean;
  showNBSComparison: boolean;
  canExport: boolean;
}> = {
  FREE: { monthsBack: 3, showRegional: false, showNBSComparison: false, canExport: false },
  SILVER: { monthsBack: 6, showRegional: true, showNBSComparison: false, canExport: false },
  GOLD: { monthsBack: 12, showRegional: true, showNBSComparison: true, canExport: true },
  BUSINESS: { monthsBack: 24, showRegional: true, showNBSComparison: true, canExport: true },
  CORPORATE: { monthsBack: 36, showRegional: true, showNBSComparison: true, canExport: true },
  ENTERPRISE: { monthsBack: 60, showRegional: true, showNBSComparison: true, canExport: true },
};

// Regional mapping
const REGIONS: Record<string, string[]> = {
  "SW": ["Lagos", "Ogun", "Oyo", "Osun", "Ondo", "Ekiti"],
  "SE": ["Anambra", "Enugu", "Imo", "Abia", "Ebonyi"],
  "NC": ["FCT", "Abuja", "Benue", "Kogi", "Kwara", "Nasarawa", "Niger", "Plateau"],
  "NW": ["Kano", "Kaduna", "Katsina", "Kebbi", "Sokoto", "Zamfara", "Jigawa"],
  "NE": ["Borno", "Yobe", "Adamawa", "Bauchi", "Gombe", "Taraba"],
  "SS": ["Rivers", "Delta", "Bayelsa", "Akwa Ibom", "Cross River", "Edo"],
};

const REGION_NAMES: Record<string, string> = {
  "SW": "South West",
  "SE": "South East",
  "NC": "North Central",
  "NW": "North West",
  "NE": "North East",
  "SS": "South South",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface PriceRecord {
  item: string;
  market: string;
  state: string;
  region: string;
  price: number;
  date: string;
  year: number;
  month: number;
}

interface MonthlyInflation {
  month: string;
  monthName: string;
  year: number;
  inflationRate: number;
  nbsRate: number | null;
  difference: number | null;
  avgPrice: number;
  prevAvgPrice: number;
}

interface RegionalInflation {
  region: string;
  regionName: string;
  inflationRate: number;
  change: number;
  trend: "up" | "down" | "stable";
  markets: string[];
}

interface ItemInflation {
  item: string;
  currentPrice: number;
  previousPrice: number;
  inflationRate: number;
  change30d: number;
  trend: "up" | "down" | "stable";
}

interface InflationResponse {
  success: boolean;
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
  } | null;
  topInflators: ItemInflation[];
  topDeflators: ItemInflation[];
  basketComposition: {
    item: string;
    weight: number;
    contribution: number;
  }[];
  tierLimits: {
    tier: string;
    monthsBack: number;
    showRegional: boolean;
    showNBSComparison: boolean;
    canExport: boolean;
  };
  dataSource: string;
  lastUpdated: string;
  recordCount: number;
}

// ============================================================================
// DATA FETCHING FUNCTIONS
// ============================================================================

/**
 * 1️⃣ PRIMARY: Fetch from Azure SQL Daily_Prices table
 */
async function fetchFromAzureSQL(monthsBack: number): Promise<{ data: PriceRecord[]; success: boolean }> {
  // Check if credentials are configured
  if (!SQL_CONFIG.user || !SQL_CONFIG.password) {
    console.log("Azure SQL credentials not configured, skipping...");
    return { data: [], success: false };
  }

  let pool: sql.ConnectionPool | null = null;
  
  try {
    console.log("Connecting to Azure SQL...");
    pool = await sql.connect(SQL_CONFIG);
    
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);
    const cutoffStr = cutoffDate.toISOString().split("T")[0];
    
    const result = await pool.request()
      .input("cutoffDate", sql.Date, cutoffStr)
      .query(`
        SELECT 
          item_name AS item,
          market_name AS market,
          state,
          price_naira AS price,
          price_date AS date,
          YEAR(price_date) AS year,
          MONTH(price_date) AS month
        FROM dbo.Daily_Prices
        WHERE price_date >= @cutoffDate
          AND price_naira > 0
        ORDER BY price_date DESC
      `);
    
    console.log(`Azure SQL returned ${result.recordset.length} records`);
    
    const data: PriceRecord[] = result.recordset.map((row: {
      item: string;
      market: string;
      state: string;
      price: number;
      date: Date;
      year: number;
      month: number;
    }) => ({
      item: row.item,
      market: row.market,
      state: row.state,
      region: getRegionFromState(row.state),
      price: row.price,
      date: row.date instanceof Date ? row.date.toISOString().split("T")[0] ?? "" : String(row.date),
      year: row.year,
      month: row.month,
    }));
    
    return { data, success: true };
    
  } catch (error) {
    console.error("Azure SQL error:", error);
    return { data: [], success: false };
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

/**
 * 2️⃣ FALLBACK: Fetch from Google Sheets
 */
async function fetchFromGoogleSheets(): Promise<{ data: PriceRecord[]; success: boolean }> {
  if (!GOOGLE_API_KEY) {
    console.log("Google Sheets API key not configured, skipping...");
    return { data: [], success: false };
  }

  try {
    console.log("Fetching from Google Sheets...");
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}/values/Validated_Prices?key=${GOOGLE_API_KEY}`;
    const response = await fetch(url, { next: { revalidate: 3600 } });
    
    if (!response.ok) {
      console.error(`Google Sheets API error: ${response.status}`);
      return { data: [], success: false };
    }
    
    const result = await response.json();
    const rows: string[][] = result.values || [];
    
    if (rows.length < 2) {
      return { data: [], success: false };
    }
    
    const headers = rows[0] ?? [];
    const itemIdx = headers.findIndex((h: string) => h?.toLowerCase().includes("item") || h?.toLowerCase().includes("commodity"));
    const priceIdx = headers.findIndex((h: string) => h?.toLowerCase().includes("price"));
    const marketIdx = headers.findIndex((h: string) => h?.toLowerCase().includes("market"));
    const stateIdx = headers.findIndex((h: string) => h?.toLowerCase().includes("state"));
    const dateIdx = headers.findIndex((h: string) => h?.toLowerCase().includes("date") || h?.toLowerCase().includes("created"));
    
    const data: PriceRecord[] = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] ?? [];
      const item = row[itemIdx] ?? "";
      const price = parseFloat(row[priceIdx] ?? "0") || 0;
      const market = row[marketIdx] ?? "";
      const state = row[stateIdx] ?? "";
      const dateStr = row[dateIdx] ?? "";
      
      if (item && price > 0) {
        const date = new Date(dateStr);
        const year = date.getFullYear() || new Date().getFullYear();
        const month = (date.getMonth() + 1) || 1;
        
        data.push({
          item,
          market,
          state,
          region: getRegionFromState(state),
          price,
          date: dateStr,
          year,
          month,
        });
      }
    }
    
    console.log(`Google Sheets returned ${data.length} records`);
    return { data, success: data.length > 0 };
    
  } catch (error) {
    console.error("Google Sheets error:", error);
    return { data: [], success: false };
  }
}

/**
 * 3️⃣ FINAL FALLBACK: Generate synthetic data
 */
function generateMockPriceData(months: number = 12): PriceRecord[] {
  console.log("Generating synthetic data...");
  const data: PriceRecord[] = [];
  const currentDate = new Date();
  
  const items = [
    { name: "Rice (50kg)", basePrice: 75000, volatility: 0.15 },
    { name: "Tomatoes (basket)", basePrice: 45000, volatility: 0.35 },
    { name: "Onions (bag)", basePrice: 35000, volatility: 0.25 },
    { name: "Beans (bag)", basePrice: 60000, volatility: 0.12 },
    { name: "Garri (bag)", basePrice: 28000, volatility: 0.10 },
    { name: "Palm Oil (25L)", basePrice: 50000, volatility: 0.18 },
    { name: "Yam (tuber)", basePrice: 2500, volatility: 0.20 },
    { name: "Pepper (basket)", basePrice: 30000, volatility: 0.30 },
    { name: "Plantain (bunch)", basePrice: 4000, volatility: 0.22 },
    { name: "Groundnut Oil (25L)", basePrice: 55000, volatility: 0.15 },
  ];
  
  const markets = [
    { name: "Mile 12 Market", state: "Lagos", region: "SW" },
    { name: "Alaba International", state: "Lagos", region: "SW" },
    { name: "Onitsha Main Market", state: "Anambra", region: "SE" },
    { name: "Wuse Market", state: "FCT", region: "NC" },
    { name: "Kano Main Market", state: "Kano", region: "NW" },
    { name: "Port Harcourt Market", state: "Rivers", region: "SS" },
    { name: "Ariaria Market", state: "Abia", region: "SE" },
    { name: "Jos Main Market", state: "Plateau", region: "NC" },
  ];
  
  for (let m = months; m >= 0; m--) {
    const date = new Date(currentDate);
    date.setMonth(date.getMonth() - m);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const dateStr = `${year}-${String(month).padStart(2, "0")}-15`;
    
    const monthsFromStart = months - m;
    const inflationFactor = 1 + (monthsFromStart * 0.025);
    
    for (const item of items) {
      for (const market of markets) {
        const regionalVariation = market.region === "SW" ? 1.05 : 
                                  market.region === "NW" ? 0.92 : 
                                  market.region === "SE" ? 1.02 : 1.0;
        
        const randomFactor = 1 + (Math.random() - 0.5) * item.volatility;
        const price = Math.round(item.basePrice * inflationFactor * regionalVariation * randomFactor);
        
        data.push({
          item: item.name,
          market: market.name,
          state: market.state,
          region: market.region,
          price,
          date: dateStr,
          year,
          month,
        });
      }
    }
  }
  
  console.log(`Generated ${data.length} synthetic records`);
  return data;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getRegionFromState(state: string): string {
  const stateLower = state.toLowerCase();
  for (const [region, states] of Object.entries(REGIONS)) {
    if (states.some(s => stateLower.includes(s.toLowerCase()))) {
      return region;
    }
  }
  return "SW"; // Default
}

function calculateInflation(currentPrices: number[], previousPrices: number[]): number {
  if (currentPrices.length === 0 || previousPrices.length === 0) return 0;
  
  const currentAvg = currentPrices.reduce((a, b) => a + b, 0) / currentPrices.length;
  const previousAvg = previousPrices.reduce((a, b) => a + b, 0) / previousPrices.length;
  
  if (previousAvg === 0) return 0;
  return ((currentAvg - previousAvg) / previousAvg) * 100;
}

function getMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// ============================================================================
// API HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tier = (searchParams.get("tier") || "FREE").toUpperCase();
    
    const defaultLimits = { monthsBack: 3, showRegional: false, showNBSComparison: false, canExport: false };
    const limits = TIER_LIMITS[tier] ?? defaultLimits;
    
    // ========================================================================
    // HYBRID DATA FETCHING: Azure SQL → Google Sheets → Mock
    // ========================================================================
    let priceData: PriceRecord[] = [];
    let dataSource = "Unknown";
    
    // 1️⃣ Try Azure SQL first
    const sqlResult = await fetchFromAzureSQL(limits.monthsBack);
    if (sqlResult.success && sqlResult.data.length >= 100) {
      priceData = sqlResult.data;
      dataSource = "Azure SQL (Daily_Prices)";
    } else {
      // 2️⃣ Try Google Sheets
      const sheetsResult = await fetchFromGoogleSheets();
      if (sheetsResult.success && sheetsResult.data.length >= 50) {
        priceData = sheetsResult.data;
        dataSource = "Google Sheets (Validated_Prices)";
      } else {
        // 3️⃣ Use synthetic data
        priceData = generateMockPriceData(limits.monthsBack);
        dataSource = "Synthetic Model (Demo)";
      }
    }
    
    // ========================================================================
    // CALCULATE INFLATION METRICS
    // ========================================================================
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentMonthKey = getMonthKey(currentYear, currentMonth);
    
    const prevDate = new Date(now);
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth() + 1;
    
    const lastYearMonth = currentMonth;
    const lastYear = currentYear - 1;
    
    const currentMonthPrices = priceData.filter(p => p.year === currentYear && p.month === currentMonth);
    const prevMonthPrices = priceData.filter(p => p.year === prevYear && p.month === prevMonth);
    const lastYearPrices = priceData.filter(p => p.year === lastYear && p.month === lastYearMonth);
    
    const momInflation = calculateInflation(
      currentMonthPrices.map(p => p.price),
      prevMonthPrices.map(p => p.price)
    );
    
    const yoyInflation = calculateInflation(
      currentMonthPrices.map(p => p.price),
      lastYearPrices.map(p => p.price)
    );
    
    let trend: "up" | "down" | "stable" = "stable";
    if (momInflation > 1) trend = "up";
    else if (momInflation < -1) trend = "down";
    
    // Monthly trend
    const monthlyTrend: MonthlyInflation[] = [];
    for (let i = 0; i < limits.monthsBack; i++) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthKey = getMonthKey(year, month);
      
      const monthPrices = priceData.filter(p => p.year === year && p.month === month);
      
      const prevD = new Date(date);
      prevD.setMonth(prevD.getMonth() - 1);
      const prevMonthPricesForCalc = priceData.filter(p => 
        p.year === prevD.getFullYear() && p.month === (prevD.getMonth() + 1)
      );
      
      const inflationRate = calculateInflation(
        monthPrices.map(p => p.price),
        prevMonthPricesForCalc.map(p => p.price)
      );
      
      const avgPrice = monthPrices.length > 0 
        ? monthPrices.reduce((a, b) => a + b.price, 0) / monthPrices.length 
        : 0;
      
      const prevAvgPrice = prevMonthPricesForCalc.length > 0
        ? prevMonthPricesForCalc.reduce((a, b) => a + b.price, 0) / prevMonthPricesForCalc.length
        : 0;
      
      const nbsRate = NBS_OFFICIAL_INFLATION[monthKey] ?? null;
      
      monthlyTrend.push({
        month: monthKey,
        monthName: MONTHS[month - 1] ?? "Unknown",
        year,
        inflationRate: Math.round(inflationRate * 10) / 10,
        nbsRate,
        difference: nbsRate !== null ? Math.round((inflationRate - nbsRate) * 10) / 10 : null,
        avgPrice: Math.round(avgPrice),
        prevAvgPrice: Math.round(prevAvgPrice),
      });
    }
    
    // Regional breakdown
    const regionalBreakdown: RegionalInflation[] = [];
    if (limits.showRegional) {
      for (const [regionCode, regionName] of Object.entries(REGION_NAMES)) {
        const regionCurrentPrices = currentMonthPrices.filter(p => p.region === regionCode);
        const regionPrevPrices = prevMonthPrices.filter(p => p.region === regionCode);
        
        const regionInflation = calculateInflation(
          regionCurrentPrices.map(p => p.price),
          regionPrevPrices.map(p => p.price)
        );
        
        const twoMonthsAgo = new Date(now);
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
        const twoMonthPrices = priceData.filter(p => 
          p.year === twoMonthsAgo.getFullYear() && 
          p.month === (twoMonthsAgo.getMonth() + 1) &&
          p.region === regionCode
        );
        
        const prevRegionInflation = calculateInflation(
          regionPrevPrices.map(p => p.price),
          twoMonthPrices.map(p => p.price)
        );
        
        const change = regionInflation - prevRegionInflation;
        
        const regionMarkets = [...new Set(priceData.filter(p => p.region === regionCode).map(p => p.market))];
        
        regionalBreakdown.push({
          region: regionCode,
          regionName,
          inflationRate: Math.round(regionInflation * 10) / 10,
          change: Math.round(change * 10) / 10,
          trend: change > 0.5 ? "up" : change < -0.5 ? "down" : "stable",
          markets: regionMarkets.slice(0, 5),
        });
      }
    }
    
    // NBS Comparison
    let nbsComparison = null;
    if (limits.showNBSComparison) {
      const nbsRate = NBS_OFFICIAL_INFLATION[currentMonthKey] ?? NBS_OFFICIAL_INFLATION["2026-01"] ?? 33.7;
      const diff = yoyInflation - nbsRate;
      
      let interpretation = "Our data aligns closely with NBS official figures.";
      if (diff > 3) {
        interpretation = "Our crowdsourced data shows higher inflation than official NBS figures. This may reflect real-time market conditions that haven't been captured in official statistics yet.";
      } else if (diff < -3) {
        interpretation = "Our data shows lower inflation than NBS. This could be due to regional variations in our sample or different basket compositions.";
      }
      
      nbsComparison = {
        naijaMarket: Math.round(yoyInflation * 10) / 10,
        nbs: nbsRate,
        difference: Math.round(diff * 10) / 10,
        interpretation,
      };
    }
    
    // Item-level inflation
    const itemInflation: ItemInflation[] = [];
    const uniqueItems = [...new Set(priceData.map(p => p.item))];
    
    for (const item of uniqueItems) {
      const currentItemPrices = currentMonthPrices.filter(p => p.item === item);
      const prevItemPrices = prevMonthPrices.filter(p => p.item === item);
      
      if (currentItemPrices.length > 0 && prevItemPrices.length > 0) {
        const currentAvg = currentItemPrices.reduce((a, b) => a + b.price, 0) / currentItemPrices.length;
        const prevAvg = prevItemPrices.reduce((a, b) => a + b.price, 0) / prevItemPrices.length;
        
        const inflationRate = ((currentAvg - prevAvg) / prevAvg) * 100;
        
        itemInflation.push({
          item,
          currentPrice: Math.round(currentAvg),
          previousPrice: Math.round(prevAvg),
          inflationRate: Math.round(inflationRate * 10) / 10,
          change30d: Math.round(inflationRate * 10) / 10,
          trend: inflationRate > 2 ? "up" : inflationRate < -2 ? "down" : "stable",
        });
      }
    }
    
    const sortedByInflation = [...itemInflation].sort((a, b) => b.inflationRate - a.inflationRate);
    const topInflators = sortedByInflation.slice(0, 5);
    const topDeflators = sortedByInflation.slice(-5).reverse();
    
    // Basket composition
    const basketWeights: Record<string, number> = {
      "Rice (50kg)": 20,
      "Beans (bag)": 10,
      "Garri (bag)": 15,
      "Palm Oil (25L)": 12,
      "Tomatoes (basket)": 10,
      "Onions (bag)": 8,
      "Pepper (basket)": 8,
      "Yam (tuber)": 7,
      "Plantain (bunch)": 5,
      "Groundnut Oil (25L)": 5,
    };
    
    const basketComposition = itemInflation.map(item => {
      const weight = basketWeights[item.item] ?? 5;
      const contribution = (weight / 100) * item.inflationRate;
      return {
        item: item.item,
        weight,
        contribution: Math.round(contribution * 10) / 10,
      };
    }).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    
    // Build response
    const today = new Date();
    const lastUpdated = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    
    const response: InflationResponse = {
      success: true,
      currentInflation: {
        rate: Math.round(yoyInflation * 10) / 10,
        monthOverMonth: Math.round(momInflation * 10) / 10,
        yearOverYear: Math.round(yoyInflation * 10) / 10,
        trend,
        asOf: `${MONTHS[currentMonth - 1] ?? "January"} ${currentYear}`,
      },
      monthlyTrend,
      regionalBreakdown,
      nbsComparison,
      topInflators,
      topDeflators,
      basketComposition,
      tierLimits: {
        tier,
        ...limits,
      },
      dataSource,
      lastUpdated,
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
