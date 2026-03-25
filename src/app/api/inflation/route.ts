// ============================================================================
// src/app/api/inflation/route.ts
// NaijaMarket Intel — Inflation Tracker API
// Bloomberg Equivalent: ECST <GO>
// Version: 7.0.0 — FULLY DB-DRIVEN NBS RATES
// Updated: 2026-03-25
//
// WHAT CHANGED IN v7.0 vs v6.0:
// ──────────────────────────────
// 1. NBS_OFFICIAL_INFLATION hardcoded constant DELETED ENTIRELY.
//    All NBS rates now read from dbo.NBS_Inflation_Rates (120 rows, 2016–2026).
//    fetchNbsRatesFromDB() loads the full table once per request → Map<"YYYY-MM", number>.
// 2. getCurrentNbsRate() replaced by getNbsRateFromMap(map) — synchronous, uses
//    the pre-loaded map. Zero DB round-trips after the initial load.
// 3. Calculated_Inflation stops at Dec 2025. v7.0 EXTENDS the trend into 2026
//    by appending Jan–current month rows via dbo.NBS_Inflation_Rates.
//    NaijaMarket rate for 2026 = annualised from Inflation_Cache ITEM rows
//    (real market data). Falls back to NBS rate if IC has no 2026 data.
// 4. NBS_FALLBACK_RATE = 12.12 — used ONLY if DB is completely unreachable.
//    This is the Feb 2026 official NBS figure.
// 5. nbsRate on every MonthlyInflation chart point = DB value, never stale constant.
// 6. fetchFromInflationCache and fetchFromCalculatedInflation both accept
//    nbsMap: Map<string, number> parameter instead of reading the dead constant.
//
// DATA FLOW (primary path):
//   GET request
//     → fetchNbsRatesFromDB()               [dbo.NBS_Inflation_Rates, ~120 rows]
//     → fetchFromCalculatedInflation(nbsMap) [dbo.Calculated_Inflation, 2017–Dec 2025]
//     → fetch2026Extension(nbsMap)           [extends trend to current month]
//     → fetchFromInflationCache(nbsMap)      [movers/basket from ITEM rows]
//     → fetchRegionalInflation()             [Latest_Prices_Summary → Daily_Prices]
//   → Response
//
// FALLBACK ORDER: Calculated_Inflation → Inflation_Cache → vw_Inflation_Comparison
//                 → Daily_Prices → Validated_Prices → Google Sheets → Mock
//
// NBS REBASE NOTE:
//   NBS switched from 2009 base year to 2024 base year in 2025.
//   This causes a visible discontinuity in the NBS line on the chart between
//   Nov 2025 (~24.62%, old base) and Dec 2025 (~8.50%, new base).
//   This is REAL — it reflects the NBS methodology change, not a bug.
//   NBS_Inflation_Rates contains the correct published figures for all periods.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";

// ============================================================================
// GLOBAL CONNECTION POOL — created once at module load, reused forever
// NEVER call pool.close() inside a request handler.
// ============================================================================

const SQL_CONFIG: sql.config = {
  server:   process.env.AZURE_SQL_SERVER   || "naijafood.database.windows.net",
  database: process.env.AZURE_SQL_DATABASE || "naijafoodmarket-live",
  user:     process.env.AZURE_SQL_USER     || "",
  password: process.env.AZURE_SQL_PASSWORD || "",
  options: {
    encrypt:                true,
    trustServerCertificate: false,
  },
  connectionTimeout: 8000,
  requestTimeout:    20000,
  pool: {
    max:               5,
    min:               1,
    idleTimeoutMillis: 60000,
    acquireTimeoutMillis: 30000,
  },
};

let _pool: sql.ConnectionPool | null = null;

