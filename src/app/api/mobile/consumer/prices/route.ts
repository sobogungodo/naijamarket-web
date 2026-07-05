// src/app/api/mobile/consumer/prices/route.ts
// NaijaMarket Intel — Consumer mobile prices feed (Bearer JWT auth)
// Additive route for the consumer app. Does NOT touch the PWA's /api/prices.

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

  try {
    const sp = request.nextUrl.searchParams;
    const item = (sp.get("item") || "").trim();
    const state = (sp.get("state") || "").trim();
    const marketId = (sp.get("market_id") || "").trim();
    const trending = sp.get("trending") === "true";
    const history = sp.get("history") === "true";
    const limit = Math.min(parseInt(sp.get("limit") || "20") || 20, 50);

    // --- Detail view (history=true): exact item, ALL markets, + national daily-avg series ---
    if (history && item) {
      const detailWhere =
        "WHERE is_nbs_ref = 0 AND is_food = 1 AND item_id NOT LIKE 'NBS[_]%' AND price_naira > 0"
        + ` AND item_name = '${esc(item)}'`
        + (state ? ` AND state LIKE '%${esc(state)}%'` : "")
        + (marketId ? ` AND market_id = '${esc(marketId)}'` : "");

      // One row per market (latest snapshot), cheapest first — fixes the
      // "Across markets" list that previously collapsed to a single market.
      const marketsSql = `
        SELECT TOP 500
          item_id, item_name, market_name, market_id, state,
          price_naira, unit, trend, price_change_pct,
          week_high, week_low, confidence_score, last_updated
        FROM (
          SELECT
            item_id, item_name, market_name, market_id, state,
            CAST(price_naira AS FLOAT) AS price_naira, unit, trend,
            CAST(price_change_pct AS FLOAT) AS price_change_pct,
            CAST(week_high AS FLOAT) AS week_high,
            CAST(week_low AS FLOAT) AS week_low,
            CAST(confidence_score AS FLOAT) AS confidence_score,
            last_updated,
            ROW_NUMBER() OVER (PARTITION BY market_id ORDER BY last_updated DESC) AS rn
          FROM Latest_Prices_Summary WITH (NOLOCK)
          ${detailWhere}
        ) t
        WHERE rn = 1
        ORDER BY price_naira ASC
      `;

      // National daily average over the last 30 days (small pre-aggregated table).
      const histSql = `
        SELECT CONVERT(varchar(10), price_date, 23) AS date,
               CAST(AVG(avg_price) AS FLOAT) AS price
        FROM Daily_Price_Stats WITH (NOLOCK)
        WHERE item_name = '${esc(item)}'
          AND price_date >= DATEADD(day, -30, CAST(GETUTCDATE() AS date))
        GROUP BY price_date
        ORDER BY price_date ASC
      `;

      const [mkRows, histRows] = await Promise.all([
        prisma.$queryRawUnsafe<any[]>(marketsSql),
        prisma.$queryRawUnsafe<any[]>(histSql),
      ]);

      const historySeries = histRows.map((h) => ({ date: h.date, price: Number(h.price) || 0 }));
      const data = mkRows.map((r, i) => ({
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
        // App scans for the first row carrying history; attach to the cheapest row.
        history: i === 0 ? historySeries : undefined,
      }));

      return NextResponse.json({ success: true, data, history: historySeries, total: data.length });
    }

    let where =
      "WHERE is_nbs_ref = 0 AND is_food = 1 AND item_id NOT LIKE 'NBS[_]%' AND price_naira > 0";
    if (item) where += ` AND item_name LIKE '%${esc(item)}%'`;
    if (state) where += ` AND state LIKE '%${esc(state)}%'`;
    if (marketId) where += ` AND market_id = '${esc(marketId)}'`;

    // trending=true → "Top picks": one item per category (highest confidence).
    // default → diversified ticker: one row per item (cheapest market).
    const sql = trending
      ? `
      SELECT TOP ${limit}
        item_id, item_name, market_name, market_id, state,
        price_naira, unit, trend, price_change_pct,
        week_high, week_low, confidence_score, last_updated
      FROM (
        SELECT
          item_id, item_name, market_name, market_id, state,
          category_id, category_name,
          CAST(price_naira AS FLOAT) AS price_naira, unit, trend,
          CAST(price_change_pct AS FLOAT) AS price_change_pct,
          CAST(week_high AS FLOAT) AS week_high,
          CAST(week_low AS FLOAT) AS week_low,
          CAST(confidence_score AS FLOAT) AS confidence_score,
          last_updated,
          ROW_NUMBER() OVER (
            PARTITION BY category_id
            ORDER BY confidence_score DESC, last_updated DESC
          ) AS rn
        FROM Latest_Prices_Summary WITH (NOLOCK)
        ${where}
      ) t
      WHERE rn = 1
      ORDER BY confidence_score DESC
    `
      : `
      SELECT TOP ${limit}
        item_id, item_name, market_name, market_id, state,
        price_naira, unit, trend, price_change_pct,
        week_high, week_low, confidence_score, last_updated
      FROM (
        SELECT
          item_id, item_name, market_name, market_id, state,
          CAST(price_naira AS FLOAT) AS price_naira, unit, trend,
          CAST(price_change_pct AS FLOAT) AS price_change_pct,
          CAST(week_high AS FLOAT) AS week_high,
          CAST(week_low AS FLOAT) AS week_low,
          CAST(confidence_score AS FLOAT) AS confidence_score,
          last_updated,
          ROW_NUMBER() OVER (
            PARTITION BY item_id
            ORDER BY price_naira ASC, market_id ASC
          ) AS rn
        FROM Latest_Prices_Summary WITH (NOLOCK)
        ${where}
      ) t
      WHERE rn = 1
      ORDER BY last_updated DESC
    `;

    const rows = await prisma.$queryRawUnsafe<any[]>(sql);

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
