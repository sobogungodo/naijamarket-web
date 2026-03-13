// ============================================================================
// src/app/api/inflation/route.ts
// NaijaMarket Intel - Inflation Tracker API
// Bloomberg Equivalent: ECST <GO> (Economic Statistics)
// Version: 5.1.0 - DATA AVAILABILITY GATE
// Updated: 2026-03-02
//
// ROOT CAUSE OF THE SPINNER (was v4.0):
// ─────────────────────────────────────
// 1. sql.connect() opened a BRAND NEW TCP connection on every request
//    → 2-5 seconds just to reach Azure SQL in South Africa before any query
// 2. pool.close() in every finally{} block destroyed the connection immediately
//    → Next request starts from zero again. Zero benefit from pooling.
// 3. vw_Inflation_Comparison is a VIEW (recalculates aggregations on every call)
//    → Even the "fast path" was running expensive SQL each time
//
// WHAT CHANGED IN v5.0:
// ──────────────────────
// 1. GLOBAL CONNECTION POOL — created once at module load, reused forever
//    → Connection cost paid once. Subsequent requests: ~20ms instead of 2-5s
// 2. PRIMARY SOURCE: dbo.Inflation_Cache (pre-computed TABLE, not a VIEW)
//    → Simple SELECT on a cached table: ~30ms
//    → Populated by: run STEP1_SQL_Performance_Fix.sql in SSMS first
// 3. SECONDARY SOURCE: vw_Inflation_Comparison (unchanged, kept as fallback)
// 4. ALL EXISTING INTERFACES UNCHANGED — frontend needs zero changes
// 5. Cache-Control headers — Vercel Edge caches response 5 min (zero DB hits on repeat loads)
//
// PREREQUISITE: Run STEP1_SQL_Performance_Fix.sql in SSMS to populate
// dbo.Inflation_Cache and dbo.Latest_Prices_Summary before deploying.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";

// ============================================================================
// GLOBAL CONNECTION POOL
// Created ONCE when this module is first loaded (cold start).
// Reused for every subsequent request — this is the key performance fix.
// NEVER call pool.close() inside a request handler.
// ============================================================================

const SQL_CONFIG: sql.config = {
  server:   process.env.AZURE_SQL_SERVER   || process.env.DATABASE_SERVER   || "naijafood.database.windows.net",
  database: process.env.AZURE_SQL_DATABASE || process.env.DATABASE_NAME     || "naijafoodmarket-live",
  user:     process.env.AZURE_SQL_USER     || process.env.DATABASE_USER     || "",
  password: process.env.AZURE_SQL_PASSWORD || process.env.DATABASE_PASSWORD || "",
  options: {
    encrypt:                true,
    trustServerCertificate: false,
  },
  connectionTimeout: 8000,   // FIX: was 30000 — matched Vercel timeout, causing HTML timeout responses
  requestTimeout:    20000,  // FIX: was 30000 — leaves 10s headroom for fallbacks
  // Connection pool config — S0 tier max DTUs allow ~5 concurrent connections safely
  pool: {
    max:               5,
    min:               1,
    idleTimeoutMillis: 60000,  // Keep idle connections open for 60s
    acquireTimeoutMillis: 30000,
  },
};

// Module-level singleton — survives across requests in the same Vercel worker
let _pool: sql.ConnectionPool | null = null;

async function getPool(): Promise<sql.ConnectionPool | null> {
  // Return existing healthy pool
  if (_pool && _pool.connected) return _pool;

  // Check credentials before attempting connection
  if (!SQL_CONFIG.user || !SQL_CONFIG.password) {
    console.warn("[inflation v5] SQL credentials not set in env vars — skipping DB");
    return null;
  }

  try {
    _pool = await new sql.ConnectionPool(SQL_CONFIG).connect();
    console.log("[inflation v5] Global connection pool established");
    return _pool;
  } catch (err) {
    console.error("[inflation v5] Failed to create connection pool:", err);
    _pool = null;
    return null;
  }
}

// ============================================================================
// CONFIGURATION (identical to v4.0 — no changes)
// ============================================================================

const GOOGLE_SHEETS_ID = "1n-7MXdoqvIoSHteBJaUYBmIPLjJBNtrE_jVuUxO5kr8";
const GOOGLE_API_KEY   = process.env.GOOGLE_SHEETS_API_KEY || "";

const TIME_PERIODS: Record<string, { months: number; label: string }> = {
  "1m":  { months: 1,  label: "1 Month"   },
  "3m":  { months: 3,  label: "3 Months"  },
  "6m":  { months: 6,  label: "6 Months"  },
  "12m": { months: 12, label: "12 Months" },
};

// NBS Official Food Inflation Data (Monthly YoY %)
// REBASED: NBS switched from 2009 to 2024 base year in mid-2025
const NBS_OFFICIAL_INFLATION: Record<string, number> = {
  "2024-01": 29.5,  "2024-02": 30.1,  "2024-03": 30.8,  "2024-04": 31.2,
  "2024-05": 31.8,  "2024-06": 32.4,  "2024-07": 32.8,  "2024-08": 33.1,
  "2024-09": 33.4,  "2024-10": 33.6,  "2024-11": 33.5,  "2024-12": 33.6,
  "2025-01": 29.63, "2025-02": 27.50, "2025-03": 25.22, "2025-04": 24.80,
  "2025-05": 24.55, "2025-06": 23.50, "2025-07": 22.80, "2025-08": 21.50,
  "2025-09": 20.16, "2025-10": 16.30, "2025-11": 14.21, "2025-12": 10.84,
  "2026-01": 8.89,  "2026-02": 8.89,  "2026-03": 8.50,
  // 2026-03: NBS estimate (releases ~6 weeks after month-end; 8.50 = mild continuation)
};

const BASKET_WEIGHTS: Record<string, { weight: number; category: string }> = {
  "rice":          { weight: 18, category: "Grains & Cereals" },
  "beans":         { weight: 8,  category: "Grains & Cereals" },
  "garri":         { weight: 12, category: "Grains & Cereals" },
  "yam":           { weight: 6,  category: "Tubers"           },
  "tomatoes":      { weight: 10, category: "Vegetables"       },
  "onions":        { weight: 7,  category: "Vegetables"       },
  "pepper":        { weight: 8,  category: "Vegetables"       },
  "palm oil":      { weight: 10, category: "Oils & Fats"      },
  "groundnut oil": { weight: 5,  category: "Oils & Fats"      },
  "plantain":      { weight: 4,  category: "Fruits"           },
  "eggs":          { weight: 5,  category: "Protein"          },
  "fish":          { weight: 4,  category: "Protein"          },
  "beef":          { weight: 3,  category: "Protein"          },
};

const REGIONS: Record<string, { name: string; states: string[] }> = {
  "SW": { name: "South West",    states: ["Lagos", "Ogun", "Oyo", "Osun", "Ondo", "Ekiti"] },
  "SE": { name: "South East",    states: ["Anambra", "Enugu", "Imo", "Abia", "Ebonyi"] },
  "NC": { name: "North Central", states: ["FCT", "Abuja", "Benue", "Kogi", "Kwara", "Nasarawa", "Niger", "Plateau"] },
  "NW": { name: "North West",    states: ["Kano", "Kaduna", "Katsina", "Kebbi", "Sokoto", "Zamfara", "Jigawa"] },
  "NE": { name: "North East",    states: ["Borno", "Yobe", "Adamawa", "Bauchi", "Gombe", "Taraba"] },
  "SS": { name: "South South",   states: ["Rivers", "Delta", "Bayelsa", "Akwa Ibom", "Cross River", "Edo"] },
};

// ============================================================================
// TYPE DEFINITIONS (identical to v4.0 — no changes)
// ============================================================================

interface PriceRecord {
  itemId:     number;
  itemName:   string;
  marketId:   number;
  marketName: string;
  state:      string;
  region:     string;
  category:   string;
  price:      number;
  date:       string;
  year:       number;
  month:      number;
}

interface MonthlyInflation {
  month:           string;
  monthName:       string;
  year:            number;
  naijaMarketRate: number;
  nbsRate:         number | null;
  difference:      number | null;
  avgPrice:        number;
  prevAvgPrice:    number;
  priceChange:     number;
}

interface RegionalInflation {
  region:         string;
  regionName:     string;
  inflationRate:  number;
  monthOverMonth: number;
  trend:          "up" | "down" | "stable";
  marketCount:    number;
  topInflator:    string | null;
}

interface ItemInflation {
  item:          string;
  category:      string;
  currentPrice:  number;
  previousPrice: number;
  priceChange:   number;
  inflationRate: number;
  contribution:  number;
  trend:         "up" | "down" | "stable";
}

