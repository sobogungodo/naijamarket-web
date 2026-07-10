// src/app/api/mobile/consumer/favorites/route.ts
// NaijaMarket Intel — Consumer mobile favorites (Bearer JWT auth).
// Additive route for the consumer app. Thin wrapper over the canonical
// lib/favorites.ts helper (live-proven on web + WA). Same Consumer_Favorites
// table, naked-phone key, resolve->id, one-ID-XOR, soft-delete. Identity comes
// from the token, never the body.
//
// GET                          -> list favorites (identity only; prices deferred)
// POST   { type, name?, id? }  -> add    (tier-gated, cross-surface count)
// DELETE { type, name?, id? }  -> remove (soft-delete)

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { addFavorite, removeFavorite, listFavorites } from "@/lib/favorites";

export const dynamic = "force-dynamic";

// Inline Bearer auth — copied verbatim from the other mobile/consumer routes
// (prices/recent-searches). NOT extracted to a shared lib in this change; that
// 8-copy consolidation is a separate refactor.
async function verifyConsumer(request: NextRequest) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  // Fail-closed: no hardcoded fallback secret — unset env means 401.
  const secret = process.env.CONSUMER_JWT_SECRET;
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(auth.slice(7), new TextEncoder().encode(secret));
    return payload as { consumer_id?: string; phone_number?: string; subscription_tier?: string };
  } catch {
    return null;
  }
}

// Tier limits — same values as the web watchlist POST (WATCHLIST_LIMITS).
// Duplicated here for v1; candidate for extraction to a shared lib (like
// @/lib/alertLimits) alongside the web route.
const WATCHLIST_LIMITS: Record<string, { markets: number; items: number }> = {
  FREE: { markets: 0, items: 0 },
  SILVER: { markets: 1, items: 3 },
  GOLD: { markets: 3, items: 10 },
  BUSINESS: { markets: 5, items: 20 },
  CORPORATE: { markets: 7, items: 30 },
  ENTERPRISE: { markets: -1, items: -1 },
  OGA_BOSS: { markets: -1, items: -1 },
  GOVERNMENT: { markets: -1, items: -1 },
};

// Auth + authoritative identity. Mirrors the alerts route: tier + phone come
// from the Consumers row (token claims can be stale/empty), token phone is a
// last resort. Phone is passed to the helper as-is — the helper forces naked.
async function requireConsumer(
  request: NextRequest
): Promise<{ consumer_id: string; phone: string; tier: string } | { response: NextResponse }> {
  const c = await verifyConsumer(request);
  if (!c?.consumer_id)
    return { response: NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 }) };

  const rows = (await prisma.$queryRaw`
    SELECT subscription_tier, phone, phone_number FROM Consumers WHERE consumer_id = ${c.consumer_id}
  `) as Array<{ subscription_tier: string | null; phone: string | null; phone_number: string | null }>;
  const row = rows[0];

  const phone = String(row?.phone_number || row?.phone || c.phone_number || "");
  const tier = (row?.subscription_tier || c.subscription_tier || "FREE").toUpperCase();

  if (!phone)
    return {
      response: NextResponse.json(
        { success: false, error: "A phone number is required. Update your profile." },
        { status: 400 }
      ),
    };
  return { consumer_id: c.consumer_id, phone, tier };
}

