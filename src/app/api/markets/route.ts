// ============================================================================
// src/app/api/markets/route.ts
// NaijaFood Intel - Markets API v3.2
// FOOD-ONLY price summaries, correct lat/lng columns, $queryRawUnsafe
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

let prismaClient: any = null;
async function getPrisma() {
  if (!prismaClient) {
    const { PrismaClient } = await import("@prisma/client");
    prismaClient = new PrismaClient();
  }
  return prismaClient;
}

// ============================================================================
// FOOD-ONLY CATEGORY MAP
// ============================================================================
const CATEGORY_MAP: Record<string, string> = {
  CAT001: "Grains & Cereals",
  CAT002: "Vegetables & Peppers",
  CAT003: "Oils & Fats",
  CAT004: "Frozen Foods & Poultry",
  CAT005: "Beverages",
  CAT006: "Plantain",
  CAT007: "Seasoning & Spices",
  CAT008: "Dried Fish & Stockfish",
  CAT009: "Flour & Bakery",
  CAT010: "Bread",
  CAT013: "Dairy & Milk",
  CAT014: "Tubers & Yam",
  CAT015: "Beans & Legumes",
  CAT070: "Poultry & Livestock",
  CAT103: "Fish (NBS)",
};

const FOOD_SQL = `AND category_id IN ('CAT001','CAT002','CAT003','CAT004','CAT005','CAT006','CAT007','CAT008','CAT009','CAT010','CAT013','CAT014','CAT015','CAT070','CAT103')`;

// ============================================================================
// REGION MAP
// ============================================================================
const STATE_REGION: Record<string, string> = {
  Lagos: "South West", Ogun: "South West", Oyo: "South West",
  Osun: "South West", Ondo: "South West", Ekiti: "South West",
  Rivers: "South South", Bayelsa: "South South", "Cross River": "South South",
  "Akwa Ibom": "South South", Delta: "South South", Edo: "South South",
  Anambra: "South East", Enugu: "South East", Imo: "South East",
  Abia: "South East", Ebonyi: "South East",
  Kano: "North West", Kaduna: "North West", Katsina: "North West",
  Jigawa: "North West", Sokoto: "North West", Zamfara: "North West", Kebbi: "North West",
  Borno: "North East", Yobe: "North East", Adamawa: "North East",
  Bauchi: "North East", Gombe: "North East", Taraba: "North East",
  Plateau: "North Central", Nasarawa: "North Central", Niger: "North Central",
  Benue: "North Central", Kogi: "North Central", Kwara: "North Central",
  FCT: "North Central", "FCT - Abuja": "North Central",
};

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

