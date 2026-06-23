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

    // Top movers — real food prices from Latest_Prices_Summary.
    // Gainers: biggest positive %; Losers: biggest negative %.
    type MoverRow = {
      item_name: string | null;
      market_name: string | null;
      state: string | null;
      price_naira: number | null;
      price_change_pct: number | null;
      trend: string | null;
    };

    const mapMover = (m: MoverRow) => ({
      name: m.item_name ?? "",
      market: m.market_name ?? m.state ?? "",
      price: Number(m.price_naira ?? 0),
      change: Number(m.price_change_pct ?? 0),
    });

    let topGainers: ReturnType<typeof mapMover>[] = [];
    let topLosers: ReturnType<typeof mapMover>[] = [];
    try {
      const [gainers, losers] = await Promise.all([
        prisma.$queryRaw`
          SELECT TOP 5 item_name, market_name, state,
            CAST(price_naira AS FLOAT) AS price_naira,
            CAST(price_change_pct AS FLOAT) AS price_change_pct, trend
          FROM dbo.Latest_Prices_Summary WITH (NOLOCK)
          WHERE is_nbs_ref = 0 AND is_food = 1
            AND price_change_pct IS NOT NULL AND price_change_pct > 0
            AND price_naira > 0
          ORDER BY price_change_pct DESC
        ` as Promise<MoverRow[]>,
        prisma.$queryRaw`
          SELECT TOP 5 item_name, market_name, state,
            CAST(price_naira AS FLOAT) AS price_naira,
            CAST(price_change_pct AS FLOAT) AS price_change_pct, trend
          FROM dbo.Latest_Prices_Summary WITH (NOLOCK)
          WHERE is_nbs_ref = 0 AND is_food = 1
            AND price_change_pct IS NOT NULL AND price_change_pct < 0
            AND price_naira > 0
          ORDER BY price_change_pct ASC
        ` as Promise<MoverRow[]>,
      ]);
      topGainers = (gainers ?? []).map(mapMover);
      topLosers = (losers ?? []).map(mapMover);
    } catch (moverErr: any) {
      // Non-fatal — keep stats working even if movers query fails.
      console.error("[dashboard/stats] movers query error:", moverErr?.message);
    }

    return NextResponse.json({
      success: true,
      marketCount: Number(row.market_count ?? 0),
      itemCount: Number(row.item_count ?? 0),
      latestPriceDate: row.latest_price_date
        ? new Date(row.latest_price_date).toISOString()
        : null,
      todayRowCount: Number(row.today_row_count ?? 0),
      topGainers,
      topLosers,
    });
  } catch (error: any) {
    console.error("[dashboard/stats] query error:", error?.message);
    return NextResponse.json(
      { success: false, error: "STATS_QUERY_FAILED" },
      { status: 500 }
    );
  }
}
