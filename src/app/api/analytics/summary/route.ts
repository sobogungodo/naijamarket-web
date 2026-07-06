// src/app/api/analytics/summary/route.ts
// Admin-only analytics summary endpoint
// Returns aggregated data for admin dashboard widget

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import sql from "mssql";

const DB_CONFIG = {
  server:   process.env.AZURE_SQL_SERVER!,
  database: process.env.AZURE_SQL_DATABASE!,
  user:     process.env.AZURE_SQL_USER!,
  password: process.env.AZURE_SQL_PASSWORD!,
  options:  { encrypt: true, trustServerCertificate: false },
  pool:     { max: 3, min: 0, idleTimeoutMillis: 30000 },
};

// Admin phone numbers allowed to access this endpoint
const ADMIN_PHONES = new Set([
  process.env.ADMIN_PHONE_1,
  process.env.ADMIN_PHONE_2,
].filter(Boolean));

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "https://naijamarket-admin.vercel.app",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const phone = (session.user as any).phone || "";
    const tier  = (session.user as any).tier  || "";
    // Allow ENTERPRISE tier or admin phones
    if (tier !== "ENTERPRISE" && !ADMIN_PHONES.has(phone)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const days = parseInt(req.nextUrl.searchParams.get("days") || "30");
    const pool = await sql.connect(DB_CONFIG);

    // 1. Site overview
    const siteOverview = await pool.request()
      .input("days", sql.Int(), days)
      .query(`
        SELECT
          COUNT(*)                                             AS total_events,
          COUNT(DISTINCT session_id)                          AS unique_sessions,
          SUM(CASE WHEN event_type='PAGE_VIEW'    THEN 1 ELSE 0 END) AS page_views,
          SUM(CASE WHEN event_type='CTA_CLICK'    THEN 1 ELSE 0 END) AS cta_clicks,
          SUM(CASE WHEN event_type='BUTTON_CLICK' THEN 1 ELSE 0 END) AS btn_clicks,
          SUM(CASE WHEN device_type='mobile'      THEN 1 ELSE 0 END) AS mobile_sessions,
          SUM(CASE WHEN device_type='desktop'     THEN 1 ELSE 0 END) AS desktop_sessions
        FROM dbo.Site_Analytics
        WHERE created_at >= DATEADD(DAY, -@days, GETUTCDATE())
      `);

    // 2. Top pages
    const topPages = await pool.request()
      .input("days", sql.Int(), days)
      .query(`
        SELECT TOP 10
          page_path,
          COUNT(*) AS views
        FROM dbo.Site_Analytics
        WHERE event_type='PAGE_VIEW'
          AND created_at >= DATEADD(DAY, -@days, GETUTCDATE())
        GROUP BY page_path
        ORDER BY views DESC
      `);

    // 3. Top CTAs clicked
    const topCTAs = await pool.request()
      .input("days", sql.Int(), days)
      .query(`
        SELECT TOP 10
          button_id,
          COUNT(*) AS clicks
        FROM dbo.Site_Analytics
        WHERE event_type IN ('CTA_CLICK','BUTTON_CLICK')
          AND button_id IS NOT NULL
          AND created_at >= DATEADD(DAY, -@days, GETUTCDATE())
        GROUP BY button_id
        ORDER BY clicks DESC
      `);

    // 4. Traffic by country
    const byCountry = await pool.request()
      .input("days", sql.Int(), days)
      .query(`
        SELECT TOP 10
          ISNULL(country,'Unknown') AS country,
          COUNT(DISTINCT session_id) AS sessions
        FROM dbo.Site_Analytics
        WHERE created_at >= DATEADD(DAY, -@days, GETUTCDATE())
        GROUP BY country
        ORDER BY sessions DESC
      `);

    // 5. Consumer feature usage
    const featureUsage = await pool.request()
      .input("days", sql.Int(), days)
      .query(`
        SELECT TOP 10
          feature_name,
          COUNT(*) AS uses,
          COUNT(DISTINCT consumer_id) AS unique_users
        FROM dbo.Consumer_Events
        WHERE event_type='FEATURE_USE'
          AND feature_name IS NOT NULL
          AND created_at >= DATEADD(DAY, -@days, GETUTCDATE())
        GROUP BY feature_name
        ORDER BY uses DESC
      `);

    // 6. Top searched commodities
    const topSearches = await pool.request()
      .input("days", sql.Int(), days)
      .query(`
        SELECT TOP 10
          ca.item_id,
          ISNULL(ic.item_name, ca.item_id) AS item_name,
          COUNT(*) AS searches
        FROM dbo.Consumer_Events ca
        LEFT JOIN dbo.Items_Catalog ic ON ic.item_id = ca.item_id
        WHERE ca.event_type='SEARCH'
          AND ca.item_id IS NOT NULL
          AND ca.created_at >= DATEADD(DAY, -@days, GETUTCDATE())
        GROUP BY ca.item_id, ic.item_name
        ORDER BY searches DESC
      `);

    // 7. Active users by tier
    const byTier = await pool.request()
      .input("days", sql.Int(), days)
      .query(`
        SELECT
          subscription_tier,
          COUNT(DISTINCT consumer_id) AS active_users
        FROM dbo.Consumer_Events
        WHERE created_at >= DATEADD(DAY, -@days, GETUTCDATE())
        GROUP BY subscription_tier
        ORDER BY active_users DESC
      `);

    // 8. Daily trend (page views last 30 days)
    const dailyTrend = await pool.request()
      .input("days", sql.Int(), days)
      .query(`
        SELECT
          CAST(created_at AS DATE) AS date,
          COUNT(*)                 AS events,
          COUNT(DISTINCT session_id) AS sessions
        FROM dbo.Site_Analytics
        WHERE event_type='PAGE_VIEW'
          AND created_at >= DATEADD(DAY, -@days, GETUTCDATE())
        GROUP BY CAST(created_at AS DATE)
        ORDER BY date ASC
      `);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://naijamarket-admin.vercel.app",
      "Access-Control-Allow-Credentials": "true",
    };
    return NextResponse.json({
      period_days:   days,
      site_overview: siteOverview.recordset[0],
      top_pages:     topPages.recordset,
      top_ctas:      topCTAs.recordset,
      by_country:    byCountry.recordset,
      feature_usage: featureUsage.recordset,
      top_searches:  topSearches.recordset,
      by_tier:       byTier.recordset,
      daily_trend:   dailyTrend.recordset,
    });

  } catch (err: any) {
    console.error("[analytics/summary]", err.message);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