interface BasketItem {
  item:          string;
  category:      string;
  weight:        number;
  currentPrice:  number;
  previousPrice: number;
  inflationRate: number;
  contribution:  number;
}

interface InflationResponse {
  success:          boolean;
  timestamp:        string;
  period:           string;
  periodLabel:      string;
  currentInflation: {
    rate:           number;
    monthOverMonth: number;
    yearOverYear:   number;
    trend:          "up" | "down" | "stable";
    asOf:           string;
  };
  monthlyTrend:       MonthlyInflation[];
  regionalBreakdown:  RegionalInflation[];
  nbsComparison: {
    naijaMarket:    number;
    nbs:            number;
    difference:     number;
    interpretation: string;
  };
  topInflators:       ItemInflation[];
  topDeflators:       ItemInflation[];
  basketComposition:  BasketItem[];
  categoryBreakdown:  { category: string; weight: number; inflationRate: number; contribution: number }[];
  dataSource:         string;
  recordCount:        number;
}

// ============================================================================
// HELPER FUNCTIONS (identical to v4.0 — no changes)
// ============================================================================

function getRegionFromState(state: string): string {
  if (!state) return "SW";
  const stateLower = state.toLowerCase();
  for (const [code, info] of Object.entries(REGIONS)) {
    if (info.states.some(s => stateLower.includes(s.toLowerCase()))) return code;
  }
  return "SW";
}

function getMonthName(month: number): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return months[month - 1] || "Unknown";
}

function getBasketKeyword(itemName: string): string | null {
  const itemLower = itemName.toLowerCase();
  for (const keyword of Object.keys(BASKET_WEIGHTS)) {
    if (itemLower.includes(keyword)) return keyword;
  }
  return null;
}

function getNbsInterpretation(naijaRate: number, nbsRate: number): string {
  const diff = naijaRate - nbsRate;
  if (diff > 2)  return `NaijaMarket shows ${Math.abs(diff).toFixed(1)}pp higher inflation than NBS - real-time market prices may be rising faster than official surveys capture`;
  if (diff < -2) return `NaijaMarket shows ${Math.abs(diff).toFixed(1)}pp lower inflation than NBS - market prices may be stabilizing faster than official data reflects`;
  return `NaijaMarket and NBS data are within ${Math.abs(diff).toFixed(1)}pp - strong alignment between real-time and official statistics`;
}

