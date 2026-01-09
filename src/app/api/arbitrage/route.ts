// ============================================================================
// NAIJAMARKET INTEL - ARBITRAGE OPPORTUNITIES API
// File: src/app/api/arbitrage/route.ts
// Bloomberg Equivalent: ARBI <GO>
// Version: 1.0
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ============================================================================
// CONFIGURATION
// ============================================================================

// Market GPS coordinates for distance calculation
const MARKET_COORDINATES: Record<string, { lat: number; lon: number; state: string }> = {
  // Lagos Markets
  "Mile 12 Market": { lat: 6.5833, lon: 3.3833, state: "Lagos" },
  "Alaba International Market": { lat: 6.4631, lon: 3.1937, state: "Lagos" },
  "Oyingbo Market": { lat: 6.4778, lon: 3.3894, state: "Lagos" },
  "Balogun Market": { lat: 6.4539, lon: 3.3944, state: "Lagos" },
  "Computer Village": { lat: 6.6018, lon: 3.3515, state: "Lagos" },
  "Iddo Market": { lat: 6.4647, lon: 3.3847, state: "Lagos" },
  
  // Southeast Markets
  "Onitsha Main Market": { lat: 6.1456, lon: 6.7856, state: "Anambra" },
  "Ariaria Market": { lat: 5.1167, lon: 7.3667, state: "Abia" },
  "Ogbete Market": { lat: 6.4411, lon: 7.4939, state: "Enugu" },
  
  // Northern Markets
  "Kano Main Market": { lat: 12.0022, lon: 8.5167, state: "Kano" },
  "Dawanau Market": { lat: 11.9467, lon: 8.4961, state: "Kano" },
  "Kurmi Market": { lat: 12.0000, lon: 8.5167, state: "Kano" },
  "Jos Main Market": { lat: 9.8965, lon: 8.8583, state: "Plateau" },
  "Kaduna Central Market": { lat: 10.5222, lon: 7.4403, state: "Kaduna" },
  
  // Southwest Markets
  "Bodija Market": { lat: 7.4167, lon: 3.9000, state: "Oyo" },
  "Dugbe Market": { lat: 7.3833, lon: 3.8833, state: "Oyo" },
  "Oja Oba Market": { lat: 7.6292, lon: 4.7433, state: "Osun" },
  
  // South-South Markets
  "Watt Market": { lat: 4.9333, lon: 8.3333, state: "Cross River" },
  "Oil Mill Market": { lat: 4.7833, lon: 7.0167, state: "Rivers" },
  
  // FCT Markets
  "Wuse Market": { lat: 9.0765, lon: 7.4898, state: "FCT" },
  "Utako Market": { lat: 9.0667, lon: 7.4333, state: "FCT" },
  "Garki Market": { lat: 9.0167, lon: 7.4833, state: "FCT" },
  "Nyanya Market": { lat: 9.0167, lon: 7.5667, state: "FCT" },
};

// Transport cost tiers based on distance (2024-2025 Nigeria rates)
const TRANSPORT_COSTS = {
  SAME_CITY: { maxKm: 50, costPer50kg: 500, label: "Same City" },
  SAME_STATE: { maxKm: 100, costPer50kg: 1000, label: "Same State" },
  NEIGHBORING: { maxKm: 300, costPer50kg: 2500, label: "Neighboring State" },
  REGIONAL: { maxKm: 500, costPer50kg: 4000, label: "Regional" },
  LONG_DISTANCE: { maxKm: 800, costPer50kg: 6000, label: "Long Distance" },
  VERY_LONG: { maxKm: 1200, costPer50kg: 8000, label: "Very Long" },
  CROSS_COUNTRY: { maxKm: 99999, costPer50kg: 10000, label: "Cross Country" },
};

// Risk premiums for certain routes
const ROUTE_RISKS: Record<string, number> = {
  // Northern routes have higher security costs
  "Lagos-Kano": 1500,
  "Lagos-Kaduna": 1500,
  "Abuja-Kano": 1000,
  "Abuja-Kaduna": 500,
  // Default
  DEFAULT: 0,
};

