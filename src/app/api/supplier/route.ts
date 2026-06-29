// ============================================================================
// NAIJAFOOD INTEL — SUPPLIER INTELLIGENCE API
// File: src/app/api/supplier/route.ts
// Version: 3.0 — Fixed column names, no GREATEST/LEAST
// Date: 2026-03-13
//
// v2 BUGS FIXED:
//   Bug 1: Referenced lp.submission_count — column does NOT exist in
//          Latest_Prices_Summary. Schema has no submission_count column.
//          Fix: Count rows from Daily_Prices as submission proxy instead.
//   Bug 2: GREATEST()/LEAST() not supported at current DB compatibility level.
//          Fix: Replaced with pure CASE WHEN equivalents.
//
// Confirmed Latest_Prices_Summary columns:
//   summary_id, item_id, item_name, market_id, market_name, state,
//   category_id, category_name, unit, price_naira, price_date,
//   previous_price, price_change_pct, trend,
//   week_high, week_low, week_avg, month_high, month_low, month_avg,
//   month_change_pct, quarter_avg, quarter_change_pct,
//   confidence_score, data_source, last_updated
//
// Confirmed Daily_Prices columns:
//   price_id, price_date, time_slot, item_id, item_name, market_id,
//   market_name, state, category_id, unit, price_naira, previous_price,
//   price_change_pct, trend, confidence_score, data_source, generated_at
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";

export const dynamic = "force-dynamic";

// ============================================================================
// MSSQL CONNECTION — identical config to arbitrage route (confirmed working)
// ============================================================================

const SQL_CONFIG: sql.config = {
  server:   process.env.AZURE_SQL_SERVER   || process.env.DATABASE_SERVER   || "naijafood.database.windows.net",
  database: process.env.AZURE_SQL_DATABASE || process.env.DATABASE_NAME     || "naijafoodmarket-live",
  user:     process.env.AZURE_SQL_USER     || process.env.DATABASE_USER     || "",
  password: process.env.AZURE_SQL_PASSWORD || process.env.DATABASE_PASSWORD || "",
  options:  { encrypt: true, trustServerCertificate: false },
  connectionTimeout: 30000,
  requestTimeout:    45000,
  pool: { max: 5, min: 1, idleTimeoutMillis: 60000, acquireTimeoutMillis: 30000 },
};

let _pool: sql.ConnectionPool | null = null;

async function getPool(): Promise<sql.ConnectionPool | null> {
  if (_pool && _pool.connected) {
    try { await _pool.request().query("SELECT 1"); return _pool; }
    catch {
      console.warn("[supplier v3] Pool ping failed — reconnecting");
      try { await _pool.close(); } catch {}
      _pool = null;
    }
  }
  if (!SQL_CONFIG.user || !SQL_CONFIG.password) {
    console.warn("[supplier v3] SQL credentials not set");
    return null;
  }
  try {
    _pool = await new sql.ConnectionPool(SQL_CONFIG).connect();
    console.log("[supplier v3] Pool established");
    return _pool;
  } catch (err) {
    console.error("[supplier v3] Connect failed:", err);
    _pool = null;
    return null;
  }
}

// ============================================================================
// TIER ACCESS
// ============================================================================

const TIER_HIERARCHY = ["FREE","SILVER","GOLD","BUSINESS","CORPORATE","ENTERPRISE","OGA_BOSS","GOVERNMENT"];

function hasTierAccess(tier: string): boolean {
  return TIER_HIERARCHY.indexOf(tier.toUpperCase()) >= TIER_HIERARCHY.indexOf("CORPORATE");
}

// ============================================================================
// ZONE MAP — all 37 states + FCT
// ============================================================================

