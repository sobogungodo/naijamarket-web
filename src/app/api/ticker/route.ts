import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/ticker - Returns latest prices for ticker display
// Source: Latest_Prices_Summary (confirmed live table)
export async function GET() {
  try {
    // =========================================================================
    // Single query against Latest_Prices_Summary
    // Confirmed columns: item_id, item_name, unit, price_naira,
    //   price_change_pct, trend, last_updated
    // Exclude NBS reference items (not consumer-facing)
    // One row per item_id — take the highest-confidence row where dupes exist
    // =========================================================================
    const rows: any[] = await prisma.$queryRaw`
      SELECT
        item_id,
        item_name,
        unit,
        CAST(price_naira        AS FLOAT) AS price_naira,
        CAST(price_change_pct   AS FLOAT) AS price_change_pct,
        trend,
        last_updated
      FROM (
        SELECT
          item_id,
          item_name,
          unit,
          price_naira,
          price_change_pct,
          trend,
          last_updated,
          confidence_score,
          ROW_NUMBER() OVER (
            PARTITION BY item_id
            ORDER BY confidence_score DESC, last_updated DESC
          ) AS rn
        FROM dbo.Latest_Prices_Summary
        WHERE price_naira  IS NOT NULL
          AND price_naira  > 0
          AND item_id NOT LIKE 'NBS%'
      ) ranked
      WHERE rn = 1
      ORDER BY last_updated DESC
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: getStaticFallback(),
        source: "static_fallback",
      });
    }

    // Map to ticker shape
    const tickerData = rows.slice(0, 25).map((row) => {
      const change = row.price_change_pct != null ? Number(row.price_change_pct) : 0;
      const trendRaw = (row.trend || "").toString().toUpperCase();
      const trend: "up" | "down" | "stable" =
        trendRaw === "UP"   ? "up"   :
        trendRaw === "DOWN" ? "down" : "stable";

      return {
        symbol:   createSymbol(row.item_name),
        name:     row.item_name,
        price:    Number(row.price_naira),
        change:   parseFloat(change.toFixed(2)),
        trend,
        unit:     row.unit || "unit",
      };
    });

    return NextResponse.json({
      success: true,
      data: tickerData,
      source: "database",
      count: tickerData.length,
      as_of: rows[0]?.last_updated ?? null,
    });

  } catch (error) {
    console.error("Ticker API error:", error);
    return NextResponse.json({
      success: true,
      data: getStaticFallback(),
      source: "static_fallback",
    });
  }
}

// Bloomberg-style symbol from item name
function createSymbol(itemName: string): string {
  if (!itemName) return "ITEM";
  const name = itemName.toUpperCase();

  if (name.includes("RICE"))       return "RICE";
  if (name.includes("BEANS"))      return "BEANS";
  if (name.includes("GARRI"))      return "GARRI";
  if (name.includes("TOMATO"))     return "TOMATO";
  if (name.includes("ONION"))      return "ONION";
  if (name.includes("PEPPER"))     return "PEPPER";
  if (name.includes("PALM OIL"))   return "PALM";
  if (name.includes("GROUNDNUT"))  return "GNUT";
  if (name.includes("YAM"))        return "YAM";
  if (name.includes("MAIZE"))      return "MAIZE";
  if (name.includes("MILLET"))     return "MILLET";
  if (name.includes("SORGHUM"))    return "SORGHUM";
  if (name.includes("WHEAT"))      return "WHEAT";
  if (name.includes("SEMOVITA"))   return "SEMO";
  if (name.includes("FLOUR"))      return "FLOUR";
  if (name.includes("SUGAR"))      return "SUGAR";
  if (name.includes("SALT"))       return "SALT";
  if (name.includes("PASTA"))      return "PASTA";
  if (name.includes("BREAD"))      return "BREAD";
  if (name.includes("EGG"))        return "EGG";
  if (name.includes("CHICKEN"))    return "CHKN";
  if (name.includes("BEEF"))       return "BEEF";
  if (name.includes("FISH"))       return "FISH";
  if (name.includes("MILK"))       return "MILK";
  if (name.includes("PLANTAIN"))   return "PLANTAIN";
  if (name.includes("CASSAVA"))    return "CASS";
  if (name.includes("CRAYFISH"))   return "CFISH";

  const firstWord = name.split(/[\s\-\(]/)[0] ?? "ITEM";
  return firstWord.substring(0, 6);
}

// Static fallback — only fires if Latest_Prices_Summary returns 0 rows
function getStaticFallback() {
  return [
    { symbol: "RICE",     name: "Rice (50kg)",      price: 78500,  change:  2.3,  trend: "up"     as const, unit: "bag"    },
    { symbol: "BEANS",    name: "Beans (100kg)",    price: 62000,  change: -1.2,  trend: "down"   as const, unit: "bag"    },
    { symbol: "GARRI",    name: "Garri (50kg)",     price: 28000,  change:  0.8,  trend: "up"     as const, unit: "bag"    },
    { symbol: "TOMATO",   name: "Tomatoes",         price: 45000,  change: -5.2,  trend: "down"   as const, unit: "basket" },
    { symbol: "ONION",    name: "Onions",           price: 38500,  change:  3.1,  trend: "up"     as const, unit: "bag"    },
    { symbol: "PALM",     name: "Palm Oil (25L)",   price: 52000,  change:  1.5,  trend: "up"     as const, unit: "keg"    },
    { symbol: "YAM",      name: "Yam (tuber)",      price: 4500,   change: -0.8,  trend: "down"   as const, unit: "each"   },
    { symbol: "FISH",     name: "Catfish (kg)",     price: 11000,  change:  0.5,  trend: "stable" as const, unit: "kg"     },
  ];
}
