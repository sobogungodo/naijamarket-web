// src/app/api/markets/snapshot/route.ts
// NaijaMarket Intel - Market Snapshot API (Bloomberg TOP <GO> equivalent)
// Shows top items at a market with prices and trends

import { NextRequest, NextResponse } from "next/server";
import { prisma as sharedPrisma } from "@/lib/db";
import { PrismaClient } from "@prisma/client";

const prisma = sharedPrisma;

// GET - Get market snapshot
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const marketId = searchParams.get("market_id");
    const marketName = searchParams.get("market");
    const limit = parseInt(searchParams.get("limit") || "20");
    const categoryId = searchParams.get("category_id");

    if (!marketId && !marketName) {
      return NextResponse.json(
        { success: false, error: "market_id or market name is required" },
        { status: 400 }
      );
    }

    // Find market
    let market;
    if (marketId) {
      market = await prisma.markets.findFirst({ where: { market_id: marketId } });
    } else if (marketName) {
      market = await prisma.markets.findFirst({
        where: { market_name: { contains: marketName } },
      });
    }

    if (!market) {
      return NextResponse.json(
        { success: false, error: "Market not found" },
        { status: 404 }
      );
    }

    // Build price query
    const priceWhere: any = { market_id: market.market_id };
    if (categoryId) priceWhere.category_id = categoryId;

    // Get latest prices for this market
    const prices = await prisma.approved_Prices.findMany({
      where: priceWhere,
      take: limit,
      
    });

    // Group by category
    const byCategory: Record<string, any[]> = {};
    prices.forEach((p: any) => {
      const cat = p.category_name || "Other";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push({
        item_name: p.item_name,
        item_id: p.item_id,
        price: p.price,
        formatted_price: `₦${Number(p.price).toLocaleString()}`,
        unit: p.unit,
        brand: p.brand,
        price_trend: p.price_trend || "STABLE",
        price_date: p.price_date,
      });
    });

    // Calculate market statistics
    const allPrices = prices.map((p: any) => Number(p.price));
    const avgPrice = allPrices.length > 0 
      ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length 
      : 0;
    
    // Count trends
    const trendCounts = {
      up: prices.filter((p: any) => p.price_trend === "UP").length,
      down: prices.filter((p: any) => p.price_trend === "DOWN").length,
      stable: prices.filter((p: any) => !p.price_trend || p.price_trend === "STABLE").length,
    };

    return NextResponse.json({
      success: true,
      data: {
        market: {
          market_id: market.market_id,
          market_name: market.market_name,
          state: market.state,
          latitude: market.latitude,
          longitude: market.longitude,
        },
        snapshot_time: new Date().toISOString(),
        statistics: {
          total_items: prices.length,
          categories_count: Object.keys(byCategory).length,
          average_price: Math.round(avgPrice),
          formatted_avg: `₦${Math.round(avgPrice).toLocaleString()}`,
          trends: trendCounts,
        },
        categories: Object.entries(byCategory).map(([name, items]) => ({
          category_name: name,
          emoji: getCategoryEmoji(name),
          item_count: items.length,
          items: items.slice(0, 10), // Top 10 per category
        })),
        all_prices: prices.map((p: any) => ({
          item_name: p.item_name,
          category_name: p.category_name,
          price: p.price,
          formatted_price: `₦${Number(p.price).toLocaleString()}`,
          unit: p.unit,
          price_trend: p.price_trend,
        })),
      },
    });
  } catch (error) {
    console.error("Market Snapshot Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch market snapshot" },
      { status: 500 }
    );
  }
}

// Helper function to get category emoji
function getCategoryEmoji(categoryName: string): string {
  const emojiMap: Record<string, string> = {
    "Grains": "🌾",
    "Rice": "🍚",
    "Beans": "🫘",
    "Proteins": "🍖",
    "Meat": "🥩",
    "Fish": "🐟",
    "Vegetables": "🥬",
    "Fruits": "🍎",
    "Oils": "🫒",
    "Dairy": "🥛",
    "Spices": "🌶️",
    "Tubers": "🥔",
    "Default": "📦",
  };

  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (categoryName.toLowerCase().includes(key.toLowerCase())) {
      return emoji;
    }
  }
  return emojiMap["Default"] || "??";
}
