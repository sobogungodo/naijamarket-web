import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// ============================================================================
// GET /api/markets
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const state = searchParams.get("state") || undefined;
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const data = await prisma.markets.findMany({
      where: {
        ...(state && { state }),
      },
      orderBy: {
        market_name: "asc",
      },
      take: Math.min(limit, 500),
    });

    return NextResponse.json({
      success: true,
      data,
      meta: {
        count: data.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Markets API Error:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch markets",
        },
      },
      { status: 500 }
    );
  }
}
