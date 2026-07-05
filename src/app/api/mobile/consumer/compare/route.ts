// src/app/api/mobile/consumer/compare/route.ts
// NaijaMarket Intel — Consumer mobile compare (one item across markets, cheapest first)
// Additive route. Does NOT touch the PWA's /api/arbitrage.

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";

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

const esc = (s: string) => s.replace(/'/g, "''");

export async function GET(request: NextRequest) {
  const consumer = await verifyConsumer(request);
  if (!consumer?.consumer_id)
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const item = (sp.get("item") || "").trim();
  const state = (sp.get("state") || "").trim();
  if (item.length < 2)
    return NextResponse.json({ success: false, error: "item (min 2 chars) required" }, { status: 400 });

  try {
    let where =
      `WHERE item_name LIKE '%${esc(item)}%' AND is_nbs_ref = 0 AND is_food = 1 ` +
      `AND item_id NOT LIKE 'NBS[_]%' AND price_naira > 0`;
    if (state) where += ` AND state LIKE '%${esc(state)}%'`;

    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT TOP 100
        item_name, unit, market_name, market_id, state,
        CAST(price_naira AS FLOAT) AS price_naira, trend,
        CAST(price_change_pct AS FLOAT) AS price_change_pct, last_updated
      FROM Latest_Prices_Summary WITH (NOLOCK)
      ${where}
      ORDER BY price_naira ASC
    `);

    const data = rows.map((r) => ({
      market_name: r.market_name,
      market_id: r.market_id,
      state: r.state,
      price_naira: Number(r.price_naira) || 0,
      trend: r.trend || "stable",
      price_change_pct: Number(r.price_change_pct) || 0,
      last_updated: r.last_updated,
    }));

    return NextResponse.json({
      success: true,
      item_name: rows[0]?.item_name || item,
      unit: rows[0]?.unit || "",
      data,
    });
  } catch (e: any) {
    console.error("[mobile/consumer/compare]", e);
    return NextResponse.json({ success: false, error: "Failed to compare prices" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
