// ============================================================================
// src/app/api/v1/prices/route.ts
// NaijaMarket Intel - Public API v1: Prices
// GET /api/v1/prices?item=rice&market=mile+12&state=lagos&limit=50
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma as sharedPrisma } from "@/lib/db";
import { PrismaClient } from "@prisma/client";
import { validateRequest, logUsage, apiResponse, corsHeaders } from "@/lib/api-middleware";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = sharedPrisma;
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(request: NextRequest) {
  const result = await validateRequest(request, "/api/v1/prices");
  if (!result.ok) return result.response;
  const { ctx } = result;

  try {
    const sp = request.nextUrl.searchParams;
    const item = sp.get("item") || "";
    const market = sp.get("market") || "";
    const state = sp.get("state") || "";
    const category = sp.get("category") || "";
    const limit = Math.min(parseInt(sp.get("limit") || "50"), 200);
    const offset = parseInt(sp.get("offset") || "0");
    const sort = sp.get("sort") || "date_desc"; // date_desc, date_asc, price_asc, price_desc, change_desc

    // Build WHERE clauses
    let where = "WHERE dp.price_naira > 0 AND dp.price_date >= DATEADD(day, -2, CAST(GETDATE() AS DATE))";
    if (item) where += ` AND dp.item_name LIKE '%${item.replace(/'/g, "''")}%'`;
    if (market) where += ` AND dp.market_name LIKE '%${market.replace(/'/g, "''")}%'`;
    if (state) where += ` AND dp.state LIKE '%${state.replace(/'/g, "''")}%'`;
    if (category) where += ` AND c.category_name LIKE '%${category.replace(/'/g, "''")}%'`;

    // Sort
    let orderBy = "dp.price_date DESC, dp.time_slot DESC";
    if (sort === "price_asc") orderBy = "dp.price_naira ASC";
    if (sort === "price_desc") orderBy = "dp.price_naira DESC";
    if (sort === "change_desc") orderBy = "ABS(dp.price_change_pct) DESC";
    if (sort === "date_asc") orderBy = "dp.price_date ASC";

    const query = `
      SELECT
        dp.item_name, dp.market_name, dp.state,
        ISNULL(c.category_name, '') AS category,
        dp.price_naira AS price,
        ISNULL(dp.unit, ic.Unit) AS unit,
        dp.previous_price,
        dp.price_change_pct AS change_pct,
        dp.trend,
        dp.confidence_score,
        dp.price_date,
        dp.time_slot
      FROM Daily_Prices dp
      LEFT JOIN Items_Catalog ic ON dp.item_name = ic.item_name
      LEFT JOIN Categories c ON ic.category_id = c.category_id
      ${where}
      ORDER BY ${orderBy}
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `;

    const prices = await prisma.$queryRawUnsafe(query) as any[];

    // Count total
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM Daily_Prices dp
      LEFT JOIN Items_Catalog ic ON dp.item_name = ic.item_name
      LEFT JOIN Categories c ON ic.category_id = c.category_id
      ${where}
    `;
    const countResult = await prisma.$queryRawUnsafe(countQuery) as any[];
    const total = parseInt(countResult[0]?.total || "0");

    await logUsage(ctx.keyInfo.key_id, "/api/v1/prices", "GET", 200, Date.now() - ctx.startTime, request);

    return apiResponse(
      {
        data: prices.map((p: any) => ({
          item: p.item_name,
          market: p.market_name,
          state: p.state,
          category: p.category,
          price: parseFloat(p.price),
          unit: p.unit,
          previous_price: p.previous_price ? parseFloat(p.previous_price) : null,
          change_pct: p.change_pct ? parseFloat(p.change_pct) : 0,
          trend: p.trend,
          confidence: p.confidence_score ? parseFloat(p.confidence_score) : null,
          date: p.price_date,
          time_slot: p.time_slot,
        })),
        pagination: { total, limit, offset, has_more: offset + limit < total },
      },
      ctx,
      { endpoint: "prices", filters: { item, market, state, category } }
    );
  } catch (e: any) {
    await logUsage(ctx.keyInfo.key_id, "/api/v1/prices", "GET", 500, Date.now() - ctx.startTime, request);
    return NextResponse.json({ error: "server_error", message: e.message }, { status: 500, headers: corsHeaders() });
  }
}

export const dynamic = "force-dynamic";
