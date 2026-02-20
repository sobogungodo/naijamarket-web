// ============================================================================
// src/app/api/v1/stats/route.ts
// NaijaMarket Intel - Public API v1: Platform Statistics
// BUSINESS tier+ required
// GET /api/v1/stats
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { validateRequest, logUsage, apiResponse, corsHeaders } from "@/lib/api-middleware";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(request: NextRequest) {
  const result = await validateRequest(request, "/api/v1/stats");
  if (!result.ok) return result.response;
  const { ctx } = result;

  try {
    // Platform stats
    const stats = await prisma.$queryRaw`
      SELECT
        (SELECT COUNT(*) FROM Markets) AS total_markets,
        (SELECT COUNT(*) FROM Items_Catalog) AS total_items,
        (SELECT COUNT(*) FROM Categories) AS total_categories,
        (SELECT COUNT(*) FROM Daily_Prices WHERE price_date = CAST(GETDATE() AS DATE)) AS prices_today,
        (SELECT COUNT(*) FROM Daily_Prices WHERE price_date >= DATEADD(day, -7, CAST(GETDATE() AS DATE))) AS prices_7d,
        (SELECT COUNT(*) FROM Daily_Prices) AS total_prices,
        (SELECT COUNT(DISTINCT state) FROM Markets) AS states_covered,
        (SELECT MAX(price_date) FROM Daily_Prices) AS latest_data_date,
        (SELECT MIN(price_date) FROM Daily_Prices) AS earliest_data_date
    ` as any[];

    // Top gainers today
    const gainers = await prisma.$queryRaw`
      SELECT TOP 5
        item_name, market_name, state,
        price_naira AS price, price_change_pct AS change_pct
      FROM Daily_Prices
      WHERE price_date = CAST(GETDATE() AS DATE)
        AND price_change_pct > 0 AND price_naira > 0
      ORDER BY price_change_pct DESC
    ` as any[];

    // Top losers today
    const losers = await prisma.$queryRaw`
      SELECT TOP 5
        item_name, market_name, state,
        price_naira AS price, price_change_pct AS change_pct
      FROM Daily_Prices
      WHERE price_date = CAST(GETDATE() AS DATE)
        AND price_change_pct < 0 AND price_naira > 0
      ORDER BY price_change_pct ASC
    ` as any[];

    const s = stats[0] || {};

    await logUsage(ctx.keyInfo.key_id, "/api/v1/stats", "GET", 200, Date.now() - ctx.startTime, request);

    return apiResponse(
      {
        platform: {
          markets: parseInt(s.total_markets || "0"),
          items: parseInt(s.total_items || "0"),
          categories: parseInt(s.total_categories || "0"),
          states: parseInt(s.states_covered || "0"),
          total_price_records: parseInt(s.total_prices || "0"),
          data_range: {
            from: s.earliest_data_date,
            to: s.latest_data_date,
          },
        },
        today: {
          prices_generated: parseInt(s.prices_today || "0"),
          prices_7d: parseInt(s.prices_7d || "0"),
          top_gainers: gainers.map((g: any) => ({
            item: g.item_name, market: g.market_name, state: g.state,
            price: parseFloat(g.price), change_pct: parseFloat(g.change_pct),
          })),
          top_losers: losers.map((l: any) => ({
            item: l.item_name, market: l.market_name, state: l.state,
            price: parseFloat(l.price), change_pct: parseFloat(l.change_pct),
          })),
        },
      },
      ctx,
      { endpoint: "stats" }
    );
  } catch (e: any) {
    await logUsage(ctx.keyInfo.key_id, "/api/v1/stats", "GET", 500, Date.now() - ctx.startTime, request);
    return NextResponse.json({ error: "server_error", message: e.message }, { status: 500, headers: corsHeaders() });
  }
}

export const dynamic = "force-dynamic";
