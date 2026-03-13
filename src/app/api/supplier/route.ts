// ============================================================================
// NAIJAFOOD INTEL — SUPPLIER INTELLIGENCE API
// File: src/app/api/supplier/route.ts
// Version: 2.0 — Computed live from Latest_Prices_Summary + Daily_Prices
// Date: 2026-03-13
//
// ROOT CAUSE FIX:
//   v1 tried Supplier_Metrics table (doesn't exist) then Prisma fallback
//   (fails silently). Result: always 0 rows, all zeros on page.
//
// v2 FIX:
//   Uses mssql directly against Latest_Prices_Summary (546K rows, always live).
//   Computes supply_score, volatility, trend_7d, shortage_risk in one SQL batch.
//   No Prisma. No missing tables. Same pattern as arbitrage route (which works).
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";

export const dynamic = "force-dynamic";

// ============================================================================
// MSSQL CONNECTION — identical config to arbitrage route (confirmed working)
// ============================================================================

const SQL_CONFIG: sql.config = {
  server:   process.env.AZURE_SQL_SERVER   || process.env.DATABASE_SERVER   || "naijafood.database.windows.net",
  database: process.env.AZURE_SQL_DATABASE || process.env.DATABASE_NAME     || "naijafoodmarket",
  user:     process.env.AZURE_SQL_USER     || process.env.DATABASE_USER     || "",
  password: process.env.AZURE_SQL_PASSWORD || process.env.DATABASE_PASSWORD || "",
  options: {
    encrypt:                true,
    trustServerCertificate: false,
  },
  connectionTimeout: 30000,
  requestTimeout:    45000,
  pool: {
    max:                  5,
    min:                  1,
    idleTimeoutMillis:    60000,
    acquireTimeoutMillis: 30000,
  },
};

let _pool: sql.ConnectionPool | null = null;

async function getPool(): Promise<sql.ConnectionPool | null> {
  if (_pool && _pool.connected) {
    try {
      await _pool.request().query("SELECT 1 AS ping");
      return _pool;
    } catch {
      console.warn("[supplier v2] Pool ping failed — reconnecting");
      try { await _pool.close(); } catch {}
      _pool = null;
    }
  }

  if (!SQL_CONFIG.user || !SQL_CONFIG.password) {
    console.warn("[supplier v2] SQL credentials not set");
    return null;
  }

  try {
    _pool = await new sql.ConnectionPool(SQL_CONFIG).connect();
    console.log("[supplier v2] Connection pool established");
    return _pool;
  } catch (err) {
    console.error("[supplier v2] Failed to connect:", err);
    _pool = null;
    return null;
  }
}

// ============================================================================
// TIER ACCESS
// ============================================================================

const TIER_HIERARCHY = ["FREE", "SILVER", "GOLD", "BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"];
const MIN_TIER = "CORPORATE";

function hasTierAccess(tier: string): boolean {
  return TIER_HIERARCHY.indexOf(tier.toUpperCase()) >= TIER_HIERARCHY.indexOf(MIN_TIER);
}

// ============================================================================
// ZONE MAPPING — Nigerian geopolitical zones
// ============================================================================

const STATE_ZONE: Record<string, string> = {
  "Abia":          "South-East",  "Anambra":     "South-East",  "Ebonyi":      "South-East",
  "Enugu":         "South-East",  "Imo":         "South-East",
  "Akwa Ibom":     "South-South", "Bayelsa":     "South-South", "Cross River":  "South-South",
  "Delta":         "South-South", "Edo":         "South-South", "Rivers":       "South-South",
  "Ekiti":         "South-West",  "Lagos":       "South-West",  "Ogun":         "South-West",
  "Ondo":          "South-West",  "Osun":        "South-West",  "Oyo":          "South-West",
  "Benue":         "North-Central","FCT":         "North-Central","Kogi":        "North-Central",
  "Kwara":         "North-Central","Nasarawa":    "North-Central","Niger":       "North-Central",
  "Plateau":       "North-Central",
  "Adamawa":       "North-East",  "Bauchi":      "North-East",  "Borno":        "North-East",
  "Gombe":         "North-East",  "Taraba":      "North-East",  "Yobe":         "North-East",
  "Jigawa":        "North-West",  "Kaduna":      "North-West",  "Kano":         "North-West",
  "Katsina":       "North-West",  "Kebbi":       "North-West",  "Sokoto":       "North-West",
  "Zamfara":       "North-West",
};