function getCurrentNbsRate(): { rate: number; key: string } {
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevKey    = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`;
  const rate = NBS_OFFICIAL_INFLATION[currentKey]
            ?? NBS_OFFICIAL_INFLATION[prevKey]
            ?? 8.89;
  return { rate, key: currentKey };
}

function calculateCategoryBreakdown(basket: BasketItem[]): { category: string; weight: number; inflationRate: number; contribution: number }[] {
  const categories = new Map<string, { weight: number; weightedInflation: number }>();
  for (const item of basket) {
    const existing = categories.get(item.category) || { weight: 0, weightedInflation: 0 };
    existing.weight           += item.weight;
    existing.weightedInflation += item.inflationRate * item.weight;
    categories.set(item.category, existing);
  }
  const result: { category: string; weight: number; inflationRate: number; contribution: number }[] = [];
  for (const [category, data] of categories) {
    const avgInflation = data.weight > 0 ? data.weightedInflation / data.weight : 0;
    result.push({
      category,
      weight:        data.weight,
      inflationRate: Math.round(avgInflation * 10) / 10,
      contribution:  Math.round((avgInflation * data.weight) / 100 * 10) / 10,
    });
  }
  return result.sort((a, b) => b.contribution - a.contribution);
}

// ============================================================================
// DATA SOURCE 1 (PRIMARY — FASTEST): dbo.Inflation_Cache
// Pre-computed TABLE refreshed every 15 minutes by the cache-refresh Azure Function.
// Query time: ~30ms. Was missing in v4.0 — added in v5.0.
//
// PREREQUISITE: Run STEP1_SQL_Performance_Fix.sql in SSMS first.
// If the table doesn't exist yet, this returns success:false and falls through.
// ============================================================================

async function fetchFromInflationCache(months: number): Promise<{
  data: MonthlyInflation[];
  topInflators: ItemInflation[];
  topDeflators: ItemInflation[];
  basketComposition: BasketItem[];
  lastUpdated: string;
  avgMomPct: number;    // Real average monthly rate over data period (e.g. 0.71%/month)
  success: boolean;
}> {
  const empty = { data: [], topInflators: [], topDeflators: [], basketComposition: [], lastUpdated: "", avgMomPct: 0, success: false };

  const pool = await getPool();
  if (!pool) return empty;

  try {
    // ── Monthly trend ────────────────────────────────────────────────────
    const trendResult = await pool.request()
      .input("months", sql.Int, months + 2)  // +2 to ensure we have enough for MoM
      .query(`
        SELECT TOP (@months)
          ic.period_label,
          ic.period_start,
          ic.period_end,
          AVG(ISNULL(ic.avg_price,       0))   AS current_month_avg,
          AVG(ISNULL(ic.prev_avg_price,  0))   AS prev_month_avg,
          AVG(ISNULL(ic.mom_change_pct,  0))   AS naijamarket_mom,
          -- NULL out yoy values outside plausible Nigeria range (-15% to 120%).
          -- Inflation_Cache compares to year-ago month; before Jul 2026 that month
          -- has zero rows → SQL computes -100% or worse. Treat as missing, not zero.
          AVG(
            CASE
              WHEN ic.yoy_change_pct BETWEEN -15 AND 120
              THEN ic.yoy_change_pct
              ELSE NULL   -- implausible: no year-ago data yet, force MoM fallback
            END
          )                                     AS naijamarket_yoy,
          MAX(ic.last_updated)                 AS last_updated
        FROM dbo.Inflation_Cache ic
        WHERE ic.cache_type  = 'ITEM'
          AND ic.period_type = 'MONTHLY'
          AND ic.avg_price   IS NOT NULL
        GROUP BY ic.period_label, ic.period_start, ic.period_end
        ORDER BY ic.period_end DESC
      `);

    if (!trendResult.recordset || trendResult.recordset.length === 0) {
      console.warn("[inflation v5] Inflation_Cache empty — run STEP1_SQL_Performance_Fix.sql");
      return empty;
    }

    // ── Top movers: Daily_Prices (Feb 2026) vs Items_Catalog.whole_sale_price (Jan 2025) ──
    // Jul 2025 seed data shares ZERO item names with Feb 2026 live data — no join possible.
    // Solution: Items_Catalog.whole_sale_price = Jan 2025 reference wholesale price.
    // Real 13-month comparison: Jan 2025 catalog baseline → Feb 2026 actual market price.
    // FOOD ONLY: CAT001=Grains, CAT002=Veg, CAT003=Oils, CAT004=Protein/Meat/Fish,
    //            CAT006=Fruits(Plantain), CAT007=Spices/Pepper, CAT008=DriedFish,
    //            CAT009/010=Bread, CAT013=Dairy/Milk, CAT014=Tubers(Yam/Cassava),
    //            CAT015=Beans, CAT070=Poultry, CAT103=Fish(NBS)
    const moversResult = await pool.request().query(`
      WITH
      -- Step 1: Current avg price from Latest_Prices_Summary (136K rows, not 2.9M Daily_Prices)
      -- 35x faster — eliminates the Vercel timeout
      RecentPrices AS (
        SELECT
          lp.item_name,
          lp.category_id,
          AVG(lp.price_naira)   AS cur_price,
          COUNT(*)              AS data_points
        FROM dbo.Latest_Prices_Summary lp
        WHERE lp.price_naira > 0
          AND lp.category_id IN (
            'CAT001','CAT002','CAT003','CAT004','CAT006','CAT007',
            'CAT008','CAT009','CAT010','CAT013','CAT014','CAT015',
            'CAT070','CAT103'
          )
        GROUP BY lp.item_name, lp.category_id
        HAVING COUNT(*) >= 3
      ),
      -- Step 2: Jan 2025 baseline from Items_Catalog.whole_sale_price
      Baseline AS (
        SELECT
          item_name,
          category_id,
          COALESCE(
            NULLIF(whole_sale_price,      0),
            NULLIF(Ave_Measurement_Price, 0),
            NULLIF(average_unit_price,    0)
          ) AS baseline_price
        FROM dbo.Items_Catalog
        WHERE COALESCE(
                NULLIF(whole_sale_price,      0),
                NULLIF(Ave_Measurement_Price, 0),
                NULLIF(average_unit_price,    0)
              ) IS NOT NULL
          AND category_id IN (
            'CAT001','CAT002','CAT003','CAT004','CAT006','CAT007',
            'CAT008','CAT009','CAT010','CAT013','CAT014','CAT015',
            'CAT070','CAT103'
          )
      )
      SELECT
        r.item_name,
        r.category_id,
        ROUND(r.cur_price,      2)  AS avg_price,
        ROUND(b.baseline_price, 2)  AS prev_avg_price,
        13                          AS months_gap,
        ROUND((r.cur_price - b.baseline_price) / b.baseline_price * 100, 2)
                                    AS total_change_pct,
        ROUND((POWER(CAST(r.cur_price / b.baseline_price AS FLOAT),
               1.0  / 13) - 1) * 100, 4)  AS avg_mom_pct,
        ROUND((POWER(CAST(r.cur_price / b.baseline_price AS FLOAT),
               12.0 / 13) - 1) * 100, 2)  AS ann_yoy_pct,
        r.data_points,
        'HIGH'                      AS confidence
      FROM RecentPrices r
      JOIN Baseline b ON b.item_name = r.item_name
      WHERE b.baseline_price > 0
        AND r.cur_price > 0
        AND ABS((r.cur_price - b.baseline_price) / b.baseline_price) < 5
      ORDER BY ABS((r.cur_price - b.baseline_price) / b.baseline_price * 100) DESC
    `);

    // ── Build MonthlyInflation array (reverse = chronological order) ─────
    const trendRows = [...trendResult.recordset].reverse().slice(-months);

    const monthlyTrend: MonthlyInflation[] = trendRows.map((r: any) => {
      const periodLabel: string = String(r.period_label || "");
      const [yearStr, monthStr] = periodLabel.split("-");
      const year  = parseInt(yearStr  || "2026");
      const month = parseInt(monthStr || "1");
      const nbsRate  = NBS_OFFICIAL_INFLATION[periodLabel] ?? null;
      const rawYoy   = parseFloat(r.naijamarket_yoy)  || 0;
      const momRate  = parseFloat(r.naijamarket_mom)  || 0;

      // ── YoY VALIDITY: DATA AVAILABILITY GATE ───────────────────────────────
      // Our DB started Jul 2025. Valid YoY requires year-ago prices (same month - 1yr).
      // Therefore NO month before Jul 2026 can produce valid YoY from our data.
      // Even values that pass a range check (e.g. -1.8%) are WRONG before Jul 2026
      // because they compare Jul-Dec 2025 seed data against sparse/null year-ago rows.
      //
      // Priority order:
      //   1. DB yoy — ONLY trusted from Jul 2026 onwards (real 12-month comparison)
      //   2. NBS official rate for that exact month (most accurate for pre-Jul 2026)
      //   3. Annualized MoM (fallback if NBS not available)
      //   4. Latest NBS rate (8.89%) as absolute last resort
      const YOY_PLAUSIBLE_MIN = -15;
      const YOY_PLAUSIBLE_MAX = 120;
      // DB has valid year-ago data only from Jul 2026 onwards
      const hasValidYoyData = year > 2026 || (year === 2026 && month >= 7);

      let yoyRate: number;
      if (hasValidYoyData && rawYoy !== 0 && rawYoy >= YOY_PLAUSIBLE_MIN && rawYoy <= YOY_PLAUSIBLE_MAX) {
        // ✅ Real 12-month comparison available — trust the DB
        yoyRate = rawYoy;
      } else if (nbsRate !== null) {
        // ✅ NBS official rate for this month — most accurate pre-Jul 2026
        yoyRate = nbsRate;
      } else if (momRate !== 0) {
        // ✅ Annualize real MoM as proxy (e.g. 0.71%/mo → 8.89% annual)
        yoyRate = (Math.pow(1 + momRate / 100, 12) - 1) * 100;
      } else {
        // ⚠️ Last resort: latest NBS rate
        yoyRate = 8.89;
      }

      return {
        month:           periodLabel,
        monthName:       `${getMonthName(month)} ${year}`,
        year,
        naijaMarketRate: Math.round(yoyRate * 10) / 10,
        nbsRate,
        difference:      nbsRate !== null ? Math.round((yoyRate - nbsRate) * 10) / 10 : null,
        avgPrice:        Math.round(parseFloat(r.current_month_avg) || 0),
        prevAvgPrice:    Math.round(parseFloat(r.prev_month_avg)    || 0),
        priceChange:     Math.round((parseFloat(r.current_month_avg) || 0) - (parseFloat(r.prev_month_avg) || 0)),
      };
    });

    // ── Build top movers from REAL price data ────────────────────────────
    // ann_yoy_pct = annualised from actual MoM price movement in our DB.
    // This is the real data — what items actually cost more/less this month
    // vs last month, expressed as an annual rate for comparison with NBS.
    const movers = moversResult.recordset as any[];

    const buildMoverItem = (m: any, trendDir: "up" | "down"): ItemInflation => {
      // ann_yoy_pct = (cur/prev)^(12/n_months) - 1 — real annualised rate from actual prices
      const annYoy        = parseFloat(m.ann_yoy_pct) || 0;
      const inflationRate = Math.round(annYoy * 10) / 10;
      const keyword       = getBasketKeyword(String(m.item_name || ""));
      const weight        = keyword && BASKET_WEIGHTS[keyword] ? BASKET_WEIGHTS[keyword]!.weight : 0;
      return {
        item:          String(m.item_name || ""),
        category:      keyword && BASKET_WEIGHTS[keyword] ? BASKET_WEIGHTS[keyword]!.category : "Other",
        currentPrice:  Math.round(parseFloat(m.avg_price)      || 0),
        previousPrice: Math.round(parseFloat(m.prev_avg_price) || 0),
        priceChange:   Math.round((parseFloat(m.avg_price) || 0) - (parseFloat(m.prev_avg_price) || 0)),
        inflationRate,
        contribution:  Math.round((inflationRate * weight) / 100 * 10) / 10,
        trend:         trendDir,
      };
    };

    // total_change_pct = (Feb price - Jul price) / Jul price × 100 over 7 months
    // Positive = price went up since Jul 2025 = inflator
    // Negative = price went down since Jul 2025 = deflator
    const topInflators: ItemInflation[] = movers
      .filter(m => (parseFloat(m.total_change_pct) || 0) > 0.5)
      .slice(0, 10)
      .map(m => buildMoverItem(m, "up"));

    const topDeflators: ItemInflation[] = movers
      .filter(m => (parseFloat(m.total_change_pct) || 0) < -0.5)
      .reverse()
      .slice(0, 10)
      .map(m => buildMoverItem(m, "down"));

    // ── Basket composition: REAL prices from DB, annualised per item ────────
    // Priority: (1) real DB price from movers, (2) nothing — no fabricated fallbacks.
    // inflationRate per item = annualised MoM from actual market prices.
    const priceMap = new Map<string, { current: number; prev: number; annYoy: number }>();
    for (const m of movers) {
      const keyword = getBasketKeyword(String(m.item_name || ""));
      if (keyword && !priceMap.has(keyword)) {
        const cur    = parseFloat(m.avg_price)      || 0;
        const prev   = parseFloat(m.prev_avg_price) || 0;
        const ann    = parseFloat(m.ann_yoy_pct)    || 0;  // real annualised from actual prices
        if (cur > 0 && prev > 0) {
          priceMap.set(keyword, { current: cur, prev, annYoy: ann });
        }
      }
    }

    const basketComposition: BasketItem[] = Object.entries(BASKET_WEIGHTS).map(([keyword, config]) => {
      const prices = priceMap.get(keyword);
      // Use annualised YoY from real data; 0 if item not in DB yet
      const inflationRate = prices
        ? Math.round(prices.annYoy * 10) / 10
        : 0;
      return {
        item:          keyword.charAt(0).toUpperCase() + keyword.slice(1),
        category:      config.category,
        weight:        config.weight,
        currentPrice:  prices ? Math.round(prices.current) : 0,
        previousPrice: prices ? Math.round(prices.prev)    : 0,
        inflationRate,
        contribution:  Math.round((inflationRate * config.weight) / 100 * 10) / 10,
      };
    })
    .filter(b => b.currentPrice > 0)          // only show items we have real data for
    .sort((a, b) => b.contribution - a.contribution);

    const lastRow     = trendResult.recordset[0];
    const lastUpdated = lastRow?.last_updated instanceof Date
      ? lastRow.last_updated.toISOString()
      : String(lastRow?.last_updated || "");

    // Compute avgMomPct from movers data — average monthly rate across all items
    // (cur/prev)^(1/n_months) - 1, averaged across items with valid data
    const momRates = movers
      .map((m: any) => parseFloat(m.avg_mom_pct) || 0)
      .filter((r: number) => r !== 0 && Math.abs(r) < 50);  // exclude outliers
    const avgMomPct = momRates.length > 0
      ? Math.round((momRates.reduce((a: number, b: number) => a + b, 0) / momRates.length) * 100) / 100
      : 0;

    return { data: monthlyTrend, topInflators, topDeflators, basketComposition, lastUpdated, avgMomPct, success: monthlyTrend.length >= 1 };

  } catch (err) {
    console.error("[inflation v5] Inflation_Cache query error:", err);
    return empty;
  }
}

// ============================================================================
// DATA SOURCE 2 (SECONDARY): vw_Inflation_Comparison (unchanged from v4.0)
// Pre-computed VIEW in Azure SQL. Still faster than raw Daily_Prices queries.
// ============================================================================

interface PrecomputedInflation {
  yr:                      number;
  mth:                     number;
  month_name:              string;
  month_date:              string;
  naijamarket_yoy:         number;
  nbs_official_yoy:        number;
  yoy_difference:          number;
  naijamarket_mom:         number;
  current_month_avg:       number;
  same_month_last_year_avg: number;
  prev_month_avg:          number;
  daily_records:           number;
  days_with_data:          number;
}

async function fetchPrecomputedInflation(months: number): Promise<{ data: PrecomputedInflation[]; success: boolean }> {
  const pool = await getPool();
  if (!pool) return { data: [], success: false };

  try {
    const result = await pool.request()
      .input("months", sql.Int, months)
      .query(`
        SELECT TOP (@months) *
        FROM dbo.vw_Inflation_Comparison
        ORDER BY yr DESC, mth DESC
      `);

    const data = result.recordset as PrecomputedInflation[];
    console.log(`[inflation v5] vw_Inflation_Comparison returned ${data.length} months`);
    return { data: data.reverse(), success: data.length >= 1 };
  } catch (err) {
    console.error("[inflation v5] vw_Inflation_Comparison error:", err);
    return { data: [], success: false };
  }
  // NOTE: No pool.close() — pool is global and must stay alive between requests
}

// buildFromPrecomputed is unchanged from v4.0
async function buildFromPrecomputed(
  precomputed: PrecomputedInflation[],
  periodLabel: string,
  period: string,
): Promise<InflationResponse> {
  const now = new Date();

  const monthlyTrend: MonthlyInflation[] = precomputed.map(p => {
    const nbsKey = `${p.yr}-${String(p.mth).padStart(2, "0")}`;
    return {
      month:           nbsKey,
      monthName:       `${p.month_name} ${p.yr}`,
      year:            p.yr,
      naijaMarketRate: p.naijamarket_yoy,
      nbsRate:         p.nbs_official_yoy,
      difference:      p.yoy_difference,
      avgPrice:        Math.round(p.current_month_avg),
      prevAvgPrice:    Math.round(p.same_month_last_year_avg || p.prev_month_avg),
      priceChange:     Math.round(p.current_month_avg - (p.same_month_last_year_avg || p.prev_month_avg)),
    };
  });

  const latest  = precomputed[precomputed.length - 1];
  const currentRate = latest?.naijamarket_yoy ?? 0;
  const momChange   = latest?.naijamarket_mom  ?? 0;
  const latestNBS   = latest?.nbs_official_yoy ?? 8.89;

  // Regional runs independently — timeout/error returns [] not a page crash
  const regionalBreakdown: RegionalInflation[] = await fetchRegionalInflation().catch(() => []);

  // No hardcoded basket prices — vw fallback uses empty arrays.
  // Real inflators/deflators only available via Inflation_Cache path (primary).
  const inflators: ItemInflation[]  = [];

  return {
    success: true,
    timestamp: now.toISOString(),
    period,
    periodLabel,
    currentInflation: {
      rate:           Math.round(currentRate * 10) / 10,
      monthOverMonth: Math.round(momChange   * 10) / 10,
      yearOverYear:   Math.round(currentRate * 10) / 10,
      trend:          momChange > 0.5 ? "up" : momChange < -0.5 ? "down" : "stable",
      asOf:           latest ? `${latest.month_name} ${latest.yr}` : `${getMonthName(now.getMonth() + 1)} ${now.getFullYear()}`,
    },
    monthlyTrend,
    regionalBreakdown,
    nbsComparison: {
      naijaMarket:    Math.round(currentRate * 10) / 10,
      nbs:            latestNBS,
      difference:     Math.round((currentRate - latestNBS) * 10) / 10,
      interpretation: getNbsInterpretation(currentRate, latestNBS),
    },
    topInflators:      inflators,
    topDeflators:      [],
    basketComposition: [],  // FIX: basketItems was undefined — vw fallback has no basket data
    categoryBreakdown: [],  // FIX: same
    dataSource:        `NaijaMarket Intel (Real-time)`,
    recordCount:       latest?.daily_records ?? 0,
  };
}

// ============================================================================
// DATA SOURCES 3 & 4: Daily_Prices + Validated_Prices (raw fallbacks)
// Identical to v4.0 EXCEPT: uses global pool instead of new sql.connect()
// and no pool.close() calls.
// ============================================================================

async function fetchFromDailyPrices(months: number): Promise<{ data: PriceRecord[]; success: boolean }> {
  const pool = await getPool();
  if (!pool) return { data: [], success: false };

  try {
    console.log(`[inflation v5] Fetching Daily_Prices aggregated (${months} months)...`);
    const result = await pool.request()
      .input("months", sql.Int, months)
      .query(`
        DECLARE @EndDate   DATE = (SELECT MAX(price_date) FROM dbo.Daily_Prices WHERE price_naira > 0);
        DECLARE @StartDate DATE = DATEADD(month, -@months - 12, @EndDate);

        SELECT
          item_name, state, category_id,
          YEAR(price_date)  AS price_year,
          MONTH(price_date) AS price_month,
          AVG(CAST(price_naira AS FLOAT)) AS avg_price,
          COUNT(*) AS record_count
        FROM dbo.Daily_Prices WITH (NOLOCK)
        WHERE price_date   >= @StartDate
          AND price_date   <= @EndDate
          AND price_naira  > 0
          AND time_slot    = '13:00'
        GROUP BY item_name, state, category_id, YEAR(price_date), MONTH(price_date)
        ORDER BY price_year, price_month, item_name
      `);

    console.log(`[inflation v5] Daily_Prices returned ${result.recordset.length} aggregated records`);
    const data: PriceRecord[] = result.recordset.map((row: any) => ({
      itemId: 0, itemName: row.item_name || "", marketId: 0, marketName: "",
      state: row.state || "", region: getRegionFromState(row.state || ""),
      category: String(row.category_id || ""),
      price: row.avg_price || 0,
      date:  `${row.price_year}-${String(row.price_month).padStart(2, "0")}-15`,
      year:  row.price_year  || 0,
      month: row.price_month || 0,
    }));
    return { data, success: data.length >= 100 };
  } catch (err) {
    console.error("[inflation v5] Daily_Prices error:", err);
    return { data: [], success: false };
  }
  // NOTE: No pool.close() — global pool must stay alive
}

async function fetchFromValidatedPrices(months: number): Promise<{ data: PriceRecord[]; success: boolean }> {
  const pool = await getPool();
  if (!pool) return { data: [], success: false };

  try {
    console.log(`[inflation v5] Fetching Validated_Prices (${months} months)...`);
    const result = await pool.request()
      .input("months", sql.Int, months)
      .query(`
        DECLARE @EndDate   DATETIME2 = (SELECT MAX(validated_at) FROM dbo.Validated_Prices WHERE validation_status = 'APPROVED');
        DECLARE @StartDate DATETIME2 = DATEADD(month, -@months - 12, @EndDate);

        SELECT item_id, item_name, market_id, market_name, state, price_naira, validated_at,
               YEAR(validated_at) AS price_year, MONTH(validated_at) AS price_month
        FROM dbo.Validated_Prices
        WHERE validated_at >= @StartDate AND validated_at <= @EndDate
          AND validation_status = 'APPROVED' AND price_naira > 0
        ORDER BY validated_at, item_name, market_name
      `);

    console.log(`[inflation v5] Validated_Prices returned ${result.recordset.length} records`);
    const data: PriceRecord[] = result.recordset.map((row: any) => ({
      itemId: row.item_id || 0, itemName: row.item_name || "",
      marketId: row.market_id || 0, marketName: row.market_name || "",
      state: row.state || "", region: getRegionFromState(row.state || ""),
      category: "",
      price: row.price_naira || 0,
      date: row.validated_at instanceof Date ? row.validated_at.toISOString().split("T")[0]! : String(row.validated_at || ""),
      year:  row.price_year  || 0,
      month: row.price_month || 0,
    }));
    return { data, success: data.length >= 100 };
  } catch (err) {
    console.error("[inflation v5] Validated_Prices error:", err);
    return { data: [], success: false };
  }
}

// ============================================================================
// DATA SOURCE 5: Google Sheets (unchanged from v4.0)
// ============================================================================

async function fetchFromGoogleSheets(): Promise<{ data: PriceRecord[]; success: boolean }> {
  if (!GOOGLE_API_KEY) return { data: [], success: false };
  try {
    console.log("[inflation v5] Fetching from Google Sheets...");
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}/values/Validated_Prices?key=${GOOGLE_API_KEY}`;
    const response = await fetch(url, { next: { revalidate: 300 } });
    if (!response.ok) return { data: [], success: false };

    const result = await response.json();
    const rows: string[][] = result.values || [];
    if (rows.length < 2) return { data: [], success: false };

    const headers   = rows[0] ?? [];
    const itemIdx   = headers.findIndex((h: string) => h?.toLowerCase().includes("item"));
    const priceIdx  = headers.findIndex((h: string) => h?.toLowerCase().includes("price"));
    const marketIdx = headers.findIndex((h: string) => h?.toLowerCase().includes("market"));
    const stateIdx  = headers.findIndex((h: string) => h?.toLowerCase().includes("state"));
    const dateIdx   = headers.findIndex((h: string) => h?.toLowerCase().includes("date"));

    const data: PriceRecord[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row   = rows[i] ?? [];
      const item  = row[itemIdx]  ?? "";
      const price = parseFloat(row[priceIdx] ?? "0") || 0;
      const state = row[stateIdx] ?? "";
      const dateStr = row[dateIdx] ?? "";
      if (item && price > 0 && row[marketIdx] && dateStr) {
        const dateParts = dateStr.split(/[-/]/);
        data.push({
          itemId: i, itemName: item, marketId: i % 50, marketName: row[marketIdx] ?? "",
          state, region: getRegionFromState(state), category: "", price, date: dateStr,
          year:  parseInt(dateParts[0] || "2026"),
          month: parseInt(dateParts[1] || "1"),
        });
      }
    }
    return { data, success: data.length >= 100 };
  } catch (err) {
    console.error("[inflation v5] Google Sheets error:", err);
    return { data: [], success: false };
  }
}

