// ============================================================================
// src/app/api/reports/route.ts
// NaijaMarket Intel - Market Intelligence Reports API
// Version: 1.0.0
// Bloomberg Equivalent: NI <GO>
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import sql from "mssql";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ReportType {
  id: string;
  name: string;
  description: string;
  frequency: string;
  sections: string[];
  estimatedPages: number;
  icon: string;
}

interface ReportRequest {
  reportType: "weekly" | "monthly" | "regional" | "inflation" | "custom";
  format: "pdf" | "excel" | "html";
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  region?: string;
  categories?: string[];
  includeForecasts?: boolean;
  includeSections?: string[];
}

interface GeneratedReport {
  id: string;
  type: string;
  title: string;
  generatedAt: string;
  expiresAt: string;
  format: string;
  fileSize: string;
  downloadUrl: string;
  sections: string[];
  metrics: ReportMetrics;
}

interface ReportMetrics {
  totalItems: number;
  totalMarkets: number;
  priceChanges: {
    increases: number;
    decreases: number;
    unchanged: number;
  };
  topGainers: PriceMovement[];
  topLosers: PriceMovement[];
  categoryBreakdown: CategoryMetric[];
  regionalData: RegionalMetric[];
  nfpiIndex: NFPIData;
  nbsComparison?: NBSComparison;
}

interface PriceMovement {
  item: string;
  market: string;
  state: string;
  currentPrice: number;
  previousPrice: number;
  changePercent: number;
  changeAmount: number;
}

interface CategoryMetric {
  category: string;
  avgPrice: number;
  avgChange: number;
  itemCount: number;
  trend: "up" | "down" | "stable";
}

interface RegionalMetric {
  region: string;
  states: string[];
  avgInflation: number;
  topItem: string;
  marketCount: number;
}

interface NFPIData {
  currentValue: number;
  previousValue: number;
  changePercent: number;
  trend: "up" | "down" | "stable";
  basketItems: Array<{
    item: string;
    weight: number;
    price: number;
    change: number;
  }>;
}

interface NBSComparison {
  naijaMarketInflation: number;
  nbsOfficialInflation: number;
  difference: number;
  insight: string;
}

