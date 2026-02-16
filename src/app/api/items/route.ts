// ============================================================================
// src/app/api/items/route.ts
// NaijaMarket Intel - Items Catalog API
// Version: 2.0 - Uses $queryRaw for SQL Server (no mode: "insensitive")
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

// Singleton Prisma
let prismaClient: any = null;
async function getPrisma() {
  if (!prismaClient) {
    const { PrismaClient } = await import("@prisma/client");
    prismaClient = new PrismaClient();
  }
  return prismaClient;
}

const CATEGORY_MAP: Record<string, string> = {
  "1": "Grains & Cereals", "2": "Tubers", "3": "Vegetables", "4": "Fruits",
  "5": "Oils & Fats", "6": "Protein", "7": "Dairy", "8": "Sweeteners",
  "9": "Beverages", "10": "Building Materials", "11": "Livestock",
  "12": "Fish & Seafood", "13": "Condiments", "14": "Processed Foods",
};

export async function GET(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || searchParams.get("q") || "";
    const categoryId = searchParams.get("category_id") || searchParams.get("category") || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);

    const searchLike = `%${search}%`;

    const items = await prisma.$queryRaw`
      SELECT TOP ${limit}
        item_id,
        item_name,
        category_id,
        Unit as unit,
        whole_sale_Price as wholesale_price,
        Average_Unit_Price as avg_price,
        min_price,
        max_price,
        status
      FROM Items_Catalog
      WHERE 1=1
        AND (${search} = '' OR item_name LIKE ${searchLike})
        AND (${categoryId} = '' OR CAST(category_id AS VARCHAR(20)) = ${categoryId})
      ORDER BY item_name ASC
    ` as any[];

    const formatted = items.map((item: any) => ({
      item_id: item.item_id,
      item_name: item.item_name,
      category_id: String(item.category_id || ""),
      category_name: CATEGORY_MAP[String(item.category_id || "")] || "General",
      unit: item.unit || "",
      wholesale_price: parseFloat(item.wholesale_price) || 0,
      avg_price: parseFloat(item.avg_price) || 0,
      min_price: parseFloat(item.min_price) || 0,
      max_price: parseFloat(item.max_price) || 0,
      status: item.status || "ACTIVE",
    }));

    return NextResponse.json({
      success: true,
      data: formatted,
      count: formatted.length,
    });

  } catch (error: any) {
    console.error("Items API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message?.substring(0, 200), data: [] },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
