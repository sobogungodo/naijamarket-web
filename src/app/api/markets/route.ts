// ============================================================================
// src/app/api/markets/route.ts
// NaijaMarket Intel - Markets API
// Version: 2.0 - Uses $queryRaw for SQL Server compatibility
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

export async function GET(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || searchParams.get("q") || "";
    const state = searchParams.get("state") || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "250"), 500);

    const searchLike = `%${search}%`;

    const markets = await prisma.$queryRaw`
      SELECT TOP ${limit}
        market_id,
        market_name,
        state,
        region,
        gps_lat,
        gps_lng,
        status
      FROM Markets
      WHERE 1=1
        AND (${search} = '' OR market_name LIKE ${searchLike})
        AND (${state} = '' OR state = ${state})
      ORDER BY market_name ASC
    ` as any[];

    const formatted = markets.map((m: any) => ({
      market_id: m.market_id || String(m.market_id),
      market_name: m.market_name,
      state: m.state || "",
      region: m.region || "",
      gps_lat: m.gps_lat ? parseFloat(m.gps_lat) : null,
      gps_lng: m.gps_lng ? parseFloat(m.gps_lng) : null,
      status: m.status || "ACTIVE",
    }));

    return NextResponse.json({
      success: true,
      data: formatted,
      count: formatted.length,
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
