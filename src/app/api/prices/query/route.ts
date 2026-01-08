// src/app/api/prices/query/route.ts
// NaijaMarket Intel - Price Query API (Bloomberg SECF equivalent)

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET - Query prices with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Query parameters
    const marketId = searchParams.get("market_id");
    const marketName = searchParams.get("market");
    const categoryId = searchParams.get("category_id");
    const categoryName = searchParams.get("category");
    const itemId = searchParams.get("item_id");
    const itemName = searchParams.get("item");
    const state = searchParams.get("state");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause dynamically
    const where: any = {};

    if (marketId) where.market_id = marketId;
    if (categoryId) where.category_id = categoryId;
    if (itemId) where.item_id = itemId;

    // Text search filters (case-insensitive contains)
    if (marketName) {
      where.market_name = { contains: marketName, mode: "insensitive" };
    }
    if (categoryName) {
      where.category_name = { contains: categoryName, mode: "insensitive" };
    }
    if (itemName) {
      where.item_name = { contains: itemName, mode: "insensitive" };
    }
    if (state) {
      where.state = { contains: state, mode: "insensitive" };
    }

    // Get prices from Approved_Prices table
    const prices = await prisma.approved_Prices.findMany({
      where,
      take: Math.min(limit, 100), // Max 100 results
      skip: offset,
      orderBy: { price_date: "desc" },
    });

    // Get total count for pagination
    const total = await prisma.approved_Prices.count({ where });

    // Format prices for response
    const formattedPrices = prices.map((p: any) => ({
      price_id: p.price_id,
      item_name: p.item_name,
      item_id: p.item_id,
      category_name: p.category_name,
      category_id: p.category_id,
      market_name: p.market_name,
      market_id: p.market_id,
      state: p.state,
      price: p.price,
      unit: p.unit,
      brand: p.brand,
      price_date: p.price_date,
      price_trend: p.price_trend,
      formatted_price: `₦${Number(p.price).toLocaleString()}`,
    }));

    return NextResponse.json({
      success: true,
      data: formattedPrices,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + prices.length < total,
      },
    });
  } catch (error) {
    console.error("Price Query Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch prices" },
      { status: 500 }
    );
  }
}

// POST - Query with complex filters (for advanced searches)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      markets, // Array of market IDs
      categories, // Array of category IDs
      items, // Array of item IDs
      priceMin,
      priceMax,
      states, // Array of states
      dateFrom,
      dateTo,
      limit = 50,
      offset = 0,
    } = body;

    // Build complex where clause
    const where: any = {};

    if (markets?.length) where.market_id = { in: markets };
    if (categories?.length) where.category_id = { in: categories };
    if (items?.length) where.item_id = { in: items };
    if (states?.length) where.state = { in: states };

    // Price range filter
    if (priceMin || priceMax) {
      where.price = {};
      if (priceMin) where.price.gte = priceMin;
      if (priceMax) where.price.lte = priceMax;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      where.price_date = {};
      if (dateFrom) where.price_date.gte = new Date(dateFrom);
      if (dateTo) where.price_date.lte = new Date(dateTo);
    }

    const prices = await prisma.approved_Prices.findMany({
      where,
      take: Math.min(limit, 100),
      skip: offset,
      orderBy: { price_date: "desc" },
    });

    const total = await prisma.approved_Prices.count({ where });

    const formattedPrices = prices.map((p: any) => ({
      price_id: p.price_id,
      item_name: p.item_name,
      item_id: p.item_id,
      category_name: p.category_name,
      category_id: p.category_id,
      market_name: p.market_name,
      market_id: p.market_id,
      state: p.state,
      price: p.price,
      unit: p.unit,
      brand: p.brand,
      price_date: p.price_date,
      price_trend: p.price_trend,
      formatted_price: `₦${Number(p.price).toLocaleString()}`,
    }));

    return NextResponse.json({
      success: true,
      data: formattedPrices,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + prices.length < total,
      },
      filters_applied: {
        markets: markets?.length || 0,
        categories: categories?.length || 0,
        items: items?.length || 0,
        states: states?.length || 0,
        priceRange: priceMin || priceMax ? { min: priceMin, max: priceMax } : null,
        dateRange: dateFrom || dateTo ? { from: dateFrom, to: dateTo } : null,
      },
    });
  } catch (error) {
    console.error("Price Query Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch prices" },
      { status: 500 }
    );
  }
}
