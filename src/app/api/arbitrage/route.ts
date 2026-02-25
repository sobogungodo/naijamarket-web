// ============================================================================
// NAIJAFOOD INTEL - ARBITRAGE OPPORTUNITIES API
// File: src/app/api/arbitrage/route.ts
// Bloomberg Equivalent: ARBI <GO>
// Version: 9.0 - State aggregation + lp.* aliases fix for item/category filter
// Date: 2026-02-19
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

// ============================================================================
// SINGLETON PRISMA
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
  prisma: any,
  minProfitPct: number,
  maxResults: number,
  filterItem?: string,
  filterCategory?: string,
  filterBuyState?: string,
  filterSellState?: string
): Promise<ArbitrageOpportunity[]> {

  // Build dynamic WHERE filters
  const conditions: string[] = [];
  if (filterItem) {
    conditions.push(`AND lp.item_name LIKE '%${filterItem.replace(/'/g, "''")}%'`);
  }
  if (filterCategory) {
    conditions.push(`AND lp.category_id = '${filterCategory.replace(/'/g, "''")}'`);
  }
  const extraWhere = conditions.join(" ");

  // State filters applied in outer WHERE (after JOIN)
  const stateConditions: string[] = [];
  if (filterBuyState) {
    stateConditions.push(`AND p1.state = '${filterBuyState.replace(/'/g, "''")}'`);
  }
  if (filterSellState) {
    stateConditions.push(`AND p2.state = '${filterSellState.replace(/'/g, "''")}'`);
  }
  const stateWhere = stateConditions.join(" ");

  // v9: state-level aggregation before self-join — eliminates cartesian explosion
  // extraWhere and stateWhere use lp.* aliases (Latest_Prices_Summary)
  const sql = `
    WITH
    StatePrices AS (
      SELECT
        lp.item_id,
        lp.item_name,
        lp.unit,
        lp.category_id,
        lp.state,
        AVG(lp.price_naira)        AS avg_price,
        MAX(lp.price_date)         AS latest_date,
        MIN(lp.market_name)        AS buy_market,
        MAX(lp.market_name)        AS sell_market,
        MIN(lp.market_id)          AS buy_market_id,
        MAX(lp.market_id)          AS sell_market_id
      FROM dbo.Latest_Prices_Summary lp
      WHERE lp.price_naira > 0
        AND lp.category_id IN (${FOOD_CAT_SQL})
        ${extraWhere}
      GROUP BY lp.item_id, lp.item_name, lp.unit, lp.category_id, lp.state
    ),
    StatePairs AS (
      SELECT
        p1.item_id,
        p1.item_name,
        p1.unit,
        p1.category_id,
        p1.state                        AS buy_state,
        p1.buy_market                   AS buy_market,
        p1.buy_market_id                AS buy_market_id,
        CAST(p1.avg_price AS FLOAT)     AS buy_price,
        p1.latest_date                  AS buy_date,
        p2.state                        AS sell_state,
        p2.sell_market                  AS sell_market,
        p2.sell_market_id               AS sell_market_id,
        CAST(p2.avg_price AS FLOAT)     AS sell_price,
        p2.latest_date                  AS sell_date,
        CAST(p2.avg_price - p1.avg_price AS FLOAT) AS gross_profit
      FROM StatePrices p1
      JOIN StatePrices p2
        ON  p1.item_id   = p2.item_id
        AND p1.state    != p2.state
        AND p2.avg_price > p1.avg_price
      ${stateWhere}
    )
    SELECT TOP ${Math.min(maxResults * 3, 300)}
      sp.item_id,
      sp.item_name,
      sp.unit,
      sp.category_id,
      sp.buy_market_id,
      sp.buy_market,
      sp.buy_state,
      sp.buy_price,
      sp.buy_date,
      sp.sell_market_id,
      sp.sell_market,
      sp.sell_state,
      sp.sell_price,
      sp.sell_date,
      ISNULL(CAST(t.road_distance_km   AS FLOAT), 500)        AS distance_km,
      ISNULL(CAST(t.total_cost_per_bag AS FLOAT), 8500)       AS transport_cost,
      ISNULL(t.distance_band, 'Inter-State')                  AS distance_band,
      ISNULL(CAST(t.rate_per_km        AS FLOAT), 17.0)       AS rate_per_km,
      1.0                                                      AS road_quality_mult,
      ISNULL(CAST(t.total_cost_per_bag AS FLOAT)*0.70, 5950)  AS fuel_haulage_cost,
      ISNULL(CAST(t.total_cost_per_bag AS FLOAT)*0.10, 850)   AS checkpoint_cost_val,
      ISNULL(CAST(t.total_cost_per_bag AS FLOAT)*0.20, 1700)  AS fixed_cost_val,
      sp.gross_profit                                          AS gross_profit,
      sp.gross_profit - ISNULL(CAST(t.total_cost_per_bag AS FLOAT), 8500)
                                                               AS raw_net_profit,
      ROUND(
        (sp.gross_profit - ISNULL(CAST(t.total_cost_per_bag AS FLOAT), 8500))
        / sp.buy_price * 100, 1
      )                                                        AS raw_profit_pct
    FROM StatePairs sp
    LEFT JOIN dbo.vw_Market_Transport t
      ON  t.market_a_id = sp.buy_market_id
      AND t.market_b_id = sp.sell_market_id
    WHERE sp.gross_profit - ISNULL(CAST(t.total_cost_per_bag AS FLOAT), 8500) > 0
    ORDER BY raw_profit_pct DESC
  `;

  const results = await prisma.$queryRawUnsafe(sql) as any[];

  // Map to ArbitrageOpportunity with category-aware transport
  return results
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
        transportLabel: r.distance_band || "Unknown",
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
    const prisma = await getPrisma();
    const url = new URL(request.url);

    const tier = (url.searchParams.get("tier") || "BUSINESS").toUpperCase();
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
    const item = url.searchParams.get("item") || undefined;
    const category = url.searchParams.get("category") || undefined;
    const buyState = url.searchParams.get("buyState") || undefined;
    const sellState = url.searchParams.get("sellState") || undefined;
    const userMinProfit = url.searchParams.get("minProfit");

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
          marketPairs: "37 states × 37 states = 1,332 state pairs",
          dataSource: "Latest_Prices_Summary (state-aggregated) + vw_Market_Transport v9.0",
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
    const prisma = await getPrisma();
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
    const results = await prisma.$queryRawUnsafe(`
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
    `) as any[];

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
    const transportRows = await prisma.$queryRawUnsafe(`
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
    `) as any[];

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
      // Fallback: estimate if pair not found
      transport = {
        distance: 0, fuelCost: 5000, loadingCost: 3000, checkpointCost: 500,
        totalCost: 8500, label: "Estimated", ratePerKm: 0,
        weightMultiplier: 1.0, categoryNote: "Estimated (market pair not in precomputed table)",
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
