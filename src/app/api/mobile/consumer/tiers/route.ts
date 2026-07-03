// src/app/api/mobile/consumer/tiers/route.ts
// Mobile subscription tiers for the consumer app's native /plans picker.
// Under /api/mobile → middleware-exempt (no NextAuth cookie needed); we verify
// the consumer Bearer JWT ourselves, matching the query-gate. Tier data is read
// from dbo.Subscription_Tiers (canonical — same source the WA engine + gate use).

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function verifyConsumer(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const secret = process.env.CONSUMER_JWT_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(auth.slice(7), new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!(await verifyConsumer(req))) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    const rows = (await prisma.$queryRaw`
      SELECT tier_id, tier_name, price_ngn, billing_cycle, query_limit, query_period, max_markets, tier_rank
      FROM dbo.Subscription_Tiers
      WHERE status = 'active'
    `) as Array<{
      tier_id: string; tier_name: string; price_ngn: number | string;
      billing_cycle: string | null; query_limit: number | string | null;
      query_period: string | null; max_markets: number | string | null;
    }>;

    const tiers = rows
      // Hide the B2B API_* products from the consumer picker; keep FREE (shown as current).
      .filter((r) => !String(r.tier_id).toUpperCase().startsWith("API_"))
      .map((r) => {
        const price = Number(r.price_ngn) || 0;
        const limit = Number(r.query_limit);
        const bc = String(r.billing_cycle || "monthly").toLowerCase();
        return {
          code: r.tier_id,
          name: r.tier_name,
          price,
          priceFormatted: price === 0 ? "Free" : `₦${price.toLocaleString()}`,
          billing: bc === "forever" ? "Forever" : bc === "weekly" ? "Per week" : "Per month",
          queryLimit: limit === -1 ? null : limit,
          queryPeriod: String(r.query_period || "DAY").toUpperCase(),
          maxMarkets: Number(r.max_markets) || 3,
        };
      })
      .sort((a, b) => a.price - b.price);

    return NextResponse.json(
      { success: true, tiers },
      { headers: { "Cache-Control": "private, max-age=300" } }
    );
  } catch (error: any) {
    console.error("[mobile/consumer/tiers]", error?.message);
    return NextResponse.json({ success: false, error: "Failed to load tiers" }, { status: 500 });
  }
}
