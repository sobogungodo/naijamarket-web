// ============================================================================
// NAIJAMARKET INTEL - ARBITRAGE OPPORTUNITIES API
// File: src/app/api/arbitrage/route.ts
// Bloomberg Equivalent: ARBI <GO>
// Version: 3.0 - Uses Latest_Prices_Summary, user-configurable profit margin
// Date: 2026-02-18
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// SINGLETON PRISMA
// ============================================================================

let prismaClient: any = null;

async function getPrisma() {
  if (!prismaClient) {
    const { PrismaClient } = await import("@prisma/client");
    prismaClient = new PrismaClient();
  }
  return prismaClient;
}

// ============================================================================
// TYPES
// ============================================================================

interface TierConfig {
  hasAccess: boolean;
  minProfitFloor: number;  // Absolute minimum the tier allows
  maxResults: number;
}

interface MarketCoordinate {
  lat: number;
  lon: number;
  state: string;
}

interface TransportResult {
  distance: number;
  baseCost: number;
  riskPremium: number;
  totalCost: number;
  label: string;
}

interface ConfidenceResult {
  score: number;
  label: string;
  color: string;
}

interface MarketInfo {
  id: string;
  name: string;
  state: string;
  price: number;
  updatedAt: string;
}

interface ArbitrageOpportunity {
  id: string;
  itemId: string;
  itemName: string;
  categoryName: string;
  unit: string;
  buyMarket: MarketInfo;
  sellMarket: MarketInfo;
  grossProfit: number;
  transportCost: number;
  netProfit: number;
  profitPercentage: number;
  distance: number;
  confidence: ConfidenceResult;
  transportLabel: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CATEGORY_MAP: Record<string, string> = {
  "1": "Grains & Cereals", "2": "Tubers", "3": "Vegetables", "4": "Fruits",
  "5": "Oils & Fats", "6": "Protein", "7": "Dairy", "8": "Sweeteners",
  "9": "Beverages", "10": "Building Materials", "11": "Livestock",
  "12": "Fish & Seafood", "13": "Condiments", "14": "Processed Foods",
};

const MARKET_COORDINATES: Record<string, MarketCoordinate> = {
  "Mile 12 Market": { lat: 6.5833, lon: 3.3833, state: "Lagos" },
  "Alaba International Market": { lat: 6.4631, lon: 3.1937, state: "Lagos" },
  "Oyingbo Market": { lat: 6.4778, lon: 3.3894, state: "Lagos" },
  "Balogun Market": { lat: 6.4539, lon: 3.3944, state: "Lagos" },
  "Computer Village": { lat: 6.6018, lon: 3.3515, state: "Lagos" },
  "Iddo Market": { lat: 6.4647, lon: 3.3847, state: "Lagos" },
  "Onitsha Main Market": { lat: 6.1456, lon: 6.7856, state: "Anambra" },
  "Ariaria Market": { lat: 5.1167, lon: 7.3667, state: "Abia" },
  "Ogbete Market": { lat: 6.4411, lon: 7.4939, state: "Enugu" },
  "Kano Main Market": { lat: 12.0022, lon: 8.5167, state: "Kano" },
  "Dawanau Market": { lat: 11.9467, lon: 8.4961, state: "Kano" },
  "Kurmi Market": { lat: 12.0000, lon: 8.5167, state: "Kano" },
  "Jos Main Market": { lat: 9.8965, lon: 8.8583, state: "Plateau" },
  "Kaduna Central Market": { lat: 10.5222, lon: 7.4403, state: "Kaduna" },
  "Bodija Market": { lat: 7.4167, lon: 3.9000, state: "Oyo" },
  "Dugbe Market": { lat: 7.3833, lon: 3.8833, state: "Oyo" },
  "Oja Oba Market": { lat: 7.6292, lon: 4.7433, state: "Osun" },
  "Watt Market": { lat: 4.9333, lon: 8.3333, state: "Cross River" },
  "Oil Mill Market": { lat: 4.7833, lon: 7.0167, state: "Rivers" },
  "Wuse Market": { lat: 9.0765, lon: 7.4898, state: "FCT" },
  "Utako Market": { lat: 9.0667, lon: 7.4333, state: "FCT" },
  "Garki Market": { lat: 9.0167, lon: 7.4833, state: "FCT" },
  "Nyanya Market": { lat: 9.0167, lon: 7.5667, state: "FCT" },
};

const TRANSPORT_COSTS = {
  SAME_CITY: { maxKm: 50, costPer50kg: 500, label: "Same City" },
  SAME_STATE: { maxKm: 100, costPer50kg: 1000, label: "Same State" },
  NEIGHBORING: { maxKm: 300, costPer50kg: 2500, label: "Neighboring State" },
  REGIONAL: { maxKm: 500, costPer50kg: 4000, label: "Regional" },
  LONG_DISTANCE: { maxKm: 800, costPer50kg: 6000, label: "Long Distance" },
  VERY_LONG: { maxKm: 1200, costPer50kg: 8000, label: "Very Long" },
  CROSS_COUNTRY: { maxKm: 99999, costPer50kg: 10000, label: "Cross Country" },
};

const ROUTE_RISKS: Record<string, number> = {
  "Lagos-Kano": 1500,
  "Lagos-Kaduna": 1500,
  "Abuja-Kano": 1000,
  "Abuja-Kaduna": 500,
  "DEFAULT": 0,
};

const DEFAULT_TIER_CONFIG: TierConfig = { hasAccess: false, minProfitFloor: 100, maxResults: 0 };

// Users can set ANY minimum profit %, but tier sets the floor
// GOLD: can see down to 2% | BUSINESS: down to 1% | ENTERPRISE: down to 0%
const TIER_ACCESS: Record<string, TierConfig> = {
  FREE: { hasAccess: false, minProfitFloor: 100, maxResults: 0 },
  SILVER: { hasAccess: false, minProfitFloor: 100, maxResults: 0 },
  GOLD: { hasAccess: true, minProfitFloor: 2, maxResults: 25 },
  BUSINESS: { hasAccess: true, minProfitFloor: 1, maxResults: 50 },
  BUSINESS_PLUS: { hasAccess: true, minProfitFloor: 0, maxResults: 75 },
  CORPORATE: { hasAccess: true, minProfitFloor: 0, maxResults: 100 },
  ENTERPRISE: { hasAccess: true, minProfitFloor: 0, maxResults: 200 },
  OGA_BOSS: { hasAccess: true, minProfitFloor: 0, maxResults: 200 },
  GOVERNMENT: { hasAccess: true, minProfitFloor: 0, maxResults: 200 },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getTierConfig(tier: string): TierConfig {
  return TIER_ACCESS[tier] || TIER_ACCESS["FREE"] || DEFAULT_TIER_CONFIG;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getTransportCost(fromMarket: string, toMarket: string): TransportResult {
  const from = MARKET_COORDINATES[fromMarket];
  const to = MARKET_COORDINATES[toMarket];
  
  if (!from || !to) {
    return { distance: 0, baseCost: 2500, riskPremium: 0, totalCost: 2500, label: "Estimated" };
  }
  
  const distance = calculateDistance(from.lat, from.lon, to.lat, to.lon);
  
  let baseCost = TRANSPORT_COSTS.CROSS_COUNTRY.costPer50kg;
  let label = TRANSPORT_COSTS.CROSS_COUNTRY.label;
  
  for (const tier of Object.values(TRANSPORT_COSTS)) {
    if (distance <= tier.maxKm) {
      baseCost = tier.costPer50kg;
      label = tier.label;
      break;
    }
  }
  
  const routeKey1 = `${from.state}-${to.state}`;
  const routeKey2 = `${to.state}-${from.state}`;
  const riskPremium: number = ROUTE_RISKS[routeKey1] ?? ROUTE_RISKS[routeKey2] ?? ROUTE_RISKS["DEFAULT"] ?? 0;
  
  return {
    distance: Math.round(distance),
    baseCost,
    riskPremium,
    totalCost: baseCost + riskPremium,
    label,
  };
}

function calculateConfidence(priceDate: string | Date | null): ConfidenceResult {
  if (!priceDate) return { score: 50, label: "Unknown", color: "gray" };
  
  const now = new Date();
  const date = priceDate instanceof Date ? priceDate : new Date(priceDate);
  const daysOld = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysOld < 1) return { score: 95, label: "Very Fresh", color: "green" };
  if (daysOld < 3) return { score: 85, label: "Fresh", color: "green" };
  if (daysOld < 7) return { score: 65, label: "Recent", color: "yellow" };
  if (daysOld < 14) return { score: 45, label: "Moderate", color: "orange" };
  return { score: 25, label: "Stale", color: "red" };
}

// ============================================================================
// ARBITRAGE FINDER - Uses Latest_Prices_Summary (fast, ~137K rows)
// ============================================================================

async function findArbitrageOpportunities(
  minProfitPct: number,
  maxResults: number,
  filterItem?: string,
  filterCategory?: string
): Promise<ArbitrageOpportunity[]> {
  const prisma = await getPrisma();
  
  // Build filter conditions
  const itemFilter = filterItem ? `AND item_name LIKE '%${filterItem.replace(/'/g, "''")}%'` : "";
  const categoryFilter = filterCategory ? `AND category_id = '${filterCategory.replace(/'/g, "''")}'` : "";
  
  // Get latest prices grouped by item+market from Summary table
  const prices = await prisma.$queryRawUnsafe(`
    SELECT 
      item_name, market_name, state, category_id, unit,
      CAST(price_naira AS FLOAT) as price,
      price_date
    FROM Latest_Prices_Summary WITH (NOLOCK)
    WHERE price_naira > 0
      ${itemFilter}
      ${categoryFilter}
    ORDER BY item_name, market_name
  `) as any[];

  if (prices.length === 0) return [];

  // Group by item
  const pricesByItem: Record<string, typeof prices> = {};
  for (const p of prices) {
    const key = p.item_name || "unknown";
    if (!pricesByItem[key]) pricesByItem[key] = [];
    pricesByItem[key].push(p);
  }

  const opportunities: ArbitrageOpportunity[] = [];

  for (const [itemName, itemPrices] of Object.entries(pricesByItem)) {
    if (itemPrices.length < 2) continue;

    // Compare every pair of markets for this item
    for (let i = 0; i < itemPrices.length; i++) {
      for (let j = i + 1; j < itemPrices.length; j++) {
        const a = itemPrices[i];
        const b = itemPrices[j];
        
        const priceA = parseFloat(a.price) || 0;
        const priceB = parseFloat(b.price) || 0;
        
        if (priceA <= 0 || priceB <= 0) continue;
        if (Math.abs(priceA - priceB) < 10) continue; // Skip negligible differences

        // Determine buy (lower) and sell (higher)
        const [buyRec, sellRec, buyPrice, sellPrice] = priceA < priceB 
          ? [a, b, priceA, priceB] 
          : [b, a, priceB, priceA];

        const buyMarketName = buyRec.market_name || "";
        const sellMarketName = sellRec.market_name || "";
        
        // Skip same market
        if (buyMarketName === sellMarketName) continue;

        const transport = getTransportCost(buyMarketName, sellMarketName);
        const grossProfit = sellPrice - buyPrice;
        const netProfit = grossProfit - transport.totalCost;
        
        if (netProfit <= 0) continue;
        
        const profitPct = (netProfit / buyPrice) * 100;
        
        if (profitPct < minProfitPct) continue;

        const buyConf = calculateConfidence(buyRec.price_date);
        const sellConf = calculateConfidence(sellRec.price_date);
        const avgScore = Math.round((buyConf.score + sellConf.score) / 2);
        
        const catId = String(buyRec.category_id || "");
        const categoryName = CATEGORY_MAP[catId] || `Category ${catId}`;

        opportunities.push({
          id: `${itemName}-${buyMarketName}-${sellMarketName}`.replace(/\s+/g, "-").toLowerCase(),
          itemId: catId,
          itemName,
          categoryName,
          unit: buyRec.unit || "unit",
          buyMarket: {
            id: buyMarketName,
            name: buyMarketName,
            state: buyRec.state || "",
            price: Math.round(buyPrice),
            updatedAt: buyRec.price_date?.toISOString?.() || String(buyRec.price_date || ""),
          },
          sellMarket: {
            id: sellMarketName,
            name: sellMarketName,
            state: sellRec.state || "",
            price: Math.round(sellPrice),
            updatedAt: sellRec.price_date?.toISOString?.() || String(sellRec.price_date || ""),
          },
          grossProfit: Math.round(grossProfit),
          transportCost: transport.totalCost,
          netProfit: Math.round(netProfit),
          profitPercentage: Math.round(profitPct * 10) / 10,
          distance: transport.distance,
          confidence: {
            score: avgScore,
            label: avgScore >= 75 ? "High" : avgScore >= 50 ? "Medium" : "Low",
            color: avgScore >= 75 ? "green" : avgScore >= 50 ? "yellow" : "red",
          },
          transportLabel: transport.label,
        });
      }
    }
  }

  // Sort by profit percentage descending
  opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);

  return opportunities.slice(0, maxResults);
}

// ============================================================================
// GET - List arbitrage opportunities
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const tier = (searchParams.get("tier") || "FREE").toUpperCase();
    const item = searchParams.get("item") || undefined;
    const category = searchParams.get("category") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    
    // User-configurable minimum profit (query param)
    const userMinProfit = searchParams.get("minProfit");
    