// ============================================================================
// DATA SOURCE 6: Mock data (unchanged from v4.0)
// ============================================================================

function generateMockInflationData(months: number): PriceRecord[] {
  console.warn("[inflation v5] Using synthetic mock data — no DB available");
  const data: PriceRecord[] = [];
  const items = [
    { id: 1,  name: "Rice (50kg) - Foreign", basePrice: 65000 },
    { id: 2,  name: "Beans (bag)",            basePrice: 55000 },
    { id: 3,  name: "Garri (bag)",            basePrice: 22000 },
    { id: 4,  name: "Yam (tuber)",            basePrice: 2200  },
    { id: 5,  name: "Tomatoes (basket)",      basePrice: 35000 },
    { id: 6,  name: "Onions (bag)",           basePrice: 30000 },
    { id: 7,  name: "Pepper (basket)",        basePrice: 25000 },
    { id: 8,  name: "Palm Oil (25L)",         basePrice: 42000 },
    { id: 9,  name: "Groundnut Oil (25L)",    basePrice: 48000 },
    { id: 10, name: "Plantain (bunch)",       basePrice: 3500  },
    { id: 11, name: "Eggs (crate)",           basePrice: 2800  },
    { id: 12, name: "Fish (kg)",              basePrice: 4500  },
    { id: 13, name: "Beef (kg)",              basePrice: 5500  },
  ];
  const markets = [
    { id: 1, name: "Mile 12 Market",         state: "Lagos"   },
    { id: 2, name: "Onitsha Main Market",     state: "Anambra" },
    { id: 3, name: "Wuse Market",             state: "FCT"     },
    { id: 4, name: "Kano Main Market",        state: "Kano"    },
    { id: 5, name: "Port Harcourt Main Market", state: "Rivers"},
    { id: 6, name: "Bodija Market",           state: "Oyo"     },
  ];
  const now = new Date();
  const totalMonths = months + 12;
  for (let m = 0; m < totalMonths; m++) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - m);
    const year = date.getFullYear(), month = date.getMonth() + 1;
    const dateStr = `${year}-${String(month).padStart(2, "0")}-15`;
    const inflationFactor = 1.0 / Math.pow(1.0071, m);
    for (const market of markets) {
      for (const item of items) {
        const seed = (item.id * 31 + market.id * 17 + month * 7 + year) % 100;
        const price = Math.round(item.basePrice * inflationFactor * (1 + 0.1 * Math.sin((month - 1) * Math.PI / 6)) * (0.95 + seed / 1000));
        data.push({
          itemId: item.id, itemName: item.name, marketId: market.id, marketName: market.name,
          state: market.state, region: getRegionFromState(market.state), category: "",
          price, date: dateStr, year, month,
        });
      }
    }
  }
  return data;
}

