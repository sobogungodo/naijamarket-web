// ============================================================================
// src/app/api/markets/route.ts
// NaijaMarket Intel - Markets API v3.0
// Enhanced: Returns market data + price summaries for map popups
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
// CATEGORY MAP for human-readable names
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
  CAT016: "Fabrics & Textiles",
  CAT020: "Footwear",
  CAT028: "Body Care & Cosmetics",
  CAT029: "Hair Care",
  CAT036: "Cement & Building",
  CAT037: "Electrical Cables",
  CAT039: "Paints & Finishes",
  CAT048: "Kitchen & Cookware",
  CAT052: "Mattresses & Bedding",
  CAT059: "Tires & Auto Parts",
  CAT066: "Generators & Power",
  CAT069: "Fertilizers & Agro-Inputs",
  CAT070: "Poultry & Livestock",
  CAT078: "Pharmaceuticals",
  CAT083: "Baby Products & Diapers",
  CAT085: "Feminine Care",
  CAT087: "Smartphones",
  CAT089: "Phone Accessories",
  CAT092: "Appliances & Electronics",
  CAT103: "Fish (NBS)",
  CAT123: "Stationery & Office",
};

// ============================================================================
// REGION MAP - Nigerian geopolitical zones
// ============================================================================
const STATE_REGION: Record<string, string> = {
  Lagos: "South West",
  Ogun: "South West",
  Oyo: "South West",
  Osun: "South West",
  Ondo: "South West",
  Ekiti: "South West",
  Rivers: "South South",
  Bayelsa: "South South",
  "Cross River": "South South",
  "Akwa Ibom": "South South",
  Delta: "South South",
  Edo: "South South",
  Anambra: "South East",
  Enugu: "South East",
  Imo: "South East",
  Abia: "South East",
  Ebonyi: "South East",
  Kano: "North West",
  Kaduna: "North West",
  Katsina: "North West",
  Jigawa: "North West",
  Sokoto: "North West",
  Zamfara: "North West",
  Kebbi: "North West",
  Borno: "North East",
  Yobe: "North East",
  Adamawa: "North East",
  Bauchi: "North East",
  Gombe: "North East",
  Taraba: "North East",
  Plateau: "North Central",
  Nasarawa: "North Central",
  Niger: "North Central",
  Benue: "North Central",
  Kogi: "North Central",
  Kwara: "North Central",
  FCT: "North Central",
  "FCT - Abuja": "North Central",
};