    const tierConfig = getTierConfig(tier);
    
    if (!tierConfig.hasAccess) {
      return NextResponse.json({
        success: false,
        error: "upgrade_required",
        message: "Arbitrage feature requires GOLD tier or higher",
        requiredTier: "GOLD",
        currentTier: tier,
      }, { status: 403 });
    }
    
    // User can set their own min profit, but not below tier floor
    const minProfit = userMinProfit !== null 
      ? Math.max(parseFloat(userMinProfit) || 0, tierConfig.minProfitFloor)
      : tierConfig.minProfitFloor;
    
    const allOpportunities = await findArbitrageOpportunities(
      minProfit,
      tierConfig.maxResults,
      item,
      category
    );
    
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;
    const opportunities = allOpportunities.slice(startIdx, endIdx);
    
    return NextResponse.json({
      success: true,
      data: {
        opportunities,
        pagination: {
          page,
          limit,
          total: allOpportunities.length,
          totalPages: Math.ceil(allOpportunities.length / limit),
          hasMore: endIdx < allOpportunities.length,
        },
        tierInfo: {
          tier,
          minProfitFloor: tierConfig.minProfitFloor,
          appliedMinProfit: minProfit,
          maxResults: tierConfig.maxResults,
        },
        meta: {
          generatedAt: new Date().toISOString(),
          transportCostBasis: "2024-2025 Nigeria logistics rates",
          dataSource: "Latest_Prices_Summary",
        },
      },
    });
    
  } catch (error) {
    console.error("[Arbitrage API Error]", error);
    return NextResponse.json({
      success: false,
      error: "server_error",
      message: "Failed to fetch arbitrage opportunities",
    }, { status: 500 });
  }
}

