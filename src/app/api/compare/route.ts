// ============================================================================
// NAIJAMARKET INTEL - MARKET COMPARISON API
// File: src/app/api/compare/route.ts
// Bloomberg Equivalent: COMP <GO>
// Version: 1.1 - Fixed for actual Prisma schema
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ============================================================================
// CONFIGURATION
// ============================================================================

const COMPARE_LIMITS: Record<string, number> = {
  FREE: 2,
  SILVER: 3,
  GOLD: 5,
  BUSINESS: 5,
  CORPORATE: 5,
  ENTERPRISE: 10,
  OGA_BOSS: 10,
  GOVERNMENT: 10,
};

// ============================================================================
// TYPES
// ============================================================================

interface MarketPrice {
  marketId: string;
  marketName: string;
  state: string;
  price: number;
  trend: string | null;
  trendPercentage: number | null;
  updatedAt: string;
  rank: number;
  savings: number;
  savingsPercentage: number;
}

interface ComparisonResult {
  item: {
    id: string;
    name: string;
    category: string;
    unit: string;
  };
  lowestPrice: MarketPrice;
  highestPrice: MarketPrice;
  averagePrice: number;
  priceRange: number;
  markets: MarketPrice[];
  maxSavings: {
    amount: number;
    percentage: number;
    fromMarket: string;
    toMarket: string;
  };
}

