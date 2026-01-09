// src/app/api/prices/compare/route.ts
// NaijaMarket Intel - Price Compare API (Bloomberg COMP <GO> equivalent)
// Compare prices for an item across multiple markets

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// POST - Compare prices across markets
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      item_id,
      item_name,
      market_ids, // Array of market IDs to compare
      states, // Array of states to compare
    } = body;

    if (!item_id && !item_name) {
      return NextResponse.json(
        { success: false, error: "item_id or item_name is required" },
        { status: 400 }
      );
    }

    // Build where clause
    const where: any = {};
    
    if (item_id) {
      where.item_id = item_id;
    } else if (item_name) {
      where.item_name = { contains: item_name };
    }

    if (market_ids?.length) {
      where.market_id = { in: market_ids };
    }

    if (states?.length) {
      where.state = { in: states };
    }

    // Get prices
    const prices = await prisma.approved_Prices.findMany({
      where,
      orderBy: { price: "asc" },
    });

    if (prices.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          item_name: item_name || item_id,
          markets_compared: 0,
          message: "No prices found for this item",
        },
      });
    }

    // Calculate statistics
    const priceValues = prices.map((p: any) => Number(p.price));
    const minPrice = Math.min(...priceValues);
    const maxPrice = Math.max(...priceValues);
    const avgPrice = priceValues.reduce((a, b) => a + b, 0) / priceValues.length;
    const priceDiff = maxPrice - minPrice;
    const priceSpread = ((priceDiff / minPrice) * 100).toFixed(1);

    // Find cheapest and most expensive
    const cheapest = prices.find((p: any) => Number(p.price) === minPrice);
    const mostExpensive = prices.find((p: any) => Number(p.price) === maxPrice);

    // Group by state for regional comparison
    const byState: Record<string, any[]> = {};
    prices.forEach((p: any) => {
      const state = p.state || "Unknown";
      if (!byState[state]) byState[state] = [];
      byState[state].push(p);
    });

    const stateComparison = Object.entries(byState).map(([state, statePrices]) => {
      const statePriceValues = statePrices.map((p: any) => Number(p.price));
      return {
        state,
        markets_count: statePrices.length,
        avg_price: Math.round(statePriceValues.reduce((a, b) => a + b, 0) / statePriceValues.length),
        min_price: Math.min(...statePriceValues),
        max_price: Math.max(...statePriceValues),
      };
    }).sort((a, b) => a.avg_price - b.avg_price);

    return NextResponse.json({
      success: true,
      data: {
        item: {
          item_id: prices[0].item_id,
          item_name: prices[0].item_name,
          category_name: prices[0].category_name,
          unit: prices[0].unit,
        },
        comparison: {
          markets_compared: prices.length,
          states_compared: Object.keys(byState).length,
          price_range: {
            min: minPrice,
            max: maxPrice,
            avg: Math.round(avgPrice),
            difference: priceDiff,
            spread_percent: `${priceSpread}%`,
          },
          formatted: {
            min: `₦${minPrice.toLocaleString()}`,
            max: `₦${maxPrice.toLocaleString()}`,
            avg: `₦${Math.round(avgPrice).toLocaleString()}`,
            difference: `₦${priceDiff.toLocaleString()}`,
          },
          cheapest_market: {
            market_name: cheapest?.market_name,
            market_id: cheapest?.market_id,
            state: cheapest?.state,
            price: cheapest?.price,
            formatted_price: `₦${Number(cheapest?.price).toLocaleString()}`,
          },
          most_expensive_market: {
            market_name: mostExpensive?.market_name,
            market_id: mostExpensive?.market_id,
            state: mostExpensive?.state,
            price: mostExpensive?.price,
            formatted_price: `₦${Number(mostExpensive?.price).toLocaleString()}`,
          },
          potential_savings: {
            amount: priceDiff,
            formatted: `₦${priceDiff.toLocaleString()}`,
            percent: priceSpread,
          },
        },
        by_state: stateComparison,
        all_markets: prices.map((p: any) => ({
          market_name: p.market_name,
          market_id: p.market_id,
          state: p.state,
          price: p.price,
          formatted_price: `₦${Number(p.price).toLocaleString()}`,
          unit: p.unit,
          price_trend: p.price_trend,
          vs_cheapest: `+${Math.round(((Number(p.price) - minPrice) / minPrice) * 100)}%`,
        })),
      },
    });
  } catch (error) {
    console.error("Price Compare Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to compare prices" },
      { status: 500 }
    );
  }
}

// GET - Quick compare by item name
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const itemName = searchParams.get("item");
    const state = searchParams.get("state");
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!itemName) {
      return NextResponse.json(
        { success: false, error: "item parameter is required" },
        { status: 400 }
      );
    }

    const where: any = {
      item_name: { contains: itemName },
    };

    if (state) {
      where.state = { contains: state };
    }

    const prices = await prisma.approved_Prices.findMany({
      where,
      take: limit,
      orderBy: { price: "asc" },
    });

    if (prices.length === 0) {
      return NextResponse.json({
        success: true,
        data: { message: "No prices found for this item" },
      });
    }

    const priceValues = prices.map((p: any) => Number(p.price));
    const minPrice = Math.min(...priceValues);
    const maxPrice = Math.max(...priceValues);

    return NextResponse.json({
      success: true,
      data: {
        item_name: prices[0].item_name,
        markets_found: prices.length,
        price_range: {
          min: `₦${minPrice.toLocaleString()}`,
          max: `₦${maxPrice.toLocaleString()}`,
          spread: `${(((maxPrice - minPrice) / minPrice) * 100).toFixed(1)}%`,
        },
        markets: prices.map((p: any) => ({
          market_name: p.market_name,
          state: p.state,
          price: `₦${Number(p.price).toLocaleString()}`,
        })),
      },
    });
  } catch (error) {
    console.error("Price Compare Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to compare prices" },
      { status: 500 }
    );
  }
}
