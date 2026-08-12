// src/app/api/analytics/track/route.ts
// NaijaMarket Intel — Analytics tracking endpoint
// Receives events from frontend, writes to Site_Analytics or Consumer_Events
// No PII stored — anonymous session IDs only for site analytics

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import sql from "mssql";
import { isSupabase, getSupabaseConnection } from "@/lib/db-supabase";

const DB_CONFIG = {
  server:   process.env.AZURE_SQL_SERVER!,
  database: process.env.AZURE_SQL_DATABASE!,
  user:     process.env.AZURE_SQL_USER!,
  password: process.env.AZURE_SQL_PASSWORD!,
  options:  { encrypt: true, trustServerCertificate: false },
  pool:     { max: 5, min: 0, idleTimeoutMillis: 30000 },
};

// Allowed event types — whitelist prevents injection via event_type field
const SITE_EVENTS     = new Set(["PAGE_VIEW","BUTTON_CLICK","SCROLL_DEPTH","CTA_CLICK"]);
const CONSUMER_EVENTS = new Set([
  "SEARCH","ALERT_SET","EXPORT","UPGRADE","DOWNGRADE",
  "FEATURE_USE","LOGIN","LOGOUT","SESSION_START","SESSION_END"
]);

const ALLOWED_FEATURES = new Set([
  "prices","arbitrage","alerts","compare","trend","snapshot",
  "nfpi","bulk","forecast","brief","favorites","filter",
  "export","calc","basket","invite","history","tokens","status",
  "markets","screener","heatmap","inflation","reports","settings"
]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event_type, payload = {} } = body;

    if (!event_type) {
      return NextResponse.json({ error: "event_type required" }, { status: 400 });
    }

    // ── Detect device type from user-agent ────────────────────────────────────
    const ua = req.headers.get("user-agent") || "";
    const device_type = /mobile|android|iphone|ipad/i.test(ua)
      ? "mobile"
      : /tablet/i.test(ua) ? "tablet" : "desktop";

    // ── Get country/region from Vercel headers ────────────────────────────────
    const country = req.headers.get("x-vercel-ip-country") || null;
    const region  = req.headers.get("x-vercel-ip-country-region") || null;

    const pool = (isSupabase() ? ((await getSupabaseConnection()) as unknown as sql.ConnectionPool) : await sql.connect(DB_CONFIG));

    // ── SITE ANALYTICS (anonymous) ────────────────────────────────────────────
    if (SITE_EVENTS.has(event_type)) {
      const {
        session_id, page_path, referrer,
        utm_source, utm_medium, utm_campaign,
        button_id, scroll_depth_pct
      } = payload;

      if (!session_id) {
        return NextResponse.json({ error: "session_id required" }, { status: 400 });
      }

      await pool.request()
        .input("session_id",       sql.VarChar(36),  session_id.substring(0,36))
        .input("event_type",       sql.VarChar(50),  event_type)
        .input("page_path",        sql.VarChar(255), (page_path || "/").substring(0,255))
        .input("referrer",         sql.VarChar(500), (referrer || "").substring(0,500) || null)
        .input("utm_source",       sql.VarChar(100), utm_source || null)
        .input("utm_medium",       sql.VarChar(100), utm_medium || null)
        .input("utm_campaign",     sql.VarChar(100), utm_campaign || null)
        .input("button_id",        sql.VarChar(100), button_id || null)
        .input("scroll_depth_pct", sql.TinyInt(),    scroll_depth_pct || null)
        .input("device_type",      sql.VarChar(20),  device_type)
        .input("country",          sql.VarChar(50),  country)
        .input("region",           sql.VarChar(100), region)
        .query(`
          INSERT INTO dbo.Site_Analytics
            (session_id, event_type, page_path, referrer,
             utm_source, utm_medium, utm_campaign,
             button_id, scroll_depth_pct, device_type, country, region)
          VALUES
            (@session_id, @event_type, @page_path, @referrer,
             @utm_source, @utm_medium, @utm_campaign,
             @button_id, @scroll_depth_pct, @device_type, @country, @region)
        `);

      return NextResponse.json({ ok: true });
    }

    // ── CONSUMER ANALYTICS (authenticated) ───────────────────────────────────
    if (CONSUMER_EVENTS.has(event_type)) {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }

      const consumer_id = (session.user as any).id;
      const tier        = (session.user as any).tier || "FREE";

      const {
        feature_name, item_id, market_id,
        session_duration_sec, metadata
      } = payload;

      // Validate feature_name if provided
      if (feature_name && !ALLOWED_FEATURES.has(feature_name)) {
        return NextResponse.json({ error: "invalid feature_name" }, { status: 400 });
      }

      await pool.request()
        .input("consumer_id",          sql.VarChar(50),   consumer_id)
        .input("event_type",           sql.VarChar(50),   event_type)
        .input("feature_name",         sql.VarChar(100),  feature_name || null)
        .input("item_id",              sql.VarChar(50),   item_id || null)
        .input("market_id",            sql.VarChar(50),   market_id || null)
        .input("subscription_tier",    sql.VarChar(20),   tier)
        .input("session_duration_sec", sql.Int(),         session_duration_sec || null)
        .input("metadata",             sql.NVarChar(sql.MAX),
               metadata ? JSON.stringify(metadata).substring(0, 4000) : null)
        .query(`
          INSERT INTO dbo.Consumer_Events
            (consumer_id, event_type, feature_name, item_id, market_id,
             subscription_tier, session_duration_sec, metadata)
          VALUES
            (@consumer_id, @event_type, @feature_name, @item_id, @market_id,
             @subscription_tier, @session_duration_sec, @metadata)
        `);

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "unknown event_type" }, { status: 400 });

  } catch (err: any) {
    console.error("[analytics/track]", err.message);
    // Fail silently — analytics must never break the user experience
    return NextResponse.json({ ok: true });
  }
}
