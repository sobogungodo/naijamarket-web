// ============================================================================
// src/app/api/prices/history/route.ts
// NaijaMarket Intel - Price History API
// Version: 8.0.0 - reads the NBS-anchored PHN v2 rebuild
// ============================================================================
// SOURCE OF TRUTH: the PHN v2 layers, 170,192 rows in total —
//   Price_History_NBS_v2_national     3,868
//   Price_History_NBS_v2_zone        23,208
//   Price_History_NBS_v2_state      143,116   <- this route reads the state layer
// The v7 header claimed "OPTIMIZED for 143M+ row database". That was wrong by a
// factor of 1,000: 143,116 is the state layer's row count, not 143 million.
//
// CHANGES from v7.0:
//   1. Reads Price_History_NBS_v2_state. Price_History_NBS (v1) is the
//      fabricated series and is no longer referenced by this route at all.
//   2. market NAME -> state resolves through dbo.Markets (226 markets covering
//      all six zones) instead of v1's 50 markets, which left NORTH EAST and
//      SOUTH SOUTH with no markets at all.
//   3. Every point carries TWO provenance dimensions — temporal (was this month
//      a printed NBS figure?) and spatial (is this state's value a printed
//      bound?). Only ~4% of v2 rows are printed in both. Never render as
//      observation without the badge.
//   4. The withdrawal gate is now the PHN_V2_ENABLED env flag, fail-closed.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { resolveV2ItemName } from "@/lib/phnV2Items";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface PriceHistoryPoint {
  date: string;
  price: number;
  trend: string;
  /** "PHNv2:<temporal>/<spatial>" — kept as the existing single-string field. */
  source: string;
  /** National-layer provenance for this month: NBS_ANCHOR | NBS_INTERP | NBS_PROXY */
  temporal_source: string;
  /** State-layer provenance: NBS_STATE_BOUND | MODELED_STATE[_CLAMPED|_UNBOUNDED] */
  spatial_source: string;
  state: string;
  zone: string;
}

/** Only NBS_ANCHOR + NBS_STATE_BOUND is a figure NBS actually printed for this
 *  state in this month. Everything else is modelled to some degree. */
type ProvenanceClass = "printed_both" | "printed_month" | "printed_state" | "modeled";

interface ProvenanceSummary {
  printed_both: number;
  printed_month: number;
  printed_state: number;
  modeled: number;
  total: number;
  printed_both_pct: number;
}

interface PriceStatistics {
  current: number;
  high: number;
  low: number;
  average: number;
  change: number;
  changePercent: number;
  volatility: number;
  dataPoints: number;
}

// ============================================================================
// SINGLETON PRISMA (reuse connection pool)
// ============================================================================

let prismaClient: any = null;

