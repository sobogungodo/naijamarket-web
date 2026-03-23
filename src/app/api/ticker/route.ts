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
  if (!itemName) return "ITEM.NGN";
  const name = itemName.toUpperCase();

  if (name.includes("RICE"))       return "RICE.NGN";
  if (name.includes("BEANS"))      return "BEANS.NGN";
  if (name.includes("GARRI"))      return "GARRI.NGN";
  if (name.includes("TOMATO"))     return "TOMATO.NGN";
  if (name.includes("ONION"))      return "ONION.NGN";
  if (name.includes("PEPPER"))     return "PEPPER.NGN";
  if (name.includes("PALM OIL"))   return "PALM.NGN";
  if (name.includes("GROUNDNUT"))  return "GNUT.NGN";
  if (name.includes("YAM"))        return "YAM.NGN";
  if (name.includes("MAIZE"))      return "MAIZE.NGN";
  if (name.includes("MILLET"))     return "MILLET.NGN";
  if (name.includes("SORGHUM"))    return "SORGHUM.NGN";
  if (name.includes("WHEAT"))      return "WHEAT.NGN";
  if (name.includes("SEMOVITA"))   return "SEMO.NGN";
  if (name.includes("FLOUR"))      return "FLOUR.NGN";
  if (name.includes("SUGAR"))      return "SUGAR.NGN";
  if (name.includes("SALT"))       return "SALT.NGN";
  if (name.includes("PASTA"))      return "PASTA.NGN";
  if (name.includes("BREAD"))      return "BREAD.NGN";
  if (name.includes("EGG"))        return "EGG.NGN";
  if (name.includes("CHICKEN"))    return "CHKN.NGN";
  if (name.includes("BEEF"))       return "BEEF.NGN";
  if (name.includes("FISH"))       return "FISH.NGN";
  if (name.includes("MILK"))       return "MILK.NGN";
  if (name.includes("PLANTAIN"))   return "PLANTAIN.NGN";
  if (name.includes("CASSAVA"))    return "CASS.NGN";
  if (name.includes("CRAYFISH"))   return "CFISH.NGN";

  const firstWord = name.split(/[\s\-\(]/)[0] ?? "ITEM";
  return `${firstWord.substring(0, 6)}.NGN`;
}

// Static fallback — only fires if Latest_Prices_Summary returns 0 rows
function getStaticFallback() {
  return [
    { symbol: "RICE.NGN",     name: "Rice (50kg)",      price: 78500,  change:  2.3,  trend: "up"     as const, unit: "bag"    },
    { symbol: "BEANS.NGN",    name: "Beans (100kg)",    price: 62000,  change: -1.2,  trend: "down"   as const, unit: "bag"    },
    { symbol: "GARRI.NGN",    name: "Garri (50kg)",     price: 28000,  change:  0.8,  trend: "up"     as const, unit: "bag"    },
    { symbol: "TOMATO.NGN",   name: "Tomatoes",         price: 45000,  change: -5.2,  trend: "down"   as const, unit: "basket" },
    { symbol: "ONION.NGN",    name: "Onions",           price: 38500,  change:  3.1,  trend: "up"     as const, unit: "bag"    },
    { symbol: "PALM.NGN",     name: "Palm Oil (25L)",   price: 52000,  change:  1.5,  trend: "up"     as const, unit: "keg"    },
    { symbol: "YAM.NGN",      name: "Yam (tuber)",      price: 4500,   change: -0.8,  trend: "down"   as const, unit: "each"   },
    { symbol: "FISH.NGN",     name: "Catfish (kg)",     price: 11000,  change:  0.5,  trend: "stable" as const, unit: "kg"     },
  ];
}
