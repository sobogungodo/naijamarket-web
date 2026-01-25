// ============================================================================
// src/app/api/inflation/route.ts
// NaijaMarket Intel - Inflation Tracker API
// Bloomberg Equivalent: ECST <GO> (Economic Statistics)
// Version: 1.0.0
// Date: 2026-01-25
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// CONFIGURATION
// ============================================================================

const GOOGLE_SHEETS_ID = "1n-7MXdoqvIoSHteBJaUYBmIPLjJBNtrE_jVuUxO5kr8";
const GOOGLE_API_KEY = process.env.GOOGLE_SHEETS_API_KEY || "";

// NBS Official Inflation Data (Food Component)
// Source: National Bureau of Statistics - updated monthly
const NBS_OFFICIAL_INFLATION: Record<string, number> = {
  "2025-01": 33.7,
  "2025-02": 34.2,
  "2025-03": 33.9,
  "2025-04": 33.5,
  "2025-05": 34.1,
  "2025-06": 34.8,
  "2025-07": 35.2,
  "2025-08": 34.6,
  "2025-09": 33.8,
  "2025-10": 33.2,
  "2025-11": 32.8,
  "2025-12": 33.1,
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
  "SW": ["Lagos", "Mile 12", "Alaba", "Iddo"],
  "SE": ["Onitsha", "Ariaria", "Aba"],
  "NC": ["Abuja", "Wuse"],
  "NW": ["Kano", "Kaduna"],
  "NE": ["Maiduguri", "Bauchi"],
  "SS": ["Port Harcourt", "Warri"],
};

const REGION_NAMES: Record<string, string> = {
  "SW": "South West",
  "SE": "South East", 
  "NC": "North Central",
  "NW": "North West",
  "NE": "North East",
  "SS": "South South",
};

