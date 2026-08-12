// ============================================================================
// NAIJAFOOD INTEL - ARBITRAGE OPPORTUNITIES API
// File: src/app/api/arbitrage/route.ts
// Bloomberg Equivalent: ARBI <GO>
// Version: 15.0 - v15: Transport_Fares state-level fallback (no more flat ₦8,500)
// Date: 2026-03-13
// ROOT CAUSE FIX: TOP N was applied BEFORE JS state filtering — so Ogun/any non-top
// state pairs were never returned. Now: SQL injects state filter so TOP N applies
// AFTER state filter. Also: LIKE replaces strict = so "Ogun" matches "Ogun State".
// Also: category filter pushed into CTE WHERE for better temp table performance.
//
// WHAT'S NEW IN v6.0:
//   - Transport costs precomputed for ALL 226×225/2 = 25,425 market pairs
//   - JOINs to dbo.vw_Market_Transport instead of runtime Haversine
//   - Lagos premium (1.40×), FCT discount (0.92×), state-specific multipliers
//   - Realistic rates: ₦8-35/km + ₦3,000 fixed + ₦2/km checkpoints
//   - Category weight multipliers (livestock 10×, frozen 3.5×, etc.)
//   - Single SQL query computes everything — no JS transport math
//
// Sources: NBS Transport Fare Watch, NARTO, Kobo360 data,
//   Mordor Intelligence Nigeria Freight Report 2025-2030
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { isSupabase, getSupabaseConnection } from "@/lib/db-supabase";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { checkQuery, logQuery } from "@/lib/query-gate";

// ============================================================================
// MSSQL CONNECTION POOL (single pool — temp tables persist within a request)
// ============================================================================

// ── Exact same config as inflation route (which works) ─────────────────────
const SQL_CONFIG: sql.config = {
  server:   process.env.AZURE_SQL_SERVER   || process.env.DATABASE_SERVER   || "naijafood.database.windows.net",
  database: process.env.AZURE_SQL_DATABASE || process.env.DATABASE_NAME     || "naijafoodmarket-live",
  user:     process.env.AZURE_SQL_USER     || process.env.DATABASE_USER     || "",
  password: process.env.AZURE_SQL_PASSWORD || process.env.DATABASE_PASSWORD || "",
  options: {
    encrypt:                true,
    trustServerCertificate: false,
  },
  connectionTimeout: 30000,
  requestTimeout:    60000,   // temp table build needs more time
  pool: {
    max:                  5,
    min:                  1,
    idleTimeoutMillis:    60000,
    acquireTimeoutMillis: 30000,
  },
};

let _pool: sql.ConnectionPool | null = null;

