// src/app/api/dashboard/stats/route.ts
// NaijaMarket Intel — Dashboard live platform stats
// Returns real counts from the DB to replace hardcoded dashboard mock numbers.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = (await prisma.$queryRaw`
      SELECT
        (SELECT COUNT(*) FROM dbo.Markets) AS market_count,
        (SELECT COUNT(*) FROM dbo.Items_Catalog
           WHERE (status = 'ACTIVE' OR status IS NULL)) AS item_count,
        (SELECT MAX(price_date) FROM dbo.Daily_Prices
           WHERE nbs_adjusted = 0) AS latest_price_date,
        (SELECT COUNT(*) FROM dbo.Daily_Prices
           WHERE price_date = (SELECT MAX(price_date) FROM dbo.Daily_Prices WHERE nbs_adjusted = 0)
             AND nbs_adjusted = 0) AS today_row_count
    `) as Array<{
      market_count: bigint | number | null;
      item_count: bigint | number | null;
      latest_price_date: Date | string | null;
      today_row_count: bigint | number | null;
    }>;

    const row = rows[0] ?? {
      market_count: 0,
      item_count: 0,
      latest_price_date: null,
      today_row_count: 0,
    };

    return NextResponse.json({
      success: true,
      marketCount: Number(row.market_count ?? 0),
      itemCount: Number(row.item_count ?? 0),
      latestPriceDate: row.latest_price_date
        ? new Date(row.latest_price_date).toISOString()
        : null,
      todayRowCount: Number(row.today_row_count ?? 0),
    });
  } catch (error: any) {
    console.error("[dashboard/stats] query error:", error?.message);
    return NextResponse.json(
      { success: false, error: "STATS_QUERY_FAILED" },
      { status: 500 }
    );
  }
}