export async function GET(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || searchParams.get("q") || "";
    const state = searchParams.get("state") || "";
    const region = searchParams.get("region") || "";
    const withPrices = searchParams.get("with_prices") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") || "300"), 500);

    // -------------------------------------------------------------------
    // 1. Fetch all markets
    // -------------------------------------------------------------------
    const searchLike = `%${search}%`;

    const markets = (await prisma.$queryRaw`
      SELECT TOP ${limit}
        market_id,
        market_name,
        state,
        gps_lat,
        gps_lng,
        status
      FROM Markets
      WHERE 1=1
        AND (${search} = '' OR market_name LIKE ${searchLike})
        AND (${state} = '' OR state = ${state})
      ORDER BY market_name ASC
    `) as any[];

    // -------------------------------------------------------------------
    // 2. Fetch price summary per market (items tracked + avg change)
    // -------------------------------------------------------------------
    let marketStats: any[] = [];
    try {
      marketStats = (await prisma.$queryRaw`
        SELECT
          market_name,
          COUNT(DISTINCT item_name) AS items_tracked,
          AVG(CAST(price_change_pct AS FLOAT)) AS avg_change,
          MIN(CAST(price_naira AS FLOAT)) AS min_price,
          MAX(CAST(price_naira AS FLOAT)) AS max_price,
          COUNT(*) AS total_prices
        FROM Latest_Prices_Summary
        WHERE price_naira > 0
        GROUP BY market_name
      `) as any[];
    } catch (e) {
      console.warn("Latest_Prices_Summary not available:", e);
    }

    // Build lookup
    const statsMap = new Map<
      string,
      {
        items_tracked: number;
        avg_change: number;
        min_price: number;
        max_price: number;
        total_prices: number;
      }
    >();
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
    // 3. Optionally fetch top 5 prices per market for popup display
    // -------------------------------------------------------------------
    let topPricesMap = new Map<
      string,
      Array<{
        item_name: string;
        price_naira: number;
        price_change_pct: number;
        category_id: string;
        unit: string;
      }>
    >();

    if (withPrices) {
      try {
        const topPrices = (await prisma.$queryRaw`
          SELECT
            market_name,
            item_name,
            CAST(price_naira AS FLOAT) AS price_naira,
            CAST(COALESCE(price_change_pct, 0) AS FLOAT) AS price_change_pct,
            COALESCE(category_id, '') AS category_id,
            COALESCE(unit, '') AS unit
          FROM (
            SELECT
              market_name,
              item_name,
              price_naira,
              price_change_pct,
              category_id,
              unit,
              ROW_NUMBER() OVER (
                PARTITION BY market_name
                ORDER BY price_naira DESC
              ) AS rn
            FROM Latest_Prices_Summary
            WHERE price_naira > 0
          ) ranked
          WHERE rn <= 5
          ORDER BY market_name, rn
        `) as any[];

        for (const tp of topPrices) {
          const key = tp.market_name;
          if (!topPricesMap.has(key)) {
            topPricesMap.set(key, []);
          }
          topPricesMap.get(key)!.push({
            item_name: tp.item_name,
            price_naira: Number(tp.price_naira),
            price_change_pct: Number(tp.price_change_pct),
            category_id: tp.category_id || "",
            unit: tp.unit || "",
          });
        }
      } catch (e) {
        console.warn("Top prices query failed:", e);
      }
    }

    // -------------------------------------------------------------------
    // 4. Format response
    // -------------------------------------------------------------------
    let formatted = markets.map((m: any) => {
      const stats = statsMap.get(m.market_name);
      const mRegion =
        STATE_REGION[m.state] || region || "";

      const result: any = {
        market_id: m.market_id || String(m.market_id),
        market_name: m.market_name,
        state: m.state || "",
        region: mRegion,
        gps_lat: m.gps_lat ? parseFloat(m.gps_lat) : null,
        gps_lng: m.gps_lng ? parseFloat(m.gps_lng) : null,
        status: m.status || "ACTIVE",
        items_tracked: stats?.items_tracked || 0,
        avg_change: stats ? parseFloat(stats.avg_change.toFixed(2)) : 0,
        min_price: stats?.min_price || 0,
        max_price: stats?.max_price || 0,
        total_prices: stats?.total_prices || 0,
      };

      // Attach top prices if requested
      if (withPrices && topPricesMap.has(m.market_name)) {
        result.top_prices = topPricesMap.get(m.market_name)!.map((tp) => ({
          ...tp,
          category_name: CATEGORY_MAP[tp.category_id] || "Other",
        }));
      }

      return result;
    });

    // Region filter (client-side since region is derived)
    if (region) {
      formatted = formatted.filter(
        (m: any) => m.region.toLowerCase() === region.toLowerCase()
      );
    }

    // -------------------------------------------------------------------
    // 5. Aggregate stats for the response
    // -------------------------------------------------------------------
    const states = [...new Set(formatted.map((m: any) => m.state).filter(Boolean))].sort();
    const regions = [
      ...new Set(formatted.map((m: any) => m.region).filter(Boolean)),
    ].sort();

    return NextResponse.json({
      success: true,
      data: formatted,
      count: formatted.length,
      filters: {
        states,
        regions,
      },
      stats: {
        total_markets: formatted.length,
        active_markets: formatted.filter((m: any) => m.status === "ACTIVE").length,
        markets_with_data: formatted.filter((m: any) => m.items_tracked > 0).length,
        total_items_tracked: formatted.reduce(
          (sum: number, m: any) => sum + m.items_tracked,
          0
        ),
      },
    });
  } catch (error: any) {
    console.error("Markets API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message?.substring(0, 200), data: [] },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
