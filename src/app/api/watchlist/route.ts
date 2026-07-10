// ============================================================================
// NAIJAMARKET INTEL - WATCHLIST / FAVORITES API
// File: src/app/api/watchlist/route.ts
// Bloomberg Equivalent: MOST <GO>
// Version: 3.0 - Repointed onto Consumer_Favorites (canonical, cross-surface)
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { addFavorite, removeFavorite, listFavorites } from "@/lib/favorites";

// ============================================================================
// TYPES
// ============================================================================

interface WatchlistLimits {
  markets: number;
  items: number;
  alerts: number;
}

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
// CONFIGURATION
// ============================================================================

const DEFAULT_LIMITS: WatchlistLimits = { markets: 0, items: 0, alerts: 0 };

const WATCHLIST_LIMITS: Record<string, WatchlistLimits> = {
  FREE: { markets: 0, items: 0, alerts: 0 },
  SILVER: { markets: 1, items: 3, alerts: 1 },
  GOLD: { markets: 3, items: 10, alerts: 5 },
  BUSINESS: { markets: 5, items: 20, alerts: 10 },
  CORPORATE: { markets: 7, items: 30, alerts: 15 },
  ENTERPRISE: { markets: -1, items: -1, alerts: -1 },
  OGA_BOSS: { markets: -1, items: -1, alerts: -1 },
  GOVERNMENT: { markets: -1, items: -1, alerts: -1 },
};

function getWatchlistLimits(tier: string): WatchlistLimits {
  const limits = WATCHLIST_LIMITS[tier];
  if (limits) return limits;
  const freeLimits = WATCHLIST_LIMITS["FREE"];
  if (freeLimits) return freeLimits;
  return DEFAULT_LIMITS;
}

