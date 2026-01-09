// src/app/api/items/route.ts
// NaijaMarket Intel - Items Catalog API

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET - List items with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("category_id");
    const categoryName = searchParams.get("category");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause
    const where: any = {};

    if (categoryId) where.category_id = categoryId;
    if (categoryName) {
      where.category_name = { contains: categoryName };
    }
    if (search) {
      where.item_name = { contains: search };
    }

    // Get items
    const items = await prisma.items_Catalog.findMany({
      where,
      take: Math.min(limit, 500),
      skip: offset,
      orderBy: { item_name: "asc" },
    });

    const total = await prisma.items_Catalog.count({ where });

    const formattedItems = items.map((item: any) => ({
      item_id: item.item_id,
      item_name: item.item_name,
      category_id: item.category_id,
      category_name: item.category_name,
      unit: item.unit,
      description: item.description,
    }));

    return NextResponse.json({
      success: true,
      data: formattedItems,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + items.length < total,
      },
    });
  } catch (error) {
    console.error("Items Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch items" },
      { status: 500 }
    );
  }
}

// GET by ID - Get single item details
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { item_id, item_name } = body;

    let item;

    if (item_id) {
      item = await prisma.items_Catalog.findFirst({
        where: { item_id },
      });
    } else if (item_name) {
      item = await prisma.items_Catalog.findFirst({
        where: { item_name: { contains: item_name } },
      });
    }

    if (!item) {
      return NextResponse.json(
        { success: false, error: "Item not found" },
        { status: 404 }
      );
    }

    // Get latest prices for this item across markets
    const prices = await prisma.approved_Prices.findMany({
      where: { item_id: item.item_id },
      take: 10,
      
    });

    return NextResponse.json({
      success: true,
      data: {
        item,
        latest_prices: prices.map((p: any) => ({
          market_name: p.market_name,
          price: p.price,
          unit: p.unit,
          formatted_price: `₦${Number(p.price).toLocaleString()}`,
          price_date: p.price_date,
        })),
      },
    });
  } catch (error) {
    console.error("Item Detail Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch item details" },
      { status: 500 }
    );
  }
}