// Normalise state name: strip " State" suffix for zone lookup
function getZone(state: string): string {
  const clean = (state || "").replace(/ State$/i, "").trim();
  return STATE_ZONE[clean] || "Other";
}

// ============================================================================
// GET
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const url   = new URL(request.url);
    const tier  = (url.searchParams.get("tier") || "CORPORATE").toUpperCase();
    const zone  = url.searchParams.get("zone")  || "";   // e.g. "South-West"
    const risk  = url.searchParams.get("risk")  || "";   // e.g. "CRITICAL"
    const sort  = url.searchParams.get("sort")  || "shortage_risk"; // shortage_risk|supply_score|price_volatility|trend_7d

    // Tier gate
    if (!hasTierAccess(tier)) {
      return NextResponse.json({
        success: false,
        error:   "upgrade_required",
        message: "Supplier Intelligence requires CORPORATE tier or higher",
        upgradeUrl: "/pricing",
      }, { status: 403 });
    }

    const pool = await getPool();
    if (!pool) {
      return NextResponse.json({
        success: false,
        error:   "db_unavailable",
        message: "Database connection unavailable",
      }, { status: 503 });
    }

    // ── Core SQL Batch ─────────────────────────────────────────────────────────
    // Strategy:
    //   1. Pull current price snapshot from Latest_Prices_Summary (always fresh)
    //   2. Pull 7-day-ago price snapshot from Daily_Prices (2026 data available)
    //   3. Self-join on item+market to compute trend_7d and volatility
    //   4. Derive supply_score and shortage_risk from computed values
    //
    // supply_score (0-100):
    //   Proxy for supply abundance. Based on:
    //   - submission_count (more submissions = more active market = higher supply)
    //   - price_volatility (high volatility = supply stress = lower score)
    //   - trend_7d (rising prices = supply tightening = lower score)
    //
    // shortage_risk:
    //   CRITICAL  — supply_score < 25
    //   WARNING   — supply_score 25-39
    //   WATCH     — supply_score 40-59
    //   NORMAL    — supply_score >= 60

    const batchSql = `
      -- Cleanup
      IF OBJECT_ID('tempdb..#SupplierBase') IS NOT NULL DROP TABLE #SupplierBase;
      IF OBJECT_ID('tempdb..#Week7Ago')     IS NOT NULL DROP TABLE #Week7Ago;
      IF OBJECT_ID('tempdb..#Supplier')     IS NOT NULL DROP TABLE #Supplier;

      -- Step 1: Current snapshot from Latest_Prices_Summary
      SELECT
        lp.item_id,
        lp.item_name,
        lp.category_id,
        lp.category_name,
        lp.market_id,
        lp.market_name,
        lp.state,
        CAST(lp.price_naira  AS FLOAT)   AS current_price,
        lp.submission_count              AS sub_count,
        lp.price_date                    AS latest_date
      INTO #SupplierBase
      FROM dbo.Latest_Prices_Summary lp
      WHERE lp.price_naira > 0
        AND lp.item_id IS NOT NULL
        AND lp.market_id IS NOT NULL;

      -- Step 2: Week-ago prices from Daily_Prices (closest available to -7 days)
      SELECT
        dp.item_id,
        dp.market_id,
        CAST(AVG(dp.price_naira) AS FLOAT) AS price_7d_ago
      INTO #Week7Ago
      FROM dbo.Daily_Prices dp
      WHERE dp.price_date >= DATEADD(DAY, -10, CAST(GETDATE() AS DATE))
        AND dp.price_date <= DATEADD(DAY, -6,  CAST(GETDATE() AS DATE))
        AND dp.price_naira > 0
      GROUP BY dp.item_id, dp.market_id;

      -- Step 3: Join + compute metrics
      SELECT
        sb.item_name,
        sb.category_name,
        sb.market_name,
        sb.state,
        sb.current_price                                         AS avg_price,
        sb.sub_count                                             AS submission_count,
        sb.latest_date,

        -- Trend 7d: (current - week ago) / week ago * 100
        CASE
          WHEN w7.price_7d_ago IS NOT NULL AND w7.price_7d_ago > 0
          THEN ROUND((sb.current_price - w7.price_7d_ago) / w7.price_7d_ago * 100, 1)
          ELSE 0.0
        END                                                      AS trend_7d,

        -- Volatility proxy: ABS(trend) as a stand-in until STDEV is available
        CASE
          WHEN w7.price_7d_ago IS NOT NULL AND w7.price_7d_ago > 0
          THEN ROUND(ABS((sb.current_price - w7.price_7d_ago) / w7.price_7d_ago * 100), 1)
          ELSE 0.0
        END                                                      AS price_volatility,

        -- supply_score: 100 base, penalise for high volatility + price rise + low submissions
        -- Capped 0-100
        CASE WHEN
          CONVERT(INT,
            GREATEST(0, LEAST(100,
              100
              -- Penalise price rises (supply tightening signal): up to -40 pts at +40% rise
              - CASE
                  WHEN w7.price_7d_ago IS NOT NULL AND w7.price_7d_ago > 0
                  THEN GREATEST(0, LEAST(40,
                    (sb.current_price - w7.price_7d_ago) / w7.price_7d_ago * 100
                  ))
                  ELSE 0
                END
              -- Penalise low submission count (low market activity = low supply visibility)
              - CASE
                  WHEN sb.sub_count IS NULL OR sb.sub_count = 0 THEN 30
                  WHEN sb.sub_count < 3  THEN 20
                  WHEN sb.sub_count < 5  THEN 10
                  WHEN sb.sub_count < 10 THEN 5
                  ELSE 0
                END
              -- Penalise high volatility
              - CASE
                  WHEN w7.price_7d_ago IS NOT NULL AND w7.price_7d_ago > 0
                  THEN GREATEST(0, LEAST(20,
                    ABS((sb.current_price - w7.price_7d_ago) / w7.price_7d_ago * 100) / 2
                  ))
                  ELSE 10  -- no historical data = unknown supply = -10
                END
            ))
          ) > 0 THEN
          CONVERT(INT,
            GREATEST(0, LEAST(100,
              100
              - CASE
                  WHEN w7.price_7d_ago IS NOT NULL AND w7.price_7d_ago > 0
                  THEN GREATEST(0, LEAST(40,
                    (sb.current_price - w7.price_7d_ago) / w7.price_7d_ago * 100
                  ))
                  ELSE 0
                END
              - CASE
                  WHEN sb.sub_count IS NULL OR sb.sub_count = 0 THEN 30
                  WHEN sb.sub_count < 3  THEN 20
                  WHEN sb.sub_count < 5  THEN 10
                  WHEN sb.sub_count < 10 THEN 5
                  ELSE 0
                END
              - CASE
                  WHEN w7.price_7d_ago IS NOT NULL AND w7.price_7d_ago > 0
                  THEN GREATEST(0, LEAST(20,
                    ABS((sb.current_price - w7.price_7d_ago) / w7.price_7d_ago * 100) / 2
                  ))
                  ELSE 10
                END
            ))
          )
          ELSE 0
        END                                                      AS supply_score

      INTO #Supplier
      FROM #SupplierBase sb
      LEFT JOIN #Week7Ago w7
        ON w7.item_id   = sb.item_id
       AND w7.market_id = sb.market_id;

      -- Step 4: Final SELECT with shortage_risk derived from supply_score
      SELECT TOP 500
        item_name,
        ISNULL(category_name, 'Other')                          AS category_name,
        market_name,
        state,
        ROUND(avg_price, 2)                                      AS avg_price,
        submission_count,
        CONVERT(VARCHAR(10), latest_date, 23)                   AS metric_date,
        ROUND(trend_7d, 1)                                       AS trend_7d,
        ROUND(price_volatility, 1)                               AS price_volatility,
        supply_score,
        CASE
          WHEN supply_score < 25 THEN 'CRITICAL'
          WHEN supply_score < 40 THEN 'WARNING'
          WHEN supply_score < 60 THEN 'WATCH'
          ELSE 'NORMAL'
        END                                                      AS shortage_risk,
        CASE
          WHEN trend_7d >  10 THEN 'HIGH'
          WHEN trend_7d >   3 THEN 'MEDIUM'
          ELSE 'LOW'
        END                                                      AS demand_indicator,
        -- trend_30d: placeholder — Daily_Prices only goes back to early 2026
        -- Will auto-populate as data accumulates
        0.0                                                      AS trend_30d
      FROM #Supplier
      ORDER BY supply_score ASC, trend_7d DESC;
    `;

    let rows: any[] = [];
    try {
      const batchResult = await pool.request().batch(batchSql);
      rows = batchResult?.recordset || [];
      console.log(`[supplier v2] Batch OK — ${rows.length} rows`);
    } catch (batchErr: any) {
      console.error("[supplier v2] Batch FAILED:", batchErr?.message);
      // Reset pool on failure
      try { await pool.close(); } catch {}
      _pool = null;
      throw batchErr;
    }

    // ── Enrich with zone mapping ───────────────────────────────────────────────
    const metrics = rows.map((r: any) => ({
      item_name:        String(r.item_name   || ""),
      category_name:    String(r.category_name || "Other"),
      market_name:      String(r.market_name || ""),
      state:            String(r.state        || ""),
      zone:             getZone(String(r.state || "")),
      avg_price:        parseFloat(r.avg_price)       || 0,
      submission_count: parseInt(r.submission_count)   || 0,
      metric_date:      String(r.metric_date  || ""),
      trend_7d:         parseFloat(r.trend_7d)         || 0,
      trend_30d:        parseFloat(r.trend_30d)        || 0,
      price_volatility: parseFloat(r.price_volatility) || 0,
      supply_score:     parseInt(r.supply_score)       || 0,
      shortage_risk:    String(r.shortage_risk || "NORMAL"),
      demand_indicator: String(r.demand_indicator || "LOW"),
    }));

    // ── Apply filters (zone, risk level) ──────────────────────────────────────
    let filtered = metrics;
    if (zone && zone !== "All Zones" && zone !== "") {
      filtered = filtered.filter(m => m.zone === zone);
    }
    if (risk && risk !== "ALL" && risk !== "") {
      filtered = filtered.filter(m => m.shortage_risk === risk);
    }

    // ── Sort ──────────────────────────────────────────────────────────────────
    const RISK_ORDER: Record<string, number> = { CRITICAL: 0, WARNING: 1, WATCH: 2, NORMAL: 3 };
    filtered.sort((a, b) => {
      if (sort === "supply_score")     return a.supply_score - b.supply_score;
      if (sort === "price_volatility") return b.price_volatility - a.price_volatility;
      if (sort === "trend_7d")         return Math.abs(b.trend_7d) - Math.abs(a.trend_7d);
      // Default: shortage_risk
      return (RISK_ORDER[a.shortage_risk] ?? 4) - (RISK_ORDER[b.shortage_risk] ?? 4);
    });

    // ── Aggregate stats for header KPI cards ─────────────────────────────────
    const allMarkets  = new Set(metrics.map(m => m.market_name)).size;
    const allCommodities = new Set(metrics.map(m => m.item_name)).size;
    const avgSupplyScore = metrics.length > 0
      ? Math.round(metrics.reduce((s, m) => s + m.supply_score, 0) / metrics.length)
      : 0;
    const criticalAlerts  = metrics.filter(m => m.shortage_risk === "CRITICAL").length;
    const warningAlerts   = metrics.filter(m => m.shortage_risk === "WARNING").length;
    const avgVolatility   = metrics.length > 0
      ? parseFloat((metrics.reduce((s, m) => s + m.price_volatility, 0) / metrics.length).toFixed(1))
      : 0;

    const stats = {
      total_markets:    allMarkets,
      total_commodities: allCommodities,
      avg_supply_score:  avgSupplyScore,
      critical_alerts:   criticalAlerts,
      warning_alerts:    warningAlerts,
      avg_volatility:    avgVolatility,
    };

    return NextResponse.json({
      success: true,
      count:   filtered.length,
      total:   metrics.length,
      source:  "Latest_Prices_Summary + Daily_Prices (live computed)",
      stats,
      metrics: filtered,
    });

  } catch (error: any) {
    console.error("[Supplier API v2 Error]", error?.message || error);
    return NextResponse.json({
      success: false,
      error:   "server_error",
      message: "Failed to load supplier data",
    }, { status: 500 });
  }
}
