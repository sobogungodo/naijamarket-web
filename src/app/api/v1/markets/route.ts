// ============================================================================
// src/app/api/v1/markets/route.ts
// NaijaMarket Intel - Public API v1: Markets
// GET /api/v1/markets?state=lagos&include_stats=true
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
  const result = await validateRequest(request, "/api/v1/markets");
  if (!result.ok) return result.response;
  const { ctx } = result;

  try {
    const sp = request.nextUrl.searchParams;
    const state = sp.get("state") || "";
    const includeStats = sp.get("include_stats") === "true";

    let where = "WHERE 1=1";
    if (state) where += ` AND m.state LIKE '%${state.replace(/'/g, "''")}%'`;

    let query: string;

    if (includeStats) {
      query = `
        SELECT
          m.market_id, m.market_name, m.state,
          m.latitude, m.longitude, m.radius_meters,
          m.opening_hours, m.status,
          COUNT(DISTINCT dp.item_name) AS items_tracked,
          COUNT(dp.price_id) AS total_prices_30d,
          MAX(dp.price_date) AS latest_price_date
        FROM Markets m
        LEFT JOIN Daily_Prices dp ON m.market_name = dp.market_name
          AND dp.price_date >= DATEADD(day, -30, CAST(GETDATE() AS DATE))
        ${where}
        GROUP BY m.market_id, m.market_name, m.state,
                 m.latitude, m.longitude, m.radius_meters,
                 m.opening_hours, m.status
        ORDER BY m.state, m.market_name
      `;
    } else {
      query = `
        SELECT market_id, market_name, state,
               latitude, longitude, radius_meters,
               opening_hours, status
        FROM Markets m
        ${where}
        ORDER BY state, market_name
      `;
    }

    const markets = await prisma.$queryRawUnsafe(query) as any[];

    await logUsage(ctx.keyInfo.key_id, "/api/v1/markets", "GET", 200, Date.now() - ctx.startTime, request);

    return apiResponse(
      {
        data: markets.map((m: any) => ({
          id: m.market_id,
          name: m.market_name,
          state: m.state,
          location: { lat: m.latitude ? parseFloat(m.latitude) : null, lng: m.longitude ? parseFloat(m.longitude) : null },
          radius_meters: m.radius_meters,
          hours: m.opening_hours,
          status: m.status,
          ...(includeStats ? {
            stats: {
              items_tracked: parseInt(m.items_tracked || "0"),
              prices_30d: parseInt(m.total_prices_30d || "0"),
              latest_date: m.latest_price_date,
            },
          } : {}),
        })),
        count: markets.length,
      },
      ctx,
      { endpoint: "markets" }
    );
  } catch (e: any) {
    await logUsage(ctx.keyInfo.key_id, "/api/v1/markets", "GET", 500, Date.now() - ctx.startTime, request);
    return NextResponse.json({ error: "server_error", message: e.message }, { status: 500, headers: corsHeaders() });
  }
}

export const dynamic = "force-dynamic";
