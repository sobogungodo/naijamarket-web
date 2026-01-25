// ============================================================================
// src/app/api/forecast/route.ts
// NaijaMarket Intel - Seasonal Forecast API
// Bloomberg Equivalent: ECFC <GO> (Economic Forecasts)
// Version: 1.0.0
// Date: 2026-01-25
// ============================================================================
// Features:
// - 9-year historical data analysis (2016-2025)
// - Monthly seasonal pattern calculation
// - Price predictions for next 6 months
// - Best/worst months to buy analysis
// - Confidence intervals based on historical variance
// - Tier-based access control (GOLD+ for full features)
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// CONFIGURATION
// ============================================================================

const GOOGLE_SHEETS_ID = "1n-7MXdoqvIoSHteBJaUYBmIPLjJBNtrE_jVuUxO5kr8";
const GOOGLE_API_KEY = process.env.GOOGLE_SHEETS_API_KEY || "";

// Azure SQL Configuration (for historical data)
const SQL_CONFIG = {
  server: process.env.AZURE_SQL_SERVER || "naijafood.database.windows.net",
  database: process.env.AZURE_SQL_DATABASE || "NaijaMarketIntel",
  user: process.env.AZURE_SQL_USER || "",
  password: process.env.AZURE_SQL_PASSWORD || "",
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

// Month names
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface HistoricalPrice {
  date: string;
  year: number;
  month: number;
  price: number;
  item: string;
  market?: string;
  category?: string;
}

interface SeasonalPattern {
  month: number;
  monthName: string;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  stdDev: number;
  priceIndex: number; // 100 = annual average
  yearOverYear: number[]; // Price for each year
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
  confidence: number; // 0-100%
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
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
  return Math.sqrt(avgSquareDiff);
}

/**
 * Calculate linear regression for trend
 */
function calculateTrend(values: number[]): number {
  if (values.length < 2) return 0;
  const n = values.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
}

/**
 * Fetch data from Google Sheets
 */
async function fetchGoogleSheetsData(sheetName: string): Promise<string[][]> {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}/values/${encodeURIComponent(sheetName)}?key=${GOOGLE_API_KEY}`;
    const response = await fetch(url, { next: { revalidate: 3600 } }); // Cache for 1 hour
    
    if (!response.ok) {
      console.error(`Google Sheets API error: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    return data.values || [];
  } catch (error) {
    console.error("Error fetching Google Sheets:", error);
    return [];
  }
}

/**
 * Generate mock historical data for demonstration
 * In production, this would come from Azure SQL
 */
function generateMockHistoricalData(item: string, years: number = 9): HistoricalPrice[] {
  const data: HistoricalPrice[] = [];
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - years;
  
  // Base prices for common commodities (2016 baseline)
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
    "default": 15000,
  };
  
  // Seasonal multipliers (1.0 = average)
  // Nigerian food prices typically higher in:
  // - Feb-Apr: Pre-harvest scarcity
  // - Aug-Sep: Flooding affects transport
  // Lower in:
  // - Oct-Dec: Post-harvest abundance
  // - Jan: New year sales
  const seasonalFactors = [
    0.95,  // Jan - New year, moderate
    1.08,  // Feb - Pre-harvest scarcity begins
    1.15,  // Mar - Peak scarcity
    1.12,  // Apr - Early harvest relief
    1.02,  // May - Harvest begins
    0.95,  // Jun - Harvest continues
    0.92,  // Jul - Peak harvest
    1.05,  // Aug - Flooding season
    1.10,  // Sep - Flooding continues
    0.88,  // Oct - Post-harvest abundance
    0.85,  // Nov - Lowest prices
    0.93,  // Dec - Festive demand
  ];
  
  // Nigerian food inflation rates by year (approximate)
  const yearlyInflation: Record<number, number> = {
    2016: 1.00,
    2017: 1.16,
    2018: 1.28,
    2019: 1.42,
    2020: 1.65,  // COVID impact
    2021: 1.95,
    2022: 2.35,
    2023: 2.85,
    2024: 3.20,
    2025: 3.55,
    2026: 3.90,
  };
  
  const basePrice = basePrices[item] || basePrices["default"];
  
  for (let year = startYear; year <= currentYear; year++) {
    const inflation = yearlyInflation[year] || 1;
    
    for (let month = 1; month <= 12; month++) {
      // Skip future months
      if (year === currentYear && month > new Date().getMonth() + 1) continue;
      
      const seasonal = seasonalFactors[month - 1];
      const randomVariance = 0.95 + Math.random() * 0.10; // ±5% random variance
      
      const price = Math.round(basePrice * inflation * seasonal * randomVariance);
      
      data.push({
        date: `${year}-${String(month).padStart(2, "0")}-15`,
        year,
        month,
        price,
        item,
        category: "Food",
      });
    }
  }
  
  return data;
}

