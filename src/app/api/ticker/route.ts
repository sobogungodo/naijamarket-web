import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/ticker - Returns latest prices for ticker display
export async function GET() {
  try {
    // =========================================================================
    // QUERY 1: Get latest prices from Approved_Prices (most recent per item)
    // =========================================================================
    let approvedPrices: any[] = [];
    try {
      // Get distinct items with their latest prices
      approvedPrices = await prisma.$queryRaw`
        SELECT 
          item_name,
          item_id,
          category_name,
          price,
          previous_price,
          price_change_percent,
          price_trend,
          unit,
          validated_at
        FROM (
          SELECT 
            item_name,
            item_id,
            category_name,
            price,
            previous_price,
            price_change_percent,
            price_trend,
            unit,
            validated_at,
            ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY validated_at DESC) as rn
          FROM Approved_Prices
          WHERE validation_status = 'APPROVED'
            AND price IS NOT NULL
            AND price > 0
        ) ranked
        WHERE rn = 1
        ORDER BY validated_at DESC
      `;
    } catch (err) {
      console.log("Approved_Prices ticker query failed:", err);
    }

    // =========================================================================
    // QUERY 2: Get latest prices from Price_History_NBS as fallback
    // =========================================================================
    let nbsPrices: any[] = [];
    try {
      nbsPrices = await prisma.$queryRaw`
        SELECT 
          item_name_standard as item_name,
          item_id,
          category_name,
          price_naira as price,
          variation_pct as price_change_percent,
          unit,
          observation_date as validated_at
        FROM (
          SELECT 
            item_name_standard,
            item_id,
            category_name,
            price_naira,
            variation_pct,
            unit,
            observation_date,
            ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY observation_date DESC) as rn
          FROM Price_History_NBS
          WHERE price_naira IS NOT NULL
            AND price_naira > 0
        ) ranked
        WHERE rn = 1
        ORDER BY observation_date DESC
      `;
    } catch (err) {
      console.log("Price_History_NBS ticker query failed:", err);
    }

    // =========================================================================
    // COMBINE: Prefer Approved_Prices, use NBS as fallback
    // =========================================================================
    const tickerItems = new Map<string, {
      symbol: string;
      name: string;
      price: number;
      change: number;
      trend: "up" | "down" | "stable";
      unit: string;
    }>();

    // Add NBS prices first (lower priority)
    for (const nbs of nbsPrices) {
      if (!nbs.item_name || !nbs.price) continue;
      
      const itemId = nbs.item_id || nbs.item_name;
      const symbol = createSymbol(nbs.item_name);
      const price = Number(nbs.price);
      const change = nbs.price_change_percent ? Number(nbs.price_change_percent) : 0;

      tickerItems.set(itemId, {
        symbol,
        name: nbs.item_name,
        price,
        change,
        trend: change > 0 ? "up" : change < 0 ? "down" : "stable",
        unit: nbs.unit || "unit",
      });
    }

    // Add/overwrite with Approved_Prices (higher priority)
    for (const ap of approvedPrices) {
      if (!ap.item_name || !ap.price) continue;
      
      const itemId = ap.item_id || ap.item_name;
      const symbol = createSymbol(ap.item_name);
      const price = Number(ap.price);
      const change = ap.price_change_percent ? Number(ap.price_change_percent) : 0;

      tickerItems.set(itemId, {
        symbol,
        name: ap.item_name,
        price,
        change,
        trend: ap.price_trend === "UP" ? "up" : ap.price_trend === "DOWN" ? "down" : "stable",
        unit: ap.unit || "unit",
      });
    }

    // Convert to array and limit to top 20 items
    const tickerData = Array.from(tickerItems.values()).slice(0, 20);

    // If no data, return fallback static data
    if (tickerData.length === 0) {
      return NextResponse.json({
        success: true,
        data: getStaticFallback(),
        source: "static",
      });
    }

    return NextResponse.json({
      success: true,
      data: tickerData,
      source: "database",
      count: tickerData.length,
    });

  } catch (error) {
    console.error("Ticker API error:", error);
    // Return static fallback on error
    return NextResponse.json({
      success: true,
      data: getStaticFallback(),
      source: "static_fallback",
    });
  }
}

// Create Bloomberg-style symbol from item name
function createSymbol(itemName: string): string {
  if (!itemName) return "ITEM.NGN";
  
  const name = itemName.toUpperCase();
  
  // Common mappings
  if (name.includes("RICE")) return "RICE.NGN";
  if (name.includes("BEANS")) return "BEANS.NGN";
  if (name.includes("GARRI")) return "GARRI.NGN";
  if (name.includes("TOMATO")) return "TOMATO.NGN";
  if (name.includes("ONION")) return "ONION.NGN";
  if (name.includes("PEPPER")) return "PEPPER.NGN";
  if (name.includes("PALM OIL")) return "PALM.NGN";
  if (name.includes("GROUNDNUT")) return "GNUT.NGN";
  if (name.includes("CEMENT")) return "CEMENT.NGN";
  if (name.includes("FLOUR")) return "FLOUR.NGN";
  if (name.includes("SUGAR")) return "SUGAR.NGN";
  if (name.includes("SALT")) return "SALT.NGN";
  if (name.includes("YAMS") || name.includes("YAM")) return "YAM.NGN";
  if (name.includes("MAIZE")) return "MAIZE.NGN";
  if (name.includes("MILLET")) return "MILLET.NGN";
  if (name.includes("SORGHUM")) return "SORGHUM.NGN";
  if (name.includes("WHEAT")) return "WHEAT.NGN";
  if (name.includes("SEMOVITA")) return "SEMO.NGN";
  if (name.includes("PASTA")) return "PASTA.NGN";
  if (name.includes("BREAD")) return "BREAD.NGN";
  if (name.includes("EGG")) return "EGG.NGN";
  if (name.includes("CHICKEN")) return "CHKN.NGN";
  if (name.includes("BEEF")) return "BEEF.NGN";
  if (name.includes("FISH")) return "FISH.NGN";
  if (name.includes("MILK")) return "MILK.NGN";
  
  // Default: take first word and add .NGN (with null safety)
  const parts = name.split(/[\s\-\(]/);
  const firstWord = parts.length > 0 && parts[0] ? parts[0].substring(0, 6) : "ITEM";
  return `${firstWord}.NGN`;
}

// Static fallback data when database is empty
function getStaticFallback() {
  return [
    { symbol: "RICE.NGN", name: "Rice (50kg)", price: 78500, change: 2.3, trend: "up" as const, unit: "bag" },
    { symbol: "BEANS.NGN", name: "Beans (100kg)", price: 62000, change: -1.2, trend: "down" as const, unit: "bag" },
    { symbol: "GARRI.NGN", name: "Garri (50kg)", price: 28000, change: 0.8, trend: "up" as const, unit: "bag" },
    { symbol: "TOMATO.NGN", name: "Tomatoes", price: 45000, change: -5.2, trend: "down" as const, unit: "basket" },
    { symbol: "ONION.NGN", name: "Onions", price: 38500, change: 3.1, trend: "up" as const, unit: "bag" },
    { symbol: "CEMENT.NGN", name: "Cement", price: 6500, change: -0.3, trend: "down" as const, unit: "bag" },
    { symbol: "PALM.NGN", name: "Palm Oil (25L)", price: 52000, change: 1.5, trend: "up" as const, unit: "keg" },
    { symbol: "NFPI.IDX", name: "Food Price Index", price: 127.4, change: 2.1, trend: "up" as const, unit: "index" },
  ];
}
