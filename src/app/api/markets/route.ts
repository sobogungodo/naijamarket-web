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

// ============================================================================
// GET /api/markets/[id]
// Fetch single market by ID
// ============================================================================

async function getMarketById(marketId: string) {
  try {
    const market = await prisma.markets.findUnique({
      where: { market_id: marketId },
    });

    if (!market) {
      return null;
    }

    return market;
  } catch (error) {
    console.error("Get Market Error:", error);
    throw error;
  }
}

// ============================================================================
// API DOCUMENTATION
// ============================================================================

/**
 * @api {get} /api/markets Get Markets
 * @apiName GetMarkets
 * @apiGroup Markets
 * @apiVersion 1.0.0
 *
 * @apiQuery {String} [state] Filter by state name
 * @apiQuery {String} [status=ACTIVE] Filter by status (ACTIVE, INACTIVE)
 * @apiQuery {Boolean} [include_stats=false] Include price statistics
 * @apiQuery {Number} [limit=100] Number of results (max 500)
 * @apiQuery {Number} [offset=0] Pagination offset
 *
 * @apiSuccess {Boolean} success Request status
 * @apiSuccess {Array} data Array of market objects
 * @apiSuccess {Object} meta Pagination metadata
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "success": true,
 *       "data": [
 *         {
 *           "market_id": "MKT_001",
 *           "market_name": "Mile 12 Market",
 *           "state": "Lagos",
 *           "latitude": 6.5833,
 *           "longitude": 3.3833,
 *           "status": "ACTIVE",
 *           "items_count": 45,
 *           "prices_count": 1234,
 *           "avg_confidence": 88.5
 *         }
 *       ],
 *       "meta": {
 *         "page": 1,
 *         "per_page": 100,
 *         "total": 226,
 *         "total_pages": 3
 *       }
 *     }
 */
