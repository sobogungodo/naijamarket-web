// src/app/api/mobile/consumer/prices/route.ts
// NaijaMarket Intel — Consumer mobile prices feed (Bearer JWT auth)
// Additive route for the consumer app. Does NOT touch the PWA's /api/prices.

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";

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

const esc = (s: string) => s.replace(/'/g, "''");

export async function GET(request: NextRequest) {
  const consumer = await verifyConsumer(request);
  if (!consumer?.consumer_id)
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });

  try {
    const sp = request.nextUrl.searchParams;
    const item = (sp.get("item") || "").trim();
    const state = (sp.get("state") || "").trim();
    const marketId = (sp.get("market_id") || "").trim();
    const limit = Math.min(parseInt(sp.get("limit") || "20") || 20, 50);

    let where =
      "WHERE is_nbs_ref = 0 AND is_food = 1 AND item_id NOT LIKE 'NBS[_]%' AND price_naira > 0";
    if (item) where += ` AND item_name LIKE '%${esc(item)}%'`;
    if (state) where += ` AND state LIKE '%${esc(state)}%'`;
    if (marketId) where += ` AND market_id = '${esc(marketId)}'`;

    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT TOP ${limit}
        item_id, item_name, market_name, market_id, state,
        CAST(price_naira AS FLOAT) AS price_naira, unit, trend,
        CAST(price_change_pct AS FLOAT) AS price_change_pct,
        CAST(week_high AS FLOAT) AS week_high,
        CAST(week_low AS FLOAT) AS week_low,
        CAST(confidence_score AS FLOAT) AS confidence_score,
        last_updated
      FROM Latest_Prices_Summary WITH (NOLOCK)
      ${where}
      ORDER BY last_updated DESC
    `);

    const data = rows.map((r) => ({
      item_id: r.item_id,
      item_name: r.item_name,
      market_name: r.market_name,
      market_id: r.market_id,
      state: r.state,
      price_naira: Number(r.price_naira) || 0,
      unit: r.unit || "",
      trend: r.trend || "stable",
      price_change_pct: Number(r.price_change_pct) || 0,
      week_high: Number(r.week_high) || 0,
      week_low: Number(r.week_low) || 0,
      confidence_score: Number(r.confidence_score) || 0,
      last_updated: r.last_updated,
    }));

    return NextResponse.json({ success: true, data, total: data.length });
  } catch (e: any) {
    console.error("[mobile/consumer/prices]", e);
    return NextResponse.json({ success: false, error: "Failed to fetch prices" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