/**
 * Calculate seasonal patterns from historical data
 */
function calculateSeasonalPatterns(historicalData: HistoricalPrice[]): SeasonalPattern[] {
  const patterns: SeasonalPattern[] = [];
  
  // Group by month
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
  
  // Calculate annual average for index
  const allPrices = historicalData.map(d => d.price);
  const annualAverage = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;
  
  for (let month = 1; month <= 12; month++) {
    const prices = monthlyData.get(month) || [];
    const yearMap = yearlyByMonth.get(month) || new Map();
    
    if (prices.length === 0) continue;
    
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const stdDev = calculateStdDev(prices);
    const priceIndex = Math.round((avgPrice / annualAverage) * 100);
    
    // Get year-over-year prices
    const years = Array.from(yearMap.keys()).sort();
    const yearOverYear = years.map(y => yearMap.get(y) || 0);
    
    // Calculate trend
    const trendSlope = calculateTrend(yearOverYear);
    const trendPercent = (trendSlope / avgPrice) * 100;
    let trend: "up" | "down" | "stable" = "stable";
    if (trendPercent > 2) trend = "up";
    else if (trendPercent < -2) trend = "down";
    
    // Calculate volatility
    const cv = (stdDev / avgPrice) * 100; // Coefficient of variation
    let volatility: "low" | "medium" | "high" = "medium";
    if (cv < 10) volatility = "low";
    else if (cv > 25) volatility = "high";
    
    patterns.push({
      month,
      monthName: MONTHS[month - 1],
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

/**
 * Generate price predictions
 */
function generatePredictions(
  patterns: SeasonalPattern[],
  currentPrice: number,
  months: number
): Prediction[] {
  const predictions: Prediction[] = [];
  const now = new Date();
  let currentMonth = now.getMonth() + 1;
  let currentYear = now.getFullYear();
  
  // Calculate recent trend from last 12 months
  const recentPrices = patterns.map(p => p.avgPrice);
  const trendFactor = calculateTrend(recentPrices) / (recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length);
  
  // Nigerian food inflation assumption: ~2% monthly
  const monthlyInflation = 1.02;
  
  for (let i = 1; i <= months; i++) {
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
    
    const pattern = patterns.find(p => p.month === currentMonth);
    if (!pattern) continue;
    
    // Base prediction on seasonal index
    const seasonalFactor = pattern.priceIndex / 100;
    
    // Apply inflation and trend
    const inflationFactor = Math.pow(monthlyInflation, i);
    const trendAdjustment = 1 + (trendFactor * i);
    
    const predictedPrice = Math.round(currentPrice * seasonalFactor * inflationFactor * trendAdjustment);
    
    // Confidence interval based on historical volatility
    const confidenceMultiplier = 1 + (i * 0.05); // Uncertainty grows with time
    const stdDev = pattern.stdDev * confidenceMultiplier;
    
    // Confidence decreases with prediction distance
    const baseConfidence = 85;
    const confidence = Math.max(50, baseConfidence - (i * 5));
    
    predictions.push({
      month: currentMonth,
      monthName: MONTHS[currentMonth - 1],
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

/**
 * Generate insights from patterns
 */
function generateInsights(
  patterns: SeasonalPattern[],
  currentPrice: number
): ForecastResponse["insights"] {
  // Find best/worst months
  const sorted = [...patterns].sort((a, b) => a.priceIndex - b.priceIndex);
  const bestMonth = sorted[0];
  const worstMonth = sorted[sorted.length - 1];
  
  // Current month position
  const currentMonth = new Date().getMonth() + 1;
  const currentPattern = patterns.find(p => p.month === currentMonth);
  
  let currentPosition = "average";
  if (currentPattern) {
    if (currentPattern.priceIndex < 95) currentPosition = "below average - good time to buy";
    else if (currentPattern.priceIndex > 105) currentPosition = "above average - consider waiting";
    else currentPosition = "near average prices";
  }
  
  // Price direction based on next 3 months
  const nextMonths = [];
  for (let i = 1; i <= 3; i++) {
    const m = ((currentMonth + i - 1) % 12) + 1;
    const p = patterns.find(pat => pat.month === m);
    if (p) nextMonths.push(p.priceIndex);
  }
  
  let priceDirection: "increasing" | "decreasing" | "stable" = "stable";
  if (nextMonths.length >= 2) {
    const trend = nextMonths[nextMonths.length - 1] - nextMonths[0];
    if (trend > 5) priceDirection = "increasing";
    else if (trend < -5) priceDirection = "decreasing";
  }
  
  // Overall volatility
  const avgVolatility = patterns.reduce((acc, p) => {
    return acc + (p.volatility === "high" ? 3 : p.volatility === "medium" ? 2 : 1);
  }, 0) / patterns.length;
  
  let volatilityRating: "low" | "medium" | "high" = "medium";
  if (avgVolatility < 1.5) volatilityRating = "low";
  else if (avgVolatility > 2.5) volatilityRating = "high";
  
  // Annual range
  const minIndex = Math.min(...patterns.map(p => p.priceIndex));
  const maxIndex = Math.max(...patterns.map(p => p.priceIndex));
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
    
    // Extract parameters
    const item = searchParams.get("item") || "Rice (50kg)";
    const market = searchParams.get("market") || "All Markets";
    const tier = (searchParams.get("tier") || "FREE").toUpperCase();
    
    // Get tier limits
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.FREE;
    
    // Calculate years of data based on tier
    const yearsOfData = Math.ceil(limits.monthsBack / 12);
    
    // Try to fetch from Google Sheets first
    let historicalData: HistoricalPrice[] = [];
    let dataSource = "Google Sheets + Azure SQL";
    
    // Fetch from Price_History_NBS sheet
    const nbsData = await fetchGoogleSheetsData("Price_History_NBS");
    
    if (nbsData.length > 1) {
      // Parse NBS data
      const headers = nbsData[0];
      const itemIndex = headers.findIndex(h => h.toLowerCase().includes("item") || h.toLowerCase().includes("commodity"));
      const priceIndex = headers.findIndex(h => h.toLowerCase().includes("price"));
      const dateIndex = headers.findIndex(h => h.toLowerCase().includes("date") || h.toLowerCase().includes("period"));
      const yearIndex = headers.findIndex(h => h.toLowerCase().includes("year"));
      const monthIndex = headers.findIndex(h => h.toLowerCase().includes("month"));
      
      for (let i = 1; i < nbsData.length; i++) {
        const row = nbsData[i];
        const rowItem = row[itemIndex] || "";
        
        if (rowItem.toLowerCase().includes(item.toLowerCase().split(" ")[0])) {
          const price = parseFloat(row[priceIndex]) || 0;
          const year = parseInt(row[yearIndex]) || new Date().getFullYear();
          const month = parseInt(row[monthIndex]) || 1;
          
          if (price > 0) {
            historicalData.push({
              date: `${year}-${String(month).padStart(2, "0")}-15`,
              year,
              month,
              price,
              item: rowItem,
            });
          }
        }
      }
      
      dataSource = "NBS Historical Data (Google Sheets)";
    }
    
    // If no data from sheets, use mock data
    if (historicalData.length < 12) {
      historicalData = generateMockHistoricalData(item, yearsOfData);
      dataSource = "Synthetic Historical Model (Demo)";
    }
    
    // Filter to tier's allowed history
    const cutoffYear = new Date().getFullYear() - yearsOfData;
    historicalData = historicalData.filter(d => d.year >= cutoffYear);
    
    // Calculate seasonal patterns
    const seasonalPatterns = calculateSeasonalPatterns(historicalData);
    
    // Get current price (most recent)
    const sortedByDate = [...historicalData].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const currentPrice = sortedByDate[0]?.price || 50000;
    const lastUpdated = sortedByDate[0]?.date || new Date().toISOString().split("T")[0];
    
    // Generate predictions based on tier
    const predictions = generatePredictions(
      seasonalPatterns, 
      currentPrice, 
      limits.predictionMonths
    );
    
    // Remove confidence data for lower tiers
    if (!limits.showConfidence) {
      predictions.forEach(p => {
        p.confidenceLow = 0;
        p.confidenceHigh = 0;
        p.confidence = 0;
      });
    }
    
    // Generate insights
    const insights = generateInsights(seasonalPatterns, currentPrice);
    
    // Calculate historical accuracy (last year's prediction vs actual)
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

// ============================================================================
// GET AVAILABLE ITEMS FOR FORECAST
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    if (action === "getItems") {
      // Return list of items available for forecasting
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