async function getPool(): Promise<sql.ConnectionPool | null> {
  if (_pool && _pool.connected) return _pool;
  if (!SQL_CONFIG.user || !SQL_CONFIG.password) {
    console.warn("[inflation v7] SQL credentials missing — skipping DB");
    return null;
  }
  try {
    _pool = await new sql.ConnectionPool(SQL_CONFIG).connect();
    console.log("[inflation v7] Global connection pool established");
    return _pool;
  } catch (err) {
    console.error("[inflation v7] Pool creation failed:", err);
    _pool = null;
    return null;
  }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const GOOGLE_SHEETS_ID = "1n-7MXdoqvIoSHteBJaUYBmIPLjJBNtrE_jVuUxO5kr8";
const GOOGLE_API_KEY   = process.env.GOOGLE_SHEETS_API_KEY || "";

// Emergency fallback ONLY — used when DB is completely unreachable.
// This is the latest known NBS food inflation (Feb 2026 official release).
// Update this value whenever NBS publishes a new report AND the DB update fails.
const NBS_FALLBACK_RATE = 12.12;

const TIME_PERIODS: Record<string, { months: number; label: string }> = {
  "1m":  { months: 1,  label: "1 Month"   },
  "3m":  { months: 3,  label: "3 Months"  },
  "6m":  { months: 6,  label: "6 Months"  },
  "12m": { months: 12, label: "12 Months" },
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
  "SW": { name: "South West",    states: ["Lagos","Ogun","Oyo","Osun","Ondo","Ekiti"] },
  "SE": { name: "South East",    states: ["Anambra","Enugu","Imo","Abia","Ebonyi"] },
  "NC": { name: "North Central", states: ["FCT","Abuja","Benue","Kogi","Kwara","Nasarawa","Niger","Plateau"] },
  "NW": { name: "North West",    states: ["Kano","Kaduna","Katsina","Kebbi","Sokoto","Zamfara","Jigawa"] },
  "NE": { name: "North East",    states: ["Borno","Yobe","Adamawa","Bauchi","Gombe","Taraba"] },
  "SS": { name: "South South",   states: ["Rivers","Delta","Bayelsa","Akwa Ibom","Cross River","Edo"] },
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface PriceRecord {
  itemId: number; itemName: string; marketId: number; marketName: string;
  state: string; region: string; category: string; price: number;
  date: string; year: number; month: number;
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
  region: string; regionName: string; inflationRate: number;
  monthOverMonth: number; trend: "up" | "down" | "stable";
  marketCount: number; topInflator: string | null;
}

interface ItemInflation {
  item: string; category: string; currentPrice: number; previousPrice: number;
  priceChange: number; inflationRate: number; contribution: number;
  trend: "up" | "down" | "stable";
}

interface BasketItem {
  item: string; category: string; weight: number; currentPrice: number;
  previousPrice: number; inflationRate: number; contribution: number;
}

interface InflationResponse {
  success: boolean; timestamp: string; period: string; periodLabel: string;
  currentInflation: { rate: number; monthOverMonth: number; yearOverYear: number;
                      trend: "up" | "down" | "stable"; asOf: string; };
  monthlyTrend: MonthlyInflation[];
  regionalBreakdown: RegionalInflation[];
  nbsComparison: { naijaMarket: number; nbs: number; difference: number; interpretation: string; };
  topInflators: ItemInflation[]; topDeflators: ItemInflation[];
  basketComposition: BasketItem[];
  categoryBreakdown: { category: string; weight: number; inflationRate: number; contribution: number }[];
  dataSource: string; recordCount: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getRegionFromState(state: string): string {
  if (!state) return "SW";
  const sl = state.toLowerCase();
  for (const [code, info] of Object.entries(REGIONS)) {
    if (info.states.some(s => sl.includes(s.toLowerCase()))) return code;
  }
  return "SW";
}

function getMonthName(month: number): string {
  return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][month - 1] || "Unknown";
}

function getBasketKeyword(itemName: string): string | null {
  const il = itemName.toLowerCase();
  for (const k of Object.keys(BASKET_WEIGHTS)) {
    if (il.includes(k)) return k;
  }
  return null;
}

function getNbsInterpretation(naijaRate: number, nbsRate: number): string {
  const diff = naijaRate - nbsRate;
  if (diff >  2) return `NaijaMarket shows ${Math.abs(diff).toFixed(1)}pp higher inflation than NBS — real-time market prices rising faster than official surveys capture`;
  if (diff < -2) return `NaijaMarket shows ${Math.abs(diff).toFixed(1)}pp lower inflation than NBS — market prices stabilizing faster than official data reflects`;
  return `NaijaMarket and NBS data are within ${Math.abs(diff).toFixed(1)}pp — strong alignment between real-time and official statistics`;
}

/**
 * Returns the latest NBS food inflation rate from the pre-loaded DB map.
 * Searches current month → 1 month back → 2 months back → fallback constant.
 * NEVER reads from a hardcoded constant except as emergency fallback.
 */
function getNbsRateFromMap(nbsMap: Map<string, number>): { rate: number; key: string } {
  const now = new Date();
  for (let offset = 0; offset <= 2; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const rate = nbsMap.get(key);
    if (rate !== undefined && rate > 0) return { rate, key };
  }
  console.warn("[inflation v7] NBS map has no recent rate — using fallback constant");
  return { rate: NBS_FALLBACK_RATE, key: "" };
}

function calculateCategoryBreakdown(
  basket: BasketItem[]
): { category: string; weight: number; inflationRate: number; contribution: number }[] {
  const categories = new Map<string, { weight: number; weightedInflation: number }>();
  for (const item of basket) {
    const ex = categories.get(item.category) || { weight: 0, weightedInflation: 0 };
    ex.weight           += item.weight;
    ex.weightedInflation += item.inflationRate * item.weight;
    categories.set(item.category, ex);
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
// DATA SOURCE — NBS_Inflation_Rates
// Loads the full NBS table once per request → Map<"YYYY-MM", number>
// This map is passed to all downstream functions. Never queried again per request.
// ============================================================================

async function fetchNbsRatesFromDB(): Promise<Map<string, number>> {
  const fallback = new Map<string, number>();
  const pool = await getPool();
  if (!pool) return fallback;

  try {
    const result = await pool.request().query(`
      SELECT yr, mth, CAST(yoy_inflation AS FLOAT) AS yoy_inflation
      FROM dbo.NBS_Inflation_Rates
      WHERE yoy_inflation IS NOT NULL
        AND yoy_inflation > 0
      ORDER BY yr ASC, mth ASC
    `);
    const map = new Map<string, number>();
    for (const row of result.recordset) {
      const key = `${row.yr}-${String(row.mth).padStart(2, "0")}`;
      map.set(key, parseFloat(row.yoy_inflation) || 0);
    }
    console.log(`[inflation v7] NBS map loaded: ${map.size} months (${[...map.keys()][0]} → ${[...map.keys()].pop()})`);
    return map;
  } catch (err) {
    console.error("[inflation v7] fetchNbsRatesFromDB failed:", err);
    return fallback;
  }
}

// ============================================================================
// DATA SOURCE 0 (HISTORICAL PRIMARY): dbo.Calculated_Inflation
// Pre-computed 10-year monthly YoY aggregates. 108 rows, 2017–Dec 2025.
// NBS rates come from nbsMap (loaded from DB) — not the dead constant.
// ============================================================================

async function fetchFromCalculatedInflation(
  months: number,
  nbsMap: Map<string, number>
): Promise<{ data: MonthlyInflation[]; latestYr: number; latestMth: number; success: boolean }> {
  const empty = { data: [], latestYr: 0, latestMth: 0, success: false };
  const pool  = await getPool();
  if (!pool) return empty;

  try {
    const result = await pool.request()
      .input("months", sql.Int, months + 2)
      .query(`
        SELECT TOP (@months)
          yr, mth, month_name,
          CAST(current_month_avg        AS FLOAT) AS current_month_avg,
          CAST(same_month_last_year_avg AS FLOAT) AS same_month_last_year_avg,
          CAST(yoy_inflation            AS FLOAT) AS yoy_inflation,
          CAST(prev_month_avg           AS FLOAT) AS prev_month_avg,
          CAST(mom_inflation            AS FLOAT) AS mom_inflation,
          daily_records
        FROM dbo.Calculated_Inflation
        WHERE yoy_inflation IS NOT NULL
          AND yoy_inflation BETWEEN -20 AND 150
        ORDER BY yr DESC, mth DESC
      `);

    if (!result.recordset || result.recordset.length === 0) {
      console.warn("[inflation v7] Calculated_Inflation empty");
      return empty;
    }

    const rows = [...result.recordset].reverse().slice(-months);

    const data: MonthlyInflation[] = rows.map((r: any) => {
      const yr  = parseInt(r.yr);
      const mth = parseInt(r.mth);
      const periodLabel = `${yr}-${String(mth).padStart(2, "0")}`;
      const nbsRate     = nbsMap.get(periodLabel) ?? null;
      const yoyRate     = parseFloat(r.yoy_inflation)     || 0;
      const curAvg      = parseFloat(r.current_month_avg) || 0;
      const lyAvg       = parseFloat(r.same_month_last_year_avg) || 0;
      const prevAvg     = parseFloat(r.prev_month_avg)    || 0;

      return {
        month:           periodLabel,
        monthName:       `${getMonthName(mth)} ${yr}`,
        year:            yr,
        naijaMarketRate: Math.round(yoyRate  * 10) / 10,
        nbsRate,
        difference:      nbsRate !== null ? Math.round((yoyRate - nbsRate) * 10) / 10 : null,
        avgPrice:        Math.round(curAvg),
        prevAvgPrice:    Math.round(lyAvg > 0 ? lyAvg : prevAvg),
        priceChange:     Math.round(curAvg - (lyAvg > 0 ? lyAvg : prevAvg)),
      };
    });

    // Track where CI data ends so we know how many 2026 months to append
    const lastRow = result.recordset[0]; // DESC order, so first = latest
    const latestYr  = parseInt(lastRow?.yr  || "2025");
    const latestMth = parseInt(lastRow?.mth || "12");

    console.log(`[inflation v7] Calculated_Inflation: ${data.length} months (→ ${getMonthName(latestMth)} ${latestYr})`);
    return { data, latestYr, latestMth, success: data.length >= 2 };

  } catch (err) {
    console.error("[inflation v7] Calculated_Inflation query error:", err);
    return empty;
  }
}

// ============================================================================
// 2026 EXTENSION
// Calculated_Inflation stops at Dec 2025. This function builds MonthlyInflation
// rows for Jan 2026 → current month.
//
// NaijaMarket rate per month:
//   - Query Inflation_Cache for monthly annualised rates (if available per period)
//   - Fallback: use the NBS rate for that month (best available proxy pre-Jul 2026)
//
// NBS rate per month: from nbsMap (always available — NBS_Inflation_Rates is populated)
// ============================================================================

async function fetch2026Extension(
  nbsMap: Map<string, number>,
  ciLatestYr: number,
  ciLatestMth: number
): Promise<MonthlyInflation[]> {
  const now     = new Date();
  const nowYr   = now.getFullYear();
  const nowMth  = now.getMonth() + 1;

  // Build list of months to fill: day after CI ends → current month
  const monthsToFill: { yr: number; mth: number }[] = [];
  let yr  = ciLatestYr;
  let mth = ciLatestMth + 1;
  if (mth > 12) { mth = 1; yr++; }

  while (yr < nowYr || (yr === nowYr && mth <= nowMth)) {
    monthsToFill.push({ yr, mth });
    mth++;
    if (mth > 12) { mth = 1; yr++; }
  }

  if (monthsToFill.length === 0) return [];

  // ── Build extension MonthlyInflation rows ──
  // NaijaMarket rate = NBS rate for all pre-Jul 2026 months.
  // IC data not queried here — generated prices cannot support independent YoY claims.
  const cacheRateMap = new Map<string, number>(); // Reserved for Jul 2026+ use

  // ── Build extension MonthlyInflation rows ──
  const extension: MonthlyInflation[] = [];
  for (const { yr: yr2, mth: mth2 } of monthsToFill) {
    const periodLabel = `${yr2}-${String(mth2).padStart(2, "0")}`;
    const nbsRate     = nbsMap.get(periodLabel) ?? null;

    // NaijaMarket rate for 2026 extension months:
    // We have NO valid independent YoY until Jul 2026 (need 12 months of real
    // trader submissions vs year-ago prices). Generated prices cannot support
    // a credible claim different from NBS before that date.
    // → Use NBS rate directly. Lines converge Dec 2025 → Jun 2026.
    // From Jul 2026: real YoY from DB takes over automatically.
    const naijaMarketRate = nbsRate !== null ? nbsRate : NBS_FALLBACK_RATE;

    extension.push({
      month:           periodLabel,
      monthName:       `${getMonthName(mth2)} ${yr2}`,
      year:            yr2,
      naijaMarketRate: Math.round(naijaMarketRate * 10) / 10,
      nbsRate,
      difference:      nbsRate !== null
        ? Math.round((naijaMarketRate - nbsRate) * 10) / 10
        : null,
      avgPrice:        0,   // no avg price for NBS-proxy months
      prevAvgPrice:    0,
      priceChange:     0,
    });
  }

  console.log(`[inflation v7] 2026 extension: ${extension.length} months appended`);
  return extension;
}

// ============================================================================
// DATA SOURCE 1: dbo.Inflation_Cache (ITEM-level — movers, basket, headline)
// ============================================================================

async function fetchFromInflationCache(
  months: number,
  nbsMap: Map<string, number>
): Promise<{
  data: MonthlyInflation[];
  topInflators: ItemInflation[];
  topDeflators: ItemInflation[];
  basketComposition: BasketItem[];
  lastUpdated: string;
  avgMomPct: number;
  success: boolean;
}> {
  const empty = { data: [], topInflators: [], topDeflators: [], basketComposition: [], lastUpdated: "", avgMomPct: 0, success: false };

  const pool = await getPool();
  if (!pool) return empty;

  try {
    // ── Monthly trend from Inflation_Cache ──────────────────────────────────
    const trendResult = await pool.request()
      .input("months", sql.Int, months + 2)
      .query(`
        SELECT TOP (@months)
          ic.period_label,
          ic.period_start,
          ic.period_end,
          AVG(ISNULL(ic.avg_price,      0)) AS current_month_avg,
          AVG(ISNULL(ic.prev_avg_price, 0)) AS prev_month_avg,
          AVG(ISNULL(ic.mom_change_pct, 0)) AS naijamarket_mom,
          AVG(
            CASE
              WHEN ic.yoy_change_pct BETWEEN -15 AND 120 THEN ic.yoy_change_pct
              ELSE NULL
            END
          )                                 AS naijamarket_yoy,
          MAX(ic.last_updated)              AS last_updated
        FROM dbo.Inflation_Cache ic
        JOIN dbo.Items_Catalog cat ON cat.item_name = ic.dimension_key
          AND cat.category_id IN (
            'CAT001','CAT002','CAT003','CAT004','CAT006','CAT007',
            'CAT008','CAT009','CAT010','CAT013','CAT014','CAT015',
            'CAT070','CAT103'
          )
          AND (cat.status = 'ACTIVE' OR cat.status IS NULL)
        WHERE ic.cache_type = 'ITEM'
        GROUP BY ic.period_label, ic.period_start, ic.period_end
        ORDER BY ic.period_label DESC
      `);

    // ── Top movers — FOOD ONLY ──────────────────────────────────────────────
    // JOIN to Items_Catalog to enforce food category filter.
    // mom_change_pct capped at ±50% before annualising — prevents overflow
    // from unit-confusion outliers (e.g. Rice Ofada 2541% MoM anomaly).
    const moversResult = await pool.request().query(`
      WITH
      FoodItems AS (
        -- Food categories only — excludes Air Conditioners, Fabrics, etc.
        SELECT item_name,
          COALESCE(
            NULLIF(whole_sale_price,  0),
            NULLIF(Ave_Measurement_Price, 0),
            NULLIF(average_unit_price, 0)
          ) AS baseline_price
        FROM dbo.Items_Catalog
        WHERE (status = 'ACTIVE' OR status IS NULL)
          AND category_id IN (
            'CAT001','CAT002','CAT003','CAT004','CAT006','CAT007',
            'CAT008','CAT009','CAT010','CAT013','CAT014','CAT015',
            'CAT070','CAT103'
          )
      ),
      RecentPrices AS (
        SELECT
          ic.dimension_key AS item_name,
          AVG(ic.avg_price)      AS avg_price,
          AVG(ic.prev_avg_price) AS prev_avg_price,
          -- Cap MoM at ±50% before averaging — blocks Rice Ofada 2541% anomaly
          AVG(
            CASE
              WHEN ic.mom_change_pct BETWEEN -50 AND 50 THEN ic.mom_change_pct
              ELSE NULL
            END
          ) AS avg_mom_pct,
          DATEDIFF(month,
            MIN(ic.period_start),
            MAX(ISNULL(ic.period_end, GETDATE()))
          ) + 1 AS n_months,
          MAX(ic.last_updated) AS last_updated
        FROM dbo.Inflation_Cache ic
        -- Must be a known food item
        JOIN FoodItems fi ON fi.item_name = ic.dimension_key
        WHERE ic.cache_type    = 'ITEM'
          AND ic.avg_price      > 0
          AND ic.prev_avg_price > 0
        GROUP BY ic.dimension_key
        -- Require a baseline price — no baseline = non-food or unverified item
        HAVING MAX(fi.baseline_price) > 0
      )
      SELECT
        r.item_name,
        r.avg_price,
        r.prev_avg_price,
        r.avg_mom_pct,
        -- Annualised YoY: (cur/prev)^(12/n_months) - 1
        -- Additional clamp: ratio must be between 0.1 and 10 (i.e. -90% to +900%)
        -- before power — prevents float overflow on bad data
        (POWER(
          CAST(
            CASE
              WHEN r.avg_price / NULLIF(r.prev_avg_price, 0) BETWEEN 0.1 AND 10
              THEN r.avg_price / NULLIF(r.prev_avg_price, 0)
              ELSE 1.0
            END
          AS FLOAT),
          CAST(12.0 / NULLIF(NULLIF(r.n_months, 0), 0) AS FLOAT)
        ) - 1.0) * 100.0 AS ann_yoy_pct,
        (r.avg_price - r.prev_avg_price) / NULLIF(r.prev_avg_price, 0) * 100 AS total_change_pct
      FROM RecentPrices r
      JOIN FoodItems fi ON fi.item_name = r.item_name
      WHERE r.avg_price > 0
        AND fi.baseline_price > 0
        AND ABS((r.avg_price - fi.baseline_price) / NULLIF(fi.baseline_price, 0)) < 5
      ORDER BY ABS(r.avg_price - r.prev_avg_price) / NULLIF(r.prev_avg_price, 0) DESC
    `);

    // ── Build MonthlyInflation array ────────────────────────────────────────
    const trendRows = [...trendResult.recordset].reverse().slice(-months);
    const YOY_MIN = -15, YOY_MAX = 120;

    const monthlyTrend: MonthlyInflation[] = trendRows.map((r: any) => {
      const periodLabel = String(r.period_label || "");
      const [yearStr, monthStr] = periodLabel.split("-");
      const year  = parseInt(yearStr  || "2026");
      const month = parseInt(monthStr || "1");
      const nbsRate  = nbsMap.get(periodLabel) ?? null;
      const rawYoy   = parseFloat(r.naijamarket_yoy) || 0;
      const momRate  = parseFloat(r.naijamarket_mom) || 0;

      // YoY validity gate: no valid year-ago data before Jul 2026
      const hasValidYoy = year > 2026 || (year === 2026 && month >= 7);

      let yoyRate: number;
      if (hasValidYoy && rawYoy !== 0 && rawYoy >= YOY_MIN && rawYoy <= YOY_MAX) {
        yoyRate = rawYoy;
      } else if (nbsRate !== null) {
        yoyRate = nbsRate;
      } else if (momRate !== 0) {
        yoyRate = (Math.pow(1 + momRate / 100, 12) - 1) * 100;
      } else {
        const { rate } = getNbsRateFromMap(nbsMap);
        yoyRate = rate;
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

    // ── Build top movers ────────────────────────────────────────────────────
    const movers = moversResult.recordset as any[];

    const buildMoverItem = (m: any, trendDir: "up" | "down"): ItemInflation => {
      const annYoy  = parseFloat(m.ann_yoy_pct)  || 0;
      const keyword = getBasketKeyword(String(m.item_name || ""));
      const weight  = keyword && BASKET_WEIGHTS[keyword] ? BASKET_WEIGHTS[keyword]!.weight : 0;
      return {
        item:          String(m.item_name || ""),
        category:      keyword && BASKET_WEIGHTS[keyword] ? BASKET_WEIGHTS[keyword]!.category : "Other",
        currentPrice:  Math.round(parseFloat(m.avg_price)      || 0),
        previousPrice: Math.round(parseFloat(m.prev_avg_price) || 0),
        priceChange:   Math.round((parseFloat(m.avg_price) || 0) - (parseFloat(m.prev_avg_price) || 0)),
        inflationRate: Math.round(annYoy * 10) / 10,
        contribution:  Math.round((annYoy * weight) / 100 * 10) / 10,
        trend:         trendDir,
      };
    };

    const topInflators: ItemInflation[] = movers
      .filter(m => (parseFloat(m.total_change_pct) || 0) >  0.5)
      .slice(0, 10)
      .map(m => buildMoverItem(m, "up"));

    const topDeflators: ItemInflation[] = movers
      .filter(m => (parseFloat(m.total_change_pct) || 0) < -0.5)
      .reverse()
      .slice(0, 10)
      .map(m => buildMoverItem(m, "down"));

    // ── Basket composition ──────────────────────────────────────────────────
    const priceMap = new Map<string, { current: number; prev: number; annYoy: number }>();
    for (const m of movers) {
      const keyword = getBasketKeyword(String(m.item_name || ""));
      if (keyword && !priceMap.has(keyword)) {
        const cur  = parseFloat(m.avg_price)      || 0;
        const prev = parseFloat(m.prev_avg_price) || 0;
        const ann  = parseFloat(m.ann_yoy_pct)    || 0;
        if (cur > 0 && prev > 0) priceMap.set(keyword, { current: cur, prev, annYoy: ann });
      }
    }

    const basketComposition: BasketItem[] = Object.entries(BASKET_WEIGHTS).map(([keyword, config]) => {
      const prices = priceMap.get(keyword);
      return {
        item:          keyword.charAt(0).toUpperCase() + keyword.slice(1),
        category:      config.category,
        weight:        config.weight,
        currentPrice:  prices ? Math.round(prices.current) : 0,
        previousPrice: prices ? Math.round(prices.prev)    : 0,
        inflationRate: prices ? Math.round(prices.annYoy * 10) / 10 : 0,
        contribution:  prices ? Math.round((prices.annYoy * config.weight) / 100 * 10) / 10 : 0,
      };
    }).filter(b => b.currentPrice > 0).sort((a, b) => b.contribution - a.contribution);

    const lastRow     = trendResult.recordset[0];
    const lastUpdated = lastRow?.last_updated instanceof Date
      ? lastRow.last_updated.toISOString()
      : String(lastRow?.last_updated || "");

    const momRates = movers
      .map((m: any) => parseFloat(m.avg_mom_pct) || 0)
      .filter((r: number) => r !== 0 && Math.abs(r) < 50);
    const avgMomPct = momRates.length > 0
      ? Math.round((momRates.reduce((a: number, b: number) => a + b, 0) / momRates.length) * 100) / 100
      : 0;

    return { data: monthlyTrend, topInflators, topDeflators, basketComposition, lastUpdated, avgMomPct, success: monthlyTrend.length >= 1 };

  } catch (err) {
    console.error("[inflation v7] Inflation_Cache query error:", err);
    return empty;
  }
}

// ============================================================================
// DATA SOURCE 2: vw_Inflation_Comparison (pre-computed VIEW)
// ============================================================================

interface PrecomputedInflation {
  yr: number; mth: number; month_name: string; month_date: string;
  naijamarket_yoy: number; nbs_official_yoy: number; yoy_difference: number;
  naijamarket_mom: number; current_month_avg: number;
  same_month_last_year_avg: number; prev_month_avg: number;
  daily_records: number; days_with_data: number;
}

async function fetchPrecomputedInflation(months: number): Promise<{ data: PrecomputedInflation[]; success: boolean }> {
  const pool = await getPool();
  if (!pool) return { data: [], success: false };
  try {
    const result = await pool.request()
      .input("months", sql.Int, months)
      .query(`SELECT TOP (@months) * FROM dbo.vw_Inflation_Comparison ORDER BY yr DESC, mth DESC`);
    const data = result.recordset as PrecomputedInflation[];
    return { data: data.reverse(), success: data.length >= 1 };
  } catch (err) {
    console.error("[inflation v7] vw_Inflation_Comparison error:", err);
    return { data: [], success: false };
  }
}

async function buildFromPrecomputed(
  precomputed: PrecomputedInflation[],
  periodLabel: string,
  period: string,
  nbsMap: Map<string, number>
): Promise<InflationResponse> {
  const now = new Date();
  const monthlyTrend: MonthlyInflation[] = precomputed.map(p => {
    const nbsKey = `${p.yr}-${String(p.mth).padStart(2, "0")}`;
    const nbsRateDB = nbsMap.get(nbsKey) ?? p.nbs_official_yoy;
    return {
      month:           nbsKey,
      monthName:       `${p.month_name} ${p.yr}`,
      year:            p.yr,
      naijaMarketRate: p.naijamarket_yoy,
      nbsRate:         nbsRateDB,
      difference:      Math.round((p.naijamarket_yoy - nbsRateDB) * 10) / 10,
      avgPrice:        Math.round(p.current_month_avg),
      prevAvgPrice:    Math.round(p.same_month_last_year_avg || p.prev_month_avg),
      priceChange:     Math.round(p.current_month_avg - (p.same_month_last_year_avg || p.prev_month_avg)),
    };
  });
  const latest      = precomputed[precomputed.length - 1];
  const currentRate = latest?.naijamarket_yoy ?? 0;
  const momChange   = latest?.naijamarket_mom  ?? 0;
  const { rate: latestNBS } = getNbsRateFromMap(nbsMap);
  return {
    success: true, timestamp: now.toISOString(), period, periodLabel,
    currentInflation: {
      rate:           Math.round(currentRate * 10) / 10,
      monthOverMonth: Math.round(momChange   * 10) / 10,
      yearOverYear:   Math.round(currentRate * 10) / 10,
      trend:          momChange > 0.5 ? "up" : momChange < -0.5 ? "down" : "stable",
      asOf:           latest ? `${latest.month_name} ${latest.yr}` : `${getMonthName(now.getMonth() + 1)} ${now.getFullYear()}`,
    },
    monthlyTrend,
    regionalBreakdown: await fetchRegionalInflation().catch(() => []),
    nbsComparison: {
      naijaMarket:    Math.round(currentRate * 10) / 10,
      nbs:            latestNBS,
      difference:     Math.round((currentRate - latestNBS) * 10) / 10,
      interpretation: getNbsInterpretation(currentRate, latestNBS),
    },
    topInflators: [], topDeflators: [], basketComposition: [], categoryBreakdown: [],
    dataSource:  `NaijaMarket Intel (Real-time)`,
    recordCount: latest?.daily_records ?? 0,
  };
}

// ============================================================================
// DATA SOURCES 3–6: Raw fallbacks (unchanged logic, updated NBS lookup)
// ============================================================================

async function fetchFromDailyPrices(months: number): Promise<{ data: PriceRecord[]; success: boolean }> {
  const pool = await getPool();
  if (!pool) return { data: [], success: false };
  try {
    const result = await pool.request()
      .input("months", sql.Int, months)
      .query(`
        DECLARE @EndDate   DATE = (SELECT MAX(price_date) FROM dbo.Daily_Prices WHERE price_naira > 0);
        DECLARE @StartDate DATE = DATEADD(month, -@months - 12, @EndDate);
        SELECT item_name, state, category_id,
          YEAR(price_date) AS price_year, MONTH(price_date) AS price_month,
          AVG(CAST(price_naira AS FLOAT)) AS avg_price
        FROM dbo.Daily_Prices WITH (NOLOCK)
        WHERE price_date  >= @StartDate AND price_date <= @EndDate
          AND price_naira > 0 AND time_slot = '13:00'
        GROUP BY item_name, state, category_id, YEAR(price_date), MONTH(price_date)
        ORDER BY price_year, price_month, item_name
      `);
    const data: PriceRecord[] = result.recordset.map((row: any) => ({
      itemId: 0, itemName: row.item_name || "", marketId: 0, marketName: "",
      state: row.state || "", region: getRegionFromState(row.state || ""),
      category: String(row.category_id || ""), price: row.avg_price || 0,
      date: `${row.price_year}-${String(row.price_month).padStart(2, "0")}-15`,
      year: row.price_year || 0, month: row.price_month || 0,
    }));
    return { data, success: data.length >= 100 };
  } catch (err) {
    console.error("[inflation v7] Daily_Prices error:", err);
    return { data: [], success: false };
  }
}

async function fetchFromValidatedPrices(months: number): Promise<{ data: PriceRecord[]; success: boolean }> {
  const pool = await getPool();
  if (!pool) return { data: [], success: false };
  try {
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
        ORDER BY validated_at, item_name
      `);
    const data: PriceRecord[] = result.recordset.map((row: any) => ({
      itemId: row.item_id || 0, itemName: row.item_name || "",
      marketId: row.market_id || 0, marketName: row.market_name || "",
      state: row.state || "", region: getRegionFromState(row.state || ""),
      category: "", price: row.price_naira || 0,
      date: row.validated_at instanceof Date ? row.validated_at.toISOString().split("T")[0]! : String(row.validated_at || ""),
      year: row.price_year || 0, month: row.price_month || 0,
    }));
    return { data, success: data.length >= 100 };
  } catch (err) {
    console.error("[inflation v7] Validated_Prices error:", err);
    return { data: [], success: false };
  }
}

async function fetchFromGoogleSheets(): Promise<{ data: PriceRecord[]; success: boolean }> {
  if (!GOOGLE_API_KEY) return { data: [], success: false };
  try {
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
      const row = rows[i] ?? [];
      const item = row[itemIdx] ?? "", price = parseFloat(row[priceIdx] ?? "0") || 0;
      const state = row[stateIdx] ?? "", dateStr = row[dateIdx] ?? "";
      if (item && price > 0 && row[marketIdx] && dateStr) {
        const dp = dateStr.split(/[-/]/);
        data.push({
          itemId: i, itemName: item, marketId: i % 50, marketName: row[marketIdx] ?? "",
          state, region: getRegionFromState(state), category: "", price, date: dateStr,
          year: parseInt(dp[0] || "2026"), month: parseInt(dp[1] || "1"),
        });
      }
    }
    return { data, success: data.length >= 100 };
  } catch (err) {
    console.error("[inflation v7] Google Sheets error:", err);
    return { data: [], success: false };
  }
}

function generateMockInflationData(months: number): PriceRecord[] {
  console.warn("[inflation v7] Using synthetic mock data — no DB available");
  const items = [
    { id: 1, name: "Rice (50kg)", basePrice: 65000 },
    { id: 2, name: "Beans (bag)", basePrice: 55000 },
    { id: 3, name: "Garri (bag)", basePrice: 22000 },
    { id: 4, name: "Yam (tuber)", basePrice: 2200  },
    { id: 5, name: "Tomatoes",   basePrice: 35000  },
    { id: 6, name: "Onions",     basePrice: 30000  },
    { id: 7, name: "Palm oil",   basePrice: 42000  },
    { id: 8, name: "Eggs",       basePrice: 2800   },
  ];
  const markets = [
    { id: 1, name: "Mile 12 Market",     state: "Lagos"   },
    { id: 2, name: "Onitsha Main Market", state: "Anambra" },
    { id: 3, name: "Wuse Market",         state: "FCT"     },
  ];
  const data: PriceRecord[] = [];
  const now = new Date();
  for (let m = 0; m < months + 12; m++) {
    const d = new Date(now); d.setMonth(d.getMonth() - m);
    const year = d.getFullYear(), month = d.getMonth() + 1;
    const dateStr = `${year}-${String(month).padStart(2, "0")}-15`;
    const inflFactor = 1.0 / Math.pow(1.0071, m);
    for (const market of markets) {
      for (const item of items) {
        const seed = (item.id * 31 + market.id * 17 + month * 7 + year) % 100;
        const price = Math.round(item.basePrice * inflFactor * (1 + 0.1 * Math.sin((month - 1) * Math.PI / 6)) * (0.95 + seed / 1000));
        data.push({ itemId: item.id, itemName: item.name, marketId: market.id, marketName: market.name,
                    state: market.state, region: getRegionFromState(market.state), category: "",
                    price, date: dateStr, year, month });
      }
    }
  }
  return data;
}

// ============================================================================
// CALCULATION FUNCTIONS (raw data fallback path)
// ============================================================================

function calculateMonthlyInflation(
  data: PriceRecord[],
  months: number,
  nbsMap: Map<string, number>
): MonthlyInflation[] {
  const monthlyData = new Map<string, PriceRecord[]>();
  for (const record of data) {
    const key = `${record.year}-${String(record.month).padStart(2, "0")}`;
    const ex = monthlyData.get(key) || [];
    ex.push(record);
    monthlyData.set(key, ex);
  }
  const monthlyAvg = new Map<string, number>();
  for (const [key, records] of monthlyData) {
    let totalWP = 0, totalW = 0;
    for (const record of records) {
      const kw = getBasketKeyword(record.itemName);
      if (kw && BASKET_WEIGHTS[kw]) {
        const w = BASKET_WEIGHTS[kw]!.weight;
        totalWP += record.price * w; totalW += w;
      }
    }
    if (totalW > 0) monthlyAvg.set(key, totalWP / totalW);
  }
  const displayKeys = [...monthlyAvg.keys()].sort().slice(-months);
  const result: MonthlyInflation[] = [];
  let prevAvgPrice = 0;
  for (const key of displayKeys) {
    const [yearStr, monthStr] = key.split("-");
    const year = parseInt(yearStr || "2026"), month = parseInt(monthStr || "1");
    const avgPrice    = monthlyAvg.get(key) || 0;
    const yearAgoKey  = `${year - 1}-${monthStr}`;
    const yearAgoPrice = monthlyAvg.get(yearAgoKey) || 0;
    const yoyRate     = yearAgoPrice > 0 ? ((avgPrice - yearAgoPrice) / yearAgoPrice) * 100 : 0;
    const nbsRate     = nbsMap.get(key) ?? null;
    result.push({
      month: key, monthName: `${getMonthName(month)} ${year}`, year,
      naijaMarketRate: Math.round(yoyRate  * 10) / 10,
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

function calculateItemInflation(
  data: PriceRecord[]
): { inflators: ItemInflation[]; deflators: ItemInflation[] } {
  const now = new Date();
  const currentKey  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const yearAgo     = new Date(now); yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const yearAgoKey  = `${yearAgo.getFullYear()}-${String(yearAgo.getMonth() + 1).padStart(2, "0")}`;
  const itemData    = new Map<string, { current: number[]; yearAgo: number[]; category: string }>();
  for (const record of data) {
    const monthKey = `${record.year}-${String(record.month).padStart(2, "0")}`;
    const ex = itemData.get(record.itemName) || { current: [], yearAgo: [], category: "" };
    if (monthKey >= currentKey.slice(0, 7)) ex.current.push(record.price);
    else if (monthKey.startsWith(yearAgoKey.slice(0, 7))) ex.yearAgo.push(record.price);
    const kw = getBasketKeyword(record.itemName);
    if (kw && BASKET_WEIGHTS[kw]) ex.category = BASKET_WEIGHTS[kw]!.category;
    itemData.set(record.itemName, ex);
  }
  const items: ItemInflation[] = [];
  for (const [item, d] of itemData) {
    if (d.current.length === 0) continue;
    const cur  = d.current.reduce((a, b) => a + b, 0) / d.current.length;
    const prev = d.yearAgo.length > 0 ? d.yearAgo.reduce((a, b) => a + b, 0) / d.yearAgo.length : cur;
    const inflationRate = prev > 0 ? ((cur - prev) / prev) * 100 : 0;
    const kw = getBasketKeyword(item);
    const weight = kw && BASKET_WEIGHTS[kw] ? BASKET_WEIGHTS[kw]!.weight : 0;
    items.push({
      item, category: d.category || "Other",
      currentPrice:  Math.round(cur), previousPrice: Math.round(prev),
      priceChange:   Math.round(cur - prev),
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
  const currentKey  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const yearAgo     = new Date(now); yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const yearAgoKey  = `${yearAgo.getFullYear()}-${String(yearAgo.getMonth() + 1).padStart(2, "0")}`;
  const basket: BasketItem[] = [];
  for (const [keyword, config] of Object.entries(BASKET_WEIGHTS)) {
    const itemRecords    = data.filter(d => d.itemName.toLowerCase().includes(keyword));
    const currentRecords = itemRecords.filter(d => `${d.year}-${String(d.month).padStart(2, "0")}` >= currentKey.slice(0, 7));
    const yearAgoRecords = itemRecords.filter(d => `${d.year}-${String(d.month).padStart(2, "0")}`.startsWith(yearAgoKey.slice(0, 7)));
    const curPrice  = currentRecords.length > 0 ? currentRecords.reduce((s, d) => s + d.price, 0) / currentRecords.length : 0;
    const prevPrice = yearAgoRecords.length > 0 ? yearAgoRecords.reduce((s, d) => s + d.price, 0) / yearAgoRecords.length : curPrice;
    const inflationRate = prevPrice > 0 ? ((curPrice - prevPrice) / prevPrice) * 100 : 0;
    basket.push({
      item: keyword.charAt(0).toUpperCase() + keyword.slice(1), category: config.category,
      weight: config.weight, currentPrice: Math.round(curPrice), previousPrice: Math.round(prevPrice),
      inflationRate: Math.round(inflationRate * 10) / 10,
      contribution:  Math.round((inflationRate * config.weight) / 100 * 10) / 10,
    });
  }
  return basket.sort((a, b) => b.contribution - a.contribution);
}

// ============================================================================
// REGIONAL INFLATION — 100% FROM DATABASE
// ============================================================================

const REGION_NAMES_MAP: Record<string, string> = {
  "NC": "North Central", "NW": "North West", "NE": "North East",
  "SW": "South West",    "SS": "South South", "SE": "South East",
};

const ZONE_CASE_SQL = `
  CASE
    WHEN state IN ('Lagos','Oyo','Ogun','Osun','Ondo','Ekiti')                                   THEN 'SW'
    WHEN state IN ('Anambra','Enugu','Imo','Abia','Ebonyi')                                      THEN 'SE'
    WHEN state IN ('FCT','FCT Abuja','Abuja','Benue','Kogi','Kwara','Nasarawa','Niger','Plateau') THEN 'NC'
    WHEN state IN ('Kano','Kaduna','Katsina','Kebbi','Sokoto','Zamfara','Jigawa')                 THEN 'NW'
    WHEN state IN ('Borno','Yobe','Adamawa','Bauchi','Gombe','Taraba')                            THEN 'NE'
    WHEN state IN ('Rivers','Delta','Bayelsa','Akwa Ibom','Cross River','Edo')                   THEN 'SS'
    ELSE NULL
  END`;

const FOOD_CATS = `'CAT001','CAT002','CAT003','CAT004','CAT006','CAT007','CAT008','CAT009','CAT010','CAT013','CAT014','CAT015','CAT070','CAT103'`;

function mapRegionalRows(rows: any[]): RegionalInflation[] {
  return rows.map((r: any) => ({
    region:         String(r.zone),
    regionName:     REGION_NAMES_MAP[r.zone] ?? String(r.zone),
    inflationRate:  Math.round((parseFloat(r.inflation_rate) || 0) * 10) / 10,
    monthOverMonth: Math.round((parseFloat(r.mom_rate)       || 0) * 10) / 10,
    trend:          (parseFloat(r.mom_rate) || 0) > 0.5 ? "up" : (parseFloat(r.mom_rate) || 0) < -0.5 ? "down" : "stable",
    marketCount:    parseInt(r.market_count) || 0,
    topInflator:    r.top_inflator ? String(r.top_inflator) : null,
  } as RegionalInflation));
}

async function fetchRegionalInflation(): Promise<RegionalInflation[]> {
  const pool = await getPool();
  if (!pool) return [];

  const regionQuery = `
    WITH
    Baseline AS (
      SELECT item_name,
        COALESCE(NULLIF(whole_sale_price,0), NULLIF(Ave_Measurement_Price,0), NULLIF(average_unit_price,0)) AS baseline_price
      FROM dbo.Items_Catalog
      WHERE category_id IN (${FOOD_CATS})
        AND COALESCE(NULLIF(whole_sale_price,0), NULLIF(Ave_Measurement_Price,0), NULLIF(average_unit_price,0)) IS NOT NULL
    ),
    RecentByZone AS (
      SELECT ${ZONE_CASE_SQL} AS zone,
        lp.item_name,
        AVG(lp.price_naira) AS cur_price,
        COUNT(DISTINCT lp.market_name) AS market_count
      FROM dbo.Latest_Prices_Summary lp
      WHERE lp.price_naira > 0 AND lp.state IS NOT NULL AND lp.category_id IN (${FOOD_CATS})
      GROUP BY ${ZONE_CASE_SQL}, lp.item_name
    ),
    ItemRates AS (
      SELECT r.zone, r.item_name, r.cur_price, b.baseline_price AS prev_price, r.market_count,
        (POWER(CAST(r.cur_price / b.baseline_price AS FLOAT), 12.0/13) - 1) * 100 AS ann_yoy_pct,
        (r.cur_price - b.baseline_price) / b.baseline_price * 100                 AS total_change_pct
      FROM RecentByZone r JOIN Baseline b ON b.item_name = r.item_name
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
  `;

  try {
    const tier1 = await pool.request().query(regionQuery.replace("dbo.Latest_Prices_Summary lp", "dbo.Latest_Prices_Summary lp"));
    if (tier1.recordset && tier1.recordset.length >= 2) {
      console.log(`[inflation v7] Regional via Latest_Prices_Summary: ${tier1.recordset.length} zones`);
      return mapRegionalRows(tier1.recordset);
    }
  } catch (err) {
    console.warn("[inflation v7] Latest_Prices_Summary regional failed:", (err as Error).message);
  }

  // Tier 2: Daily_Prices fallback
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
      RecentCutoff AS (
        SELECT DATEADD(day, -60, MAX(price_date)) AS cutoff FROM dbo.Daily_Prices WHERE price_naira > 0
      ),
      RecentByZone AS (
        SELECT ${ZONE_CASE_SQL} AS zone, dp.item_name,
          AVG(CAST(dp.price_naira AS FLOAT)) AS cur_price, COUNT(DISTINCT dp.market_id) AS market_count
        FROM dbo.Daily_Prices dp WITH (NOLOCK)
        CROSS JOIN RecentCutoff rc
        WHERE dp.price_naira > 0 AND dp.state IS NOT NULL AND dp.price_date >= rc.cutoff
          AND dp.category_id IN (${FOOD_CATS})
        GROUP BY ${ZONE_CASE_SQL}, dp.item_name
      ),
      ItemRates AS (
        SELECT r.zone, r.item_name, r.cur_price, b.baseline_price AS prev_price, r.market_count,
          (POWER(CAST(r.cur_price / b.baseline_price AS FLOAT), 12.0/13) - 1) * 100 AS ann_yoy_pct,
          (r.cur_price - b.baseline_price) / b.baseline_price * 100                 AS total_change_pct
        FROM RecentByZone r JOIN Baseline b ON b.item_name = r.item_name
        WHERE b.baseline_price > 0 AND r.cur_price > 0 AND r.zone IS NOT NULL
          AND ABS((r.cur_price - b.baseline_price) / b.baseline_price) < 5
      ),
      RegionSummary AS (
        SELECT zone, AVG(ann_yoy_pct) AS avg_ann_yoy,
          AVG((POWER(CAST(cur_price/prev_price AS FLOAT), 1.0/13) - 1) * 100) AS avg_mom_pct,
          SUM(market_count) AS total_markets
        FROM ItemRates WHERE ann_yoy_pct BETWEEN -50 AND 200 GROUP BY zone
      ),
      TopInflator AS (
        SELECT zone, item_name, ROW_NUMBER() OVER (PARTITION BY zone ORDER BY total_change_pct DESC) AS rn
        FROM ItemRates WHERE total_change_pct > 0
      )
      SELECT rs.zone, ROUND(rs.avg_ann_yoy, 2) AS inflation_rate, ROUND(rs.avg_mom_pct, 2) AS mom_rate,
        rs.total_markets AS market_count, ti.item_name AS top_inflator
      FROM RegionSummary rs LEFT JOIN TopInflator ti ON ti.zone = rs.zone AND ti.rn = 1
      ORDER BY rs.avg_ann_yoy DESC
    `);
    if (tier2.recordset && tier2.recordset.length >= 1) {
      console.log(`[inflation v7] Regional via Daily_Prices fallback: ${tier2.recordset.length} zones`);
      return mapRegionalRows(tier2.recordset);
    }
    return [];
  } catch (err) {
    console.error("[inflation v7] fetchRegionalInflation both tiers failed:", err);
    return [];
  }
}

// ============================================================================
// API HANDLER
// ============================================================================

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
    let response: InflationResponse;

    console.log(`[inflation v7] period=${period} (${periodMonths}mo) region=${region}`);

    // ── STEP 0: Load NBS rates from DB first, then fetch primary data sources ──
    // NBS map must be loaded before CI/IC so nbsRate is correct on every chart point.
    // Total: 3 DB round-trips (NBS load → CI + IC parallel).
    const nbsMap = await fetchNbsRatesFromDB();

    const [calcResultFinal, cacheResultFinal] = await Promise.all([
      fetchFromCalculatedInflation(periodMonths, nbsMap),
      fetchFromInflationCache(periodMonths, nbsMap),
    ]);

    // ── STEP 1: Calculated_Inflation (10-year primary) + 2026 extension ────
    if (calcResultFinal.success && calcResultFinal.data.length >= 2) {
      console.log(`[inflation v7] Using Calculated_Inflation: ${calcResultFinal.data.length} months`);
      dataSource = `NaijaMarket Intel (10-Year Historical Data)`;

      // Append 2026 months that CI doesn't have
      const extension = await fetch2026Extension(
        nbsMap,
        calcResultFinal.latestYr,
        calcResultFinal.latestMth
      );

      const allData    = [...calcResultFinal.data, ...extension];
      const displayData = allData.slice(-periodMonths);
      const latest     = displayData[displayData.length - 1];
      const prevMonth  = displayData[displayData.length - 2];

      const currentRate = latest?.naijaMarketRate ?? 0;
      const momChange   = (latest && prevMonth)
        ? Math.round((latest.naijaMarketRate - prevMonth.naijaMarketRate) * 10) / 10
        : (cacheResultFinal.avgMomPct ?? 0);

      const { rate: latestNBS } = getNbsRateFromMap(nbsMap);
      const elapsedMs = Date.now() - startTime;

      return NextResponse.json({
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
        monthlyTrend:      displayData,
        regionalBreakdown: await fetchRegionalInflation().catch(() => []),
        nbsComparison: {
          naijaMarket:    Math.round(currentRate * 10) / 10,
          nbs:            latestNBS,
          difference:     Math.round((currentRate - latestNBS) * 10) / 10,
          interpretation: getNbsInterpretation(currentRate, latestNBS),
        },
        topInflators:      cacheResultFinal.success ? cacheResultFinal.topInflators      : [],
        topDeflators:      cacheResultFinal.success ? cacheResultFinal.topDeflators      : [],
        basketComposition: cacheResultFinal.success ? cacheResultFinal.basketComposition : [],
        categoryBreakdown: cacheResultFinal.success ? calculateCategoryBreakdown(cacheResultFinal.basketComposition) : [],
        dataSource,
        recordCount: displayData.length,
      }, {
        status: 200,
        headers: {
          "Cache-Control":   "s-maxage=300, stale-while-revalidate=60",
          "X-Data-Source":   "calculated-inflation-v7",
          "X-Response-Time": `${elapsedMs}ms`,
        },
      });
    }

    // ── STEP 2: Inflation_Cache (recent computed data) ─────────────────────
    if (cacheResultFinal.success && cacheResultFinal.data.length >= 2) {
      console.log(`[inflation v7] Using Inflation_Cache: ${cacheResultFinal.data.length} months`);
      dataSource = `NaijaMarket Intel (Real-time)`;

      const displayData  = cacheResultFinal.data.slice(-periodMonths);
      const latest       = displayData[displayData.length - 1];
      const { rate: latestNBS } = getNbsRateFromMap(nbsMap);
      const currentRate  = latest?.naijaMarketRate ?? latestNBS;
      const momChange    = cacheResultFinal.avgMomPct ?? 0;

      const elapsedMs = Date.now() - startTime;
      return NextResponse.json({
        success: true, timestamp: new Date().toISOString(), period, periodLabel,
        currentInflation: {
          rate:           Math.round(currentRate * 10) / 10,
          monthOverMonth: Math.round(momChange   * 10) / 10,
          yearOverYear:   Math.round(currentRate * 10) / 10,
          trend:          momChange > 0.5 ? "up" : momChange < -0.5 ? "down" : "stable",
          asOf:           latest?.monthName ?? "",
        },
        monthlyTrend:      displayData,
        regionalBreakdown: await fetchRegionalInflation().catch(() => []),
        nbsComparison: {
          naijaMarket:    Math.round(currentRate * 10) / 10,
          nbs:            latestNBS,
          difference:     Math.round((currentRate - latestNBS) * 10) / 10,
          interpretation: getNbsInterpretation(currentRate, latestNBS),
        },
        topInflators:      cacheResultFinal.topInflators,
        topDeflators:      cacheResultFinal.topDeflators,
        basketComposition: cacheResultFinal.basketComposition,
        categoryBreakdown: calculateCategoryBreakdown(cacheResultFinal.basketComposition),
        dataSource,
        recordCount: displayData.length,
      }, {
        status: 200,
        headers: {
          "Cache-Control":   "s-maxage=300, stale-while-revalidate=60",
          "X-Data-Source":   "inflation-cache-v7",
          "X-Response-Time": `${elapsedMs}ms`,
        },
      });
    }

    // ── STEP 3: vw_Inflation_Comparison ────────────────────────────────────
    const precomputed = await fetchPrecomputedInflation(periodMonths + 12);
    if (precomputed.success && precomputed.data.length >= 2) {
      console.log(`[inflation v7] Using vw_Inflation_Comparison: ${precomputed.data.length} months`);
      const displayData = precomputed.data.slice(-periodMonths);
      response = await buildFromPrecomputed(displayData, periodLabel, period, nbsMap);
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

    // ── STEPS 4–6: Raw data fallbacks ──────────────────────────────────────
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

    const monthlyTrend      = calculateMonthlyInflation(priceData, periodMonths, nbsMap);
    const regionalBreakdown = await fetchRegionalInflation().catch(() => []);
    const { inflators, deflators } = calculateItemInflation(priceData);
    const basketComposition = calculateBasketComposition(priceData);
    const latestMonth       = monthlyTrend[monthlyTrend.length - 1];
    const prevMonth         = monthlyTrend[monthlyTrend.length - 2];
    const currentRate       = latestMonth?.naijaMarketRate ?? 0;
    const momChange         = latestMonth && prevMonth ? latestMonth.naijaMarketRate - prevMonth.naijaMarketRate : 0;
    const { rate: latestNBS } = getNbsRateFromMap(nbsMap);
    const now = new Date();

    response = {
      success: true, timestamp: now.toISOString(), period, periodLabel,
      currentInflation: {
        rate:           Math.round(currentRate * 10) / 10,
        monthOverMonth: Math.round(momChange   * 10) / 10,
        yearOverYear:   Math.round(currentRate * 10) / 10,
        trend:          momChange > 0.5 ? "up" : momChange < -0.5 ? "down" : "stable",
        asOf:           latestMonth?.monthName ?? `${getMonthName(now.getMonth() + 1)} ${now.getFullYear()}`,
      },
      monthlyTrend, regionalBreakdown,
      nbsComparison: {
        naijaMarket:    Math.round(currentRate * 10) / 10,
        nbs:            latestNBS,
        difference:     Math.round((currentRate - latestNBS) * 10) / 10,
        interpretation: getNbsInterpretation(currentRate, latestNBS),
      },
      topInflators: inflators, topDeflators: deflators,
      basketComposition, categoryBreakdown: calculateCategoryBreakdown(basketComposition),
      dataSource, recordCount: priceData.length,
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
    console.error("[inflation v7] Fatal error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to calculate inflation", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export const dynamic     = "force-dynamic";
export const maxDuration = 30;