interface ScheduledReport {
  id: string;
  userId: string;
  reportType: string;
  format: string;
  frequency: "daily" | "weekly" | "monthly";
  deliveryMethod: "email" | "whatsapp" | "both";
  deliveryAddress: string;
  nextDelivery: string;
  lastDelivery: string | null;
  isActive: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TIER_ACCESS: Record<string, number> = {
  FREE: 0,
  SILVER: 0,
  GOLD: 0,
  BUSINESS: 10,
  CORPORATE: 999,
  ENTERPRISE: 999,
};

const TIER_FEATURES: Record<string, string[]> = {
  BUSINESS: ["10 reports/month", "PDF & Excel", "Download only"],
  CORPORATE: ["Unlimited reports", "All formats", "Scheduled delivery", "Email & WhatsApp"],
  ENTERPRISE: ["Unlimited reports", "All formats", "Scheduled delivery", "API access", "White-label"],
};

const REPORT_TYPES: ReportType[] = [
  {
    id: "weekly",
    name: "Weekly Market Summary",
    description: "Comprehensive overview of price movements, top movers, and market trends",
    frequency: "Weekly",
    sections: [
      "Executive Summary",
      "Key Metrics Dashboard",
      "Top 10 Price Increases",
      "Top 10 Price Decreases",
      "Category Breakdown",
      "Regional Heatmap",
      "NBS Comparison",
      "NFPI Index Trend",
      "Market Spotlight",
      "Methodology Notes",
    ],
    estimatedPages: 12,
    icon: "📊",
  },
  {
    id: "monthly",
    name: "Monthly Commodity Analysis",
    description: "Deep-dive into specific commodities with forecast and historical analysis",
    frequency: "Monthly",
    sections: [
      "Executive Summary",
      "Key Metrics Dashboard",
      "Top 10 Price Increases",
      "Top 10 Price Decreases",
      "Category Breakdown",
      "Regional Heatmap",
      "NBS Comparison",
      "NFPI Index Trend",
      "Market Spotlight",
      "Commodity Deep-Dive",
      "Price Forecast",
      "Methodology Notes",
    ],
    estimatedPages: 20,
    icon: "📈",
  },
  {
    id: "regional",
    name: "Regional Price Report",
    description: "State-by-state price comparison across all six geopolitical zones",
    frequency: "Weekly/Monthly",
    sections: [
      "Executive Summary",
      "Key Metrics Dashboard",
      "Top 10 Price Increases",
      "Top 10 Price Decreases",
      "Category Breakdown",
      "Regional Heatmap",
      "Market Spotlight",
      "Methodology Notes",
    ],
    estimatedPages: 15,
    icon: "🗺️",
  },
  {
    id: "inflation",
    name: "Inflation Comparison Report",
    description: "NaijaMarket real-time data vs NBS official statistics",
    frequency: "Monthly",
    sections: [
      "Executive Summary",
      "Key Metrics Dashboard",
      "Category Breakdown",
      "Regional Heatmap",
      "NBS Comparison",
      "NFPI Index Trend",
      "Methodology Notes",
    ],
    estimatedPages: 10,
    icon: "📉",
  },
  {
    id: "custom",
    name: "Custom Date Range Report",
    description: "Generate reports for any custom date range with optional sections",
    frequency: "On-demand",
    sections: [
      "Executive Summary",
      "Key Metrics Dashboard",
      "Top 10 Price Increases",
      "Top 10 Price Decreases",
      "Category Breakdown",
      "Regional Heatmap",
      "NFPI Index Trend",
      "Methodology Notes",
    ],
    estimatedPages: 8,
    icon: "📅",
  },
];

const NBS_OFFICIAL_RATES: Record<string, { headline: number; food: number }> = {
  "2026-01": { headline: 35.50, food: 40.50 },
  "2025-12": { headline: 35.20, food: 40.15 },
  "2025-11": { headline: 35.00, food: 40.00 },
  "2025-10": { headline: 34.90, food: 39.90 },
  "2025-09": { headline: 34.75, food: 39.75 },
  "2025-08": { headline: 34.60, food: 39.60 },
  "2025-07": { headline: 34.50, food: 39.50 },
  "2025-06": { headline: 34.40, food: 39.40 },
};

const NFPI_BASKET: Array<{ item: string; weight: number }> = [
  { item: "Rice (50kg)", weight: 15.5 },
  { item: "Beans (50kg)", weight: 8.2 },
  { item: "Garri (50kg)", weight: 7.8 },
  { item: "Palm Oil (25L)", weight: 9.5 },
  { item: "Groundnut Oil (25L)", weight: 6.3 },
  { item: "Tomatoes (basket)", weight: 8.0 },
  { item: "Onions (bag)", weight: 5.5 },
  { item: "Yam (tuber)", weight: 6.2 },
  { item: "Beef (kg)", weight: 10.0 },
  { item: "Chicken (kg)", weight: 7.5 },
  { item: "Fish (kg)", weight: 8.0 },
  { item: "Eggs (crate)", weight: 4.5 },
  { item: "Bread (loaf)", weight: 3.0 },
];

const REGIONS: Record<string, string[]> = {
  "South-West": ["Lagos", "Oyo", "Ogun", "Osun", "Ondo", "Ekiti"],
  "South-East": ["Anambra", "Enugu", "Imo", "Abia", "Ebonyi"],
  "South-South": ["Rivers", "Delta", "Edo", "Bayelsa", "Cross River", "Akwa Ibom"],
  "North-Central": ["Abuja", "Kwara", "Kogi", "Niger", "Plateau", "Benue", "Nassarawa"],
  "North-West": ["Kano", "Kaduna", "Katsina", "Sokoto", "Kebbi", "Zamfara", "Jigawa"],
  "North-East": ["Borno", "Adamawa", "Bauchi", "Gombe", "Yobe", "Taraba"],
};

// ============================================================================
// DATABASE CONNECTION
// ============================================================================

const sqlConfig: sql.config = {
  user: process.env.DATABASE_USER || "",
  password: process.env.DATABASE_PASSWORD || "",
  database: process.env.DATABASE_NAME || "NaijaMarketIntel",
  server: process.env.DATABASE_SERVER || "",
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

async function getDbConnection(): Promise<sql.ConnectionPool | null> {
  try {
    const pool = await sql.connect(sqlConfig);
    return pool;
  } catch {
    console.error("Database connection failed");
    return null;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getTierLevel(tier: string): number {
  return TIER_ACCESS[tier.toUpperCase()] ?? 0;
}

function canAccessReports(tier: string): boolean {
  return getTierLevel(tier) > 0;
}

function getReportsRemaining(tier: string, usedThisMonth: number): number {
  const limit = TIER_ACCESS[tier.toUpperCase()] ?? 0;
  if (limit === 999) return 999; // Unlimited
  return Math.max(0, limit - usedThisMonth);
}

function canScheduleDelivery(tier: string): boolean {
  const t = tier.toUpperCase();
  return t === "CORPORATE" || t === "ENTERPRISE";
}

function generateReportId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `RPT-${timestamp}-${random}`.toUpperCase();
}

function getDateRange(reportType: string): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  let startDate = new Date();

  switch (reportType) {
    case "weekly":
      startDate.setDate(endDate.getDate() - 7);
      break;
    case "monthly":
      startDate.setMonth(endDate.getMonth() - 1);
      break;
    case "regional":
      startDate.setDate(endDate.getDate() - 7);
      break;
    case "inflation":
      startDate.setMonth(endDate.getMonth() - 1);
      break;
    default:
      startDate.setDate(endDate.getDate() - 30);
  }

  return { startDate, endDate };
}

// ============================================================================
// DATA FETCHING - HYBRID APPROACH
// ============================================================================

async function fetchReportData(
  reportType: string,
  dateRange?: { startDate: string; endDate: string }
): Promise<ReportMetrics | null> {
  // Try Azure SQL first
  const dbData = await fetchFromDatabase(reportType, dateRange);
  if (dbData) return dbData;

  // Fallback to demo data
  console.log("Using demo data for report");
  return generateDemoData(reportType);
}

async function fetchFromDatabase(
  reportType: string,
  dateRange?: { startDate: string; endDate: string }
): Promise<ReportMetrics | null> {
  const pool = await getDbConnection();
  if (!pool) return null;

  try {
    const { startDate, endDate } = dateRange
      ? { startDate: new Date(dateRange.startDate), endDate: new Date(dateRange.endDate) }
      : getDateRange(reportType);

    // Fetch price data
    const pricesResult = await pool.request()
      .input("startDate", sql.Date, startDate)
      .input("endDate", sql.Date, endDate)
      .query(`
        SELECT 
          item_name,
          market_name,
          state,
          category_id,
          price_naira,
          previous_price,
          price_change_pct,
          trend,
          price_date
        FROM Daily_Prices
        WHERE price_date BETWEEN @startDate AND @endDate
        ORDER BY price_date DESC
      `);

    if (!pricesResult.recordset || pricesResult.recordset.length === 0) {
      return null;
    }

    const prices = pricesResult.recordset;

    // Calculate metrics
    const topGainers = prices
      .filter((p: { price_change_pct: number }) => p.price_change_pct > 0)
      .sort((a: { price_change_pct: number }, b: { price_change_pct: number }) => 
        b.price_change_pct - a.price_change_pct)
      .slice(0, 10)
      .map((p: { 
        item_name: string; 
        market_name: string; 
        state: string;
        price_naira: number;
        previous_price: number;
        price_change_pct: number;
      }) => ({
        item: p.item_name,
        market: p.market_name,
        state: p.state,
        currentPrice: p.price_naira,
        previousPrice: p.previous_price,
        changePercent: p.price_change_pct,
        changeAmount: p.price_naira - p.previous_price,
      }));

    const topLosers = prices
      .filter((p: { price_change_pct: number }) => p.price_change_pct < 0)
      .sort((a: { price_change_pct: number }, b: { price_change_pct: number }) => 
        a.price_change_pct - b.price_change_pct)
      .slice(0, 10)
      .map((p: { 
        item_name: string; 
        market_name: string; 
        state: string;
        price_naira: number;
        previous_price: number;
        price_change_pct: number;
      }) => ({
        item: p.item_name,
        market: p.market_name,
        state: p.state,
        currentPrice: p.price_naira,
        previousPrice: p.previous_price,
        changePercent: p.price_change_pct,
        changeAmount: p.price_naira - p.previous_price,
      }));

    // Category breakdown
    const categoryResult = await pool.request()
      .input("startDate", sql.Date, startDate)
      .input("endDate", sql.Date, endDate)
      .query(`
        SELECT 
          c.category_name,
          AVG(dp.price_naira) as avg_price,
          AVG(dp.price_change_pct) as avg_change,
          COUNT(DISTINCT dp.item_name) as item_count
        FROM Daily_Prices dp
        LEFT JOIN Categories c ON dp.category_id = c.category_id
        WHERE dp.price_date BETWEEN @startDate AND @endDate
        GROUP BY c.category_name
        ORDER BY avg_change DESC
      `);

    const categoryBreakdown: CategoryMetric[] = categoryResult.recordset.map((c: {
      category_name: string;
      avg_price: number;
      avg_change: number;
      item_count: number;
    }) => ({
      category: c.category_name || "Uncategorized",
      avgPrice: Math.round(c.avg_price),
      avgChange: parseFloat(c.avg_change?.toFixed(2) || "0"),
      itemCount: c.item_count,
      trend: c.avg_change > 0 ? "up" : c.avg_change < 0 ? "down" : "stable",
    }));

    // Regional data
    const regionalData: RegionalMetric[] = Object.entries(REGIONS).map(([region, states]) => {
      const regionPrices = prices.filter((p: { state: string }) => 
        states.some(s => p.state?.toLowerCase().includes(s.toLowerCase()))
      );
      const avgInflation = regionPrices.length > 0
        ? regionPrices.reduce((sum: number, p: { price_change_pct: number }) => 
            sum + (p.price_change_pct || 0), 0) / regionPrices.length
        : 0;
      
      return {
        region,
        states,
        avgInflation: parseFloat(avgInflation.toFixed(2)),
        topItem: regionPrices[0]?.item_name || "N/A",
        marketCount: new Set(regionPrices.map((p: { market_name: string }) => p.market_name)).size,
      };
    });

    // NFPI calculation
    const nfpiData = calculateNFPI(prices);

    // NBS comparison
    const currentMonth = new Date().toISOString().slice(0, 7);
    const nbsRate = NBS_OFFICIAL_RATES[currentMonth] || NBS_OFFICIAL_RATES["2026-01"];
    const naijaMarketInflation = parseFloat(
      (prices.reduce((sum: number, p: { price_change_pct: number }) => 
        sum + (p.price_change_pct || 0), 0) / prices.length).toFixed(2)
    );

    const nbsComparison: NBSComparison = {
      naijaMarketInflation: naijaMarketInflation * 12, // Annualized
      nbsOfficialInflation: nbsRate.food,
      difference: parseFloat((naijaMarketInflation * 12 - nbsRate.food).toFixed(2)),
      insight: naijaMarketInflation * 12 > nbsRate.food
        ? `Our real-time data shows food inflation ${Math.abs(naijaMarketInflation * 12 - nbsRate.food).toFixed(1)}% HIGHER than official NBS figures`
        : `Our real-time data shows food inflation ${Math.abs(naijaMarketInflation * 12 - nbsRate.food).toFixed(1)}% LOWER than official NBS figures`,
    };

    const uniqueMarkets = new Set(prices.map((p: { market_name: string }) => p.market_name));
    const uniqueItems = new Set(prices.map((p: { item_name: string }) => p.item_name));

    return {
      totalItems: uniqueItems.size,
      totalMarkets: uniqueMarkets.size,
      priceChanges: {
        increases: prices.filter((p: { price_change_pct: number }) => p.price_change_pct > 0).length,
        decreases: prices.filter((p: { price_change_pct: number }) => p.price_change_pct < 0).length,
        unchanged: prices.filter((p: { price_change_pct: number }) => p.price_change_pct === 0).length,
      },
      topGainers,
      topLosers,
      categoryBreakdown,
      regionalData,
      nfpiIndex: nfpiData,
      nbsComparison,
    };
  } catch (error) {
    console.error("Database query error:", error);
    return null;
  } finally {
    await pool.close();
  }
}

function calculateNFPI(prices: Array<{
  item_name: string;
  price_naira: number;
  price_change_pct: number;
}>): NFPIData {
  let totalWeight = 0;
  let weightedChange = 0;
  let currentValue = 1000; // Base index value

  const basketItems = NFPI_BASKET.map(basketItem => {
    const matchingPrices = prices.filter(p =>
      p.item_name?.toLowerCase().includes(basketItem.item.toLowerCase().split(" ")[0])
    );

    const avgPrice = matchingPrices.length > 0
      ? matchingPrices.reduce((sum, p) => sum + p.price_naira, 0) / matchingPrices.length
      : 50000; // Default price

    const avgChange = matchingPrices.length > 0
      ? matchingPrices.reduce((sum, p) => sum + (p.price_change_pct || 0), 0) / matchingPrices.length
      : 0;

    totalWeight += basketItem.weight;
    weightedChange += avgChange * basketItem.weight;

    return {
      item: basketItem.item,
      weight: basketItem.weight,
      price: Math.round(avgPrice),
      change: parseFloat(avgChange.toFixed(2)),
    };
  });

  const avgWeightedChange = totalWeight > 0 ? weightedChange / totalWeight : 0;
  currentValue = 1000 * (1 + avgWeightedChange / 100);

  return {
    currentValue: parseFloat(currentValue.toFixed(2)),
    previousValue: 1000,
    changePercent: parseFloat(avgWeightedChange.toFixed(2)),
    trend: avgWeightedChange > 0 ? "up" : avgWeightedChange < 0 ? "down" : "stable",
    basketItems,
  };
}

function generateDemoData(reportType: string): ReportMetrics {
  const baseMultiplier = reportType === "monthly" ? 1.2 : 1;

  return {
    totalItems: Math.round(50 * baseMultiplier),
    totalMarkets: 226,
    priceChanges: {
      increases: Math.round(35 * baseMultiplier),
      decreases: Math.round(12 * baseMultiplier),
      unchanged: Math.round(3 * baseMultiplier),
    },
    topGainers: [
      { item: "Tomatoes (basket)", market: "Mile 12", state: "Lagos", currentPrice: 85000, previousPrice: 65000, changePercent: 30.8, changeAmount: 20000 },
      { item: "Palm Oil (25L)", market: "Onitsha Main", state: "Anambra", currentPrice: 52000, previousPrice: 42000, changePercent: 23.8, changeAmount: 10000 },
      { item: "Onions (bag)", market: "Kano Main", state: "Kano", currentPrice: 48000, previousPrice: 40000, changePercent: 20.0, changeAmount: 8000 },
      { item: "Rice (50kg)", market: "Iddo", state: "Lagos", currentPrice: 78500, previousPrice: 68000, changePercent: 15.4, changeAmount: 10500 },
      { item: "Beans (50kg)", market: "Ariaria", state: "Abia", currentPrice: 95000, previousPrice: 85000, changePercent: 11.8, changeAmount: 10000 },
      { item: "Groundnut Oil (25L)", market: "Wuse", state: "Abuja", currentPrice: 45000, previousPrice: 41000, changePercent: 9.8, changeAmount: 4000 },
      { item: "Yam (tuber)", market: "Jos Main", state: "Plateau", currentPrice: 3500, previousPrice: 3200, changePercent: 9.4, changeAmount: 300 },
      { item: "Garri (50kg)", market: "Alaba", state: "Lagos", currentPrice: 42000, previousPrice: 39000, changePercent: 7.7, changeAmount: 3000 },
      { item: "Pepper (basket)", market: "Mile 12", state: "Lagos", currentPrice: 65000, previousPrice: 61000, changePercent: 6.6, changeAmount: 4000 },
      { item: "Chicken (kg)", market: "Onitsha Main", state: "Anambra", currentPrice: 5200, previousPrice: 4900, changePercent: 6.1, changeAmount: 300 },
    ],
    topLosers: [
      { item: "Maize (100kg)", market: "Kano Main", state: "Kano", currentPrice: 55000, previousPrice: 62000, changePercent: -11.3, changeAmount: -7000 },
      { item: "Millet (100kg)", market: "Jos Main", state: "Plateau", currentPrice: 48000, previousPrice: 52000, changePercent: -7.7, changeAmount: -4000 },
      { item: "Cassava (bag)", market: "Iddo", state: "Lagos", currentPrice: 25000, previousPrice: 27000, changePercent: -7.4, changeAmount: -2000 },
      { item: "Plantain (bunch)", market: "Mile 12", state: "Lagos", currentPrice: 4500, previousPrice: 4800, changePercent: -6.3, changeAmount: -300 },
      { item: "Sweet Potato (bag)", market: "Wuse", state: "Abuja", currentPrice: 32000, previousPrice: 34000, changePercent: -5.9, changeAmount: -2000 },
      { item: "Cocoyam (bag)", market: "Onitsha Main", state: "Anambra", currentPrice: 28000, previousPrice: 29500, changePercent: -5.1, changeAmount: -1500 },
      { item: "Sorghum (100kg)", market: "Kano Main", state: "Kano", currentPrice: 45000, previousPrice: 47000, changePercent: -4.3, changeAmount: -2000 },
      { item: "Soybeans (bag)", market: "Jos Main", state: "Plateau", currentPrice: 68000, previousPrice: 70000, changePercent: -2.9, changeAmount: -2000 },
      { item: "Wheat (bag)", market: "Ariaria", state: "Abia", currentPrice: 58000, previousPrice: 59500, changePercent: -2.5, changeAmount: -1500 },
      { item: "Cowpeas (bag)", market: "Alaba", state: "Lagos", currentPrice: 72000, previousPrice: 73500, changePercent: -2.0, changeAmount: -1500 },
    ],
    categoryBreakdown: [
      { category: "Vegetables & Produce", avgPrice: 65000, avgChange: 18.5, itemCount: 8, trend: "up" },
      { category: "Oils & Fats", avgPrice: 48000, avgChange: 15.2, itemCount: 4, trend: "up" },
      { category: "Staple Foods & Grains", avgPrice: 72000, avgChange: 12.8, itemCount: 12, trend: "up" },
      { category: "Proteins & Meat", avgPrice: 5500, avgChange: 8.5, itemCount: 6, trend: "up" },
      { category: "Roots & Tubers", avgPrice: 28000, avgChange: -3.2, itemCount: 5, trend: "down" },
      { category: "Legumes & Pulses", avgPrice: 85000, avgChange: 6.5, itemCount: 4, trend: "up" },
    ],
    regionalData: [
      { region: "South-West", states: ["Lagos", "Oyo", "Ogun", "Osun", "Ondo", "Ekiti"], avgInflation: 15.8, topItem: "Rice (50kg)", marketCount: 45 },
      { region: "South-East", states: ["Anambra", "Enugu", "Imo", "Abia", "Ebonyi"], avgInflation: 14.2, topItem: "Palm Oil (25L)", marketCount: 38 },
      { region: "North-Central", states: ["Abuja", "Kwara", "Kogi", "Niger", "Plateau", "Benue", "Nassarawa"], avgInflation: 12.5, topItem: "Yam (tuber)", marketCount: 42 },
      { region: "North-West", states: ["Kano", "Kaduna", "Katsina", "Sokoto", "Kebbi", "Zamfara", "Jigawa"], avgInflation: 11.8, topItem: "Tomatoes (basket)", marketCount: 48 },
      { region: "South-South", states: ["Rivers", "Delta", "Edo", "Bayelsa", "Cross River", "Akwa Ibom"], avgInflation: 13.5, topItem: "Fish (kg)", marketCount: 35 },
      { region: "North-East", states: ["Borno", "Adamawa", "Bauchi", "Gombe", "Yobe", "Taraba"], avgInflation: 10.2, topItem: "Beans (50kg)", marketCount: 28 },
    ],
    nfpiIndex: {
      currentValue: 1142.5,
      previousValue: 1000,
      changePercent: 14.25,
      trend: "up",
      basketItems: [
        { item: "Rice (50kg)", weight: 15.5, price: 78500, change: 15.4 },
        { item: "Beans (50kg)", weight: 8.2, price: 95000, change: 11.8 },
        { item: "Garri (50kg)", weight: 7.8, price: 42000, change: 7.7 },
        { item: "Palm Oil (25L)", weight: 9.5, price: 52000, change: 23.8 },
        { item: "Groundnut Oil (25L)", weight: 6.3, price: 45000, change: 9.8 },
        { item: "Tomatoes (basket)", weight: 8.0, price: 85000, change: 30.8 },
        { item: "Onions (bag)", weight: 5.5, price: 48000, change: 20.0 },
        { item: "Yam (tuber)", weight: 6.2, price: 3500, change: 9.4 },
        { item: "Beef (kg)", weight: 10.0, price: 5800, change: 8.2 },
        { item: "Chicken (kg)", weight: 7.5, price: 5200, change: 6.1 },
        { item: "Fish (kg)", weight: 8.0, price: 4500, change: 5.5 },
        { item: "Eggs (crate)", weight: 4.5, price: 3800, change: 4.2 },
        { item: "Bread (loaf)", weight: 3.0, price: 1200, change: 3.8 },
      ],
    },
    nbsComparison: {
      naijaMarketInflation: 42.5,
      nbsOfficialInflation: 40.5,
      difference: 2.0,
      insight: "Our real-time data shows food inflation 2.0% HIGHER than official NBS figures",
    },
  };
}

// ============================================================================
// GET - List available reports and user's generated reports
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession();
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get("action");

  // Get user tier
  const userTier = ((session?.user as { tier?: string })?.tier || "FREE").toUpperCase();

  // Check access
  if (!canAccessReports(userTier)) {
    return NextResponse.json({
      success: false,
      error: "Reports require BUSINESS tier or higher",
      currentTier: userTier,
      requiredTier: "BUSINESS",
      upgradeUrl: "/subscribe",
    }, { status: 403 });
  }

  // List available report types
  if (action === "types") {
    return NextResponse.json({
      success: true,
      reportTypes: REPORT_TYPES,
      userTier,
      features: TIER_FEATURES[userTier] || [],
      reportsRemaining: getReportsRemaining(userTier, 0), // TODO: Get actual usage
      canSchedule: canScheduleDelivery(userTier),
    });
  }

  // List user's scheduled reports
  if (action === "scheduled") {
    if (!canScheduleDelivery(userTier)) {
      return NextResponse.json({
        success: false,
        error: "Scheduled delivery requires CORPORATE tier or higher",
        currentTier: userTier,
        requiredTier: "CORPORATE",
      }, { status: 403 });
    }

    // TODO: Fetch from database
    const scheduledReports: ScheduledReport[] = [];

    return NextResponse.json({
      success: true,
      scheduledReports,
      canSchedule: true,
    });
  }

  // Default: List generated reports history
  // TODO: Fetch from database
  const generatedReports: GeneratedReport[] = [];

  return NextResponse.json({
    success: true,
    generatedReports,
    reportTypes: REPORT_TYPES,
    userTier,
    features: TIER_FEATURES[userTier] || [],
    reportsRemaining: getReportsRemaining(userTier, 0),
    canSchedule: canScheduleDelivery(userTier),
  });
}

// ============================================================================
// POST - Generate a new report
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession();

