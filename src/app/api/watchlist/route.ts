// ============================================================================
// NAIJAMARKET INTEL - WATCHLIST / FAVORITES API
// File: src/app/api/watchlist/route.ts
// Bloomberg Equivalent: MOST <GO>
// Version: 1.1 - Fixed for actual Prisma schema
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ============================================================================
// CONFIGURATION
// ============================================================================

const WATCHLIST_LIMITS: Record<string, { markets: number; items: number; alerts: number }> = {
  FREE: { markets: 0, items: 0, alerts: 0 },
  SILVER: { markets: 1, items: 3, alerts: 1 },
  GOLD: { markets: 3, items: 10, alerts: 5 },
  BUSINESS: { markets: 5, items: 20, alerts: 10 },
  CORPORATE: { markets: 7, items: 30, alerts: 15 },
  ENTERPRISE: { markets: -1, items: -1, alerts: -1 },
  OGA_BOSS: { markets: -1, items: -1, alerts: -1 },
  GOVERNMENT: { markets: -1, items: -1, alerts: -1 },
};

// ============================================================================
// TYPES
// ============================================================================

interface WatchlistItem {
  id: string;
  type: "market" | "item";
  targetId: string;
  targetName: string;
  category?: string;
  state?: string;
  currentPrice?: number;
  priceChange?: number;
  priceChangePercent?: number;
  trend?: string;
  lastUpdated?: string;
  addedAt: string;
}