// Tier access configuration
const TIER_ACCESS: Record<string, { hasAccess: boolean; minProfitPct: number; maxResults: number }> = {
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

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get transport cost between two markets
 */
function getTransportCost(fromMarket: string, toMarket: string): {
  distance: number;
  baseCost: number;
  riskPremium: number;
  totalCost: number;
  label: string;
} {
  const from = MARKET_COORDINATES[fromMarket];
  const to = MARKET_COORDINATES[toMarket];
  
  if (!from || !to) {
    return { distance: 0, baseCost: 0, riskPremium: 0, totalCost: 0, label: "Unknown" };
  }
  
  const distance = calculateDistance(from.lat, from.lon, to.lat, to.lon);
  
  // Determine transport tier
  let baseCost = TRANSPORT_COSTS.CROSS_COUNTRY.costPer50kg;
  let label = TRANSPORT_COSTS.CROSS_COUNTRY.label;
  
  for (const tier of Object.values(TRANSPORT_COSTS)) {
    if (distance <= tier.maxKm) {
      baseCost = tier.costPer50kg;
      label = tier.label;
      break;
    }
  }
  
  // Check for route-specific risk premiums
  const routeKey1 = `${from.state}-${to.state}`;
  const routeKey2 = `${to.state}-${from.state}`;
  const riskPremium = ROUTE_RISKS[routeKey1] || ROUTE_RISKS[routeKey2] || ROUTE_RISKS.DEFAULT;
  
  return {
    distance: Math.round(distance),
    baseCost,
    riskPremium,
    totalCost: baseCost + riskPremium,
    label,
  };
}

/**
 * Calculate confidence score based on data freshness
 */
function calculateConfidence(updatedAt: Date): { score: number; label: string; color: string } {
  const now = new Date();
  const hoursOld = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);
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
// ARBITRAGE OPPORTUNITY FINDER
// ============================================================================

interface ArbitrageOpportunity {
  id: string;
  itemId: string;
  itemName: string;
  categoryName: string;
  unit: string;
  buyMarket: {
    id: string;
    name: string;
    state: string;
    price: number;
    updatedAt: string;
  };
  sellMarket: {
    id: string;
    name: string;
    state: string;
    price: number;
    updatedAt: string;
  };
  grossProfit: number;
  transportCost: number;
  netProfit: number;
  profitPercentage: number;
  distance: number;
  confidence: {
    score: number;
    label: string;
    color: string;
  };
  transportLabel: string;
}

async function findArbitrageOpportunities(
  minProfitPct: number = 0,
  maxResults: number = 50,
  filterItem?: string,
  filterCategory?: string
): Promise<ArbitrageOpportunity[]> {
  // Get all prices with market and item info
  const prices = await prisma.prices.findMany({
    where: {
      validated: true,
      ...(filterItem && {
        Items: {
          item_name: {
            contains: filterItem,
          },
        },
      }),
      ...(filterCategory && {
        Items: {
          Categories: {
            category_name: {
              contains: filterCategory,
            },
          },
        },
      }),
    },
    include: {
      Items: {
        include: {
          Categories: true,
        },
      },
      Markets: true,
    },
  });

  // Group prices by item
  const pricesByItem: Record<string, typeof prices> = {};
  
  for (const price of prices) {
    const itemId = price.item_id;
    if (!pricesByItem[itemId]) {
      pricesByItem[itemId] = [];
    }
    pricesByItem[itemId].push(price);
  }

  const opportunities: ArbitrageOpportunity[] = [];

  // Find arbitrage opportunities for each item
  for (const [itemId, itemPrices] of Object.entries(pricesByItem)) {
    if (itemPrices.length < 2) continue;

    // Sort by price (ascending)
    const sorted = [...itemPrices].sort((a, b) => 
      Number(a.price || 0) - Number(b.price || 0)
    );

    // Compare lowest price markets with highest price markets
    for (let i = 0; i < Math.min(3, sorted.length); i++) {
      for (let j = sorted.length - 1; j > i && j >= sorted.length - 3; j--) {
        const buyPrice = sorted[i];
        const sellPrice = sorted[j];
        
        if (!buyPrice.Markets || !sellPrice.Markets) continue;
        
        const buyPriceNum = Number(buyPrice.price || 0);
        const sellPriceNum = Number(sellPrice.price || 0);
        
        if (buyPriceNum <= 0 || sellPriceNum <= buyPriceNum) continue;

        const buyMarketName = buyPrice.Markets.market_name || "";
        const sellMarketName = sellPrice.Markets.market_name || "";
        
        // Calculate transport cost
        const transport = getTransportCost(buyMarketName, sellMarketName);
        
        // Calculate profits
        const grossProfit = sellPriceNum - buyPriceNum;
        const netProfit = grossProfit - transport.totalCost;
        const profitPct = (netProfit / buyPriceNum) * 100;
        
        // Filter by minimum profit percentage
        if (profitPct < minProfitPct) continue;
        
        // Calculate confidence (average of both prices)
        const buyConfidence = calculateConfidence(new Date(buyPrice.updated_at || new Date()));
        const sellConfidence = calculateConfidence(new Date(sellPrice.updated_at || new Date()));
        const avgConfidence = Math.round((buyConfidence.score + sellConfidence.score) / 2);
        
        const confidenceLabel = avgConfidence >= 75 ? "High" : avgConfidence >= 50 ? "Medium" : "Low";
        const confidenceColor = avgConfidence >= 75 ? "green" : avgConfidence >= 50 ? "yellow" : "red";

        opportunities.push({
          id: `${itemId}-${buyPrice.market_id}-${sellPrice.market_id}`,
          itemId: itemId,
          itemName: buyPrice.Items?.item_name || "Unknown",
          categoryName: buyPrice.Items?.Categories?.category_name || "Unknown",
          unit: buyPrice.unit || buyPrice.Items?.unit || "unit",
          buyMarket: {
            id: buyPrice.market_id || "",
            name: buyMarketName,
            state: buyPrice.Markets.state || "",
            price: buyPriceNum,
            updatedAt: buyPrice.updated_at?.toISOString() || "",
          },
          sellMarket: {
            id: sellPrice.market_id || "",
            name: sellMarketName,
            state: sellPrice.Markets.state || "",
            price: sellPriceNum,
            updatedAt: sellPrice.updated_at?.toISOString() || "",
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

  // Sort by profit percentage (descending)
  opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);

  return opportunities.slice(0, maxResults);
}

// ============================================================================
// API ROUTE HANDLERS
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get parameters
    const tier = (searchParams.get("tier") || "FREE").toUpperCase();
    const item = searchParams.get("item") || undefined;
    const category = searchParams.get("category") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    
    // Check tier access
    const tierConfig = TIER_ACCESS[tier] || TIER_ACCESS.FREE;
    
    if (!tierConfig.hasAccess) {
      return NextResponse.json({
        success: false,
        error: "upgrade_required",
        message: "Arbitrage feature requires GOLD tier or higher",
        requiredTier: "GOLD",
        currentTier: tier,
      }, { status: 403 });
    }
    
    // Find opportunities
    const allOpportunities = await findArbitrageOpportunities(
      tierConfig.minProfitPct,
      tierConfig.maxResults,
      item,
      category
    );
    
    // Paginate results
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

// POST endpoint for detailed opportunity analysis
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { buyMarketId, sellMarketId, itemId, tier = "FREE" } = body;
    
    // Check tier access
    const tierConfig = TIER_ACCESS[tier.toUpperCase()] || TIER_ACCESS.FREE;
    
    if (!tierConfig.hasAccess) {
      return NextResponse.json({
        success: false,
        error: "upgrade_required",
        message: "Arbitrage feature requires GOLD tier or higher",
      }, { status: 403 });
    }
    
    // Get specific prices
    const buyPrice = await prisma.prices.findFirst({
      where: {
        item_id: itemId,
        market_id: buyMarketId,
        validated: true,
      },
      include: {
        Items: { include: { Categories: true } },
        Markets: true,
      },
    });
    
    const sellPrice = await prisma.prices.findFirst({
      where: {
        item_id: itemId,
        market_id: sellMarketId,
        validated: true,
      },
      include: {
        Items: { include: { Categories: true } },
        Markets: true,
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
    const buyMarketName = buyPrice.Markets?.market_name || "";
    const sellMarketName = sellPrice.Markets?.market_name || "";
    
    // Calculate transport
    const transport = getTransportCost(buyMarketName, sellMarketName);
    
    // Calculate profits at various quantities
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
    
    // Calculate confidence
    const buyConfidence = calculateConfidence(new Date(buyPrice.updated_at || new Date()));
    const sellConfidence = calculateConfidence(new Date(sellPrice.updated_at || new Date()));
    
    return NextResponse.json({
      success: true,
      data: {
        item: {
          id: itemId,
          name: buyPrice.Items?.item_name,
          category: buyPrice.Items?.Categories?.category_name,
          unit: buyPrice.unit || buyPrice.Items?.unit,
        },
        buyMarket: {
          id: buyMarketId,
          name: buyMarketName,
          state: buyPrice.Markets?.state,
          price: buyPriceNum,
          updatedAt: buyPrice.updated_at,
          confidence: buyConfidence,
        },
        sellMarket: {
          id: sellMarketId,
          name: sellMarketName,
          state: sellPrice.Markets?.state,
          price: sellPriceNum,
          updatedAt: sellPrice.updated_at,
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
        recommendation: {
          viable: sellPriceNum - buyPriceNum - transport.totalCost > 0,
          minQuantityForProfit: Math.ceil(transport.totalCost / (sellPriceNum - buyPriceNum)),
          breakEvenQuantity: transport.totalCost > 0 ? Math.ceil(transport.totalCost / (sellPriceNum - buyPriceNum - transport.totalCost / 10)) : 1,
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
