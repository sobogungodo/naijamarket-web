// ============================================================================
// NAIJAMARKET INTEL - MARKET COMPARISON API
// File: src/app/api/compare/route.ts
// Bloomberg Equivalent: COMP <GO>
// Version: 1.0
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ============================================================================
// CONFIGURATION
// ============================================================================

// Tier limits for comparison
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
// HELPER FUNCTIONS
// ============================================================================

function getTrendEmoji(trend: string | null): string {
  if (!trend) return "→";
  switch (trend.toUpperCase()) {
    case "UP": return "↑";
    case "DOWN": return "↓";
    default: return "→";
  }
}

function getTrendColor(trend: string | null): string {
  if (!trend) return "gray";
  switch (trend.toUpperCase()) {
    case "UP": return "red";
    case "DOWN": return "green";
    default: return "gray";
  }
}

// ============================================================================
// API ROUTE HANDLERS
// ============================================================================

/**
 * GET /api/compare
 * Compare an item across multiple markets
 * 
 * Query params:
 * - item: Item ID or name to compare
 * - markets: Comma-separated market IDs or names
 * - tier: User subscription tier (for limit enforcement)
 */
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
    
    // Get comparison limit for tier
    const maxMarkets = COMPARE_LIMITS[tier] || COMPARE_LIMITS.FREE;
    
    // Find the item
    const item = await prisma.items.findFirst({
      where: {
        OR: [
          { item_id: itemParam },
          { item_name: { contains: itemParam } },
        ],
      },
      include: {
        Categories: true,
      },
    });
    
    if (!item) {
      return NextResponse.json({
        success: false,
        error: "item_not_found",
        message: `Item "${itemParam}" not found`,
      }, { status: 404 });
    }
    
    // Build market filter
    let marketFilter: string[] = [];
    if (marketsParam) {
      marketFilter = marketsParam.split(",").map(m => m.trim()).slice(0, maxMarkets);
    }
    
    // Get prices for this item across markets
    const pricesQuery = await prisma.prices.findMany({
      where: {
        item_id: item.item_id,
        validated: true,
        ...(marketFilter.length > 0 && {
          OR: marketFilter.map(m => ({
            OR: [
              { market_id: m },
              { Markets: { market_name: { contains: m } } },
            ],
          })),
        }),
      },
      include: {
        Markets: true,
      },
      orderBy: {
        price: "asc",
      },
    });
    
    if (pricesQuery.length === 0) {
      return NextResponse.json({
        success: false,
        error: "no_prices",
        message: `No prices found for "${item.item_name}"`,
        suggestion: "Try different markets or check if the item has been recently submitted",
      }, { status: 404 });
    }
    
    // Limit to max markets
    const prices = pricesQuery.slice(0, maxMarkets);
    
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
        marketName: p.Markets?.market_name || "Unknown",
        state: p.Markets?.state || "",
        price,
        trend: p.trend,
        trendPercentage: Number(p.trend_percentage || 0),
        updatedAt: p.updated_at?.toISOString() || "",
        rank: index + 1,
        savings: Math.round(savings),
        savingsPercentage: Math.round(savingsPct * 10) / 10,
      };
    });
    
    // Find lowest and highest
    const lowestMarket = marketPrices[0];
    const highestMarket = marketPrices[marketPrices.length - 1];
    
    const result: ComparisonResult = {
      item: {
        id: item.item_id,
        name: item.item_name || "",
        category: item.Categories?.category_name || "",
        unit: item.unit || "unit",
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

/**
 * POST /api/compare
 * Compare multiple items across multiple markets (advanced comparison)
 * 
 * Body:
 * {
 *   items: ["item1", "item2"],
 *   markets: ["market1", "market2", "market3"],
 *   tier: "GOLD"
 * }
 */
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
    
    // Get all items
    const itemRecords = await prisma.items.findMany({
      where: {
        OR: items.map(item => ({
          OR: [
            { item_id: item },
            { item_name: { contains: item } },
          ],
        })),
      },
      include: {
        Categories: true,
      },
    });
    
    // Get all market records
    const marketRecords = await prisma.markets.findMany({
      where: {
        OR: selectedMarkets.map(m => ({
          OR: [
            { market_id: m },
            { market_name: { contains: m } },
          ],
        })),
      },
    });
    
    // Build comparison matrix
    const comparisons: ComparisonResult[] = [];
    
    for (const item of itemRecords) {
      const prices = await prisma.prices.findMany({
        where: {
          item_id: item.item_id,
          validated: true,
          market_id: {
            in: marketRecords.map(m => m.market_id),
          },
        },
        include: {
          Markets: true,
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
          marketName: p.Markets?.market_name || "Unknown",
          state: p.Markets?.state || "",
          price,
          trend: p.trend,
          trendPercentage: Number(p.trend_percentage || 0),
          updatedAt: p.updated_at?.toISOString() || "",
          rank: index + 1,
          savings: Math.round(savings),
          savingsPercentage: Math.round(savingsPct * 10) / 10,
        };
      });
      
      comparisons.push({
        item: {
          id: item.item_id,
          name: item.item_name || "",
          category: item.Categories?.category_name || "",
          unit: item.unit || "unit",
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
    
    // Calculate shopping list total if buying from cheapest markets
    const shoppingListOptimal = comparisons.map(c => ({
      item: c.item.name,
      cheapestMarket: c.lowestPrice.marketName,
      price: c.lowestPrice.price,
    }));
    
    const totalOptimal = shoppingListOptimal.reduce((sum, item) => sum + item.price, 0);
    
    // Calculate if buying everything from first market
    const firstMarketTotal = comparisons.reduce((sum, c) => {
      const firstMarketPrice = c.markets.find(m => m.marketId === selectedMarkets[0]);
      return sum + (firstMarketPrice?.price || c.averagePrice);
    }, 0);
    
    return NextResponse.json({
      success: true,
      data: {
        comparisons,
        summary: {
          itemsCompared: comparisons.length,
          marketsCompared: marketRecords.length,
          optimalShoppingList: shoppingListOptimal,
          totalIfOptimal: Math.round(totalOptimal),
          totalIfSingleMarket: Math.round(firstMarketTotal),
          potentialSavings: Math.round(firstMarketTotal - totalOptimal),
          savingsPercentage: Math.round(((firstMarketTotal - totalOptimal) / firstMarketTotal) * 1000) / 10,
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