async function getPool(): Promise<sql.ConnectionPool | null> {
  if (isSupabase()) return (await getSupabaseConnection()) as unknown as sql.ConnectionPool;
  // Check pool is truly healthy — .connected can be stale after Vercel cold start
  if (_pool && _pool.connected) {
    try {
      // Lightweight ping to confirm connection is alive
      await _pool.request().query("SELECT 1 AS ping");
      return _pool;
    } catch {
      // Connection dropped — close and recreate
      console.warn("[arbitrage v15] Pool ping failed — reconnecting");
      try { await _pool.close(); } catch {}
      _pool = null;
    }
  }

  if (!SQL_CONFIG.user || !SQL_CONFIG.password) {
    console.warn("[arbitrage v15] SQL credentials not set in env vars");
    return null;
  }

  try {
    _pool = await new sql.ConnectionPool(SQL_CONFIG).connect();
    console.log("[arbitrage v15] Connection pool established");
    return _pool;
  } catch (err) {
    console.error("[arbitrage v15] Failed to create connection pool:", err);
    _pool = null;
    return null;
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface TierConfig {
  hasAccess: boolean;
  minProfitFloor: number;
  maxResults: number;
}

interface TransportResult {
  distance: number;
  fuelCost: number;
  loadingCost: number;
  checkpointCost: number;
  totalCost: number;
  label: string;
  ratePerKm: number;
  weightMultiplier: number;
  categoryNote: string;
}

interface ConfidenceResult {
  score: number;
  label: string;
  color: string;
}

interface ArbitrageOpportunity {
  id: string;
  itemId: string;
  itemName: string;
  categoryName: string;
  unit: string;
  buyMarket: {
    id: string; name: string; state: string; price: number; updatedAt: string;
  };
  sellMarket: {
    id: string; name: string; state: string; price: number; updatedAt: string;
  };
  grossProfit: number;
  transportCost: number;
  netProfit: number;
  profitPercentage: number;
  distance: number;
  confidence: ConfidenceResult;
  transportLabel: string;
}

// ============================================================================
// CATEGORY CONFIGURATION
// ============================================================================

// Food-related categories ONLY (NaijaFood Intel = food price platform)
const FOOD_CATEGORIES = new Set([
  "CAT001",  // Grains & Cereals
  "CAT002",  // Vegetables & Peppers
  "CAT003",  // Oils & Fats
  "CAT004",  // Frozen Foods & Poultry
  "CAT005",  // Beverages
  "CAT006",  // Plantain & Protein
  "CAT007",  // Seasoning & Spices
  "CAT008",  // Dried Fish & Stockfish
  "CAT009",  // Flour & Bakery
  "CAT010",  // Bread
  "CAT013",  // Dairy & Milk
  "CAT014",  // Tubers & Yam
  "CAT015",  // Beans & Legumes
  "CAT070",  // Poultry & Livestock
  "CAT103",  // Fish (NBS)
]);

const FOOD_CAT_SQL = Array.from(FOOD_CATEGORIES).map(c => `'${c}'`).join(",");

const CATEGORY_MAP: Record<string, string> = {
  "CAT001": "Grains & Cereals", "CAT002": "Tubers", "CAT003": "Vegetables",
  "CAT004": "Fruits", "CAT005": "Oils & Fats", "CAT006": "Protein",
  "CAT007": "Seasoning & Spices", "CAT008": "Sweeteners", "CAT009": "Beverages",
  "CAT010": "Building Materials", "CAT011": "Livestock",
  "CAT012": "Fish & Seafood", "CAT013": "Condiments", "CAT014": "Processed Foods",
  "CAT015": "Personal Care", "CAT016": "Baby Products", "CAT017": "Health",
  "CAT018": "Household", "CAT019": "Electronics", "CAT020": "Fashion",
  "CAT021": "Fabrics & Textiles", "CAT022": "Stationery", "CAT023": "Auto Parts",
  "CAT024": "Poultry & Feed", "CAT025": "Agricultural Inputs",
  "CAT030": "Electrical", "CAT069": "Seeds & Seedlings",
  "CAT070": "Livestock (Large)", "CAT092": "Appliances", "CAT099": "Feminine Care",
};

// Category weight multiplier — adjusts per-bag transport cost to actual unit
// Base: 1.0 = standard 50kg bag (rice, beans, flour)
const CATEGORY_WEIGHT_MULTIPLIER: Record<string, number> = {
  // Standard bags — 1.0×
  "CAT001": 1.0,   // Grains & Cereals (rice, maize, wheat)
  "CAT005": 1.2,   // Oils & Fats (heavy liquids, spillage risk)
  "CAT008": 1.0,   // Sweeteners (sugar bags)
  "CAT014": 1.0,   // Processed Foods (standard packs)
  "CAT025": 1.0,   // Agricultural Inputs (fertilizer bags)

  // Heavy/bulky — 1.5-2.0×
  "CAT002": 1.8,   // Tubers (yam, cassava — heavy, individual handling)
  "CAT010": 2.5,   // Building Materials (cement, rods — very heavy)
  "CAT030": 1.5,   // Electrical (bulky items)
  "CAT092": 2.0,   // Appliances (large, fragile)

  // Perishables — 2.0-3.5× (speed premium, cold chain, loss risk)
  "CAT003": 2.0,   // Vegetables (tomatoes, peppers — perishable, fragile)
  "CAT004": 2.5,   // Fruits (fragile, spoilage)
  "CAT006": 2.5,   // Protein (meat — cold chain needed)
  "CAT012": 3.5,   // Fish & Seafood (cold chain, ice, speed premium)
  "CAT024": 2.0,   // Poultry & Feed (live poultry or frozen)

  // Livestock — 8-10× (cattle truck, handler, feed, water, vet cert)
  "CAT011": 8.0,   // Livestock (goats, sheep)
  "CAT070": 10.0,  // Livestock Large (cattle, camels)

  // Light/small — 0.3-0.8× (multiple units per bag space)
  "CAT007": 0.5,   // Seasoning & Spices (small packs)
  "CAT009": 0.8,   // Beverages (crates)
  "CAT013": 0.5,   // Condiments (small jars/packs)
  "CAT015": 0.3,   // Personal Care (light, small)
  "CAT016": 0.3,   // Baby Products (light)
  "CAT017": 0.3,   // Health (light, small packs)
  "CAT018": 0.5,   // Household (mixed)
  "CAT019": 1.5,   // Electronics (fragile, insurance)
  "CAT020": 0.5,   // Fashion (light)
  "CAT021": 0.8,   // Fabrics & Textiles (bales)
  "CAT022": 0.3,   // Stationery (light)
  "CAT023": 1.5,   // Auto Parts (heavy, varied)
  "CAT069": 0.5,   // Seeds & Seedlings (light)
  "CAT099": 0.3,   // Feminine Care (light)
};

// ============================================================================
// TIER ACCESS CONFIGURATION
// ============================================================================

const DEFAULT_TIER_CONFIG: TierConfig = { hasAccess: false, minProfitFloor: 100, maxResults: 0 };

const TIER_ACCESS: Record<string, TierConfig> = {
  FREE:       { hasAccess: false, minProfitFloor: 100, maxResults: 0 },
  SILVER:     { hasAccess: false, minProfitFloor: 100, maxResults: 0 },
  GOLD:       { hasAccess: true,  minProfitFloor: 5,   maxResults: 20 },
  BUSINESS:   { hasAccess: true,  minProfitFloor: 3,   maxResults: 50 },
  CORPORATE:  { hasAccess: true,  minProfitFloor: 1,   maxResults: 100 },
  ENTERPRISE: { hasAccess: true,  minProfitFloor: 0,   maxResults: 500 },
  OGA_BOSS:   { hasAccess: true,  minProfitFloor: 0,   maxResults: 500 },
  GOVERNMENT: { hasAccess: true,  minProfitFloor: 0,   maxResults: 500 },
};

function getTierConfig(tier: string): TierConfig {
  return TIER_ACCESS[tier] || TIER_ACCESS["FREE"] || DEFAULT_TIER_CONFIG;
}

// ============================================================================
// CONFIDENCE SCORER
// ============================================================================

function calculateConfidence(priceDate: string | Date | null): ConfidenceResult {
  if (!priceDate) return { score: 50, label: "Unknown", color: "gray" };
  const now = new Date();
  const date = priceDate instanceof Date ? priceDate : new Date(priceDate);
  const daysOld = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

  if (daysOld < 1) return { score: 95, label: "Very Fresh", color: "green" };
  if (daysOld < 3) return { score: 85, label: "Fresh", color: "green" };
  if (daysOld < 7) return { score: 65, label: "Recent", color: "yellow" };
  if (daysOld < 14) return { score: 45, label: "Moderate", color: "orange" };
  return { score: 25, label: "Stale", color: "red" };
}

// ============================================================================
// ARBITRAGE FINDER — uses precomputed Market_Distances
// ============================================================================

async function findArbitrageOpportunities(
  _prisma: any,   // kept for signature compat — internally uses mssql pool
  minProfitPct: number,
  maxResults: number,
  filterItem?: string,
  filterCategory?: string,
  filterBuyState?: string,
  filterSellState?: string
): Promise<ArbitrageOpportunity[]> {
  const pool = await getPool();
  if (!pool) return [];

  // ── v14 FIX: Category ID resolution (used in BOTH SQL and JS) ──────────────
  let resolvedCatId: string | undefined;
  if (filterCategory) {
    resolvedCatId = filterCategory.startsWith("CAT")
      ? filterCategory
      : Object.entries(CATEGORY_MAP).find(([, v]) => v === filterCategory)?.[0] || filterCategory;
  }

  // ── v14 FIX: Safe SQL injection for state/category filters ─────────────────
  // BUG FIX 1: TOP N was applied BEFORE JS state filtering, so Ogun→Lagos pairs
  // ranked below position 300 were never returned — always 0 results.
  // SOLUTION: When state filters are active, inject them into SQL so TOP N is
  // applied AFTER the state filter. Use safe string escaping (no user concat risk
  // since values come from a controlled dropdown, not free-text input).
  //
  // BUG FIX 2: JS used strict !== equality on state names. DB may store
  // "Ogun State" while dropdown sends "Ogun". Now using LIKE in SQL instead.

  const sqlStateConditions: string[] = [];
  if (filterBuyState) {
    const safe = filterBuyState.replace(/'/g, "''");
    // LIKE with % handles "Ogun" matching "Ogun State" and vice versa
    sqlStateConditions.push(`AND p1.state LIKE '%${safe}%'`);
  }
  if (filterSellState) {
    const safe = filterSellState.replace(/'/g, "''");
    sqlStateConditions.push(`AND p2.state LIKE '%${safe}%'`);
  }
  const sqlStateWhere = sqlStateConditions.join(" ");

  // When state filters are active: expand TOP N to see ALL pairs for that state,
  // not just the global top 300. Without this, low-ranked state pairs are invisible.
  // State-filtered queries return far fewer rows so this is still fast.
  const hasStateFilter = !!(filterBuyState || filterSellState);
  const topN = hasStateFilter
    ? 5000                            // All state pairs — critical for state filtering
    : Math.min(maxResults * 3, 300);  // Global browse — keep fast

  const catFilter = resolvedCatId
    ? `AND lp.category_id = '${resolvedCatId.replace(/'/g, "''")}'`
    : "";

  // ── v12 KEY FIX: pool.request().batch() sends ALL statements as ONE T-SQL batch
  // on a SINGLE connection — #StatePrices persists for the full batch.
  const batchSql = `
    -- Cleanup any leftover from failed previous run
    IF OBJECT_ID('tempdb..#StatePrices') IS NOT NULL DROP TABLE #StatePrices;

    -- Step 1: Materialize state averages (258ms in SSMS benchmark)
    -- v14: category filter applied HERE to reduce temp table size when category selected
    SELECT
      lp.item_id, lp.item_name, lp.unit, lp.category_id, lp.state,
      AVG(lp.price_naira)        AS avg_price,
      MAX(lp.price_date)         AS latest_date,
      MIN(lp.market_name)        AS buy_market,
      MAX(lp.market_name)        AS sell_market,
      MIN(lp.market_id)          AS buy_market_id,
      MAX(lp.market_id)          AS sell_market_id
    INTO #StatePrices
    FROM dbo.Latest_Prices_Summary lp
    WHERE lp.price_naira > 0
      AND lp.category_id IN (${FOOD_CAT_SQL})
      ${catFilter}
    GROUP BY lp.item_id, lp.item_name, lp.unit, lp.category_id, lp.state;

    -- Step 2: Index for self-join (49ms in SSMS benchmark)
    CREATE INDEX IX_SP ON #StatePrices (item_id, avg_price)
    INCLUDE (item_name, unit, category_id, state, latest_date,
             buy_market, sell_market, buy_market_id, sell_market_id);

    -- Step 3: Self-join + transport (same batch = same connection = #StatePrices alive)
    -- v14 FIX: sqlStateWhere injected HERE so TOP N applies AFTER state filtering.
    -- This is the root cause fix — previously TOP 300 was global (all states),
    -- then JS tried to filter by state on an already-truncated result set.
    -- tf = Transport_Fares fallback by state (populated by transport_fare_scraper)
    SELECT TOP ${topN}
      p1.item_id,
      p1.item_name,
      p1.unit,
      p1.category_id,
      p1.buy_market_id                                              AS buy_market_id,
      p1.buy_market                                                 AS buy_market,
      p1.state                                                      AS buy_state,
      CAST(p1.avg_price  AS FLOAT)                                  AS buy_price,
      p1.latest_date                                                AS buy_date,
      p2.sell_market_id                                             AS sell_market_id,
      p2.sell_market                                                AS sell_market,
      p2.state                                                      AS sell_state,
      CAST(p2.avg_price  AS FLOAT)                                  AS sell_price,
      p2.latest_date                                                AS sell_date,
      -- Distance: market-level view first, then estimate from state fare, then 500km
      COALESCE(
        CAST(t.road_distance_km AS FLOAT),
        CAST(tf.fare_per_tonne AS FLOAT) / 17.0,
        500
      )                                                             AS distance_km,
      -- Transport cost: market-level → state-level (Transport_Fares) → last resort
      COALESCE(
        CAST(t.total_cost_per_bag AS FLOAT),
        CAST(tf.fare_per_tonne AS FLOAT),
        15000
      )                                                             AS transport_cost,
      -- Label: show real distance band or state pair
      COALESCE(
        t.distance_band,
        CASE
          WHEN tf.fare_per_tonne IS NOT NULL
          THEN CONCAT(p1.state, ' → ', p2.state)
          ELSE 'Inter-State (est.)'
        END
      )                                                             AS distance_band,
      ISNULL(CAST(t.rate_per_km AS FLOAT), 17.0)                   AS rate_per_km,
      ISNULL(CAST(t.road_quality_mult AS FLOAT), 1.0)              AS road_quality_mult,
      ISNULL(CAST(t.fuel_haulage_cost AS FLOAT),
        COALESCE(CAST(tf.fare_per_tonne AS FLOAT) * 0.70, 5950))   AS fuel_haulage_cost,
      ISNULL(CAST(t.checkpoint_cost AS FLOAT), 850)                AS checkpoint_cost_val,
      ISNULL(CAST(t.fixed_cost AS FLOAT), 1700)                    AS fixed_cost_val,
      CAST(p2.avg_price - p1.avg_price AS FLOAT)                   AS gross_profit,
      CAST(p2.avg_price - p1.avg_price
           - COALESCE(
               CAST(t.total_cost_per_bag AS FLOAT),
               CAST(tf.fare_per_tonne AS FLOAT),
               15000
             ) AS FLOAT)                                           AS raw_net_profit,
      ROUND(
        CAST(p2.avg_price - p1.avg_price
             - COALESCE(
                 CAST(t.total_cost_per_bag AS FLOAT),
                 CAST(tf.fare_per_tonne AS FLOAT),
                 15000
               ) AS FLOAT)
        / CAST(p1.avg_price AS FLOAT) * 100, 1
      )                                                             AS raw_profit_pct
    FROM #StatePrices p1
    JOIN #StatePrices p2
      ON  p1.item_id   = p2.item_id
      AND p1.state    != p2.state
      AND p2.avg_price > p1.avg_price
    -- Level 1: market-pair exact match
    LEFT JOIN dbo.vw_Market_Transport t
      ON  t.market_a_id = p1.buy_market_id
      AND t.market_b_id = p2.sell_market_id
    -- Level 2: state-pair fallback from Transport_Fares (NARTO + scraped rates)
    LEFT JOIN dbo.Transport_Fares tf
      ON  tf.origin_state      = p1.state
      AND tf.destination_state = p2.state
      AND tf.vehicle_class     = 'TRUCK_5T'
      AND tf.is_current        = 1
      AND t.market_a_id IS NULL  -- only use when Level 1 missed
    WHERE CAST(p2.avg_price - p1.avg_price
               - COALESCE(
                   CAST(t.total_cost_per_bag AS FLOAT),
                   CAST(tf.fare_per_tonne AS FLOAT),
                   15000
                 ) AS FLOAT) > 0
      ${sqlStateWhere}
    ORDER BY raw_profit_pct DESC;
  `;
  // ⚠️  DROP TABLE is at the TOP of the batch (cleanup of previous run).
  // It must NOT appear at the end — mssql .batch() returns the last resultset.
  // DROP TABLE produces no recordset → batchResult.recordset = undefined → crash.
  // SELECT TOP must be the FINAL statement so batchResult.recordset = our rows.

  let results: any[] = [];
  try {
    const batchResult = await pool.request().batch(batchSql);
    results = batchResult?.recordset || [];
    console.log(`[arbitrage v15] Batch OK — ${results.length} rows (topN=${topN}, stateFilter=${hasStateFilter})`);
  } catch (batchErr: any) {
    console.error("[arbitrage v15] Batch FAILED:", batchErr?.message || batchErr);
    console.error("[arbitrage v15] Error number:", batchErr?.number, "| State:", batchErr?.state);
    try { await pool.close(); } catch {}
    _pool = null;
    throw batchErr;
  }

  // ── JS-level filtering (item, category only — state now filtered in SQL) ───
  // v15: State filtering moved to SQL WHERE so TOP N applies AFTER state filter.
  // JS still filters item text-search and category as a safety net.
  const filtered = results.filter((r: any) => {
    if (filterItem) {
      const name = String(r.item_name || "").toLowerCase();
      if (!name.includes(filterItem.toLowerCase())) return false;
    }
    if (resolvedCatId) {
      if (r.category_id !== resolvedCatId) return false;
    }
    // v15: State filter is now in SQL (LIKE-based), but keep JS as secondary
    // safety using INCLUDES instead of === to handle "Ogun" vs "Ogun State" edge cases
    if (filterBuyState) {
      const dbState = String(r.buy_state || "").toLowerCase();
      const filterLower = filterBuyState.toLowerCase();
      if (!dbState.includes(filterLower) && !filterLower.includes(dbState)) return false;
    }
    if (filterSellState) {
      const dbState = String(r.sell_state || "").toLowerCase();
      const filterLower = filterSellState.toLowerCase();
      if (!dbState.includes(filterLower) && !filterLower.includes(dbState)) return false;
    }
    return true;
  });

  // Map to ArbitrageOpportunity with category-aware transport
  return filtered
    .map((r: any) => {
      const buyPrice = parseFloat(r.buy_price) || 0;
      const sellPrice = parseFloat(r.sell_price) || 0;
      const baseTransport = parseFloat(r.transport_cost) || 0;
      const distance = parseFloat(r.distance_km) || 0;
      const catId = String(r.category_id || "");

      // Apply category weight multiplier
      const weightMult = CATEGORY_WEIGHT_MULTIPLIER[catId] || 1.0;
      const adjustedTransport = Math.round(baseTransport * weightMult);
      const grossProfit = Math.round(sellPrice - buyPrice);
      const netProfit = Math.round(sellPrice - buyPrice - adjustedTransport);
      const profitPct = buyPrice > 0
        ? Math.round((netProfit / buyPrice) * 1000) / 10
        : 0;

      // Skip if not profitable after category adjustment
      if (netProfit <= 0 || profitPct < minProfitPct) return null;

      // Confidence based on oldest price date
      const oldestDate = r.buy_date < r.sell_date ? r.buy_date : r.sell_date;
      const confidence = calculateConfidence(oldestDate);

      return {
        id: `${r.item_id}-${r.buy_market_id}-${r.sell_market_id}`,
        itemId: r.item_id,
        itemName: r.item_name,
        categoryName: CATEGORY_MAP[catId] || "Other",
        unit: r.unit || "unit",
        buyMarket: {
          id: r.buy_market_id,
          name: r.buy_market,
          state: r.buy_state,
          price: Math.round(buyPrice),
          updatedAt: r.buy_date?.toISOString?.() || String(r.buy_date || ""),
        },
        sellMarket: {
          id: r.sell_market_id,
          name: r.sell_market,
          state: r.sell_state,
          price: Math.round(sellPrice),
          updatedAt: r.sell_date?.toISOString?.() || String(r.sell_date || ""),
        },
        grossProfit,
        transportCost: adjustedTransport,
        netProfit,
        profitPercentage: profitPct,
        distance: Math.round(distance),
        confidence,
        // v15 FIX: distance_band varchar col corrupts → to ? — build label from state names
        transportLabel: (function() {
          var band = String(r.distance_band || '');
          // If band contains ? (corrupted arrow) or is empty, format from states
          if (!band || band.includes('?') || band.length < 3) {
            return String(r.buy_state || '') + ' to ' + String(r.sell_state || '');
          }
          return band;
        })(),
      } as ArbitrageOpportunity;
    })
    .filter((opp): opp is ArbitrageOpportunity => opp !== null)
    .slice(0, maxResults);
}

// ============================================================================
// GET — List arbitrage opportunities
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const prisma = null;  // v11: mssql used internally, prisma arg kept for compat
    const url = new URL(request.url);

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tier = ((session.user as any).tier || "FREE").toUpperCase();
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
    const item = url.searchParams.get("item") || undefined;
    const category = url.searchParams.get("category") || undefined;
    const buyState = url.searchParams.get("buyState") || undefined;
    const sellState = url.searchParams.get("sellState") || undefined;
    const userMinProfit = url.searchParams.get("minProfit");

    // FREE-tier weekly query gate — only on explicit search (count=1).
    // NOTE: arbitrage is GOLD+ (FREE is 403'd below) and the gate only limits
    // FREE, so this is currently inert; added for symmetry/future-proofing.
    if (url.searchParams.get("count") === "1") {
      try {
        const session = await getServerSession(authOptions);
        const userId = (session?.user as any)?.id;
        const sTier = (session?.user as any)?.tier || "FREE";
        if (userId) {
          const gate = await checkQuery(userId, sTier);
          if (!gate.allowed) {
            return NextResponse.json(
              { success: false, error: "query_limit_reached", message: gate.upsell, remaining: 0, upgrade_url: "/subscribe" },
              { status: 429 }
            );
          }
          await logQuery(userId, sTier, "WEB", { item_name: item });
        }
      } catch (gateErr: any) {
        console.error("[arbitrage] query-gate error (fail-open):", gateErr?.message);
      }
    }

    const tierConfig = getTierConfig(tier);

    if (!tierConfig.hasAccess) {
      return NextResponse.json({
        success: false,
        error: "upgrade_required",
        message: "Arbitrage requires GOLD tier or higher. Upgrade at naijamarket-web.vercel.app/pricing",
        upgradeUrl: "/pricing",
      }, { status: 403 });
    }

    const minProfit = userMinProfit
      ? Math.max(parseFloat(userMinProfit) || 0, tierConfig.minProfitFloor)
      : tierConfig.minProfitFloor;

    const allOpportunities = await findArbitrageOpportunities(
      prisma, minProfit, tierConfig.maxResults, item, category, buyState, sellState
    );

    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;
    const opportunities = allOpportunities.slice(startIdx, endIdx);

    return NextResponse.json({
      success: true,
      data: {
        opportunities,
        pagination: {
          page,
          limit,
          total: allOpportunities.length,
          totalPages: Math.ceil(allOpportunities.length / limit),
          hasMore: endIdx < allOpportunities.length,
        },
        tierInfo: {
          tier,
          minProfitFloor: tierConfig.minProfitFloor,
          appliedMinProfit: minProfit,
          maxResults: tierConfig.maxResults,
        },
        meta: {
          generatedAt: new Date().toISOString(),
          transportModel: "Precomputed Market_Distances v6.0 (Feb 2026)",
          dieselPrice: "₦1,100/litre",
          marketPairs: "37×37 state pairs via #StatePrices (mssql session)",
          dataSource: "Latest_Prices_Summary #temp (mssql) + vw_Market_Transport v11.0",
          categoryMultipliers: "Applied (livestock 10×, frozen 3.5×, perishables 2×)",
        },
      },
    });

  } catch (error) {
    console.error("[Arbitrage API Error]", error);
    return NextResponse.json({
      success: false,
      error: "server_error",
      message: "Failed to fetch arbitrage opportunities",
    }, { status: 500 });
  }
}

// ============================================================================
// POST — Detailed arbitrage analysis for a specific pair
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const pool = await getPool();
    if (!pool) return NextResponse.json({ success: false, error: "db_unavailable" }, { status: 503 });
    const body = await request.json();
    const { buyMarket, sellMarket, itemName, tier = "FREE" } = body;

    const tierConfig = getTierConfig(tier.toUpperCase());
    if (!tierConfig.hasAccess) {
      return NextResponse.json({
        success: false,
        error: "upgrade_required",
        message: "Arbitrage feature requires GOLD tier or higher",
      }, { status: 403 });
    }

    const itemSearch = (itemName || "").replace(/'/g, "''");
    const buySearch = (buyMarket || "").replace(/'/g, "''");
    const sellSearch = (sellMarket || "").replace(/'/g, "''");

    // Get prices for both markets
    const postResult = await pool.request().query(`
      SELECT
        lp.item_name, lp.market_name, lp.market_id, lp.state,
        lp.category_id, lp.unit,
        CAST(lp.price_naira AS FLOAT) AS price,
        lp.price_date
      FROM dbo.Latest_Prices_Summary lp
      WHERE lp.item_name   LIKE '%${itemSearch}%'
        AND (lp.market_name LIKE '%${buySearch}%' OR lp.market_name LIKE '%${sellSearch}%')
        AND lp.price_naira > 0
        AND lp.category_id IN (${FOOD_CAT_SQL})
    `);
    const results = postResult.recordset as any[];

    if (!results || results.length < 2) {
      return NextResponse.json({
        success: false,
        error: "insufficient_data",
        message: "Could not find prices for both markets",
      }, { status: 404 });
    }

    // Identify buy (cheaper) and sell (more expensive)
    const buyPrice = results.find((r: any) => 
      String(r.market_name).toLowerCase().includes(buySearch.toLowerCase())
    );
    const sellPrice = results.find((r: any) => 
      String(r.market_name).toLowerCase().includes(sellSearch.toLowerCase())
    );

    if (!buyPrice || !sellPrice) {
      return NextResponse.json({
        success: false,
        error: "market_not_found",
        message: "Could not match market names",
      }, { status: 404 });
    }

    const buyNum = parseFloat(buyPrice.price) || 0;
    const sellNum = parseFloat(sellPrice.price) || 0;
    const catId = String(buyPrice.category_id || "");

    // Get transport from precomputed table
    const transportResult = await pool.request().query(`
      SELECT 
        CAST(road_distance_km AS FLOAT) AS distance,
        CAST(total_cost_per_bag AS FLOAT) AS total_cost,
        CAST(fuel_haulage_cost AS FLOAT) AS fuel_cost,
        CAST(checkpoint_cost AS FLOAT) AS checkpoint_cost,
        CAST(fixed_cost AS FLOAT) AS fixed_cost,
        CAST(rate_per_km AS FLOAT) AS rate_per_km,
        CAST(road_quality_mult AS FLOAT) AS road_mult,
        distance_band
      FROM dbo.vw_Market_Transport
      WHERE market_a_id = '${String(buyPrice.market_id).replace(/'/g, "''")}'
        AND market_b_id = '${String(sellPrice.market_id).replace(/'/g, "''")}'
    `);
    const transportRows = transportResult.recordset as any[];

    let transport: TransportResult;

    if (transportRows && transportRows.length > 0) {
      const t = transportRows[0];
      const weightMult = CATEGORY_WEIGHT_MULTIPLIER[catId] || 1.0;
      transport = {
        distance: parseFloat(t.distance) || 0,
        fuelCost: Math.round((parseFloat(t.fuel_cost) || 0) * weightMult),
        loadingCost: Math.round((parseFloat(t.fixed_cost) || 0) * weightMult),
        checkpointCost: Math.round((parseFloat(t.checkpoint_cost) || 0) * weightMult),
        totalCost: Math.round((parseFloat(t.total_cost) || 0) * weightMult),
        label: t.distance_band || "Unknown",
        ratePerKm: parseFloat(t.rate_per_km) || 0,
        weightMultiplier: weightMult,
        categoryNote: weightMult !== 1.0
          ? `${CATEGORY_MAP[catId] || "Category"} (${weightMult}× transport adjustment)`
          : "Standard rate (1.0×)",
      };
    } else {
      // Fallback: try Transport_Fares by state, else use ₦15,000 estimate
      const stateResult = await pool.request().query(`
        SELECT TOP 1 CAST(fare_per_tonne AS FLOAT) AS fare,
               CONCAT(origin_state,' → ',destination_state) AS label
        FROM dbo.Transport_Fares
        WHERE origin_state      = '${String(buyPrice.state || "").replace(/'/g, "''")}'
          AND destination_state = '${String(sellPrice.state || "").replace(/'/g, "''")}'
          AND vehicle_class     = 'TRUCK_5T'
          AND is_current        = 1
        ORDER BY fare_date DESC
      `);
      const stateRow = stateResult.recordset?.[0];
      const stateFare = stateRow ? parseFloat(stateRow.fare) : 15000;
      const stateLabel = stateRow ? stateRow.label : "Inter-State (est.)";
      transport = {
        distance: Math.round(stateFare / 17),
        fuelCost: Math.round(stateFare * 0.70),
        loadingCost: Math.round(stateFare * 0.20),
        checkpointCost: Math.round(stateFare * 0.10),
        totalCost: stateFare,
        label: stateLabel,
        ratePerKm: 17,
        weightMultiplier: 1.0,
        categoryNote: stateRow
          ? "NARTO state-level rate (Transport_Fares)"
          : "Estimated ₦15,000 (state pair not in Transport_Fares)",
      };
    }

    // Profit breakdown for bulk quantities
    const quantities = [1, 5, 10, 25, 50, 100];
    const profitBreakdown = quantities.map((qty) => {
      const totalBuy = buyNum * qty;
      const totalSell = sellNum * qty;
      const totalTransport = transport.totalCost * qty;
      const totalNet = totalSell - totalBuy - totalTransport;
      const roi = (totalBuy + totalTransport) > 0
        ? (totalNet / (totalBuy + totalTransport)) * 100
        : 0;
      return {
        quantity: qty,
        buyCost: Math.round(totalBuy),
        sellRevenue: Math.round(totalSell),
        transportCost: Math.round(totalTransport),
        netProfit: Math.round(totalNet),
        roi: Math.round(roi * 10) / 10,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        item: {
          name: buyPrice.item_name,
          category: CATEGORY_MAP[catId] || "Other",
          unit: buyPrice.unit,
        },
        buyMarket: {
          name: buyPrice.market_name,
          state: buyPrice.state,
          price: Math.round(buyNum),
          confidence: calculateConfidence(buyPrice.price_date),
        },
        sellMarket: {
          name: sellPrice.market_name,
          state: sellPrice.state,
          price: Math.round(sellNum),
          confidence: calculateConfidence(sellPrice.price_date),
        },
        transport: {
          distance: transport.distance,
          fuelCost: transport.fuelCost,
          loadingCost: transport.loadingCost,
          checkpointCost: transport.checkpointCost,
          totalCostPerUnit: transport.totalCost,
          label: transport.label,
          ratePerKm: transport.ratePerKm,
          weightMultiplier: transport.weightMultiplier,
          categoryNote: transport.categoryNote,
          model: "Precomputed Market_Distances v6.0 (Diesel ₦1,100/L)",
        },
        profitAnalysis: {
          unitPriceSpread: Math.round(sellNum - buyNum),
          unitNetProfit: Math.round(sellNum - buyNum - transport.totalCost),
          unitProfitPct:
            Math.round(((sellNum - buyNum - transport.totalCost) / buyNum) * 1000) / 10,
          breakdown: profitBreakdown,
        },
      },
    });

  } catch (error) {
    console.error("[Arbitrage Detail API Error]", error);
    return NextResponse.json({
      success: false,
      error: "server_error",
      message: "Failed to analyze arbitrage opportunity",
    }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