const STATE_ZONE: Record<string, string> = {
  "Abia":"South-East","Anambra":"South-East","Ebonyi":"South-East","Enugu":"South-East","Imo":"South-East",
  "Akwa Ibom":"South-South","Bayelsa":"South-South","Cross River":"South-South",
  "Delta":"South-South","Edo":"South-South","Rivers":"South-South",
  "Ekiti":"South-West","Lagos":"South-West","Ogun":"South-West",
  "Ondo":"South-West","Osun":"South-West","Oyo":"South-West",
  "Benue":"North-Central","FCT":"North-Central","Kogi":"North-Central",
  "Kwara":"North-Central","Nasarawa":"North-Central","Niger":"North-Central","Plateau":"North-Central",
  "Adamawa":"North-East","Bauchi":"North-East","Borno":"North-East",
  "Gombe":"North-East","Taraba":"North-East","Yobe":"North-East",
  "Jigawa":"North-West","Kaduna":"North-West","Kano":"North-West",
  "Katsina":"North-West","Kebbi":"North-West","Sokoto":"North-West","Zamfara":"North-West",
};

function getZone(state: string): string {
  const clean = (state || "").replace(/ State$/i, "").trim();
  return STATE_ZONE[clean] || "Other";
}

// ============================================================================
// SUPPLY SCORE HELPER (JS) — applied after SQL returns rows
// Keeps SQL simple (no GREATEST/LEAST needed)
// ============================================================================

function computeSupplyScore(trend7d: number, hasTrendData: boolean, priceTrend: string | null): number {
  let score = 70; // base: assume adequate supply

  // Penalise rising prices (supply tightening signal)
  if (hasTrendData) {
    if      (trend7d >  40) score -= 40;
    else if (trend7d >  20) score -= 25;
    else if (trend7d >  10) score -= 15;
    else if (trend7d >   5) score -= 8;
    else if (trend7d >   0) score -= 3;
    // Falling prices = supply improvement bonus
    else if (trend7d < -10) score += 10;
    else if (trend7d <  -5) score += 5;
  } else {
    // No historical data — unknown supply, apply moderate penalty
    score -= 15;
  }

  // Use Latest_Prices_Summary trend column as secondary signal
  if (priceTrend === "UP")   score -= 5;
  if (priceTrend === "DOWN") score += 5;

  // Clamp 0–100
  if (score < 0)   score = 0;
  if (score > 100) score = 100;
  return Math.round(score);
}

function getShortageRisk(score: number): string {
  if (score < 25) return "CRITICAL";
  if (score < 40) return "WARNING";
  if (score < 60) return "WATCH";
  return "NORMAL";
}

