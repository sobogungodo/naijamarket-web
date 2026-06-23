// src/app/api/mobile/consumer/query/route.ts
// NaijaMarket Intel — Consumer mobile query gate (Bearer JWT auth).
// The app calls this BEFORE each price search. Shares the single source of
// truth (Consumers.queries_remaining) with the web gate via checkAndDecrementQuery.

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { checkAndDecrementQuery } from "@/lib/query-gate";

export const dynamic = "force-dynamic";

const SECRET = new TextEncoder().encode(
  process.env.CONSUMER_JWT_SECRET || "NaijaMarketConsumer2026SecureJWT!X#$"
);

async function verifyConsumer(request: NextRequest) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  try {
    const { payload } = await jwtVerify(auth.slice(7), SECRET);
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

  const gate = await checkAndDecrementQuery(
    consumer.consumer_id,
    consumer.subscription_tier || "FREE"
  );

  return NextResponse.json(
    {
      success: true,
      allowed: gate.allowed,
      remaining: gate.remaining,
      ...(gate.allowed ? {} : { upsell: gate.upsell, upgrade_url: "/subscribe" }),
    },
    {
      status: gate.allowed ? 200 : 429,
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}