// Month names
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
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchGoogleSheetsData(sheetName: string): Promise<string[][]> {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}/values/${encodeURIComponent(sheetName)}?key=${GOOGLE_API_KEY}`;
    const response = await fetch(url, { next: { revalidate: 3600 } });
    
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

function generateMockPriceData(months: number = 12): PriceRecord[] {
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
    { name: "Mile 12", region: "SW" },
    { name: "Alaba", region: "SW" },
    { name: "Onitsha", region: "SE" },
    { name: "Wuse", region: "NC" },
    { name: "Kano Main", region: "NW" },
    { name: "Port Harcourt", region: "SS" },
  ];
  
  // Generate data for each month going back
  for (let m = months; m >= 0; m--) {
    const date = new Date(currentDate);
    date.setMonth(date.getMonth() - m);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const dateStr = `${year}-${String(month).padStart(2, "0")}-15`;
    
    // Inflation factor increases over time (simulating Nigerian inflation)
    const monthsFromStart = months - m;
    const inflationFactor = 1 + (monthsFromStart * 0.025); // ~2.5% monthly inflation
    
    for (const item of items) {
      for (const market of markets) {
        // Add regional variation
        const regionalVariation = market.region === "SW" ? 1.05 : 
                                  market.region === "NW" ? 0.92 : 
                                  market.region === "SE" ? 1.02 : 1.0;
        
        // Add random variation
        const randomFactor = 1 + (Math.random() - 0.5) * item.volatility;
        
        const price = Math.round(item.basePrice * inflationFactor * regionalVariation * randomFactor);
        
        data.push({
          item: item.name,
          market: market.name,
          region: market.region,
          price,
          date: dateStr,
          year,
          month,
        });
      }
    }
  }
  
  return data;
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

function getRegionFromMarket(market: string): string {
  for (const [region, markets] of Object.entries(REGIONS)) {
    if (markets.some(m => market.toLowerCase().includes(m.toLowerCase()))) {
      return region;
    }
  }
  return "SW"; // Default to South West
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
    
    // Fetch or generate price data
    let priceData: PriceRecord[] = [];
    let dataSource = "Google Sheets";
    
    const sheetsData = await fetchGoogleSheetsData("Validated_Prices");
    
    if (sheetsData.length > 1) {
      const headers = sheetsData[0] ?? [];
      const itemIdx = headers.findIndex(h => h?.toLowerCase().includes("item") || h?.toLowerCase().includes("commodity"));
      const priceIdx = headers.findIndex(h => h?.toLowerCase().includes("price"));
      const marketIdx = headers.findIndex(h => h?.toLowerCase().includes("market"));
      const dateIdx = headers.findIndex(h => h?.toLowerCase().includes("date") || h?.toLowerCase().includes("created"));
      
      for (let i = 1; i < sheetsData.length; i++) {
        const row = sheetsData[i] ?? [];
        const item = row[itemIdx] ?? "";
        const price = parseFloat(row[priceIdx] ?? "0") || 0;
        const market = row[marketIdx] ?? "";
        const dateStr = row[dateIdx] ?? "";
        
        if (item && price > 0) {
          const date = new Date(dateStr);
          priceData.push({
            item,
            market,
            region: getRegionFromMarket(market),
            price,
            date: dateStr,
            year: date.getFullYear() || new Date().getFullYear(),
            month: (date.getMonth() + 1) || 1,
          });
        }
      }
    }
    
    // Use mock data if insufficient real data
    if (priceData.length < 100) {
      priceData = generateMockPriceData(limits.monthsBack);
      dataSource = "Synthetic Model (Demo)";
    }
    
    // Current date info
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentMonthKey = getMonthKey(currentYear, currentMonth);
    
    // Previous month
    const prevDate = new Date(now);
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth() + 1;
    
    // Same month last year
    const lastYearMonth = currentMonth;
    const lastYear = currentYear - 1;
    
    // Filter price data by time
    const currentMonthPrices = priceData.filter(p => p.year === currentYear && p.month === currentMonth);
    const prevMonthPrices = priceData.filter(p => p.year === prevYear && p.month === prevMonth);
    const lastYearPrices = priceData.filter(p => p.year === lastYear && p.month === lastYearMonth);
    
    // Calculate current inflation rates
    const momInflation = calculateInflation(
      currentMonthPrices.map(p => p.price),
      prevMonthPrices.map(p => p.price)
    );
    
    const yoyInflation = calculateInflation(
      currentMonthPrices.map(p => p.price),
      lastYearPrices.map(p => p.price)
    );
    
    // Determine trend
    let trend: "up" | "down" | "stable" = "stable";
    if (momInflation > 1) trend = "up";
    else if (momInflation < -1) trend = "down";
    
    // Calculate monthly trend
    const monthlyTrend: MonthlyInflation[] = [];
    for (let i = 0; i < limits.monthsBack; i++) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthKey = getMonthKey(year, month);
      
      const monthPrices = priceData.filter(p => p.year === year && p.month === month);
      
      // Previous month for this calculation
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
    
    // Regional breakdown (if tier allows)
    const regionalBreakdown: RegionalInflation[] = [];
    if (limits.showRegional) {
      for (const [regionCode, regionName] of Object.entries(REGION_NAMES)) {
        const regionCurrentPrices = currentMonthPrices.filter(p => p.region === regionCode);
        const regionPrevPrices = prevMonthPrices.filter(p => p.region === regionCode);
        
        const regionInflation = calculateInflation(
          regionCurrentPrices.map(p => p.price),
          regionPrevPrices.map(p => p.price)
        );
        
        // Calculate 2-month ago for change
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
        
        regionalBreakdown.push({
          region: regionCode,
          regionName,
          inflationRate: Math.round(regionInflation * 10) / 10,
          change: Math.round(change * 10) / 10,
          trend: change > 0.5 ? "up" : change < -0.5 ? "down" : "stable",
          markets: REGIONS[regionCode] ?? [],
        });
      }
    }
    
    // NBS Comparison (if tier allows)
    let nbsComparison = null;
    if (limits.showNBSComparison) {
      const nbsRate = NBS_OFFICIAL_INFLATION[currentMonthKey] ?? NBS_OFFICIAL_INFLATION["2026-01"] ?? 33.7;
      const diff = yoyInflation - nbsRate;
      
      let interpretation = "Our data aligns with NBS official figures.";
      if (diff > 3) {
        interpretation = "Our crowdsourced data shows higher inflation than official NBS figures, possibly due to real-time market conditions.";
      } else if (diff < -3) {
        interpretation = "Our data shows lower inflation than NBS, possibly due to regional market variations in our sample.";
      }
      
      nbsComparison = {
        naijaMarket: Math.round(yoyInflation * 10) / 10,
        nbs: nbsRate,
        difference: Math.round(diff * 10) / 10,
        interpretation,
      };
    }
    
    // Calculate item-level inflation for top movers
    const itemInflation: ItemInflation[] = [];
    const uniqueItems = [...new Set(priceData.map(p => p.item))];
    
    for (const item of uniqueItems) {
      const currentItemPrices = currentMonthPrices.filter(p => p.item === item);
      const prevItemPrices = prevMonthPrices.filter(p => p.item === item);
      
      if (currentItemPrices.length > 0 && prevItemPrices.length > 0) {
        const currentAvg = currentItemPrices.reduce((a, b) => a + b.price, 0) / currentItemPrices.length;
        const prevAvg = prevItemPrices.reduce((a, b) => a + b.price, 0) / prevItemPrices.length;
        
        const inflationRate = ((currentAvg - prevAvg) / prevAvg) * 100;
        
        // 30-day change (same as MoM for simplicity)
        const change30d = inflationRate;
        
        itemInflation.push({
          item,
          currentPrice: Math.round(currentAvg),
          previousPrice: Math.round(prevAvg),
          inflationRate: Math.round(inflationRate * 10) / 10,
          change30d: Math.round(change30d * 10) / 10,
          trend: inflationRate > 2 ? "up" : inflationRate < -2 ? "down" : "stable",
        });
      }
    }
    
    // Sort for top inflators and deflators
    const sortedByInflation = [...itemInflation].sort((a, b) => b.inflationRate - a.inflationRate);
    const topInflators = sortedByInflation.slice(0, 5);
    const topDeflators = sortedByInflation.slice(-5).reverse();
    
    // Basket composition (weighted by typical consumption)
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