// ============================================================================
// GET
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const url  = new URL(request.url);
    const tier = (url.searchParams.get("tier") || "CORPORATE").toUpperCase();
    const zone = url.searchParams.get("zone") || "";
    const risk = url.searchParams.get("risk") || "";
    const sort = url.searchParams.get("sort") || "shortage_risk";

    // ── Tier gate ─────────────────────────────────────────────────────────────
    if (!hasTierAccess(tier)) {
      return NextResponse.json({
        success: false, error: "upgrade_required",
        message: "Supplier Intelligence requires CORPORATE tier or higher",
        upgradeUrl: "/pricing",
      }, { status: 403 });
    }

    const pool = await getPool();
    if (!pool) {
      return NextResponse.json({
        success: false, error: "db_unavailable",
        message: "Database connection unavailable",
      }, { status: 503 });
    }

    // ── SQL Batch ─────────────────────────────────────────────────────────────
    // Strategy:
    //   Step 1 — Current prices from Latest_Prices_Summary (always populated)
    //   Step 2 — 7-day-ago prices from Daily_Prices (2026 data, always available)
    //   Step 3 — Join + compute trend_7d + volatility proxy using pure CASE WHEN
    //   Step 4 — Final SELECT (supply_score computed in JS after this returns)
    //
    // Deliberately NO submission_count (column does not exist in LPS).
    // Deliberately NO GREATEST/LEAST (compatibility level constraint).
    // All clamping done in JS computeSupplyScore().

    const batchSql = `
      IF OBJECT_ID('tempdb..#LPS')  IS NOT NULL DROP TABLE #LPS;
      IF OBJECT_ID('tempdb..#W7')   IS NOT NULL DROP TABLE #W7;

      -- Step 1: Snapshot of current prices
      SELECT
        lp.item_id,
        lp.item_name,
        ISNULL(lp.category_name, 'Other')   AS category_name,
        lp.market_id,
        lp.market_name,
        lp.state,
        CAST(lp.price_naira AS FLOAT)       AS current_price,
        lp.price_date                       AS latest_date,
        ISNULL(lp.trend, '')                AS price_trend,
        CAST(ISNULL(lp.price_change_pct,0) AS FLOAT) AS lps_change_pct
      INTO #LPS
      FROM dbo.Latest_Prices_Summary lp
      WHERE lp.price_naira > 0
        AND lp.item_id    IS NOT NULL
        AND lp.market_id  IS NOT NULL;

      -- Step 2: 7-day-ago prices from Daily_Prices
      SELECT
        dp.item_id,
        dp.market_id,
        CAST(AVG(dp.price_naira) AS FLOAT)  AS price_7d_ago,
        COUNT(*)                            AS submission_count
      INTO #W7
      FROM dbo.Daily_Prices dp
      WHERE dp.price_date >= DATEADD(DAY, -10, CAST(GETDATE() AS DATE))
        AND dp.price_date <= DATEADD(DAY, -6,  CAST(GETDATE() AS DATE))
        AND dp.price_naira > 0
      GROUP BY dp.item_id, dp.market_id;

      -- Step 3: Join + compute metrics (pure CASE WHEN, no GREATEST/LEAST)
      SELECT TOP 500
        lps.item_name,
        lps.category_name,
        lps.market_name,
        lps.state,
        ROUND(lps.current_price, 2)         AS avg_price,
        ISNULL(w7.submission_count, 0)      AS submission_count,
        CONVERT(VARCHAR(10), lps.latest_date, 23) AS metric_date,
        lps.price_trend,

        -- trend_7d: percentage change vs 7 days ago
        CASE
          WHEN w7.price_7d_ago IS NOT NULL AND w7.price_7d_ago > 0
          THEN ROUND(
            (lps.current_price - w7.price_7d_ago) / w7.price_7d_ago * 100
          , 1)
          ELSE lps.lps_change_pct   -- fallback: use Latest_Prices_Summary's own change_pct
        END                                 AS trend_7d,

        -- has_trend_data: 1 if we have actual 7-day comparison, 0 if not
        CASE WHEN w7.price_7d_ago IS NOT NULL AND w7.price_7d_ago > 0
             THEN 1 ELSE 0 END             AS has_trend_data,

        -- volatility: absolute % change (proxy for std dev without STDEV needing multiple rows)
        CASE
          WHEN w7.price_7d_ago IS NOT NULL AND w7.price_7d_ago > 0
          THEN ROUND(
            ABS(lps.current_price - w7.price_7d_ago) / w7.price_7d_ago * 100
          , 1)
          ELSE 0.0
        END                                 AS price_volatility

      FROM #LPS lps
      LEFT JOIN #W7 w7
        ON w7.item_id   = lps.item_id
       AND w7.market_id = lps.market_id
      ORDER BY
        -- Pre-sort by trend descending so high-risk items come first in JS processing
        CASE
          WHEN w7.price_7d_ago IS NOT NULL AND w7.price_7d_ago > 0
          THEN (lps.current_price - w7.price_7d_ago) / w7.price_7d_ago * 100
          ELSE lps.lps_change_pct
        END DESC;
    `;

    let rows: any[] = [];
    try {
      const batchResult = await pool.request().batch(batchSql);
      rows = batchResult?.recordset || [];
      console.log(`[supplier v3] Batch OK — ${rows.length} rows`);
    } catch (batchErr: any) {
      console.error("[supplier v3] Batch FAILED:", batchErr?.message);
      console.error("[supplier v3] Error code:", batchErr?.number, "state:", batchErr?.state);
      try { await pool.close(); } catch {}
      _pool = null;
      throw batchErr;
    }

    // ── JS: compute supply_score + shortage_risk + zone ───────────────────────
    const metrics = rows.map((r: any) => {
      const trend7d       = parseFloat(r.trend_7d)         || 0;
      const hasTrendData  = parseInt(r.has_trend_data)      === 1;
      const priceTrend    = String(r.price_trend || "");
      const supplyScore   = computeSupplyScore(trend7d, hasTrendData, priceTrend);
      const shortageRisk  = getShortageRisk(supplyScore);

      return {
        item_name:        String(r.item_name        || ""),
        category_name:    String(r.category_name    || "Other"),
        market_name:      String(r.market_name      || ""),
        state:            String(r.state            || ""),
        zone:             getZone(String(r.state    || "")),
        avg_price:        parseFloat(r.avg_price)    || 0,
        submission_count: parseInt(r.submission_count) || 0,
        metric_date:      String(r.metric_date       || ""),
        trend_7d:         trend7d,
        trend_30d:        0,   // Daily_Prices only has 2026 data, accumulates over time
        price_volatility: parseFloat(r.price_volatility) || 0,
        supply_score:     supplyScore,
        shortage_risk:    shortageRisk,
        demand_indicator: trend7d > 10 ? "HIGH" : trend7d > 3 ? "MEDIUM" : "LOW",
      };
    });

    // ── Apply filters ─────────────────────────────────────────────────────────
    let filtered = metrics;
    if (zone && zone !== "All Zones" && zone !== "")
      filtered = filtered.filter(m => m.zone === zone);
    if (risk && risk !== "ALL" && risk !== "")
      filtered = filtered.filter(m => m.shortage_risk === risk);

    // ── Sort ──────────────────────────────────────────────────────────────────
    const RISK_ORDER: Record<string, number> = { CRITICAL:0, WARNING:1, WATCH:2, NORMAL:3 };
    filtered.sort((a, b) => {
      if (sort === "supply_score")     return a.supply_score - b.supply_score;
      if (sort === "price_volatility") return b.price_volatility - a.price_volatility;
      if (sort === "trend_7d")         return Math.abs(b.trend_7d) - Math.abs(a.trend_7d);
      return (RISK_ORDER[a.shortage_risk] ?? 4) - (RISK_ORDER[b.shortage_risk] ?? 4);
    });

    // ── Stats for KPI cards ───────────────────────────────────────────────────
    const allMarkets     = new Set(metrics.map(m => m.market_name)).size;
    const allCommodities = new Set(metrics.map(m => m.item_name)).size;
    const avgSupply      = metrics.length > 0
      ? Math.round(metrics.reduce((s, m) => s + m.supply_score, 0) / metrics.length)
      : 0;

    return NextResponse.json({
      success: true,
      count:   filtered.length,
      total:   metrics.length,
      source:  "Latest_Prices_Summary + Daily_Prices (live v3)",
      stats: {
        total_markets:     allMarkets,
        total_commodities: allCommodities,
        avg_supply_score:  avgSupply,
        critical_alerts:   metrics.filter(m => m.shortage_risk === "CRITICAL").length,
        warning_alerts:    metrics.filter(m => m.shortage_risk === "WARNING").length,
        avg_volatility:    metrics.length > 0
          ? parseFloat((metrics.reduce((s, m) => s + m.price_volatility, 0) / metrics.length).toFixed(1))
          : 0,
      },
      metrics: filtered,
    });

  } catch (error: any) {
    console.error("[Supplier API v3 Error]", error?.message || error);
    return NextResponse.json({
      success: false, error: "server_error",
      message: "Failed to load supplier data",
    }, { status: 500 });
  }
}