// ============================================================================
// API ROUTE HANDLERS
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const itemParam = searchParams.get("item");
    const marketsParam = searchParams.get("markets");
    const tier = (searchParams.get("tier") || "FREE").toUpperCase();
    
    if (!itemParam) {
      return NextResponse.json({
        success: false,
        error: "missing_parameter",
        message: "Item parameter is required",
      }, { status: 400 });
    }
    
    const maxMarkets = COMPARE_LIMITS[tier] || COMPARE_LIMITS.FREE;
    
    // Get prices from Approved_Prices matching item name
    let pricesQuery = await prisma.approved_Prices.findMany({
      where: {
        validation_status: "APPROVED",
        item_name: { contains: itemParam },
        price: { not: null },
      },
      orderBy: {
        price: "asc",
      },
    });
    
    // Filter by markets if specified
    if (marketsParam) {
      const marketFilter = marketsParam.split(",").map(m => m.trim().toLowerCase());
      pricesQuery = pricesQuery.filter(p => 
        marketFilter.some(mf => 
          p.market_name?.toLowerCase().includes(mf) || 
          p.market_id?.toLowerCase() === mf
        )
      );
    }
    
    if (pricesQuery.length === 0) {
      return NextResponse.json({
        success: false,
        error: "no_prices",
        message: `No prices found for "${itemParam}"`,
        suggestion: "Try different markets or check if the item has been recently submitted",
      }, { status: 404 });
    }
    
    // Limit to max markets (one price per market)
    const seenMarkets = new Set<string>();
    const prices = pricesQuery.filter(p => {
      const marketId = p.market_id || p.market_name || "";
      if (seenMarkets.has(marketId)) return false;
      if (seenMarkets.size >= maxMarkets) return false;
      seenMarkets.add(marketId);
      return true;
    });
    
    // Calculate statistics
    const priceValues = prices.map(p => Number(p.price || 0)).filter(p => p > 0);
    const lowestPrice = Math.min(...priceValues);
    const highestPrice = Math.max(...priceValues);
    const averagePrice = priceValues.reduce((a, b) => a + b, 0) / priceValues.length;
    
    // Build market price list with rankings and savings
    const marketPrices: MarketPrice[] = prices.map((p, index) => {
      const price = Number(p.price || 0);
      const savings = highestPrice - price;
      const savingsPct = highestPrice > 0 ? (savings / highestPrice) * 100 : 0;
      
      return {
        marketId: p.market_id || "",
        marketName: p.market_name || "Unknown",
        state: p.state || "",
        price,
        trend: p.price_trend || null,
        trendPercentage: Number(p.price_change_percent || 0),
        updatedAt: p.validated_at?.toISOString() || "",
        rank: index + 1,
        savings: Math.round(savings),
        savingsPercentage: Math.round(savingsPct * 10) / 10,
      };
    });
    
    const lowestMarket = marketPrices[0];
    const highestMarket = marketPrices[marketPrices.length - 1];
    
    // Get item info from first price
    const firstPrice = prices[0];
    
    const result: ComparisonResult = {
      item: {
        id: firstPrice.item_id || "",
        name: firstPrice.item_name || "",
        category: firstPrice.category_name || "",
        unit: firstPrice.unit || "unit",
      },
      lowestPrice: lowestMarket,
      highestPrice: highestMarket,
      averagePrice: Math.round(averagePrice),
      priceRange: Math.round(highestPrice - lowestPrice),
      markets: marketPrices,
      maxSavings: {
        amount: Math.round(highestPrice - lowestPrice),
        percentage: Math.round(((highestPrice - lowestPrice) / highestPrice) * 1000) / 10,
        fromMarket: highestMarket.marketName,
        toMarket: lowestMarket.marketName,
      },
    };
    
    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        tier,
        maxMarketsAllowed: maxMarkets,
        marketsCompared: marketPrices.length,
        generatedAt: new Date().toISOString(),
      },
    });
    
  } catch (error) {
    console.error("[Compare API Error]", error);
    return NextResponse.json({
      success: false,
      error: "server_error",
      message: "Failed to compare prices",
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, markets, tier = "FREE" } = body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({
        success: false,
        error: "missing_parameter",
        message: "Items array is required",
      }, { status: 400 });
    }
    
    if (!markets || !Array.isArray(markets) || markets.length < 2) {
      return NextResponse.json({
        success: false,
        error: "missing_parameter",
        message: "At least 2 markets are required for comparison",
      }, { status: 400 });
    }
    
    const maxMarkets = COMPARE_LIMITS[tier.toUpperCase()] || COMPARE_LIMITS.FREE;
    const selectedMarkets = markets.slice(0, maxMarkets);
    
    const comparisons: ComparisonResult[] = [];
    
    for (const itemName of items) {
      // Get prices for this item
      const prices = await prisma.approved_Prices.findMany({
        where: {
          validation_status: "APPROVED",
          item_name: { contains: itemName },
          price: { not: null },
          OR: selectedMarkets.map(m => ({
            OR: [
              { market_id: m },
              { market_name: { contains: m } },
            ],
          })),
        },
        orderBy: {
          price: "asc",
        },
      });
      
      if (prices.length === 0) continue;
      
      const priceValues = prices.map(p => Number(p.price || 0)).filter(p => p > 0);
      if (priceValues.length === 0) continue;
      
      const lowestPrice = Math.min(...priceValues);
      const highestPrice = Math.max(...priceValues);
      const averagePrice = priceValues.reduce((a, b) => a + b, 0) / priceValues.length;
      
      const marketPrices: MarketPrice[] = prices.map((p, index) => {
        const price = Number(p.price || 0);
        const savings = highestPrice - price;
        const savingsPct = highestPrice > 0 ? (savings / highestPrice) * 100 : 0;
        
        return {
          marketId: p.market_id || "",
          marketName: p.market_name || "Unknown",
          state: p.state || "",
          price,
          trend: p.price_trend || null,
          trendPercentage: Number(p.price_change_percent || 0),
          updatedAt: p.validated_at?.toISOString() || "",
          rank: index + 1,
          savings: Math.round(savings),
          savingsPercentage: Math.round(savingsPct * 10) / 10,
        };
      });
      
      const firstPrice = prices[0];
      
      comparisons.push({
        item: {
          id: firstPrice.item_id || "",
          name: firstPrice.item_name || "",
          category: firstPrice.category_name || "",
          unit: firstPrice.unit || "unit",
        },
        lowestPrice: marketPrices[0],
        highestPrice: marketPrices[marketPrices.length - 1],
        averagePrice: Math.round(averagePrice),
        priceRange: Math.round(highestPrice - lowestPrice),
        markets: marketPrices,
        maxSavings: {
          amount: Math.round(highestPrice - lowestPrice),
          percentage: Math.round(((highestPrice - lowestPrice) / highestPrice) * 1000) / 10,
          fromMarket: marketPrices[marketPrices.length - 1].marketName,
          toMarket: marketPrices[0].marketName,
        },
      });
    }
    
    // Calculate shopping list total
    const shoppingListOptimal = comparisons.map(c => ({
      item: c.item.name,
      cheapestMarket: c.lowestPrice.marketName,
      price: c.lowestPrice.price,
    }));
    
    const totalOptimal = shoppingListOptimal.reduce((sum, item) => sum + item.price, 0);
    
    const firstMarketTotal = comparisons.reduce((sum, c) => {
      const firstMarketPrice = c.markets.find(m => 
        selectedMarkets.some(sm => 
          m.marketId === sm || m.marketName.toLowerCase().includes(sm.toLowerCase())
        )
      );
      return sum + (firstMarketPrice?.price || c.averagePrice);
    }, 0);
    
    return NextResponse.json({
      success: true,
      data: {
        comparisons,
        summary: {
          itemsCompared: comparisons.length,
          marketsCompared: selectedMarkets.length,
          optimalShoppingList: shoppingListOptimal,
          totalIfOptimal: Math.round(totalOptimal),
          totalIfSingleMarket: Math.round(firstMarketTotal),
          potentialSavings: Math.round(firstMarketTotal - totalOptimal),
          savingsPercentage: firstMarketTotal > 0 
            ? Math.round(((firstMarketTotal - totalOptimal) / firstMarketTotal) * 1000) / 10
            : 0,
        },
      },
      meta: {
        tier: tier.toUpperCase(),
        maxMarketsAllowed: maxMarkets,
        generatedAt: new Date().toISOString(),
      },
    });
    
  } catch (error) {
    console.error("[Compare POST API Error]", error);
    return NextResponse.json({
      success: false,
      error: "server_error",
      message: "Failed to compare prices",
    }, { status: 500 });
  }
}