export async function GET(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    const { searchParams } = new URL(request.url);

    const search = (searchParams.get("search") || searchParams.get("q") || "").trim();
    const state = (searchParams.get("state") || "").trim();
    const region = (searchParams.get("region") || "").trim();
    const withPrices = searchParams.get("with_prices") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") || "300") || 300, 500);

    // -------------------------------------------------------------------
    // 1. Fetch markets (latitude/longitude — NOT gps_lat/gps_lng)
    // -------------------------------------------------------------------
    let whereClause = "WHERE 1=1";
    if (search) whereClause += ` AND market_name LIKE '%${esc(search)}%'`;
    if (state) whereClause += ` AND state = '${esc(state)}'`;

    const marketsQuery = `
      SELECT TOP ${limit}
        market_id, market_name, state, latitude, longitude, status
      FROM Markets WITH (NOLOCK)
      ${whereClause}
      ORDER BY market_name ASC
    `;
    const markets = (await prisma.$queryRawUnsafe(marketsQuery)) as any[];

    // -------------------------------------------------------------------
    // 2. Price stats per market — FOOD ONLY
    // -------------------------------------------------------------------
    let marketStats: any[] = [];
    try {
      marketStats = (await prisma.$queryRawUnsafe(`
        SELECT
          market_name,
          COUNT(DISTINCT item_name) AS items_tracked,
          AVG(CAST(price_change_pct AS FLOAT)) AS avg_change,
          MIN(CAST(price_naira AS FLOAT)) AS min_price,
          MAX(CAST(price_naira AS FLOAT)) AS max_price,
          COUNT(*) AS total_prices
        FROM Latest_Prices_Summary WITH (NOLOCK)
        WHERE price_naira > 0
          ${FOOD_SQL}
        GROUP BY market_name
      `)) as any[];
    } catch (e) {
      console.warn("Market stats failed:", e);
    }

    const statsMap = new Map<string, any>();
    for (const s of marketStats) {
      statsMap.set(s.market_name, {
        items_tracked: Number(s.items_tracked) || 0,
        avg_change: Number(s.avg_change) || 0,
        min_price: Number(s.min_price) || 0,
        max_price: Number(s.max_price) || 0,
        total_prices: Number(s.total_prices) || 0,
      });
    }

    // -------------------------------------------------------------------
    // 3. Top 5 food prices per market
    // -------------------------------------------------------------------
    const topPricesMap = new Map<string, any[]>();

    if (withPrices) {
      try {
        const topPrices = (await prisma.$queryRawUnsafe(`
          SELECT
            market_name, item_name,
            CAST(price_naira AS FLOAT) AS price_naira,
            CAST(COALESCE(price_change_pct, 0) AS FLOAT) AS price_change_pct,
            COALESCE(category_id, '') AS category_id,
            COALESCE(unit, '') AS unit
          FROM (
            SELECT
              market_name, item_name, price_naira, price_change_pct,
              category_id, unit,
              ROW_NUMBER() OVER (
                PARTITION BY market_name ORDER BY price_naira DESC
              ) AS rn
            FROM Latest_Prices_Summary WITH (NOLOCK)
            WHERE price_naira > 0
              AND category_id IN ('CAT001','CAT002','CAT003','CAT004','CAT005','CAT006','CAT007','CAT008','CAT009','CAT010','CAT013','CAT014','CAT015','CAT070','CAT103')
          ) ranked
          WHERE rn <= 5
          ORDER BY market_name, rn
        `)) as any[];

        for (const tp of topPrices) {
          const key = tp.market_name;
          if (!topPricesMap.has(key)) topPricesMap.set(key, []);
          topPricesMap.get(key)!.push({
            item_name: tp.item_name,
            price_naira: Number(tp.price_naira),
            price_change_pct: Number(tp.price_change_pct),
            category_id: tp.category_id || "",
            unit: tp.unit || "",
          });
        }
      } catch (e) {
        console.warn("Top prices failed:", e);
      }
    }

    // -------------------------------------------------------------------
    // 4. Format (output gps_lat/gps_lng for frontend compat)
    // -------------------------------------------------------------------
    let formatted = markets.map((m: any) => {
      const stats = statsMap.get(m.market_name);
      const mState = m.state || "";
      const mRegion = STATE_REGION[mState] || "";

      let lat: number | null = null;
      let lng: number | null = null;
      if (m.latitude != null) lat = parseFloat(String(m.latitude));
      if (m.longitude != null) lng = parseFloat(String(m.longitude));
      if (lat !== null && isNaN(lat)) lat = null;
      if (lng !== null && isNaN(lng)) lng = null;

      const result: any = {
        market_id: m.market_id || "",
        market_name: m.market_name || "",
        state: mState,
        region: mRegion,
        gps_lat: lat,
        gps_lng: lng,
        status: m.status || "ACTIVE",
        items_tracked: stats?.items_tracked || 0,
        avg_change: stats ? parseFloat(stats.avg_change.toFixed(2)) : 0,
        min_price: stats?.min_price || 0,
        max_price: stats?.max_price || 0,
        total_prices: stats?.total_prices || 0,
      };

      if (withPrices && topPricesMap.has(m.market_name)) {
        result.top_prices = topPricesMap.get(m.market_name)!.map((tp: any) => ({
          ...tp,
          category_name: CATEGORY_MAP[tp.category_id] || "Food",
        }));
      }

      return result;
    });

    if (region) {
      formatted = formatted.filter(
        (m: any) => m.region.toLowerCase() === region.toLowerCase()
      );
    }

    // -------------------------------------------------------------------
    // 5. Aggregates
    // -------------------------------------------------------------------
    const states = [...new Set(formatted.map((m: any) => m.state).filter(Boolean))].sort();
    const regions = [...new Set(formatted.map((m: any) => m.region).filter(Boolean))].sort();

    return NextResponse.json({
      success: true,
      data: formatted,
      count: formatted.length,
      filters: { states, regions },
      stats: {
        total_markets: formatted.length,
        active_markets: formatted.filter((m: any) => m.status === "ACTIVE").length,
        markets_with_data: formatted.filter((m: any) => m.items_tracked > 0).length,
        total_items_tracked: formatted.reduce((sum: number, m: any) => sum + m.items_tracked, 0),
      },
    });
  } catch (error: any) {
    console.error("Markets API Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", data: [] },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
