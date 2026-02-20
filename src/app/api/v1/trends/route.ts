// ============================================================================
// src/app/api/v1/trends/route.ts
// NaijaMarket Intel - Public API v1: Price Trends
// STARTER tier+ required
// GET /api/v1/trends?item=rice&market=mile+12&days=30
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
  const result = await validateRequest(request, "/api/v1/trends");
  if (!result.ok) return result.response;
  const { ctx } = result;

  try {
    const sp = request.nextUrl.searchParams;
    const item = sp.get("item") || "";
    const market = sp.get("market") || "";
    const state = sp.get("state") || "";
    const days = Math.min(parseInt(sp.get("days") || "30"), 90);

    if (!item) {
      return NextResponse.json(
        { error: "missing_parameter", message: "The 'item' parameter is required. Example: ?item=rice" },
        { status: 400, headers: corsHeaders() }
      );
    }

    let where = `WHERE dp.item_name LIKE '%${item.replace(/'/g, "''")}%'
      AND dp.price_date >= DATEADD(day, -${days}, CAST(GETDATE() AS DATE))
      AND dp.price_naira > 0`;
    if (market) where += ` AND dp.market_name LIKE '%${market.replace(/'/g, "''")}%'`;
    if (state) where += ` AND dp.state LIKE '%${state.replace(/'/g, "''")}%'`;

    // Daily average trend
    const trendQuery = `
      SELECT
        dp.item_name,
        ${market ? "dp.market_name," : "'All Markets' AS market_name,"}
        dp.price_date,
        AVG(dp.price_naira) AS avg_price,
        MIN(dp.price_naira) AS min_price,
        MAX(dp.price_naira) AS max_price,
        COUNT(*) AS data_points
      FROM Daily_Prices dp
      ${where}
      GROUP BY dp.item_name, ${market ? "dp.market_name," : ""} dp.price_date
      ORDER BY dp.price_date ASC
    `;

    const trends = await prisma.$queryRawUnsafe(trendQuery) as any[];

    // Summary stats
    const allPrices = trends.map((t: any) => parseFloat(t.avg_price));
    const first = allPrices[0] || 0;
    const last = allPrices[allPrices.length - 1] || 0;
    const changePct = first > 0 ? ((last - first) / first) * 100 : 0;
    const avg = allPrices.reduce((a, b) => a + b, 0) / (allPrices.length || 1);
    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);

    await logUsage(ctx.keyInfo.key_id, "/api/v1/trends", "GET", 200, Date.now() - ctx.startTime, request);

    return apiResponse(
      {
        data: trends.map((t: any) => ({
          item: t.item_name,
          market: t.market_name,
          date: t.price_date,
          avg_price: parseFloat(parseFloat(t.avg_price).toFixed(2)),
          min_price: parseFloat(parseFloat(t.min_price).toFixed(2)),
          max_price: parseFloat(parseFloat(t.max_price).toFixed(2)),
          data_points: parseInt(t.data_points),
        })),
        summary: {
          item: item,
          period_days: days,
          data_points: trends.length,
          start_price: parseFloat(first.toFixed(2)),
          end_price: parseFloat(last.toFixed(2)),
          change_pct: parseFloat(changePct.toFixed(2)),
          avg_price: parseFloat(avg.toFixed(2)),
          min_price: parseFloat(min.toFixed(2)),
          max_price: parseFloat(max.toFixed(2)),
          direction: changePct > 1 ? "UP" : changePct < -1 ? "DOWN" : "STABLE",
        },
      },
      ctx,
      { endpoint: "trends", period_days: days }
    );
  } catch (e: any) {
    await logUsage(ctx.keyInfo.key_id, "/api/v1/trends", "GET", 500, Date.now() - ctx.startTime, request);
    return NextResponse.json({ error: "server_error", message: e.message }, { status: 500, headers: corsHeaders() });
  }
}

export const dynamic = "force-dynamic";