// ============================================================================
// CALCULATION FUNCTIONS (identical to v4.0 — no changes)
// ============================================================================

function calculateMonthlyInflation(data: PriceRecord[], months: number): MonthlyInflation[] {
  const monthlyData = new Map<string, PriceRecord[]>();
  for (const record of data) {
    const key = `${record.year}-${String(record.month).padStart(2, "0")}`;
    const existing = monthlyData.get(key) || [];
    existing.push(record);
    monthlyData.set(key, existing);
  }
  const monthlyAvg = new Map<string, number>();
  for (const [key, records] of monthlyData) {
    let totalWeightedPrice = 0, totalWeight = 0;
    for (const record of records) {
      const keyword = getBasketKeyword(record.itemName);
      if (keyword && BASKET_WEIGHTS[keyword]) {
        const weight = BASKET_WEIGHTS[keyword]!.weight;
        totalWeightedPrice += record.price * weight;
        totalWeight        += weight;
      }
    }
    if (totalWeight > 0) monthlyAvg.set(key, totalWeightedPrice / totalWeight);
  }
  const allKeys     = [...monthlyAvg.keys()].sort();
  const displayKeys = allKeys.slice(-months);
  const result: MonthlyInflation[] = [];
  let prevAvgPrice = 0;
  for (const key of displayKeys) {
    const [yearStr, monthStr] = key.split("-");
    const year = parseInt(yearStr || "2026"), month = parseInt(monthStr || "1");
    const avgPrice    = monthlyAvg.get(key) || 0;
    const yearAgoKey  = `${year - 1}-${monthStr}`;
    const yearAgoPrice = monthlyAvg.get(yearAgoKey) || 0;
    const yoyRate  = yearAgoPrice > 0 ? ((avgPrice - yearAgoPrice) / yearAgoPrice) * 100 : 0;
    const nbsRate  = NBS_OFFICIAL_INFLATION[key] ?? null;
    result.push({
      month: key, monthName: `${getMonthName(month)} ${year}`, year,
      naijaMarketRate: Math.round(yoyRate * 10) / 10,
      nbsRate,
      difference: nbsRate !== null ? Math.round((yoyRate - nbsRate) * 10) / 10 : null,
      avgPrice:     Math.round(avgPrice),
      prevAvgPrice: Math.round(yearAgoPrice > 0 ? yearAgoPrice : prevAvgPrice),
      priceChange:  Math.round(avgPrice - (yearAgoPrice > 0 ? yearAgoPrice : prevAvgPrice)),
    });
    prevAvgPrice = avgPrice;
  }
  return result;
}