// ============================================================================
// POST - Detailed arbitrage analysis for specific pair
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    const body = await request.json();
    const { buyMarket, sellMarket, itemName, tier = "FREE" } = body;
    
    const tierConfig = getTierConfig(tier.toUpperCase());
    
    if (!tierConfig.hasAccess) {
      return NextResponse.json({
        success: false,
        error: "upgrade_required",
        message: "Arbitrage feature requires GOLD tier or higher",
      }, { status: 403 });
    }

    const itemSearch = (itemName || "").replace(/'/g, "''");
    const buySearch = (buyMarket || "").replace(/'/g, "''");
    const sellSearch = (sellMarket || "").replace(/'/g, "''");
    
    const results = await prisma.$queryRawUnsafe(`
      SELECT item_name, market_name, state, category_id, unit,
        CAST(price_naira AS FLOAT) as price, price_date
      FROM Latest_Prices_Summary WITH (NOLOCK)
      WHERE item_name LIKE '%${itemSearch}%'
        AND (market_name = '${buySearch}' OR market_name = '${sellSearch}')
        AND price_naira > 0
    `) as any[];
    
    const buyPrice = results.find((r: any) => r.market_name === buyMarket);
    const sellPrice = results.find((r: any) => r.market_name === sellMarket);
    
    if (!buyPrice || !sellPrice) {
      return NextResponse.json({
        success: false,
        error: "not_found",
        message: "Price data not found for specified markets/item",
      }, { status: 404 });
    }
    
    const buyPriceNum = parseFloat(buyPrice.price) || 0;
    const sellPriceNum = parseFloat(sellPrice.price) || 0;
    
    const transport = getTransportCost(buyMarket, sellMarket);
    
    const quantities = [1, 5, 10, 25, 50, 100];
    const profitBreakdown = quantities.map(qty => {
      const totalBuyCost = buyPriceNum * qty;
      const totalSellRevenue = sellPriceNum * qty;
      const totalTransport = transport.totalCost * qty;
      const totalNetProfit = totalSellRevenue - totalBuyCost - totalTransport;
      const roi = totalBuyCost + totalTransport > 0 
        ? (totalNetProfit / (totalBuyCost + totalTransport)) * 100 
        : 0;
      
      return {
        quantity: qty,
        buyCost: Math.round(totalBuyCost),
        sellRevenue: Math.round(totalSellRevenue),
        transportCost: Math.round(totalTransport),
        netProfit: Math.round(totalNetProfit),
        roi: Math.round(roi * 10) / 10,
      };
    });
    
    return NextResponse.json({
      success: true,
      data: {
        item: {
          name: buyPrice.item_name,
          category: CATEGORY_MAP[String(buyPrice.category_id)] || "Other",
          unit: buyPrice.unit,
        },
        buyMarket: {
          name: buyMarket,
          state: buyPrice.state,
          price: Math.round(buyPriceNum),
          confidence: calculateConfidence(buyPrice.price_date),
        },
        sellMarket: {
          name: sellMarket,
          state: sellPrice.state,
          price: Math.round(sellPriceNum),
          confidence: calculateConfidence(sellPrice.price_date),
        },
        transport: {
          distance: transport.distance,
          baseCost: transport.baseCost,
          riskPremium: transport.riskPremium,
          totalCostPerUnit: transport.totalCost,
          label: transport.label,
        },
        profitAnalysis: {
          unitPriceSpread: Math.round(sellPriceNum - buyPriceNum),
          unitNetProfit: Math.round(sellPriceNum - buyPriceNum - transport.totalCost),
          unitProfitPct: Math.round(((sellPriceNum - buyPriceNum - transport.totalCost) / buyPriceNum) * 1000) / 10,
          breakdown: profitBreakdown,
        },
      },
    });
    
  } catch (error) {
    console.error("[Arbitrage Detail API Error]", error);
    return NextResponse.json({
      success: false,
      error: "server_error",
      message: "Failed to analyze arbitrage opportunity",
    }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