interface WatchlistSummary {
  markets: WatchlistItem[];
  items: WatchlistItem[];
  totalMarkets: number;
  totalItems: number;
  limits: {
    markets: number;
    items: number;
  };
  canAddMarket: boolean;
  canAddItem: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseWatchlist(json: string | null | undefined): string[] {
  if (!json || json.trim() === "") return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ============================================================================
// API ROUTE HANDLERS
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const phone = searchParams.get("phone");
    const consumerId = searchParams.get("consumerId");
    const type = searchParams.get("type") || "all";
    const tier = (searchParams.get("tier") || "FREE").toUpperCase();
    
    if (!phone && !consumerId) {
      return NextResponse.json({
        success: false,
        error: "missing_parameter",
        message: "Phone number or consumerId is required",
      }, { status: 400 });
    }
    
    // Get consumer record
    const consumer = await prisma.consumers.findFirst({
      where: {
        OR: [
          ...(phone ? [{ phone_number: phone }] : []),
          ...(consumerId ? [{ consumer_id: consumerId }] : []),
        ],
      },
    });
    
    if (!consumer) {
      return NextResponse.json({
        success: false,
        error: "consumer_not_found",
        message: "Consumer not found",
      }, { status: 404 });
    }
    
    // Get limits
    const actualTier = consumer.subscription_tier?.toUpperCase() || tier;
    const limits = WATCHLIST_LIMITS[actualTier] || WATCHLIST_LIMITS.FREE;
    
    // Parse favorites (assuming these columns exist in Consumers table)
    const favoriteMarkets = parseWatchlist(consumer.favorite_markets as string);
    const favoriteItems = parseWatchlist(consumer.favorite_items as string);
    
    const response: WatchlistSummary = {
      markets: [],
      items: [],
      totalMarkets: favoriteMarkets.length,
      totalItems: favoriteItems.length,
      limits: {
        markets: limits.markets,
        items: limits.items,
      },
      canAddMarket: limits.markets < 0 || favoriteMarkets.length < limits.markets,
      canAddItem: limits.items < 0 || favoriteItems.length < limits.items,
    };
    
    // Get market details if requested
    if (type === "all" || type === "markets") {
      for (const marketName of favoriteMarkets) {
        const market = await prisma.markets.findFirst({
          where: { market_name: marketName },
        });
        
        if (market) {
          // Get latest price for this market
          const latestPrice = await prisma.approved_Prices.findFirst({
            where: {
              market_id: market.market_id,
              validation_status: "APPROVED",
            },
            orderBy: { validated_at: "desc" },
          });
          
          response.markets.push({
            id: market.market_id,
            type: "market",
            targetId: market.market_id,
            targetName: market.market_name || "",
            state: market.state || "",
            lastUpdated: latestPrice?.validated_at?.toISOString() || "",
            addedAt: "",
          });
        }
      }
    }
    
    // Get item details if requested
    if (type === "all" || type === "items") {
      for (const itemName of favoriteItems) {
        const item = await prisma.items_Catalog.findFirst({
          where: { item_name: itemName },
        });
        
        if (item) {
          // Get latest price for this item
          const latestPrice = await prisma.approved_Prices.findFirst({
            where: {
              item_id: item.item_id,
              validation_status: "APPROVED",
            },
            orderBy: { validated_at: "desc" },
          });
          
          // Get category name
          const category = item.category_id 
            ? await prisma.categories.findFirst({ where: { category_id: item.category_id } })
            : null;
          
          response.items.push({
            id: item.item_id,
            type: "item",
            targetId: item.item_id,
            targetName: item.item_name || "",
            category: category?.category_name || "",
            currentPrice: latestPrice ? Number(latestPrice.price) : undefined,
            trend: latestPrice?.price_trend || undefined,
            priceChangePercent: latestPrice ? Number(latestPrice.price_change_percent) : undefined,
            lastUpdated: latestPrice?.validated_at?.toISOString() || "",
            addedAt: "",
          });
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      data: response,
      meta: {
        consumerId: consumer.consumer_id,
        tier: actualTier,
        generatedAt: new Date().toISOString(),
      },
    });
    
  } catch (error) {
    console.error("[Watchlist GET Error]", error);
    return NextResponse.json({
      success: false,
      error: "server_error",
      message: "Failed to fetch watchlist",
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, consumerId, type, targetName, targetId } = body;
    
    if (!phone && !consumerId) {
      return NextResponse.json({
        success: false,
        error: "missing_parameter",
        message: "Phone number or consumerId is required",
      }, { status: 400 });
    }
    
    if (!type || !["market", "item"].includes(type)) {
      return NextResponse.json({
        success: false,
        error: "invalid_type",
        message: "Type must be 'market' or 'item'",
      }, { status: 400 });
    }
    
    if (!targetName && !targetId) {
      return NextResponse.json({
        success: false,
        error: "missing_parameter",
        message: "targetName or targetId is required",
      }, { status: 400 });
    }
    
    // Get consumer record
    const consumer = await prisma.consumers.findFirst({
      where: {
        OR: [
          ...(phone ? [{ phone_number: phone }] : []),
          ...(consumerId ? [{ consumer_id: consumerId }] : []),
        ],
      },
    });
    
    if (!consumer) {
      return NextResponse.json({
        success: false,
        error: "consumer_not_found",
        message: "Consumer not found",
      }, { status: 404 });
    }
    
    // Get limits
    const tier = consumer.subscription_tier?.toUpperCase() || "FREE";
    const limits = WATCHLIST_LIMITS[tier] || WATCHLIST_LIMITS.FREE;
    
    // Check if allowed
    const limitKey = type === "market" ? "markets" : "items";
    const currentList = type === "market"
      ? parseWatchlist(consumer.favorite_markets as string)
      : parseWatchlist(consumer.favorite_items as string);
    
    const limit = limits[limitKey];
    
    if (limit === 0) {
      return NextResponse.json({
        success: false,
        error: "tier_limit",
        message: `Your ${tier} tier doesn't allow favorite ${type}s. Upgrade to SILVER or higher.`,
        requiredTier: "SILVER",
      }, { status: 403 });
    }
    
    if (limit > 0 && currentList.length >= limit) {
      return NextResponse.json({
        success: false,
        error: "limit_reached",
        message: `You've reached your limit of ${limit} favorite ${type}s. Remove one first or upgrade your plan.`,
        current: currentList.length,
        limit,
      }, { status: 403 });
    }
    
    // Verify target exists
    let finalTargetName = targetName;
    
    if (type === "market") {
      const market = await prisma.markets.findFirst({
        where: {
          OR: [
            ...(targetId ? [{ market_id: targetId }] : []),
            ...(targetName ? [{ market_name: targetName }] : []),
          ],
        },
      });
      
      if (!market) {
        return NextResponse.json({
          success: false,
          error: "market_not_found",
          message: `Market "${targetName || targetId}" not found`,
        }, { status: 404 });
      }
      
      finalTargetName = market.market_name;
    } else {
      const item = await prisma.items_Catalog.findFirst({
        where: {
          OR: [
            ...(targetId ? [{ item_id: targetId }] : []),
            ...(targetName ? [{ item_name: targetName }] : []),
          ],
        },
      });
      
      if (!item) {
        return NextResponse.json({
          success: false,
          error: "item_not_found",
          message: `Item "${targetName || targetId}" not found`,
        }, { status: 404 });
      }
      
      finalTargetName = item.item_name;
    }
    
    // Check if already in list
    if (currentList.includes(finalTargetName)) {
      return NextResponse.json({
        success: false,
        error: "already_exists",
        message: `${finalTargetName} is already in your favorites`,
      }, { status: 409 });
    }
    
    // Add to list
    currentList.push(finalTargetName);
    
    // Update consumer record
    const updateField = type === "market" ? "favorite_markets" : "favorite_items";
    
    await prisma.consumers.update({
      where: {
        consumer_id: consumer.consumer_id,
      },
      data: {
        [updateField]: JSON.stringify(currentList),
        updated_at: new Date(),
      },
    });
    
    return NextResponse.json({
      success: true,
      message: `${finalTargetName} added to favorites`,
      data: {
        type,
        targetName: finalTargetName,
        count: currentList.length,
        limit: limit < 0 ? "unlimited" : limit,
      },
    });
    
  } catch (error) {
    console.error("[Watchlist POST Error]", error);
    return NextResponse.json({
      success: false,
      error: "server_error",
      message: "Failed to add to watchlist",
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, consumerId, type, targetName } = body;
    
    if (!phone && !consumerId) {
      return NextResponse.json({
        success: false,
        error: "missing_parameter",
        message: "Phone number or consumerId is required",
      }, { status: 400 });
    }
    
    if (!type || !["market", "item"].includes(type)) {
      return NextResponse.json({
        success: false,
        error: "invalid_type",
        message: "Type must be 'market' or 'item'",
      }, { status: 400 });
    }
    
    if (!targetName) {
      return NextResponse.json({
        success: false,
        error: "missing_parameter",
        message: "targetName is required",
      }, { status: 400 });
    }
    
    // Get consumer record
    const consumer = await prisma.consumers.findFirst({
      where: {
        OR: [
          ...(phone ? [{ phone_number: phone }] : []),
          ...(consumerId ? [{ consumer_id: consumerId }] : []),
        ],
      },
    });
    
    if (!consumer) {
      return NextResponse.json({
        success: false,
        error: "consumer_not_found",
        message: "Consumer not found",
      }, { status: 404 });
    }
    
    // Get current list
    const currentList = type === "market"
      ? parseWatchlist(consumer.favorite_markets as string)
      : parseWatchlist(consumer.favorite_items as string);
    
    // Find and remove
    const index = currentList.indexOf(targetName);
    
    if (index < 0) {
      return NextResponse.json({
        success: false,
        error: "not_found",
        message: `${targetName} is not in your favorites`,
      }, { status: 404 });
    }
    
    currentList.splice(index, 1);
    
    // Update consumer record
    const updateField = type === "market" ? "favorite_markets" : "favorite_items";
    
    await prisma.consumers.update({
      where: {
        consumer_id: consumer.consumer_id,
      },
      data: {
        [updateField]: JSON.stringify(currentList),
        updated_at: new Date(),
      },
    });
    
    return NextResponse.json({
      success: true,
      message: `${targetName} removed from favorites`,
      data: {
        type,
        targetName,
        count: currentList.length,
      },
    });
    
  } catch (error) {
    console.error("[Watchlist DELETE Error]", error);
    return NextResponse.json({
      success: false,
      error: "server_error",
      message: "Failed to remove from watchlist",
    }, { status: 500 });
  }
}
