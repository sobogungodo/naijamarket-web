import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/compare?item=Rice&item_id=ITM00001&markets=MKT0001,MKT0002&tier=FREE
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const itemName = searchParams.get("item");
    const itemId = searchParams.get("item_id");
    const marketsParam = searchParams.get("markets");
    const tier = searchParams.get("tier") || "FREE";

    // Validate required parameters
    if (!itemName) {
      return NextResponse.json(
        { success: false, error: "missing_item", message: "Item name is required" },
        { status: 400 }
      );
    }

    if (!marketsParam) {
      return NextResponse.json(
        { success: false, error: "missing_markets", message: "Markets parameter is required" },
        { status: 400 }
      );
    }

    const marketIds = marketsParam.split(",").filter(Boolean);
    
    if (marketIds.length < 2) {
      return NextResponse.json(
        { success: false, error: "insufficient_markets", message: "At least 2 markets required" },
        { status: 400 }
      );
    }

    // Tier limits
    const maxMarketsAllowed = tier === "FREE" ? 2 : tier === "SILVER" ? 3 : 5;
    const limitedMarketIds = marketIds.slice(0, maxMarketsAllowed);

    console.log("Compare API - Searching for:", { itemName, itemId, marketIds: limitedMarketIds });

    // =========================================================================
    // QUERY 1: Get prices from Approved_Prices (crowdsourced, most recent)
    // =========================================================================
    let approvedPrices: any[] = [];
    try {
      approvedPrices = await prisma.approved_Prices.findMany({
        where: {
          AND: [
            {
              OR: [
                { item_name: { contains: itemName } },
                { item_id: itemId || undefined },
              ],
            },
            { market_id: { in: limitedMarketIds } },
            { validation_status: "APPROVED" },
          ],
        },
        orderBy: { validated_at: "desc" },
      });
      console.log(`Found ${approvedPrices.length} approved prices`);
    } catch (err) {
      console.log("Approved_Prices query failed:", err);
    }

    // =========================================================================
    // QUERY 2: Get prices from Price_History_NBS (government data)
    // =========================================================================
    let nbsPrices: any[] = [];
    try {
      nbsPrices = await prisma.price_History_NBS.findMany({
        where: {
          AND: [
            {
              OR: [
                { item_name_nbs: { contains: itemName } },
                { item_name_standard: { contains: itemName } },
                { item_id: itemId || undefined },
              ],
            },
            { market_id: { in: limitedMarketIds } },
          ],
        },
        orderBy: { observation_date: "desc" },
      });
      console.log(`Found ${nbsPrices.length} NBS prices`);
    } catch (err) {
      console.log("Price_History_NBS query failed:", err);
    }

    // =========================================================================
    // COMBINE AND DEDUPLICATE: Prefer Approved_Prices over NBS
    // =========================================================================
    const pricesByMarket = new Map<string, {
      marketId: string;
      marketName: string;
      state: string;
      price: number;
      trend: string | null;
      trendPercentage: number | null;
      updatedAt: string;
      source: string;
    }>();

    // First add NBS prices (lower priority)
    for (const nbs of nbsPrices) {
      const marketId = nbs.market_id;
      if (!marketId || !limitedMarketIds.includes(marketId)) continue;
      
      const price = nbs.price_naira ? Number(nbs.price_naira) : null;
      if (!price || price <= 0) continue;

      pricesByMarket.set(marketId, {
        marketId,
        marketName: nbs.market_name || "Unknown Market",
        state: nbs.db_state || nbs.state_name_nbs || "Unknown",
        price,
        trend: nbs.variation_pct ? (Number(nbs.variation_pct) > 0 ? "UP" : Number(nbs.variation_pct) < 0 ? "DOWN" : "STABLE") : null,
        trendPercentage: nbs.variation_pct ? Number(nbs.variation_pct) : null,
        updatedAt: nbs.observation_date?.toISOString() || new Date().toISOString(),
        source: "NBS",
      });
    }

    // Then add/overwrite with Approved_Prices (higher priority - more recent)
    for (const ap of approvedPrices) {
      const marketId = ap.market_id;
      if (!marketId || !limitedMarketIds.includes(marketId)) continue;
      
      const price = ap.price ? Number(ap.price) : null;
      if (!price || price <= 0) continue;

      pricesByMarket.set(marketId, {
        marketId,
        marketName: ap.market_name || "Unknown Market",
        state: ap.state || "Unknown",
        price,
        trend: ap.price_trend || null,
        trendPercentage: ap.price_change_percent ? Number(ap.price_change_percent) : null,
        updatedAt: ap.validated_at?.toISOString() || ap.submission_date?.toISOString() || new Date().toISOString(),
        source: "TRADER",
      });
    }

    console.log(`Combined unique markets with prices: ${pricesByMarket.size}`);

    // =========================================================================
    // CHECK IF WE HAVE ENOUGH DATA
    // =========================================================================
    if (pricesByMarket.size < 2) {
      // Try to get market names for the requested markets to provide better error message
      const requestedMarkets = await prisma.markets.findMany({
        where: { market_id: { in: limitedMarketIds } },
        select: { market_id: true, market_name: true },
      });

      const marketNames = requestedMarkets.map(m => m.market_name).join(", ");

      return NextResponse.json({
        success: false,
        error: "no_prices",
        message: `No prices found for "${itemName}"`,
        suggestion: `Try different markets or check if the item has been recently submitted`,
        marketsSearched: marketNames || limitedMarketIds.join(", "),
        pricesFound: pricesByMarket.size,
      });
    }

    // =========================================================================
    // BUILD COMPARISON RESULT
    // =========================================================================
    const pricesArray = Array.from(pricesByMarket.values());
    
    // Sort by price (lowest first)
    pricesArray.sort((a, b) => a.price - b.price);

    // Calculate stats
    const prices = pricesArray.map(p => p.price);
    const lowestPrice = Math.min(...prices);
    const highestPrice = Math.max(...prices);
    const averagePrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    const priceRange = highestPrice - lowestPrice;

    // Add rank and savings
    const marketsWithRank = pricesArray.map((market, index) => ({
      ...market,
      rank: index + 1,
      savings: market.price - lowestPrice,
      savingsPercentage: Math.round(((market.price - lowestPrice) / market.price) * 100),
    }));

    // Get category info
    let category = "Unknown";
    let unit = "unit";
    
    if (approvedPrices.length > 0) {
      category = approvedPrices[0].category_name || "Unknown";
      unit = approvedPrices[0].unit || "unit";
    } else if (nbsPrices.length > 0) {
      category = nbsPrices[0].category_name || "Unknown";
      unit = nbsPrices[0].unit || "unit";
    }

    const result = {
      item: {
        id: itemId || "UNKNOWN",
        name: itemName,
        category,
        unit,
      },
      lowestPrice: marketsWithRank[0],
      highestPrice: marketsWithRank[marketsWithRank.length - 1],
      averagePrice,
      priceRange,
      markets: marketsWithRank,
      maxSavings: {
        amount: priceRange,
        percentage: Math.round((priceRange / highestPrice) * 100),
        fromMarket: marketsWithRank[marketsWithRank.length - 1].marketName,
        toMarket: marketsWithRank[0].marketName,
      },
      dataSources: {
        approvedPrices: approvedPrices.length,
        nbsPrices: nbsPrices.length,
      },
    };

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error("Compare API error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "server_error", 
        message: "Failed to compare prices",
        details: process.env.NODE_ENV === "development" ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}