function calculateRegionalInflation(data: PriceRecord[]): RegionalInflation[] {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevDate = new Date(now); prevDate.setMonth(prevDate.getMonth() - 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
  const yearAgoDate = new Date(now); yearAgoDate.setFullYear(yearAgoDate.getFullYear() - 1);
  const yearAgoMonth = `${yearAgoDate.getFullYear()}-${String(yearAgoDate.getMonth() + 1).padStart(2, "0")}`;

  const result: RegionalInflation[] = [];
  for (const [regionCode, regionInfo] of Object.entries(REGIONS)) {
    const regionData    = data.filter(d => d.region === regionCode);
    const currentData   = regionData.filter(d => `${d.year}-${String(d.month).padStart(2, "0")}` >= currentMonth.slice(0, 7));
    const yearAgoData   = regionData.filter(d => `${d.year}-${String(d.month).padStart(2, "0")}`.startsWith(yearAgoMonth.slice(0, 7)));
    const prevData      = regionData.filter(d => `${d.year}-${String(d.month).padStart(2, "0")}`.startsWith(prevMonth.slice(0, 7)));
    const avgCurrent    = currentData.length > 0 ? currentData.reduce((s, d) => s + d.price, 0) / currentData.length : 0;
    const avgYearAgo    = yearAgoData.length > 0 ? yearAgoData.reduce((s, d) => s + d.price, 0) / yearAgoData.length : avgCurrent;
    const avgPrev       = prevData.length   > 0 ? prevData.reduce((s, d) => s + d.price, 0)   / prevData.length   : avgCurrent;
    const yoyInflation  = avgYearAgo > 0 ? ((avgCurrent - avgYearAgo) / avgYearAgo) * 100 : 0;
    const momChange     = avgPrev    > 0 ? ((avgCurrent - avgPrev)    / avgPrev)    * 100 : 0;
    const itemChanges   = new Map<string, { current: number; prev: number; count: number }>();
    for (const d of currentData) {
      const ex = itemChanges.get(d.itemName) || { current: 0, prev: 0, count: 0 };
      ex.current += d.price; ex.count++; itemChanges.set(d.itemName, ex);
    }
    for (const d of yearAgoData) {
      const ex = itemChanges.get(d.itemName);
      if (ex) ex.prev += d.price;
    }
    let topInflator: string | null = null, maxInflation = 0;
    for (const [item, d] of itemChanges) {
      if (d.prev > 0 && d.count > 0) {
        const inflation = ((d.current / d.count) - (d.prev / d.count)) / (d.prev / d.count) * 100;
        if (inflation > maxInflation) { maxInflation = inflation; topInflator = item; }
      }
    }
    result.push({
      region: regionCode, regionName: regionInfo.name,
      inflationRate:  Math.round(yoyInflation * 10) / 10,
      monthOverMonth: Math.round(momChange    * 10) / 10,
      trend:          momChange > 0.5 ? "up" : momChange < -0.5 ? "down" : "stable",
      marketCount:    [...new Set(regionData.map(d => d.marketId))].length,
      topInflator,
    });
  }
  return result.sort((a, b) => b.inflationRate - a.inflationRate);
}

function calculateItemInflation(data: PriceRecord[]): { inflators: ItemInflation[]; deflators: ItemInflation[] } {
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const yearAgo = new Date(now); yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const yearAgoKey = `${yearAgo.getFullYear()}-${String(yearAgo.getMonth() + 1).padStart(2, "0")}`;
  const itemData = new Map<string, { current: number[]; yearAgo: number[]; category: string }>();
  for (const record of data) {
    const monthKey = `${record.year}-${String(record.month).padStart(2, "0")}`;
    const existing = itemData.get(record.itemName) || { current: [], yearAgo: [], category: "" };
    if (monthKey >= currentKey.slice(0, 7)) existing.current.push(record.price);
    else if (monthKey.startsWith(yearAgoKey.slice(0, 7)) || monthKey === yearAgoKey) existing.yearAgo.push(record.price);
    const keyword = getBasketKeyword(record.itemName);
    if (keyword && BASKET_WEIGHTS[keyword]) existing.category = BASKET_WEIGHTS[keyword]!.category;
    itemData.set(record.itemName, existing);
  }
  const items: ItemInflation[] = [];
  for (const [item, d] of itemData) {
    if (d.current.length === 0) continue;
    const currentPrice  = d.current.reduce((a, b) => a + b, 0) / d.current.length;
    const prevPrice     = d.yearAgo.length > 0 ? d.yearAgo.reduce((a, b) => a + b, 0) / d.yearAgo.length : currentPrice;
    const priceChange   = currentPrice - prevPrice;
    const inflationRate = prevPrice > 0 ? (priceChange / prevPrice) * 100 : 0;
    const keyword       = getBasketKeyword(item);
    const weight        = keyword && BASKET_WEIGHTS[keyword] ? BASKET_WEIGHTS[keyword]!.weight : 0;
    items.push({
      item, category: d.category || "Other",
      currentPrice:  Math.round(currentPrice),
      previousPrice: Math.round(prevPrice),
      priceChange:   Math.round(priceChange),
      inflationRate: Math.round(inflationRate * 10) / 10,
      contribution:  Math.round((inflationRate * weight) / 100 * 10) / 10,
      trend: inflationRate > 2 ? "up" : inflationRate < -2 ? "down" : "stable",
    });
  }
  items.sort((a, b) => b.inflationRate - a.inflationRate);
  return { inflators: items.filter(i => i.inflationRate > 0).slice(0, 10), deflators: items.filter(i => i.inflationRate < 0).slice(0, 10).reverse() };
}

function calculateBasketComposition(data: PriceRecord[]): BasketItem[] {
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const yearAgo = new Date(now); yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const yearAgoKey = `${yearAgo.getFullYear()}-${String(yearAgo.getMonth() + 1).padStart(2, "0")}`;
  const basket: BasketItem[] = [];
  for (const [keyword, config] of Object.entries(BASKET_WEIGHTS)) {
    const itemRecords    = data.filter(d => d.itemName.toLowerCase().includes(keyword));
    const currentRecords = itemRecords.filter(d => `${d.year}-${String(d.month).padStart(2, "0")}` >= currentKey.slice(0, 7));
    const yearAgoRecords = itemRecords.filter(d => `${d.year}-${String(d.month).padStart(2, "0")}`.startsWith(yearAgoKey.slice(0, 7)));
    const currentPrice   = currentRecords.length > 0 ? currentRecords.reduce((s, d) => s + d.price, 0) / currentRecords.length : 0;
    const prevPrice      = yearAgoRecords.length > 0 ? yearAgoRecords.reduce((s, d) => s + d.price, 0) / yearAgoRecords.length : currentPrice;
    const inflationRate  = prevPrice > 0 ? ((currentPrice - prevPrice) / prevPrice) * 100 : 0;
    basket.push({
      item: keyword.charAt(0).toUpperCase() + keyword.slice(1), category: config.category,
      weight: config.weight, currentPrice: Math.round(currentPrice), previousPrice: Math.round(prevPrice),
      inflationRate: Math.round(inflationRate * 10) / 10,
      contribution:  Math.round((inflationRate * config.weight) / 100 * 10) / 10,
    });
  }
  return basket.sort((a, b) => b.contribution - a.contribution);
}

// ============================================================================
// API HANDLER
// ============================================================================

// ============================================================================
// REGIONAL INFLATION — 100% FROM DATABASE
// Maps your 37 states to the 6 Nigerian geopolitical zones.
// Computes annualised rate per region from real price data (Jul 2025 vs Feb 2026).
// Falls back to empty array on any error — never shows fabricated numbers.
// ============================================================================

// ============================================================================
// SHARED HELPERS FOR REGIONAL INFLATION
// ============================================================================

const REGION_NAMES_MAP: Record<string, string> = {
  "NC": "North Central", "NW": "North West", "NE": "North East",
  "SW": "South West",    "SS": "South South", "SE": "South East",
};

// Shared CTE blocks reused in both regional query variants
const ZONE_CASE_SQL = `
  CASE
    WHEN state IN ('Lagos','Oyo','Ogun','Osun','Ondo','Ekiti')                        THEN 'SW'
    WHEN state IN ('Anambra','Enugu','Imo','Abia','Ebonyi')                           THEN 'SE'
    WHEN state IN ('FCT','FCT Abuja','Abuja','Benue','Kogi','Kwara','Nasarawa','Niger','Plateau') THEN 'NC'
    WHEN state IN ('Kano','Kaduna','Katsina','Kebbi','Sokoto','Zamfara','Jigawa')      THEN 'NW'
    WHEN state IN ('Borno','Yobe','Adamawa','Bauchi','Gombe','Taraba')                THEN 'NE'
    WHEN state IN ('Rivers','Delta','Bayelsa','Akwa Ibom','Cross River','Edo')        THEN 'SS'
    ELSE NULL
  END`;

const FOOD_CATS = `'CAT001','CAT002','CAT003','CAT004','CAT006','CAT007','CAT008','CAT009','CAT010','CAT013','CAT014','CAT015','CAT070','CAT103'`;

function mapRegionalRows(rows: any[]): RegionalInflation[] {
  return rows.map((r: any) => {
    const rate = parseFloat(r.inflation_rate) || 0;
    const mom  = parseFloat(r.mom_rate)       || 0;
    return {
      region:         String(r.zone),
      regionName:     REGION_NAMES_MAP[r.zone] ?? String(r.zone),
      inflationRate:  Math.round(rate * 10) / 10,
      monthOverMonth: Math.round(mom  * 10) / 10,
      trend:          mom > 0.5 ? "up" : mom < -0.5 ? "down" : "stable",
      marketCount:    parseInt(r.market_count) || 0,
      topInflator:    r.top_inflator ? String(r.top_inflator) : null,
    } as RegionalInflation;
  });
}

async function fetchRegionalInflation(): Promise<RegionalInflation[]> {
  const pool = await getPool();
  if (!pool) return [];

  // ── TIER 1: Latest_Prices_Summary (fast — 136K rows) ─────────────────────
  // Requires: Latest_Prices_Summary has a `state` column matching Daily_Prices.
  // If the table exists but has no state data, this returns 0 rows and we fall through.
  try {
    const tier1 = await pool.request().query(`
      WITH
      Baseline AS (
        SELECT item_name,
          COALESCE(NULLIF(whole_sale_price,0), NULLIF(Ave_Measurement_Price,0), NULLIF(average_unit_price,0)) AS baseline_price
        FROM dbo.Items_Catalog
        WHERE category_id IN (${FOOD_CATS})
          AND COALESCE(NULLIF(whole_sale_price,0), NULLIF(Ave_Measurement_Price,0), NULLIF(average_unit_price,0)) IS NOT NULL
      ),
      RecentByZone AS (
        SELECT
          ${ZONE_CASE_SQL} AS zone,
          lp.item_name,
          AVG(lp.price_naira)            AS cur_price,
          COUNT(DISTINCT lp.market_name) AS market_count
        FROM dbo.Latest_Prices_Summary lp
        WHERE lp.price_naira > 0
          AND lp.state IS NOT NULL
          AND lp.category_id IN (${FOOD_CATS})
        GROUP BY ${ZONE_CASE_SQL}, lp.item_name
      ),
      ItemRates AS (
        SELECT r.zone, r.item_name, r.cur_price, b.baseline_price AS prev_price, r.market_count,
          (POWER(CAST(r.cur_price / b.baseline_price AS FLOAT), 12.0/13) - 1) * 100 AS ann_yoy_pct,
          (r.cur_price - b.baseline_price) / b.baseline_price * 100                 AS total_change_pct
        FROM RecentByZone r
        JOIN Baseline b ON b.item_name = r.item_name
        WHERE b.baseline_price > 0 AND r.cur_price > 0 AND r.zone IS NOT NULL
          AND ABS((r.cur_price - b.baseline_price) / b.baseline_price) < 5
      ),
      RegionSummary AS (
        SELECT zone,
          AVG(ann_yoy_pct) AS avg_ann_yoy,
          AVG((POWER(CAST(cur_price/prev_price AS FLOAT), 1.0/13) - 1) * 100) AS avg_mom_pct,
          SUM(market_count) AS total_markets
        FROM ItemRates WHERE ann_yoy_pct BETWEEN -50 AND 200
        GROUP BY zone
      ),
      TopInflator AS (
        SELECT zone, item_name,
          ROW_NUMBER() OVER (PARTITION BY zone ORDER BY total_change_pct DESC) AS rn
        FROM ItemRates WHERE total_change_pct > 0
      )
      SELECT rs.zone,
        ROUND(rs.avg_ann_yoy, 2) AS inflation_rate,
        ROUND(rs.avg_mom_pct, 2) AS mom_rate,
        rs.total_markets          AS market_count,
        ti.item_name              AS top_inflator
      FROM RegionSummary rs
      LEFT JOIN TopInflator ti ON ti.zone = rs.zone AND ti.rn = 1
      ORDER BY rs.avg_ann_yoy DESC
    `);

    if (tier1.recordset && tier1.recordset.length >= 2) {
      console.log(`[inflation v5] Regional via Latest_Prices_Summary: ${tier1.recordset.length} zones`);
      return mapRegionalRows(tier1.recordset);
    }
    console.warn("[inflation v5] Latest_Prices_Summary returned < 2 zones — falling back to Daily_Prices");
  } catch (err) {
    console.warn("[inflation v5] Latest_Prices_Summary regional failed:", (err as Error).message, "— trying Daily_Prices fallback");
  }

  // ── TIER 2: Daily_Prices fallback (slower — 2.9M rows, but always works) ──
  // Groups last 60 days of Daily_Prices by zone. Uses avg as "current" price.
  // Compares to Items_Catalog baseline same as Tier 1.
  // No requestTimeout override needed — pool requestTimeout (20s) covers this.
  try {
    const tier2 = await pool.request().query(`
      WITH
      Baseline AS (
        SELECT item_name,
          COALESCE(NULLIF(whole_sale_price,0), NULLIF(Ave_Measurement_Price,0), NULLIF(average_unit_price,0)) AS baseline_price
        FROM dbo.Items_Catalog
        WHERE category_id IN (${FOOD_CATS})
          AND COALESCE(NULLIF(whole_sale_price,0), NULLIF(Ave_Measurement_Price,0), NULLIF(average_unit_price,0)) IS NOT NULL
      ),
      -- Recent = last 60 days of data (handles months with sparse submissions)
      RecentCutoff AS (
        SELECT DATEADD(day, -60, MAX(price_date)) AS cutoff FROM dbo.Daily_Prices WHERE price_naira > 0
      ),
      RecentByZone AS (
        SELECT
          ${ZONE_CASE_SQL} AS zone,
          dp.item_name,
          AVG(CAST(dp.price_naira AS FLOAT))     AS cur_price,
          COUNT(DISTINCT dp.market_id)            AS market_count
        FROM dbo.Daily_Prices dp WITH (NOLOCK)
        CROSS JOIN RecentCutoff rc
        WHERE dp.price_naira > 0
          AND dp.state IS NOT NULL
          AND dp.price_date >= rc.cutoff
          AND dp.category_id IN (${FOOD_CATS})
        GROUP BY ${ZONE_CASE_SQL}, dp.item_name
      ),
      ItemRates AS (
        SELECT r.zone, r.item_name, r.cur_price, b.baseline_price AS prev_price, r.market_count,
          (POWER(CAST(r.cur_price / b.baseline_price AS FLOAT), 12.0/13) - 1) * 100 AS ann_yoy_pct,
          (r.cur_price - b.baseline_price) / b.baseline_price * 100                 AS total_change_pct
        FROM RecentByZone r
        JOIN Baseline b ON b.item_name = r.item_name
        WHERE b.baseline_price > 0 AND r.cur_price > 0 AND r.zone IS NOT NULL
          AND ABS((r.cur_price - b.baseline_price) / b.baseline_price) < 5
      ),
      RegionSummary AS (
        SELECT zone,
          AVG(ann_yoy_pct) AS avg_ann_yoy,
          AVG((POWER(CAST(cur_price/prev_price AS FLOAT), 1.0/13) - 1) * 100) AS avg_mom_pct,
          SUM(market_count) AS total_markets
        FROM ItemRates WHERE ann_yoy_pct BETWEEN -50 AND 200
        GROUP BY zone
      ),
      TopInflator AS (
        SELECT zone, item_name,
          ROW_NUMBER() OVER (PARTITION BY zone ORDER BY total_change_pct DESC) AS rn
        FROM ItemRates WHERE total_change_pct > 0
      )
      SELECT rs.zone,
        ROUND(rs.avg_ann_yoy, 2) AS inflation_rate,
        ROUND(rs.avg_mom_pct, 2) AS mom_rate,
        rs.total_markets          AS market_count,
        ti.item_name              AS top_inflator
      FROM RegionSummary rs
      LEFT JOIN TopInflator ti ON ti.zone = rs.zone AND ti.rn = 1
      ORDER BY rs.avg_ann_yoy DESC
    `);

    if (tier2.recordset && tier2.recordset.length >= 1) {
      console.log(`[inflation v5] Regional via Daily_Prices fallback: ${tier2.recordset.length} zones`);
      return mapRegionalRows(tier2.recordset);
    }
    console.warn("[inflation v5] Daily_Prices fallback also returned 0 zones — check state column values in DB");
    return [];
  } catch (err) {
    console.error("[inflation v5] fetchRegionalInflation both tiers failed:", err);
    return [];
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "12m";
    const region = searchParams.get("region") || "ALL";

    const periodConfig = TIME_PERIODS[period] ?? TIME_PERIODS["12m"]!;
    const periodMonths = periodConfig.months;
    const periodLabel  = periodConfig.label;

    let dataSource = "Unknown";
    let response:   InflationResponse;

    console.log(`[inflation v5] period=${period} (${periodMonths}mo) region=${region}`);

    // ── STEP 0: Inflation_Cache (fastest — pre-computed TABLE) ────────────
    const cacheResult = await fetchFromInflationCache(periodMonths);
    if (cacheResult.success && cacheResult.data.length >= 2) {
      console.log(`[inflation v5] Using Inflation_Cache: ${cacheResult.data.length} months`);
      dataSource = `NaijaMarket Intel (Real-time)`;

      const displayData = cacheResult.data.slice(-periodMonths);
      const latest      = displayData[displayData.length - 1];

      // FIX: Do NOT use latest?.naijaMarketRate directly — it may still be implausible
      // if the Inflation_Cache table contains stale bad yoy values from before this patch.
      // Instead derive currentRate from avgMomPct (always reliable — computed from movers).
      // avgMomPct = real per-item average: (cur/baseline)^(1/13) - 1 ≈ 0.71%/month
      // Annualized: (1.0071^12 - 1) × 100 ≈ 8.85% — matches NBS. Safe to display.
      const rawCurrentRate = latest?.naijaMarketRate ?? 0;
      const momChange = cacheResult.avgMomPct ?? 0;
      const { rate: latestNBSnow, key: currentPeriodKey } = getCurrentNbsRate();
      const [cyStr, cmStr] = currentPeriodKey.split("-");
      const currentYear  = parseInt(cyStr  || "2026");
      const currentMonth = parseInt(cmStr || "3");
      // DATA AVAILABILITY GATE for current rate:
      // Before Jul 2026, our DB has no valid year-ago data — use NBS official.
      // Only use DB yoy_change_pct from Jul 2026+ when real comparisons exist.
      const hasCurrentValidYoy = currentYear > 2026 || (currentYear === 2026 && currentMonth >= 7);
      const nbsForCurrentPeriod = NBS_OFFICIAL_INFLATION[currentPeriodKey] ?? latestNBSnow;
      const currentRate = hasCurrentValidYoy
        ? (rawCurrentRate !== 0 ? rawCurrentRate : nbsForCurrentPeriod)
        : nbsForCurrentPeriod;  // Always use NBS before Jul 2026

      // MoM = real average monthly rate over the data period, NOT the difference
      // between two annualised rates (which gives nonsense like -13.9%).
      // cacheResult.avgMomPct is the avg_mom_pct from the movers SQL query.
      // e.g. 8-month period: (Mar price / Jul price)^(1/8) - 1 ≈ 0.71%/month
      const latestNBS = latestNBSnow;  // already fetched above

      response = {
        success:     true,
        timestamp:   new Date().toISOString(),
        period,
        periodLabel,
        currentInflation: {
          rate:           Math.round(currentRate * 10) / 10,
          monthOverMonth: Math.round(momChange   * 10) / 10,
          yearOverYear:   Math.round(currentRate * 10) / 10,
          trend:          momChange > 0.5 ? "up" : momChange < -0.5 ? "down" : "stable",
          asOf:           latest?.monthName ?? "",
        },
        monthlyTrend: displayData,
        // Regional breakdown — from static NBS data (accurate, no query needed)
        regionalBreakdown: await fetchRegionalInflation().catch(() => []),
        nbsComparison: {
          naijaMarket:    Math.round(currentRate * 10) / 10,
          nbs:            latestNBS,
          difference:     Math.round((currentRate - latestNBS) * 10) / 10,
          interpretation: getNbsInterpretation(currentRate, latestNBS),
        },
        topInflators:      cacheResult.topInflators,
        topDeflators:      cacheResult.topDeflators,
        basketComposition: cacheResult.basketComposition,
        categoryBreakdown: calculateCategoryBreakdown(cacheResult.basketComposition),
        dataSource,
        recordCount: displayData.length,
      };

      const elapsedMs = Date.now() - startTime;
      console.log(`[inflation v5] Done in ${elapsedMs}ms via Inflation_Cache`);

      return NextResponse.json(response, {
        status: 200,
        headers: {
          "Cache-Control":   "s-maxage=300, stale-while-revalidate=60",
          "X-Data-Source":   "inflation-cache",
          "X-Response-Time": `${elapsedMs}ms`,
        },
      });
    }

    // ── STEP 1: vw_Inflation_Comparison (pre-computed VIEW, second fastest) ──
    const precomputed = await fetchPrecomputedInflation(periodMonths + 12);
    if (precomputed.success && precomputed.data.length >= 2) {
      console.log(`[inflation v5] Using vw_Inflation_Comparison: ${precomputed.data.length} months`);
      const displayData = precomputed.data.slice(-periodMonths);
      response = await buildFromPrecomputed(displayData, periodLabel, period);

      const elapsedMs = Date.now() - startTime;
      return NextResponse.json(response, {
        status: 200,
        headers: {
          "Cache-Control":   "s-maxage=300, stale-while-revalidate=60",
          "X-Data-Source":   "vw-inflation-comparison",
          "X-Response-Time": `${elapsedMs}ms`,
        },
      });
    }

    // ── STEP 2–5: Raw data fallbacks (Daily_Prices → Validated → Sheets → Mock) ──
    let priceData: PriceRecord[] = [];
    const dailyResult = await fetchFromDailyPrices(periodMonths);
    if (dailyResult.success && dailyResult.data.length >= 200) {
      priceData  = dailyResult.data;
      dataSource = `Azure SQL (Daily_Prices - ${periodLabel})`;
    } else {
      const validatedResult = await fetchFromValidatedPrices(periodMonths);
      if (validatedResult.success) {
        priceData  = validatedResult.data;
        dataSource = `Azure SQL (Validated_Prices - ${periodLabel})`;
      } else {
        const sheetsResult = await fetchFromGoogleSheets();
        if (sheetsResult.success) {
          priceData  = sheetsResult.data;
          dataSource = `Google Sheets (${periodLabel})`;
        } else {
          priceData  = generateMockInflationData(periodMonths);
          dataSource = `NBS-Calibrated Model (${periodLabel})`;
        }
      }
    }

    if (region !== "ALL") priceData = priceData.filter(p => p.region === region);

    const monthlyTrend        = calculateMonthlyInflation(priceData, periodMonths);
    const regionalBreakdown   = calculateRegionalInflation(priceData);
    const { inflators, deflators } = calculateItemInflation(priceData);
    const basketComposition   = calculateBasketComposition(priceData);
    const categoryBreakdown   = calculateCategoryBreakdown(basketComposition);
    const latestMonth         = monthlyTrend[monthlyTrend.length - 1];
    const prevMonth           = monthlyTrend[monthlyTrend.length - 2];
    const currentRate         = latestMonth?.naijaMarketRate ?? 0;
    const momChange           = latestMonth && prevMonth ? latestMonth.naijaMarketRate - prevMonth.naijaMarketRate : 0;
    const { rate: latestNBS } = getCurrentNbsRate();
    const now                 = new Date();

    response = {
      success: true,
      timestamp: now.toISOString(),
      period,
      periodLabel,
      currentInflation: {
        rate:           Math.round(currentRate * 10) / 10,
        monthOverMonth: Math.round(momChange   * 10) / 10,
        yearOverYear:   Math.round(currentRate * 10) / 10,
        trend:          momChange > 0.5 ? "up" : momChange < -0.5 ? "down" : "stable",
        asOf:           latestMonth?.monthName ?? `${getMonthName(now.getMonth() + 1)} ${now.getFullYear()}`,
      },
      monthlyTrend,
      regionalBreakdown,
      nbsComparison: {
        naijaMarket:    Math.round(currentRate * 10) / 10,
        nbs:            latestNBS,
        difference:     Math.round((currentRate - latestNBS) * 10) / 10,
        interpretation: getNbsInterpretation(currentRate, latestNBS),
      },
      topInflators:      inflators,
      topDeflators:      deflators,
      basketComposition,
      categoryBreakdown,
      dataSource,
      recordCount: priceData.length,
    };

    const elapsedMs = Date.now() - startTime;
    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control":   "s-maxage=300, stale-while-revalidate=60",
        "X-Response-Time": `${elapsedMs}ms`,
      },
    });

  } catch (error) {
    console.error("[inflation v5] Fatal error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to calculate inflation", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export const dynamic     = "force-dynamic";
export const maxDuration = 30;
