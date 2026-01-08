import { NextRequest, NextResponse } from "next/server";
import prisma, { getMarketStats } from "@/lib/db";

// ============================================================================
// GET /api/markets
// Fetch markets with optional stats
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse query parameters
    const state = searchParams.get("state") || undefined;
    const status = searchParams.get("status") || "ACTIVE";
    const includeStats = searchParams.get("include_stats") === "true";
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Validate parameters
    const safeLimit = Math.min(Math.max(1, limit), 500);
    const safeOffset = Math.max(0, offset);

    let data;

    if (includeStats) {
      // Get markets with price statistics
      data = await getMarketStats();
    } else {
      // Get basic market list
      data = await prisma.markets.findMany({
        where: {
          ...(state && { state }),
          ...(status && { status }),
        },
        orderBy: {
          market_name: "asc",
        },
        skip: safeOffset,
        take: safeLimit,
      });
    }

    // Get total count for pagination
    const totalCount = await prisma.markets.count({
      where: {
        ...(state && { state }),
        ...(status && { status }),
      },
    });

    return NextResponse.json({
      success: true,
      data,
      meta: {
        page: Math.floor(safeOffset / safeLimit) + 1,
        per_page: safeLimit,
        total: totalCount,
        total_pages: Math.ceil(totalCount / safeLimit),
        has_next: safeOffset + safeLimit < totalCount,
        has_prev: safeOffset > 0,
        filters: {
          state,
          status,
        },
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
          details: process.env.NODE_ENV === "development" 
            ? (error instanceof Error ? error.message : "Unknown error")
            : undefined,
        },
      },
      { status: 500 }
    );
  }
}

