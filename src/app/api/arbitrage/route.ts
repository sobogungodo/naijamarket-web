// ============================================================================
// NAIJAMARKET INTEL - ARBITRAGE OPPORTUNITIES API
// File: src/app/api/arbitrage/route.ts
// Bloomberg Equivalent: ARBI <GO>
// Version: 2.0 - Fully Type-Safe
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ============================================================================
// TYPES
// ============================================================================

interface TierConfig {
  hasAccess: boolean;
  minProfitPct: number;
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

const DEFAULT_TIER_CONFIG: TierConfig = { hasAccess: false, minProfitPct: 100, maxResults: 0 };

const TIER_ACCESS: Record<string, TierConfig> = {
  FREE: { hasAccess: false, minProfitPct: 100, maxResults: 0 },
  SILVER: { hasAccess: false, minProfitPct: 100, maxResults: 0 },
  GOLD: { hasAccess: true, minProfitPct: 5, maxResults: 10 },
  BUSINESS: { hasAccess: true, minProfitPct: 10, maxResults: 25 },
  CORPORATE: { hasAccess: true, minProfitPct: 15, maxResults: 50 },
  ENTERPRISE: { hasAccess: true, minProfitPct: 0, maxResults: 100 },
  OGA_BOSS: { hasAccess: true, minProfitPct: 0, maxResults: 100 },
  GOVERNMENT: { hasAccess: true, minProfitPct: 0, maxResults: 100 },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getTierConfig(tier: string): TierConfig {
  const config = TIER_ACCESS[tier];
  if (config) return config;
  const freeConfig = TIER_ACCESS["FREE"];
  if (freeConfig) return freeConfig;
  return DEFAULT_TIER_CONFIG;
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

function calculateConfidence(validatedAt: Date | null): ConfidenceResult {
  if (!validatedAt) return { score: 50, label: "Unknown", color: "gray" };
  
  const now = new Date();
  const hoursOld = (now.getTime() - validatedAt.getTime()) / (1000 * 60 * 60);
  const daysOld = hoursOld / 24;
  
  if (daysOld < 1) {
    return { score: 100 - Math.floor(hoursOld * 2), label: "Very Fresh", color: "green" };
  } else if (daysOld < 3) {
    return { score: 85 - Math.floor((daysOld - 1) * 5), label: "Fresh", color: "green" };
  } else if (daysOld < 7) {
    return { score: 65 - Math.floor((daysOld - 3) * 5), label: "Recent", color: "yellow" };
  } else if (daysOld < 14) {
    return { score: 50 - Math.floor((daysOld - 7) * 2), label: "Moderate", color: "orange" };
  } else if (daysOld < 30) {
    return { score: 35 - Math.floor((daysOld - 14) * 1), label: "Stale", color: "red" };
  } else {
    return { score: 20, label: "Very Stale", color: "red" };
  }
}

// ============================================================================
// ARBITRAGE FINDER
// ============================================================================

async function findArbitrageOpportunities(
  minProfitPct: number = 0,
  maxResults: number = 50,
  filterItem?: string,
  filterCategory?: string
): Promise<ArbitrageOpportunity[]> {
  const prices = await prisma.approved_Prices.findMany({
    where: {
      validation_status: "APPROVED",
      price: { not: null },
      ...(filterItem && {
        item_name: { contains: filterItem },
      }),
      ...(filterCategory && {
        category_name: { contains: filterCategory },
      }),
    },
  });

  const pricesByItem: Record<string, typeof prices> = {};
  
  for (const price of prices) {
    const itemId = price.item_id || price.item_name || "unknown";
    if (!pricesByItem[itemId]) {
      pricesByItem[itemId] = [];
    }
    pricesByItem[itemId].push(price);
  }

  const opportunities: ArbitrageOpportunity[] = [];

  for (const [itemId, itemPrices] of Object.entries(pricesByItem)) {
    if (itemPrices.length < 2) continue;

    const sorted = [...itemPrices].sort((a, b) => 
      Number(a.price || 0) - Number(b.price || 0)
    );

    for (let i = 0; i < Math.min(3, sorted.length); i++) {
      for (let j = sorted.length - 1; j > i && j >= sorted.length - 3; j--) {
        const buyPrice = sorted[i];
        const sellPrice = sorted[j];
        
        if (!buyPrice || !sellPrice) continue;
        
        const buyPriceNum = Number(buyPrice.price || 0);
        const sellPriceNum = Number(sellPrice.price || 0);
        
        if (buyPriceNum <= 0 || sellPriceNum <= buyPriceNum) continue;

        const buyMarketName = buyPrice.market_name || "Unknown";
        const sellMarketName = sellPrice.market_name || "Unknown";
        
        const transport = getTransportCost(buyMarketName, sellMarketName);
        
        const grossProfit = sellPriceNum - buyPriceNum;
        const netProfit = grossProfit - transport.totalCost;
        const profitPct = (netProfit / buyPriceNum) * 100;
        
        if (profitPct < minProfitPct) continue;
        
        const buyConfidence = calculateConfidence(buyPrice.validated_at);
        const sellConfidence = calculateConfidence(sellPrice.validated_at);
        const avgConfidence = Math.round((buyConfidence.score + sellConfidence.score) / 2);
        
        const confidenceLabel = avgConfidence >= 75 ? "High" : avgConfidence >= 50 ? "Medium" : "Low";
        const confidenceColor = avgConfidence >= 75 ? "green" : avgConfidence >= 50 ? "yellow" : "red";

        opportunities.push({
          id: `${itemId}-${buyPrice.market_id || i}-${sellPrice.market_id || j}`,
          itemId: buyPrice.item_id || "",
          itemName: buyPrice.item_name || "Unknown",
          categoryName: buyPrice.category_name || "Unknown",
          unit: buyPrice.unit || "unit",
          buyMarket: {
            id: buyPrice.market_id || "",
            name: buyMarketName,
            state: buyPrice.state || "",
            price: buyPriceNum,
            updatedAt: buyPrice.validated_at?.toISOString() || "",
          },
          sellMarket: {
            id: sellPrice.market_id || "",
            name: sellMarketName,
            state: sellPrice.state || "",
            price: sellPriceNum,
            updatedAt: sellPrice.validated_at?.toISOString() || "",
          },
          grossProfit,
          transportCost: transport.totalCost,
          netProfit,
          profitPercentage: Math.round(profitPct * 10) / 10,
          distance: transport.distance,
          confidence: {
            score: avgConfidence,
            label: confidenceLabel,
            color: confidenceColor,
          },
          transportLabel: transport.label,
        });
      }
    }
  }

  opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);

  return opportunities.slice(0, maxResults);
}

// ============================================================================
// API ROUTE HANDLERS
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const tier = (searchParams.get("tier") || "FREE").toUpperCase();
    const item = searchParams.get("item") || undefined;
    const category = searchParams.get("category") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    
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
    
    const allOpportunities = await findArbitrageOpportunities(
      tierConfig.minProfitPct,
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
          minProfitPct: tierConfig.minProfitPct,
          maxResults: tierConfig.maxResults,
        },
        meta: {
          generatedAt: new Date().toISOString(),
          transportCostBasis: "2024-2025 Nigeria logistics rates",
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { buyMarketId, sellMarketId, itemId, tier = "FREE" } = body;
    
    const tierConfig = getTierConfig(tier.toUpperCase());
    
    if (!tierConfig.hasAccess) {
      return NextResponse.json({
        success: false,
        error: "upgrade_required",
        message: "Arbitrage feature requires GOLD tier or higher",
      }, { status: 403 });
    }
    
    const buyPrice = await prisma.approved_Prices.findFirst({
      where: {
        item_id: itemId,
        market_id: buyMarketId,
        validation_status: "APPROVED",
      },
    });
    
    const sellPrice = await prisma.approved_Prices.findFirst({
      where: {
        item_id: itemId,
        market_id: sellMarketId,
        validation_status: "APPROVED",
      },
    });
    
    if (!buyPrice || !sellPrice) {
      return NextResponse.json({
        success: false,
        error: "not_found",
        message: "Price data not found for specified markets/item",
      }, { status: 404 });
    }
    
    const buyPriceNum = Number(buyPrice.price || 0);
    const sellPriceNum = Number(sellPrice.price || 0);
    const buyMarketName = buyPrice.market_name || "";
    const sellMarketName = sellPrice.market_name || "";
    
    const transport = getTransportCost(buyMarketName, sellMarketName);
    
    const quantities = [1, 5, 10, 25, 50, 100];
    const profitBreakdown = quantities.map(qty => {
      const totalBuyCost = buyPriceNum * qty;
      const totalSellRevenue = sellPriceNum * qty;
      const totalTransport = transport.totalCost * qty;
      const totalNetProfit = totalSellRevenue - totalBuyCost - totalTransport;
      const roi = (totalNetProfit / (totalBuyCost + totalTransport)) * 100;
      
      return {
        quantity: qty,
        buyCost: totalBuyCost,
        sellRevenue: totalSellRevenue,
        transportCost: totalTransport,
        netProfit: totalNetProfit,
        roi: Math.round(roi * 10) / 10,
      };
    });
    
    const buyConfidence = calculateConfidence(buyPrice.validated_at);
    const sellConfidence = calculateConfidence(sellPrice.validated_at);
    
    return NextResponse.json({
      success: true,
      data: {
        item: {
          id: itemId,
          name: buyPrice.item_name,
          category: buyPrice.category_name,
          unit: buyPrice.unit,
        },
        buyMarket: {
          id: buyMarketId,
          name: buyMarketName,
          state: buyPrice.state,
          price: buyPriceNum,
          updatedAt: buyPrice.validated_at,
          confidence: buyConfidence,
        },
        sellMarket: {
          id: sellMarketId,
          name: sellMarketName,
          state: sellPrice.state,
          price: sellPriceNum,
          updatedAt: sellPrice.validated_at,
          confidence: sellConfidence,
        },
        transport: {
          distance: transport.distance,
          baseCost: transport.baseCost,
          riskPremium: transport.riskPremium,
          totalCostPerUnit: transport.totalCost,
          label: transport.label,
        },
        profitAnalysis: {
          unitPriceSpread: sellPriceNum - buyPriceNum,
          unitNetProfit: sellPriceNum - buyPriceNum - transport.totalCost,
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
