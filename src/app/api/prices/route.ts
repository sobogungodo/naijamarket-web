import { NextRequest, NextResponse } from "next/server";
import { getCurrentPrices, getTopMovers } from "@/lib/db";

// ============================================================================
// GET /api/prices
// Fetch current commodity prices with filters
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse query parameters
    const marketId = searchParams.get("market_id") || undefined;
    const categoryId = searchParams.get("category_id") || undefined;
    const itemId = searchParams.get("item_id") || undefined;
    const state = searchParams.get("state") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const type = searchParams.get("type"); // 'gainers' | 'losers' | undefined

    // Validate limit
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const safeOffset = Math.max(0, offset);

    let data;
    let meta;

    // Handle top movers request
    if (type === "gainers" || type === "losers") {
      data = await getTopMovers(type, safeLimit);
      meta = {
        type,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    } else {
      // Regular price query
      data = await getCurrentPrices({
        marketId,
        categoryId,
        itemId,
        state,
        limit: safeLimit,
        offset: safeOffset,
      });

      meta = {
        page: Math.floor(safeOffset / safeLimit) + 1,
        per_page: safeLimit,
        offset: safeOffset,
        count: data.length,
        has_more: data.length === safeLimit,
        filters: {
          market_id: marketId,
          category_id: categoryId,
          item_id: itemId,
          state,
        },
        timestamp: new Date().toISOString(),
      };
    }

    return NextResponse.json({
      success: true,
      data,
      meta,
    });
  } catch (error) {
    console.error("Prices API Error:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch prices",
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
// API DOCUMENTATION
// ============================================================================

/**
 * @api {get} /api/prices Get Current Prices
 * @apiName GetPrices
 * @apiGroup Prices
 * @apiVersion 1.0.0
 *
 * @apiQuery {String} [market_id] Filter by market ID
 * @apiQuery {String} [category_id] Filter by category ID
 * @apiQuery {String} [item_id] Filter by item ID
 * @apiQuery {String} [state] Filter by state name
 * @apiQuery {Number} [limit=50] Number of results (max 100)
 * @apiQuery {Number} [offset=0] Pagination offset
 * @apiQuery {String} [type] Special query type: 'gainers' or 'losers'
 *
 * @apiSuccess {Boolean} success Request status
 * @apiSuccess {Array} data Array of price objects
 * @apiSuccess {Object} meta Pagination and filter metadata
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "success": true,
 *       "data": [
 *         {
 *           "price_id": "PRC_001",
 *           "item_id": "ITEM_001",
 *           "item_name": "Rice (50kg)",
 *           "market_id": "MKT_001",
 *           "market_name": "Mile 12 Market",
 *           "state": "Lagos",
 *           "price": 78500.00,
 *           "unit": "bag",
 *           "price_change_percent": 2.3,
 *           "price_trend": "↑",
 *           "confidence_score": 92.5,
 *           "validated_at": "2026-01-08T10:30:00Z"
 *         }
 *       ],
 *       "meta": {
 *         "page": 1,
 *         "per_page": 50,
 *         "count": 50,
 *         "has_more": true
 *       }
 *     }
 */
