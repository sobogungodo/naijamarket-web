// ============================================================================
// src/app/api/v1/historical/route.ts
// NaijaMarket Intel - Public API v1: Historical Data
// BUSINESS tier+ required
// GET /api/v1/historical?item=rice&market=mile+12&from=2026-01-01&to=2026-02-20
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
  const result = await validateRequest(request, "/api/v1/historical");
  if (!result.ok) return result.response;
  const { ctx } = result;

  try {
    const sp = request.nextUrl.searchParams;
    const item = sp.get("item") || "";
    const market = sp.get("market") || "";
    const state = sp.get("state") || "";
    const from = sp.get("from") || "";
    const to = sp.get("to") || "";
    const granularity = sp.get("granularity") || "daily"; // daily, weekly, monthly
    const limit = Math.min(parseInt(sp.get("limit") || "500"), 2000);
    const offset = parseInt(sp.get("offset") || "0");
    const format = sp.get("format") || "json"; // json, csv

    if (!item) {
      return NextResponse.json(
        { error: "missing_parameter", message: "The 'item' parameter is required." },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Date range (max 365 days). Validate the caller-supplied dates strictly as
    // YYYY-MM-DD before they reach the SQL string literal below — anything else
    // (incl. injection payloads) is rejected and the default is used.
    const okDate = (s: unknown): string | null =>
      typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
    let dateFrom = okDate(from) || new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
    let dateTo = okDate(to) || new Date().toISOString().split("T")[0];

    let where = `WHERE dp.item_name LIKE '%${item.replace(/'/g, "''")}%'
      AND dp.price_date >= '${dateFrom}' AND dp.price_date <= '${dateTo}'
      AND dp.price_naira > 0`;
    if (market) where += ` AND dp.market_name LIKE '%${market.replace(/'/g, "''")}%'`;
    if (state) where += ` AND dp.state LIKE '%${state.replace(/'/g, "''")}%'`;

    let query: string;

    if (granularity === "weekly") {
      query = `
        SELECT
          dp.item_name, dp.market_name, dp.state,
          DATEADD(day, -DATEPART(weekday, dp.price_date) + 1, dp.price_date) AS week_start,
          AVG(dp.price_naira) AS avg_price,
          MIN(dp.price_naira) AS min_price,
          MAX(dp.price_naira) AS max_price,
          COUNT(*) AS data_points
        FROM Daily_Prices dp
        ${where}
        GROUP BY dp.item_name, dp.market_name, dp.state,
                 DATEADD(day, -DATEPART(weekday, dp.price_date) + 1, dp.price_date)
        ORDER BY week_start DESC
        OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
      `;
    } else if (granularity === "monthly") {
      query = `
        SELECT
          dp.item_name, dp.market_name, dp.state,
          DATEFROMPARTS(YEAR(dp.price_date), MONTH(dp.price_date), 1) AS month_start,
          AVG(dp.price_naira) AS avg_price,
          MIN(dp.price_naira) AS min_price,
          MAX(dp.price_naira) AS max_price,
          COUNT(*) AS data_points
        FROM Daily_Prices dp
        ${where}
        GROUP BY dp.item_name, dp.market_name, dp.state,
                 DATEFROMPARTS(YEAR(dp.price_date), MONTH(dp.price_date), 1)
        ORDER BY month_start DESC
        OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
      `;
    } else {
      query = `
        SELECT
          dp.item_name, dp.market_name, dp.state,
          dp.price_date,
          AVG(dp.price_naira) AS avg_price,
          MIN(dp.price_naira) AS min_price,
          MAX(dp.price_naira) AS max_price,
          COUNT(*) AS data_points
        FROM Daily_Prices dp
        ${where}
        GROUP BY dp.item_name, dp.market_name, dp.state, dp.price_date
        ORDER BY dp.price_date DESC
        OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
      `;
    }

    const data = await prisma.$queryRawUnsafe(query) as any[];

    await logUsage(ctx.keyInfo.key_id, "/api/v1/historical", "GET", 200, Date.now() - ctx.startTime, request);

    // CSV format
    if (format === "csv") {
      const header = "item,market,state,date,avg_price,min_price,max_price,data_points\n";
      const rows = data.map((d: any) =>
        `"${d.item_name}","${d.market_name}","${d.state}","${d.price_date || d.week_start || d.month_start}",${parseFloat(d.avg_price).toFixed(2)},${parseFloat(d.min_price).toFixed(2)},${parseFloat(d.max_price).toFixed(2)},${d.data_points}`
      ).join("\n");

      return new NextResponse(header + rows, {
        headers: {
          ...corsHeaders(),
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="naijamarket_${item}_${dateFrom}_${dateTo}.csv"`,
        },
      });
    }

    return apiResponse(
      {
        data: data.map((d: any) => ({
          item: d.item_name,
          market: d.market_name,
          state: d.state,
          date: d.price_date || d.week_start || d.month_start,
          avg_price: parseFloat(parseFloat(d.avg_price).toFixed(2)),
          min_price: parseFloat(parseFloat(d.min_price).toFixed(2)),
          max_price: parseFloat(parseFloat(d.max_price).toFixed(2)),
          data_points: parseInt(d.data_points),
        })),
        query: { item, market: market || "all", state: state || "all", from: dateFrom, to: dateTo, granularity },
        pagination: { limit, offset, has_more: data.length === limit },
      },
      ctx,
      { endpoint: "historical", granularity }
    );
  } catch (e: any) {
    await logUsage(ctx.keyInfo.key_id, "/api/v1/historical", "GET", 500, Date.now() - ctx.startTime, request);
    return NextResponse.json({ error: "server_error", message: e.message }, { status: 500, headers: corsHeaders() });
  }
}

export const dynamic = "force-dynamic";
