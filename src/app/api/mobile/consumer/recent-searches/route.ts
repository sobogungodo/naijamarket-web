// src/app/api/mobile/consumer/recent-searches/route.ts
// NaijaMarket Intel — Consumer mobile recent-searches (Bearer JWT auth).
// Returns the caller's cross-surface search history (WEB + MOBILE + WhatsApp),
// deduped to one entry per item with the surfaces it appeared on. Read-only:
// no gate, no write, no counter change. Identity is server-derived from the JWT
// (never a client body), matching the /query gate exactly.

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getRecentSearches } from "@/lib/recent-searches";

export const dynamic = "force-dynamic";

// Copied verbatim from mobile/consumer/query/route.ts so identity derivation
// cannot drift from the proven gate. Fail-closed: unset secret => 401.
async function verifyConsumer(request: NextRequest) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const secret = process.env.CONSUMER_JWT_SECRET;
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(auth.slice(7), new TextEncoder().encode(secret));
    return payload as { consumer_id?: string; phone_number?: string; subscription_tier?: string };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const consumer = await verifyConsumer(request);
  if (!consumer?.consumer_id) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const searches = await getRecentSearches(consumer.consumer_id);

  return NextResponse.json(
    { success: true, searches },
    { status: 200, headers: { "Cache-Control": "private, no-store" } }
  );
}
