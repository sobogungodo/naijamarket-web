// src/app/api/mobile/consumer/basket/route.ts
// NaijaMarket Intel — Consumer mobile basket (Bearer JWT auth).
// Additive route for the consumer RN app. Thin wrapper over the canonical
// lib/basket.ts helper (live-proven on web + WA). Same Consumer_Basket table,
// naked-phone key, upsert-increment, set-once price, soft-delete. Identity
// comes from the token, never the body.
//
// Auth is copied BYTE-VERBATIM from mobile/consumer/favorites/route.ts (which
// itself copied it from prices/recent-searches). That inline duplication is a
// known, tracked debt (an 8-copy consolidation is a separate refactor) — this
// route makes it the 9th copy on purpose, per the build decision.
//
// Behaviour, status codes and messages mirror the web route
// (/api/consumer/basket): 404 "unknown item", 404 "no active line for item_id",
// bare-DELETE 400 "item_id or all=1 required", etc. Every response carries the
// favorites envelope: errors { success:false, error }, success adds success:true
// beside the web payload.
//
// GET                                 -> list basket lines (identity only)
// POST   { item_id, quantity? }       -> add / increment (tier-capped, POST only)
// PATCH  { item_id, quantity }        -> set quantity (<=0 soft-deletes the line)
// DELETE ?item_id=X | ?all=1          -> remove one line / clear the basket

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import {
  listBasket,
  addToBasket,
  setQuantity,
  removeFromBasket,
  clearBasket,
  BASKET_TIER_LIMITS,
} from "@/lib/basket";

export const runtime = "nodejs";
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
// GET — list basket lines (identity + live price movement, from the helper)
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const auth = await requireConsumer(request);
  if ("response" in auth) return auth.response;
  const { phone } = auth;

  try {
    const items = await listBasket({ phone });
    return NextResponse.json({ success: true, items });
  } catch (e) {
    console.error("[mobile basket GET]", e);
    return NextResponse.json({ success: false, error: "internal error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — add / increment. Tier cap (B) applies HERE ONLY: a new item is
// rejected once the caller is at BASKET_TIER_LIMITS[tier]; incrementing an item
// already in the basket is NOT a new line and is always allowed.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const auth = await requireConsumer(request);
  if ("response" in auth) return auth.response;
  const { phone, tier } = auth;

  try {
    let body: { item_id?: unknown; quantity?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "invalid json" }, { status: 400 });
    }

    const item_id = typeof body.item_id === "string" ? body.item_id.trim() : "";
    if (!item_id) return NextResponse.json({ success: false, error: "item_id required" }, { status: 400 });

    const qRaw = Number(body.quantity ?? 1);
    const quantity = Number.isFinite(qRaw) && qRaw > 0 ? Math.floor(qRaw) : 1;

    // Validate item_id against the consumer-visible catalog and derive name/unit
    // server-side — never trust client name/unit (currentPriceFor keys price on name).
    const rows = await prisma.$queryRaw<Array<{ item_id: string; item_name: string; unit: string | null }>>`
      SELECT TOP 1 item_id, item_name, unit
      FROM Latest_Prices_Summary
      WHERE item_id = ${item_id}
        AND is_nbs_ref = 0 AND is_food = 1 AND price_naira > 0
    `;
    const row = rows[0];
    if (!row) return NextResponse.json({ success: false, error: "unknown item" }, { status: 404 });

    // Cap: count active lines; reject a NEW item at the tier limit. An increment
    // of an item already present is not a new line — let it through. tier comes
    // from requireConsumer (no extra query). Numbers are BASKET_TIER_LIMITS.
    const lines = await listBasket({ phone });
    const alreadyPresent = lines.some((l) => l.item_id === row.item_id);
    const limit = BASKET_TIER_LIMITS[tier] ?? BASKET_TIER_LIMITS.FREE;
    if (!alreadyPresent && lines.length >= limit) {
      return NextResponse.json(
        {
          success: false,
          error: `Maximum ${limit} items allowed for ${tier} tier`,
          limit_reached: true,
          current_count: lines.length,
          limit,
        },
        { status: 403 }
      );
    }

    const result = await addToBasket({
      phone,
      item_id: row.item_id,
      item_name: row.item_name,
      unit: row.unit,
      quantity,
    });

    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (e) {
    console.error("[mobile basket POST]", e);
    return NextResponse.json({ success: false, error: "internal error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH — set quantity (web +/- controls). quantity <= 0 soft-deletes the line.
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest) {
  const auth = await requireConsumer(request);
  if ("response" in auth) return auth.response;
  const { phone } = auth;

  try {
    let body: { item_id?: unknown; quantity?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "invalid json" }, { status: 400 });
    }

    const item_id = typeof body.item_id === "string" ? body.item_id.trim() : "";
    if (!item_id) return NextResponse.json({ success: false, error: "item_id required" }, { status: 400 });

    const qRaw = Number(body.quantity);
    if (!Number.isFinite(qRaw))
      return NextResponse.json({ success: false, error: "quantity required" }, { status: 400 });

    // quantity <= 0 soft-deletes the line (basket.ts semantics) — intentional.
    const result = await setQuantity({ phone, item_id, quantity: Math.floor(qRaw) });
    if (!result.ok)
      return NextResponse.json({ success: false, error: "no active line for item_id" }, { status: 404 });
    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (e) {
    console.error("[mobile basket PATCH]", e);
    return NextResponse.json({ success: false, error: "internal error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE — ?item_id=X removes one line; ?all=1 clears the basket. Bare DELETE
// is rejected — clearing is destructive and must be explicit.
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  const auth = await requireConsumer(request);
  if ("response" in auth) return auth.response;
  const { phone } = auth;

  try {
    const item_id = (request.nextUrl.searchParams.get("item_id") || "").trim();
    const all = request.nextUrl.searchParams.get("all") === "1";

    if (!item_id && !all) {
      return NextResponse.json({ success: false, error: "item_id or all=1 required" }, { status: 400 });
    }

    if (!item_id) {
      const result = await clearBasket({ phone });
      return NextResponse.json({ success: true, ...result }, { status: 200 });
    }

    const result = await removeFromBasket({ phone, item_id });
    // removeFromBasket returns ok:true always — `removed` is the real signal.
    if (result.removed === 0)
      return NextResponse.json({ success: false, error: "no active line for item_id" }, { status: 404 });
    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (e) {
    console.error("[mobile basket DELETE]", e);
    return NextResponse.json({ success: false, error: "internal error" }, { status: 500 });
  }
}
