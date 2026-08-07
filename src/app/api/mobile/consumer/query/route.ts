// src/app/api/mobile/consumer/query/route.ts
// NaijaMarket Intel — Consumer mobile query gate (Bearer JWT auth).
// The app calls this BEFORE each price search. Shares the single source of
// truth with the web gate: FREE = Consumers.queries_remaining (3/week), paid
// tiers = daily Query_Log counts. Gate-time check + log (Option A) — self-
// contained, no post-success app call required.

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { checkQuery, logQuery } from "@/lib/query-gate";

export const dynamic = "force-dynamic";

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

export async function POST(request: NextRequest) {
  const consumer = await verifyConsumer(request);
  if (!consumer?.consumer_id) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const tier = consumer.subscription_tier || "FREE";
  const gate = await checkQuery(consumer.consumer_id, tier);

  // Body-tolerant: old/staged clients POST no body, so parse defensively. When the
  // client DOES send the searched item, log it as meta so mobile Query_Log rows
  // carry item_name (parity with web). Empty/absent item -> undefined meta ->
  // writes blank exactly as before (no regression during staged Play rollout).
  const body = await request.json().catch(() => ({} as any));
  const item = typeof body?.item === "string" ? body.item.trim() : "";
  const market = typeof body?.market === "string" ? body.market.trim() : "";

  // Count this query across ALL tiers (paid daily caps + Query_Log row).
  // Only when allowed; best-effort (never throws). Gate-time to match web.
  if (gate.allowed) {
    await logQuery(
      consumer.consumer_id,
      tier,
      "MOBILE",
      item ? { item_name: item, market_name: market || undefined } : undefined
    );
  }

  return NextResponse.json(
    {
      success: true,
      allowed: gate.allowed,
      remaining: gate.allowed && gate.remaining >= 0 ? Math.max(0, gate.remaining - 1) : gate.remaining,
      ...(gate.allowed ? {} : { upsell: gate.upsell, upgrade_url: "/subscribe" }),
    },
    {
      status: gate.allowed ? 200 : 429,
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}
