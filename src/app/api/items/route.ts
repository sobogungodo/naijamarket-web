// src/app/api/items/route.ts
// NaijaMarket Intel - Items Catalog API
// FIXED: Correct column names matching Prisma schema exactly

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET - List items with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Support multiple parameter names for flexibility
    const categoryId = searchParams.get("category_id") || searchParams.get("category");
    const search = searchParams.get("search") || searchParams.get("q");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause
    const where: any = {
      status: "ACTIVE", // Only active items
    };

    // Filter by category_id (exact match)
    if (categoryId) {
      where.category_id = categoryId;
    }

    // Search by item name (contains)
    if (search) {
      where.item_name = {
        contains: search,
      };
    }

    // Get items from database
    const items = await prisma.items_Catalog.findMany({
      where,
      take: Math.min(limit, 500),
      skip: offset,
      orderBy: { item_name: "asc" },
    });

    // Get total count for pagination
    const total = await prisma.items_Catalog.count({ where });

    // Format response - USE EXACT COLUMN NAMES FROM PRISMA SCHEMA
    const formattedItems = items.map((item: any) => ({
      item_id: item.item_id,
      item_name: item.item_name,
      category_id: item.category_id,
      unit: item.Unit,                          // Schema has capital U
      measurement: item.measurement,
      wholesale_price: item.whole_sale_Price,   // Schema has capital P
      avg_measurement_price: item.Ave_Measurement_Price,
      average_unit_price: item.Average_Unit_Price,
      min_price: item.min_price,
      max_price: item.max_price,
      max_wholesale_price: item.Max_whole_sale_Price,
      status: item.status,
    }));

    return NextResponse.json({
      success: true,
      data: formattedItems,
      count: formattedItems.length,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + items.length < total,
      },
    });
  } catch (error) {
    console.error("Items API Error:", error);
    
    // Return detailed error in development
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch items",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}

// POST - Get single item details
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
        where: { 
          item_name: { 
            contains: item_name,
          } 
        },
      });
    }

    if (!item) {
      return NextResponse.json(
        { success: false, error: "Item not found" },
        { status: 404 }
      );
    }

    // Return with correct column mapping
    return NextResponse.json({
      success: true,
      data: {
        item_id: item.item_id,
        item_name: item.item_name,
        category_id: item.category_id,
        unit: item.Unit,
        measurement: item.measurement,
        wholesale_price: item.whole_sale_Price,
        avg_measurement_price: item.Ave_Measurement_Price,
        average_unit_price: item.Average_Unit_Price,
        min_price: item.min_price,
        max_price: item.max_price,
        max_wholesale_price: item.Max_whole_sale_Price,
        status: item.status,
        created_at: item.created_at,
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