// ============================================================================
// API ROUTE HANDLERS
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const session = await getServerSession(authOptions);
    const phone = (session?.user as any)?.phone;
    if (!phone) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const type = searchParams.get("type") || "all";
    const tier = (searchParams.get("tier") || "FREE").toUpperCase();

    // Get consumer record (session-derived phone, format-agnostic match).
    // Now only needs consumer_id + subscription_tier — favorites live in
    // Consumer_Favorites and are read via the canonical helper below.
    const rows = await prisma.$queryRaw<Array<{
      consumer_id: string;
      subscription_tier: string | null;
    }>>`
      SELECT TOP 1 consumer_id, subscription_tier
      FROM Consumers
      WHERE REPLACE(phone_number, '+', '') = REPLACE(${phone}, '+', '')
    `;
    const consumer = rows[0];

    if (!consumer) {
      return NextResponse.json({
        success: false,
        error: "consumer_not_found",
        message: "Consumer not found",
      }, { status: 404 });
    }

    // Get limits
    const actualTier = consumer.subscription_tier?.toUpperCase() || tier;
    const limits = getWatchlistLimits(actualTier);

    // Canonical favorites (identity only) from Consumer_Favorites
    const favs = await listFavorites({ phone });
    const marketFavs = favs.filter((f) => f.favorite_type === "market");
    const itemFavs = favs.filter((f) => f.favorite_type === "item");

    const response: WatchlistSummary = {
      markets: [],
      items: [],
      totalMarkets: marketFavs.length,
      totalItems: itemFavs.length,
      limits: {
        markets: limits.markets,
        items: limits.items,
      },
      canAddMarket: limits.markets < 0 || marketFavs.length < limits.markets,
      canAddItem: limits.items < 0 || itemFavs.length < limits.items,
    };

    // Get market details if requested
    if (type === "all" || type === "markets") {
      for (const fav of marketFavs) {
        if (!fav.market_id) continue;

        // Get latest price for this market
        const latestPrice = await prisma.approved_Prices.findFirst({
          where: {
            market_id: fav.market_id,
            validation_status: "APPROVED",
          },
          orderBy: { validated_at: "desc" },
        });

        response.markets.push({
          id: fav.market_id,
          type: "market",
          targetId: fav.market_id,
          targetName: fav.market_name || "",
          state: fav.state || "",
          lastUpdated: latestPrice?.validated_at?.toISOString() || "",
          addedAt: "",
        });
      }
    }

    // Get item details if requested
    if (type === "all" || type === "items") {
      for (const fav of itemFavs) {
        if (!fav.item_id) continue;

        // Get latest price for this item
        const latestPrice = await prisma.approved_Prices.findFirst({
          where: {
            item_id: fav.item_id,
            validation_status: "APPROVED",
          },
          orderBy: { validated_at: "desc" },
        });

        // Get category name
        const category = fav.category_id
          ? await prisma.categories.findFirst({ where: { category_id: fav.category_id } })
          : null;

        response.items.push({
          id: fav.item_id,
          type: "item",
          targetId: fav.item_id,
          targetName: fav.item_name || "",
          category: category?.category_name || "",
          currentPrice: latestPrice ? Number(latestPrice.price) : undefined,
          trend: latestPrice?.price_trend || undefined,
          priceChangePercent: latestPrice ? Number(latestPrice.price_change_percent) : undefined,
          lastUpdated: latestPrice?.validated_at?.toISOString() || "",
          addedAt: "",
        });
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
    const { type, targetName, targetId } = body;

    const session = await getServerSession(authOptions);
    const phone = (session?.user as any)?.phone;
    if (!phone) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    // Get consumer record for tier/limits (session-derived phone, format-agnostic match)
    const rows = await prisma.$queryRaw<Array<{
      consumer_id: string;
      subscription_tier: string | null;
    }>>`
      SELECT TOP 1 consumer_id, subscription_tier
      FROM Consumers
      WHERE REPLACE(phone_number, '+', '') = REPLACE(${phone}, '+', '')
    `;
    const consumer = rows[0];

    if (!consumer) {
      return NextResponse.json({
        success: false,
        error: "consumer_not_found",
        message: "Consumer not found",
      }, { status: 404 });
    }

    // Get limits
    const tier = consumer.subscription_tier?.toUpperCase() || "FREE";
    const limits = getWatchlistLimits(tier);
    const limitKey = type === "market" ? "markets" : "items";
    const limit = limits[limitKey];

    // Current count of this type (active favorites only)
    const favs = await listFavorites({ phone });
    const count = favs.filter((f) => f.favorite_type === type).length;

    if (limit === 0) {
      return NextResponse.json({
        success: false,
        error: "tier_limit",
        message: `Your ${tier} tier doesn't allow favorite ${type}s. Upgrade to SILVER or higher.`,
        requiredTier: "SILVER",
      }, { status: 403 });
    }

    if (limit > 0 && count >= limit) {
      return NextResponse.json({
        success: false,
        error: "limit_reached",
        message: `You've reached your limit of ${limit} favorite ${type}s. Remove one first or upgrade your plan.`,
        current: count,
        limit,
      }, { status: 403 });
    }

    // Add via canonical helper (id wins over name; resolves to catalog id,
    // enforces the one-ID invariant, idempotent over UX_ConsFav_Identity).
    const r = await addFavorite({ phone, type, name: targetName, id: targetId });

    if (r.reason === "unresolved") {
      return NextResponse.json({
        success: false,
        error: type === "market" ? "market_not_found" : "item_not_found",
        message: `${type === "market" ? "Market" : "Item"} "${targetName || targetId}" not found`,
      }, { status: 404 });
    }

    if (r.reason === "already_exists") {
      return NextResponse.json({
        success: false,
        error: "already_exists",
        message: `${r.resolved_name} is already in your favorites`,
      }, { status: 409 });
    }

    // r.reason === "added" — echo the canonical resolved name
    return NextResponse.json({
      success: true,
      message: `${r.resolved_name} added to favorites`,
      data: {
        type,
        targetName: r.resolved_name,
        count: count + 1,
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
    const { type, targetName } = body;

    const session = await getServerSession(authOptions);
    const phone = (session?.user as any)?.phone;
    if (!phone) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    // Get consumer record (session-derived phone, format-agnostic match).
    // Preserved for the consumer_not_found 404 gate (matches today).
    const rows = await prisma.$queryRaw<Array<{
      consumer_id: string;
    }>>`
      SELECT TOP 1 consumer_id
      FROM Consumers
      WHERE REPLACE(phone_number, '+', '') = REPLACE(${phone}, '+', '')
    `;
    const consumer = rows[0];

    if (!consumer) {
      return NextResponse.json({
        success: false,
        error: "consumer_not_found",
        message: "Consumer not found",
      }, { status: 404 });
    }

    // Remove via canonical helper (soft-delete: is_active = 0)
    const r = await removeFavorite({ phone, type, name: targetName });

    if (r.reason === "unresolved" || r.removed === 0) {
      return NextResponse.json({
        success: false,
        error: "not_found",
        message: `${r.resolved_name || targetName} is not in your favorites`,
      }, { status: 404 });
    }

    // Recompute remaining count of this type (active favorites only)
    const favs = await listFavorites({ phone });
    const count = favs.filter((f) => f.favorite_type === type).length;

    return NextResponse.json({
      success: true,
      message: `${r.resolved_name} removed from favorites`,
      data: {
        type,
        targetName: r.resolved_name,
        count,
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