// ---------------------------------------------------------------------------
// GET — list favorites (identity only; the screen hydrates prices via /prices)
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const auth = await requireConsumer(request);
  if ("response" in auth) return auth.response;
  const { phone, tier } = auth;

  try {
    const favs = await listFavorites({ phone });
    const markets = favs
      .filter((f) => f.favorite_type === "market")
      .map((f) => ({
        favorite_id: f.favorite_id,
        type: "market" as const,
        id: f.market_id,
        name: f.market_name,
        state: f.state,
      }));
    const items = favs
      .filter((f) => f.favorite_type === "item")
      .map((f) => ({
        favorite_id: f.favorite_id,
        type: "item" as const,
        id: f.item_id,
        name: f.item_name,
        category_id: f.category_id,
      }));

    const limits = WATCHLIST_LIMITS[tier] ?? { markets: 0, items: 0 };
    return NextResponse.json({
      success: true,
      data: { markets, items },
      total: favs.length,
      tier,
      limits,
    });
  } catch (e) {
    console.error("[mobile favorites GET]", e);
    return NextResponse.json({ success: false, error: "Failed to fetch favorites" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — add favorite (accepts name or id; tier-gated)
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const auth = await requireConsumer(request);
  if ("response" in auth) return auth.response;
  const { phone, tier } = auth;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      type?: string;
      name?: string;
      id?: string;
    };
    const { type, name, id } = body;

    if (type !== "market" && type !== "item")
      return NextResponse.json({ success: false, error: "type must be 'market' or 'item'" }, { status: 400 });
    if (!name && !id)
      return NextResponse.json({ success: false, error: "name or id is required" }, { status: 400 });

    // Tier gate — same limits as web watchlist POST; count is cross-surface
    // (listFavorites reads the shared Consumer_Favorites, naked-phone keyed).
    const limits = WATCHLIST_LIMITS[tier] ?? { markets: 0, items: 0 };
    const limit = type === "market" ? limits.markets : limits.items;
    const existing = await listFavorites({ phone });
    const count = existing.filter((f) => f.favorite_type === type).length;

    if (limit === 0)
      return NextResponse.json(
        {
          success: false,
          error: `Favorite ${type}s are not available on the ${tier} plan. Upgrade to SILVER or higher.`,
          upgrade_required: true,
          current_tier: tier,
          required_tier: "SILVER",
        },
        { status: 403 }
      );
    if (limit !== -1 && count >= limit)
      return NextResponse.json(
        {
          success: false,
          error: `Favorite ${type} limit reached (${count}/${limit}). Remove one or upgrade your plan.`,
          limit_reached: true,
          current_count: count,
          limit,
        },
        { status: 403 }
      );

    const r = await addFavorite({ phone, type, name, id });

    if (r.reason === "unresolved")
      return NextResponse.json(
        { success: false, error: "not_found", message: `${type} "${name || id}" not found` },
        { status: 404 }
      );
    if (r.reason === "already_exists")
      return NextResponse.json(
        { success: false, error: "already_exists", message: `${r.resolved_name} is already in your favorites` },
        { status: 409 }
      );

    return NextResponse.json({
      success: true,
      data: { type, resolved_name: r.resolved_name, count: count + 1, limit },
    });
  } catch (e) {
    console.error("[mobile favorites POST]", e);
    return NextResponse.json({ success: false, error: "Failed to add favorite" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE — remove favorite (soft-delete via the helper)
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  const auth = await requireConsumer(request);
  if ("response" in auth) return auth.response;
  const { phone } = auth;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      type?: string;
      name?: string;
      id?: string;
    };
    const { type, name, id } = body;

    if (type !== "market" && type !== "item")
      return NextResponse.json({ success: false, error: "type must be 'market' or 'item'" }, { status: 400 });
    if (!name && !id)
      return NextResponse.json({ success: false, error: "name or id is required" }, { status: 400 });

    const r = await removeFavorite({ phone, type, name, id });

    if (r.reason === "unresolved" || r.removed === 0)
      return NextResponse.json(
        { success: false, error: "not_found", message: `${r.resolved_name || name || id} is not in your favorites` },
        { status: 404 }
      );

    return NextResponse.json({
      success: true,
      data: { type, resolved_name: r.resolved_name, removed: r.removed },
    });
  } catch (e) {
    console.error("[mobile favorites DELETE]", e);
    return NextResponse.json({ success: false, error: "Failed to remove favorite" }, { status: 500 });
  }
}
