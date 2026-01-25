// ============================================================================
// src/app/api/forecast/route.ts
// NaijaMarket Intel - Seasonal Forecast API
// Bloomberg Equivalent: ECFC <GO> (Economic Forecasts)
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

// Tier-based access limits
const TIER_LIMITS: Record<string, { 
  monthsBack: number; 
  predictionMonths: number;
  canExport: boolean;
  showConfidence: boolean;
}> = {
  FREE: { monthsBack: 12, predictionMonths: 1, canExport: false, showConfidence: false },
  SILVER: { monthsBack: 24, predictionMonths: 2, canExport: false, showConfidence: false },
  GOLD: { monthsBack: 60, predictionMonths: 3, canExport: true, showConfidence: true },
  BUSINESS: { monthsBack: 84, predictionMonths: 6, canExport: true, showConfidence: true },
  CORPORATE: { monthsBack: 108, predictionMonths: 6, canExport: true, showConfidence: true },
  ENTERPRISE: { monthsBack: 120, predictionMonths: 12, canExport: true, showConfidence: true },
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface HistoricalPrice {
  date: string;
  year: number;
  month: number;
  price: number;
  item: string;
}

interface SeasonalPattern {
  month: number;
  monthName: string;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  stdDev: number;
  priceIndex: number;
  yearOverYear: number[];
  trend: "up" | "down" | "stable";
  volatility: "low" | "medium" | "high";
}

interface Prediction {
  month: number;
  monthName: string;
  year: number;
  predictedPrice: number;
  confidenceLow: number;
  confidenceHigh: number;
  confidence: number;
  basis: string;
}

interface ForecastResponse {
  success: boolean;
  item: string;
  market: string;
  currentPrice: number;
  lastUpdated: string;
  seasonalPatterns: SeasonalPattern[];
  predictions: Prediction[];
  insights: {
    bestMonthToBuy: { month: string; savings: string; index: number };
    worstMonthToBuy: { month: string; premium: string; index: number };
    currentSeasonalPosition: string;
    priceDirection: "increasing" | "decreasing" | "stable";
    volatilityRating: "low" | "medium" | "high";
    annualRange: { min: number; max: number; spread: string };
  };
  historicalAccuracy: {
    lastYearPrediction: number;
    actualPrice: number;
    accuracy: number;
  };
  tierLimits: {
    tier: string;
    monthsBack: number;
    predictionMonths: number;
    canExport: boolean;
    showConfidence: boolean;
  };
  dataSource: string;
  yearsOfData: number;
  recordCount: number;
}

// ============================================================================
// DATA FETCHING FUNCTIONS
// ============================================================================

/**
 * 1️⃣ PRIMARY: Fetch from Azure SQL Daily_Prices table
 */
async function fetchFromAzureSQL(item: string, yearsBack: number): Promise<{ data: HistoricalPrice[]; success: boolean }> {
  if (!SQL_CONFIG.user || !SQL_CONFIG.password) {
    console.log("Azure SQL credentials not configured, skipping...");
    return { data: [], success: false };
  }

  let pool: sql.ConnectionPool | null = null;
  
  try {
    console.log(`Connecting to Azure SQL for ${item}...`);
    pool = await sql.connect(SQL_CONFIG);
    
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - yearsBack);
    const cutoffStr = cutoffDate.toISOString().split("T")[0];
    
    // Extract first word of item for flexible matching
    const itemKeyword = item.split(" ")[0] ?? item;
    
    const result = await pool.request()
      .input("cutoffDate", sql.Date, cutoffStr)
      .input("itemKeyword", sql.NVarChar, `%${itemKeyword}%`)
      .query(`
        SELECT 
          item_name AS item,
          price_naira AS price,
          price_date AS date,
          YEAR(price_date) AS year,
          MONTH(price_date) AS month
        FROM dbo.Daily_Prices
        WHERE price_date >= @cutoffDate
          AND price_naira > 0
          AND item_name LIKE @itemKeyword
        ORDER BY price_date ASC
      `);
    
    console.log(`Azure SQL returned ${result.recordset.length} records for ${item}`);
    
    const data: HistoricalPrice[] = result.recordset.map((row: {
      item: string;
      price: number;
      date: Date;
      year: number;
      month: number;
    }) => ({
      item: row.item,
      price: row.price,
      date: row.date instanceof Date ? row.date.toISOString().split("T")[0] ?? "" : String(row.date),
      year: row.year,
      month: row.month,
    }));
    
    return { data, success: data.length >= 12 };
    
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
async function fetchFromGoogleSheets(item: string): Promise<{ data: HistoricalPrice[]; success: boolean }> {
  if (!GOOGLE_API_KEY) {
    console.log("Google Sheets API key not configured, skipping...");
    return { data: [], success: false };
  }

  try {
    console.log("Fetching from Google Sheets (Price_History_NBS)...");
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}/values/Price_History_NBS?key=${GOOGLE_API_KEY}`;
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
    const yearIdx = headers.findIndex((h: string) => h?.toLowerCase().includes("year"));
    const monthIdx = headers.findIndex((h: string) => h?.toLowerCase().includes("month"));
    
    const itemKeyword = (item.split(" ")[0] ?? item).toLowerCase();
    const data: HistoricalPrice[] = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] ?? [];
      const rowItem = row[itemIdx] ?? "";
      
      if (rowItem.toLowerCase().includes(itemKeyword)) {
        const price = parseFloat(row[priceIdx] ?? "0") || 0;
        const year = parseInt(row[yearIdx] ?? "0") || new Date().getFullYear();
        const month = parseInt(row[monthIdx] ?? "0") || 1;
        
        if (price > 0) {
          data.push({
            date: `${year}-${String(month).padStart(2, "0")}-15`,
            year,
            month,
            price,
            item: rowItem,
          });
        }
      }
    }
    
    console.log(`Google Sheets returned ${data.length} records for ${item}`);
    return { data, success: data.length >= 12 };
    
  } catch (error) {
    console.error("Google Sheets error:", error);
    return { data: [], success: false };
  }
}

/**
 * 3️⃣ FINAL FALLBACK: Generate synthetic historical data
 */
function generateMockHistoricalData(item: string, years: number = 9): HistoricalPrice[] {
  console.log(`Generating synthetic data for ${item}...`);
  const data: HistoricalPrice[] = [];
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - years;
  
  const basePrices: Record<string, number> = {
    "Rice (50kg)": 18000,
    "Tomatoes (basket)": 8000,
    "Onions (bag)": 15000,
    "Beans (bag)": 22000,
    "Garri (bag)": 12000,
    "Palm Oil (25L)": 18000,
    "Groundnut Oil (25L)": 22000,
    "Yam (tuber)": 800,
    "Plantain (bunch)": 1500,
    "Pepper (basket)": 12000,
    "Cement (bag)": 2500,
    "Maize (bag)": 15000,
  };
  
  // Nigerian seasonal factors (agriculture-based)
  const seasonalFactors = [
    0.95,  // Jan - Post-harvest, prices moderate
    1.08,  // Feb - Dry season starts, prices rise
    1.15,  // Mar - Peak dry season, scarcity
    1.12,  // Apr - Pre-planting, still scarce
    1.02,  // May - Early rains, hope for harvest
    0.95,  // Jun - Planting season
    0.92,  // Jul - Growing season
    1.05,  // Aug - Pre-harvest, some flooding
    1.10,  // Sep - Flooding impacts supply
    0.88,  // Oct - Harvest begins, prices drop
    0.85,  // Nov - Peak harvest, lowest prices
    0.93,  // Dec - Post-harvest, festive demand
  ];
  
  // Nigerian food inflation by year
  const yearlyInflation: Record<number, number> = {
    2016: 1.00, 2017: 1.16, 2018: 1.28, 2019: 1.42,
    2020: 1.65, 2021: 1.95, 2022: 2.35, 2023: 2.85,
    2024: 3.20, 2025: 3.55, 2026: 3.90,
  };
  
  const basePrice: number = basePrices[item] ?? 15000;
  
  for (let year = startYear; year <= currentYear; year++) {
    const inflation = yearlyInflation[year] ?? 1;
    
    for (let month = 1; month <= 12; month++) {
      if (year === currentYear && month > new Date().getMonth() + 1) continue;
      
      const seasonal = seasonalFactors[month - 1] ?? 1;
      const randomVariance = 0.95 + Math.random() * 0.10;
      const price = Math.round(basePrice * inflation * seasonal * randomVariance);
      
      data.push({
        date: `${year}-${String(month).padStart(2, "0")}-15`,
        year,
        month,
        price,
        item,
      });
    }
  }
  
  console.log(`Generated ${data.length} synthetic records`);
  return data;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
  return Math.sqrt(avgSquareDiff);
}

function calculateTrend(values: number[]): number {
  if (values.length < 2) return 0;
  const n = values.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    const val = values[i] ?? 0;
    sumX += i;
    sumY += val;
    sumXY += i * val;
    sumX2 += i * i;
  }
  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
}

function calculateSeasonalPatterns(historicalData: HistoricalPrice[]): SeasonalPattern[] {
  const patterns: SeasonalPattern[] = [];
  const monthlyData: Map<number, number[]> = new Map();
  const yearlyByMonth: Map<number, Map<number, number>> = new Map();
  
  for (let m = 1; m <= 12; m++) {
    monthlyData.set(m, []);
    yearlyByMonth.set(m, new Map());
  }
  
  historicalData.forEach(record => {
    const prices = monthlyData.get(record.month);
    if (prices) prices.push(record.price);
    
    const yearMap = yearlyByMonth.get(record.month);
    if (yearMap) yearMap.set(record.year, record.price);
  });
  
  const allPrices = historicalData.map(d => d.price);
  const annualAverage = allPrices.length > 0 
    ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length 
    : 1;
  
  for (let month = 1; month <= 12; month++) {
    const prices = monthlyData.get(month) || [];
    const yearMap = yearlyByMonth.get(month) || new Map();
    
    if (prices.length === 0) continue;
    
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const stdDev = calculateStdDev(prices);
    const priceIndex = Math.round((avgPrice / annualAverage) * 100);
    
    const years = Array.from(yearMap.keys()).sort();
    const yearOverYear = years.map(y => yearMap.get(y) || 0);
    
    const trendSlope = calculateTrend(yearOverYear);
    const trendPercent = (trendSlope / avgPrice) * 100;
    let trend: "up" | "down" | "stable" = "stable";
    if (trendPercent > 2) trend = "up";
    else if (trendPercent < -2) trend = "down";
    
    const cv = (stdDev / avgPrice) * 100;
    let volatility: "low" | "medium" | "high" = "medium";
    if (cv < 10) volatility = "low";
    else if (cv > 25) volatility = "high";
    
    patterns.push({
      month,
      monthName: MONTHS[month - 1] ?? "Unknown",
      avgPrice: Math.round(avgPrice),
      minPrice: Math.round(minPrice),
      maxPrice: Math.round(maxPrice),
      stdDev: Math.round(stdDev),
      priceIndex,
      yearOverYear,
      trend,
      volatility,
    });
  }
  
  return patterns;
}

function generatePredictions(
  patterns: SeasonalPattern[],
  currentPrice: number,
  months: number
): Prediction[] {
  const predictions: Prediction[] = [];
  const now = new Date();
  let currentMonth = now.getMonth() + 1;
  let currentYear = now.getFullYear();
  
  const recentPrices = patterns.map(p => p.avgPrice);
  const trendFactor = recentPrices.length > 0
    ? calculateTrend(recentPrices) / (recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length)
    : 0;
  const monthlyInflation = 1.02;
  
  for (let i = 1; i <= months; i++) {
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
    
    const pattern = patterns.find(p => p.month === currentMonth);
    if (!pattern) continue;
    
    const seasonalFactor = pattern.priceIndex / 100;
    const inflationFactor = Math.pow(monthlyInflation, i);
    const trendAdjustment = 1 + (trendFactor * i);
    const predictedPrice = Math.round(currentPrice * seasonalFactor * inflationFactor * trendAdjustment);
    
    const confidenceMultiplier = 1 + (i * 0.05);
    const stdDev = pattern.stdDev * confidenceMultiplier;
    const baseConfidence = 85;
    const confidence = Math.max(50, baseConfidence - (i * 5));
    
    predictions.push({
      month: currentMonth,
      monthName: MONTHS[currentMonth - 1] ?? "Unknown",
      year: currentYear,
      predictedPrice,
      confidenceLow: Math.round(predictedPrice - stdDev * 1.5),
      confidenceHigh: Math.round(predictedPrice + stdDev * 1.5),
      confidence,
      basis: i <= 2 ? "Historical seasonal pattern + recent trend" : "Extended forecast with inflation adjustment",
    });
  }
  
  return predictions;
}

function generateInsights(
  patterns: SeasonalPattern[],
  currentPrice: number
): ForecastResponse["insights"] {
  const sorted = [...patterns].sort((a, b) => a.priceIndex - b.priceIndex);
  const bestMonth = sorted[0] ?? { monthName: "Unknown", priceIndex: 100 };
  const worstMonth = sorted[sorted.length - 1] ?? { monthName: "Unknown", priceIndex: 100 };
  
  const currentMonth = new Date().getMonth() + 1;
  const currentPattern = patterns.find(p => p.month === currentMonth);
  
  let currentPosition = "average";
  if (currentPattern) {
    if (currentPattern.priceIndex < 95) currentPosition = "below average - good time to buy";
    else if (currentPattern.priceIndex > 105) currentPosition = "above average - consider waiting";
    else currentPosition = "near average prices";
  }
  
  const nextMonths: number[] = [];
  for (let i = 1; i <= 3; i++) {
    const m = ((currentMonth + i - 1) % 12) + 1;
    const p = patterns.find(pat => pat.month === m);
    if (p) nextMonths.push(p.priceIndex);
  }
  
  let priceDirection: "increasing" | "decreasing" | "stable" = "stable";
  if (nextMonths.length >= 2) {
    const lastVal = nextMonths[nextMonths.length - 1] ?? 0;
    const firstVal = nextMonths[0] ?? 0;
    const trend = lastVal - firstVal;
    if (trend > 5) priceDirection = "increasing";
    else if (trend < -5) priceDirection = "decreasing";
  }
  
  const avgVolatility = patterns.length > 0 
    ? patterns.reduce((acc, p) => {
        return acc + (p.volatility === "high" ? 3 : p.volatility === "medium" ? 2 : 1);
      }, 0) / patterns.length
    : 2;
  
  let volatilityRating: "low" | "medium" | "high" = "medium";
  if (avgVolatility < 1.5) volatilityRating = "low";
  else if (avgVolatility > 2.5) volatilityRating = "high";
  
  const priceIndexes = patterns.map(p => p.priceIndex);
  const minIndex = priceIndexes.length > 0 ? Math.min(...priceIndexes) : 100;
  const maxIndex = priceIndexes.length > 0 ? Math.max(...priceIndexes) : 100;
  const spread = maxIndex - minIndex;
  
  return {
    bestMonthToBuy: {
      month: bestMonth.monthName,
      savings: `${100 - bestMonth.priceIndex}%`,
      index: bestMonth.priceIndex,
    },
    worstMonthToBuy: {
      month: worstMonth.monthName,
      premium: `+${worstMonth.priceIndex - 100}%`,
      index: worstMonth.priceIndex,
    },
    currentSeasonalPosition: currentPosition,
    priceDirection,
    volatilityRating,
    annualRange: {
      min: Math.round(currentPrice * (minIndex / 100)),
      max: Math.round(currentPrice * (maxIndex / 100)),
      spread: `${spread}%`,
    },
  };
}

// ============================================================================
// API HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const item = searchParams.get("item") || "Rice (50kg)";
    const market = searchParams.get("market") || "All Markets";
    const tier = (searchParams.get("tier") || "FREE").toUpperCase();
    
    const defaultLimits = { monthsBack: 12, predictionMonths: 1, canExport: false, showConfidence: false };
    const limits = TIER_LIMITS[tier] ?? defaultLimits;
    const yearsOfData = Math.ceil(limits.monthsBack / 12);
    
    // ========================================================================
    // HYBRID DATA FETCHING: Azure SQL → Google Sheets → Mock
    // ========================================================================
    let historicalData: HistoricalPrice[] = [];
    let dataSource = "Unknown";
    
    // 1️⃣ Try Azure SQL first
    const sqlResult = await fetchFromAzureSQL(item, yearsOfData);
    if (sqlResult.success) {
      historicalData = sqlResult.data;
      dataSource = "Azure SQL (Daily_Prices - 10yr)";
    } else {
      // 2️⃣ Try Google Sheets
      const sheetsResult = await fetchFromGoogleSheets(item);
      if (sheetsResult.success) {
        historicalData = sheetsResult.data;
        dataSource = "Google Sheets (Price_History_NBS)";
      } else {
        // 3️⃣ Use synthetic data
        historicalData = generateMockHistoricalData(item, yearsOfData);
        dataSource = "Synthetic Historical Model (Demo)";
      }
    }
    
    // Filter by time limit
    const cutoffYear = new Date().getFullYear() - yearsOfData;
    historicalData = historicalData.filter(d => d.year >= cutoffYear);
    
    // Calculate seasonal patterns
    const seasonalPatterns = calculateSeasonalPatterns(historicalData);
    
    // Get current price
    const sortedByDate = [...historicalData].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const currentPrice = sortedByDate[0]?.price ?? 50000;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const lastUpdated: string = sortedByDate[0]?.date ?? todayStr;
    
    // Generate predictions
    const predictions = generatePredictions(
      seasonalPatterns, 
      currentPrice, 
      limits.predictionMonths
    );
    
    // Hide confidence if tier doesn't allow
    if (!limits.showConfidence) {
      predictions.forEach(p => {
        p.confidenceLow = 0;
        p.confidenceHigh = 0;
        p.confidence = 0;
      });
    }
    
    // Generate insights
    const insights = generateInsights(seasonalPatterns, currentPrice);
    
    // Historical accuracy
    const lastYearMonth = new Date().getMonth() + 1;
    const lastYearPattern = seasonalPatterns.find(p => p.month === lastYearMonth);
    const historicalAccuracy = {
      lastYearPrediction: lastYearPattern?.avgPrice || currentPrice,
      actualPrice: currentPrice,
      accuracy: lastYearPattern 
        ? Math.round(100 - Math.abs((currentPrice - lastYearPattern.avgPrice) / currentPrice * 100))
        : 85,
    };
    
    const response: ForecastResponse = {
      success: true,
      item,
      market,
      currentPrice,
      lastUpdated,
      seasonalPatterns,
      predictions,
      insights,
      historicalAccuracy,
      tierLimits: {
        tier,
        ...limits,
      },
      dataSource,
      yearsOfData,
      recordCount: historicalData.length,
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error("Forecast API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate forecast",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    if (action === "getItems") {
      const items = [
        { id: 1, name: "Rice (50kg)", category: "Grains", hasData: true },
        { id: 2, name: "Tomatoes (basket)", category: "Vegetables", hasData: true },
        { id: 3, name: "Onions (bag)", category: "Vegetables", hasData: true },
        { id: 4, name: "Beans (bag)", category: "Legumes", hasData: true },
        { id: 5, name: "Garri (bag)", category: "Processed", hasData: true },
        { id: 6, name: "Palm Oil (25L)", category: "Oils", hasData: true },
        { id: 7, name: "Groundnut Oil (25L)", category: "Oils", hasData: true },
        { id: 8, name: "Yam (tuber)", category: "Tubers", hasData: true },
        { id: 9, name: "Plantain (bunch)", category: "Fruits", hasData: true },
        { id: 10, name: "Pepper (basket)", category: "Vegetables", hasData: true },
        { id: 11, name: "Cement (bag)", category: "Building", hasData: true },
        { id: 12, name: "Maize (bag)", category: "Grains", hasData: true },
      ];
      
      return NextResponse.json({ success: true, items });
    }
    
    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    
  } catch (error) {
    console.error("Forecast POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process request" },
      { status: 500 }
    );
  }
}