async function getPrisma() {
  if (!prismaClient) {
    const { PrismaClient } = await import("@prisma/client");
    prismaClient = new PrismaClient();
  }
  return prismaClient;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const squaredDiffs = prices.map(price => Math.pow(price - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / prices.length;
  return Number(((Math.sqrt(avgSquaredDiff) / mean) * 100).toFixed(2));
}

// PHN is monthly, so ranges are month-granular; day math would clip a whole
// month at the boundary.
function getMonthsFromPeriod(period: string): number {
  switch (period) {
    case "1y": return 12;
    case "3y": return 36;
    case "5y": return 60;
    case "10y": return 120;
    case "all": return 0;   // 0 = no lower bound, full PHN span
    default: return 12;
  }
}

function classifyProvenance(temporal: string, spatial: string): ProvenanceClass {
  const monthPrinted = temporal === "NBS_ANCHOR";
  const statePrinted = spatial === "NBS_STATE_BOUND";
  if (monthPrinted && statePrinted) return "printed_both";
  if (monthPrinted) return "printed_month";
  if (statePrinted) return "printed_state";
  return "modeled";
}

function summariseProvenance(history: PriceHistoryPoint[]): ProvenanceSummary {
  const s: ProvenanceSummary = {
    printed_both: 0, printed_month: 0, printed_state: 0, modeled: 0,
    total: history.length, printed_both_pct: 0,
  };
  for (const p of history) {
    s[classifyProvenance(p.temporal_source, p.spatial_source)]++;
  }
  s.printed_both_pct = s.total > 0
    ? Number(((s.printed_both / s.total) * 100).toFixed(1))
    : 0;
  return s;
}

// ============================================================================
// PRIMARY: FETCH FROM PHN v2 (state layer)
// ============================================================================
// Resolution:
//   market NAME -> state   via dbo.Markets, DISTINCT. Two market names map to
//                          more than one market_id ("Kurmi Market" -> 2 ids,
//                          both Kano; "Wuse Market" -> 2 ids, both FCT), so
//                          without DISTINCT those series would double. No
//                          market name resolves to more than one STATE.
//   item NAME   -> item_id via v2_national, DISTINCT. An item absent from v2
//                          (ITM01018 "Chicken - Frozen (per kg)") resolves to
//                          nothing and the series is honestly empty.
//
// Access path: PK_PHN_v2_state (item_id, observation_month, state_name,
// segment) — seek on the item_id + observation_month prefix, at most
// 96 months x 37 states = 3,552 rows per item, state_name as a residual
// predicate. dbo.Markets is a 226-row scan (its PK is market_id, not
// market_name); free at that size. The v7 comment here cited
// IX_DailyPrices_ItemMarketDate, which is an index on Daily_Prices and never
// applied to this query at all.
//
// No GROUP BY / AVG: v2_state holds exactly one row per
// (item, month, state, segment). v1 needed the average only because it carried
// several market rows per state-month.
//
// The join to v2_national is segment-exact — ITM01010 is split SEG_A/SEG_B at
// the 2025-01 rebase, and joining on (item, month) alone would fan out.
// ============================================================================

async function fetchFromDatabase(
  item: string,
  market: string,
  months: number
): Promise<PriceHistoryPoint[]> {
  try {
    const prisma = await getPrisma();

    const results = await prisma.$queryRaw`
      WITH mkt AS (
        SELECT DISTINCT m.state AS state_name
          FROM dbo.Markets m
         WHERE m.market_name = ${market}
      ),
      itm AS (
        SELECT DISTINCT n.item_id
          FROM dbo.Price_History_NBS_v2_national n
         WHERE n.item_name_standard = ${item}
      )
      SELECT
        CONVERT(VARCHAR(10), s.observation_month, 23) AS [date],
        CAST(s.price_naira AS FLOAT)                  AS price,
        s.state_name                                  AS state_name,
        s.zone_name                                   AS zone_name,
        n.data_source                                 AS temporal_source,
        s.data_source                                 AS spatial_source
      FROM dbo.Price_History_NBS_v2_state s
      JOIN itm i ON i.item_id = s.item_id
      JOIN mkt k ON k.state_name = s.state_name
      JOIN dbo.Price_History_NBS_v2_national n
        ON n.item_id           = s.item_id
       AND n.observation_month = s.observation_month
       AND n.segment           = s.segment
      WHERE (${months} = 0 OR s.observation_month >= DATEADD(month, -${months},
              DATEFROMPARTS(YEAR(GETUTCDATE()), MONTH(GETUTCDATE()), 1)))
      ORDER BY s.observation_month ASC
    ` as Array<{
      date: string;
      price: number;
      state_name: string;
      zone_name: string;
      temporal_source: string;
      spatial_source: string;
    }>;

    return results.map((r) => ({
      date: String(r.date).substring(0, 10),
      price: Math.round(Number(r.price)),
      trend: "stable",
      source: `PHNv2:${r.temporal_source}/${r.spatial_source}`,
      temporal_source: r.temporal_source,
      spatial_source: r.spatial_source,
      state: r.state_name,
      zone: r.zone_name,
    }));
  } catch (error: any) {
    console.error("PHN v2 history error:", error.message?.substring(0, 200));
    return [];
  }
}


// ============================================================================
// CALCULATE STATISTICS
// ============================================================================

function calculateStatistics(history: PriceHistoryPoint[]): PriceStatistics {
  if (history.length === 0) {
    return {
      current: 0, high: 0, low: 0, average: 0,
      change: 0, changePercent: 0, volatility: 0, dataPoints: 0,
    };
  }

  const prices = history.map(h => h.price);
  const current = prices[prices.length - 1] || 0;
  const first = prices[0] || 0;
  const change = current - first;
  const changePercent = first > 0 ? (change / first) * 100 : 0;

  return {
    current,
    high: Math.max(...prices),
    low: Math.min(...prices),
    average: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    change: Math.round(change),
    changePercent: Number(changePercent.toFixed(2)),
    volatility: calculateVolatility(prices),
    dataPoints: history.length,
  };
}

// ============================================================================
// GET HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  const item = searchParams.get("item") || "";
  const market = searchParams.get("market") || "";
  const period = searchParams.get("period") || "30d";

  if (!item || !market) {
    return NextResponse.json(
      { success: false, error: "Item and market are required" },
      { status: 400 }
    );
  }

  // WITHDRAWAL GATE — an env flag now, not an unconditional return.
  // FAIL-CLOSED: history is served only when PHN_V2_ENABLED is exactly "true".
  // Absent, empty, or any other value keeps it withheld, so the safe state
  // needs no deploy-time action. PHN_V2_ENABLED is NOT set in Vercel today,
  // which means this route stays gated on merge.
  //
  // History was withdrawn 2026-07-22 because the v1 series (synthetic 2016-2019
  // backfill + a 2026 forecast) contradicted published NBS data in level and in
  // direction. The v2 rebuild above addresses that, but the flag stays off
  // until the per-point provenance badge ships: only ~4% of v2 points are
  // printed NBS figures in both dimensions, and the rest must not render as
  // observation.
  //
  // The v7 comment here called this "this unauthenticated public route". That
  // was inaccurate — src/middleware.ts lists /api/prices in
  // PROTECTED_API_ROUTES, so unauthenticated callers already receive a 401.
  //
  // The payload below is byte-identical to the existing no-data shape.
  if (process.env.PHN_V2_ENABLED !== "true") {
    return NextResponse.json({
      success: true,
      item,
      market,
      period,
      data: [],
      statistics: null,
      source: "none",
      note: undefined,
    });
  }

  const months = getMonthsFromPeriod(period);

  // Resolve the dashboard item name to a v2 item_name_standard. The 42 v2 names
  // map to themselves; 37 hand-verified relabel aliases map to their canonical
  // (e.g. "Beans - Brown (NBS per kg)" -> "Beans - Brown (per kg)"); everything
  // else — including the two excluded frozen-chicken labels — resolves to null.
  // A null resolution skips the query and yields an honest empty series, which
  // the modal renders as the excluded-item state for the frozen-chicken labels.
  const resolvedItem = resolveV2ItemName(item);

  console.log(`\n📈 History v8 (PHN v2): ${item} -> ${resolvedItem ?? "(no v2 match)"} @ ${market} (${period})`);

  const history = resolvedItem
    ? await fetchFromDatabase(resolvedItem, market, months)
    : [];
  const source = history.length > 0 ? "phn_v2" : "none";

  // No fabricated fallback: an empty series renders an honest empty state.

  // Add trends
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1]?.price || 0;
    const curr = history[i]?.price || 0;
    if (curr > prev) history[i]!.trend = "up";
    else if (curr < prev) history[i]!.trend = "down";
    else history[i]!.trend = "stable";
  }

  const statistics = calculateStatistics(history);
  const provenance = summariseProvenance(history);
  const responseTime = Date.now() - startTime;

  console.log(
    `📊 ${history.length} points in ${responseTime}ms (${source}) — ` +
    `${provenance.printed_both}/${provenance.total} printed NBS`
  );

  return NextResponse.json({
    success: true,
    item,
    market,
    period,
    data: history,
    statistics,
    // Series-level counts for the disclosure legend. printed_both is the only
    // class NBS actually printed for this state in this month.
    provenance,
    source,
    responseTime: `${responseTime}ms`,
    note: source === "none"
      ? "No historical records found for this item and market"
      : undefined,
  });
}

export const dynamic = "force-dynamic";