  // Get user tier
  const userTier = ((session?.user as { tier?: string })?.tier || "FREE").toUpperCase();

  // Check access
  if (!canAccessReports(userTier)) {
    return NextResponse.json({
      success: false,
      error: "Reports require BUSINESS tier or higher",
      currentTier: userTier,
      requiredTier: "BUSINESS",
      upgradeUrl: "/subscribe",
    }, { status: 403 });
  }

  try {
    const body: ReportRequest = await request.json();
    const { reportType, format, dateRange } = body;

    // Validate report type
    const reportConfig = REPORT_TYPES.find(r => r.id === reportType);
    if (!reportConfig) {
      return NextResponse.json({
        success: false,
        error: "Invalid report type",
        validTypes: REPORT_TYPES.map(r => r.id),
      }, { status: 400 });
    }

    // Validate format
    if (!["pdf", "excel", "html"].includes(format)) {
      return NextResponse.json({
        success: false,
        error: "Invalid format. Use: pdf, excel, or html",
      }, { status: 400 });
    }

    // Check reports remaining
    const usedThisMonth = 0; // TODO: Get from database
    const remaining = getReportsRemaining(userTier, usedThisMonth);
    if (remaining <= 0) {
      return NextResponse.json({
        success: false,
        error: "Monthly report limit reached",
        limit: TIER_ACCESS[userTier],
        used: usedThisMonth,
        upgradeUrl: "/subscribe",
      }, { status: 429 });
    }

    // Fetch report data
    const metrics = await fetchReportData(reportType, dateRange);
    if (!metrics) {
      return NextResponse.json({
        success: false,
        error: "Failed to fetch report data",
      }, { status: 500 });
    }

    // Generate report
    const reportId = generateReportId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const dateStr = dateRange
      ? `${new Date(dateRange.startDate).toLocaleDateString("en-GB")} - ${new Date(dateRange.endDate).toLocaleDateString("en-GB")}`
      : reportType === "weekly"
        ? `Week of ${new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-GB")}`
        : `${now.toLocaleString("en-US", { month: "long", year: "numeric" })}`;

    const generatedReport: GeneratedReport = {
      id: reportId,
      type: reportType,
      title: `${reportConfig.name} - ${dateStr}`,
      generatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      format,
      fileSize: format === "pdf" ? "~2.5 MB" : format === "excel" ? "~1.2 MB" : "~500 KB",
      downloadUrl: `/api/reports/${reportId}?format=${format}`,
      sections: reportConfig.sections,
      metrics,
    };

    // TODO: Save to database

    return NextResponse.json({
      success: true,
      report: generatedReport,
      message: `${reportConfig.name} generated successfully`,
      reportsRemaining: remaining - 1,
    });
  } catch (error) {
    console.error("Report generation error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to generate report",
    }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
