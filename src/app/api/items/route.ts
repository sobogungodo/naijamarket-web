// ============================================================================
// src/app/api/items/route.ts
// NaijaFood Intel - Items Catalog API
// Version: 2.1 - FOOD-ONLY filter, $queryRawUnsafe for SQL Server TOP
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma as sharedPrisma } from "@/lib/db";

let prismaClient: any = null;
async function getPrisma() {
  if (!prismaClient) {
    const { PrismaClient } = await import("@prisma/client");
    prismaClient = sharedPrisma;
  }
  return prismaClient;
}

// Food-only category map (15 categories)
const CATEGORY_MAP: Record<string, string> = {
  CAT001: "Grains & Cereals",
  CAT002: "Vegetables & Peppers",
  CAT003: "Oils & Fats",
  CAT004: "Frozen Foods & Poultry",
  CAT005: "Beverages",
  CAT006: "Plantain",
  CAT007: "Seasoning & Spices",
  CAT008: "Dried Fish & Stockfish",
  CAT009: "Flour & Bakery",
  CAT010: "Bread",
  CAT013: "Dairy & Milk",
  CAT014: "Tubers & Yam",
  CAT015: "Beans & Legumes",
  CAT070: "Poultry & Livestock",
  CAT103: "Fish (NBS)",
};

const FOOD_CATEGORY_SQL = `('CAT001','CAT002','CAT003','CAT004','CAT005','CAT006','CAT007','CAT008','CAT009','CAT010','CAT013','CAT014','CAT015','CAT070','CAT103')`;

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

export async function GET(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    const { searchParams } = new URL(request.url);

    const search = (searchParams.get("search") || searchParams.get("q") || "").trim();
    const categoryId = (searchParams.get("category_id") || searchParams.get("category") || "").trim();
    const limit = Math.min(parseInt(searchParams.get("limit") || "300") || 300, 500);

    // Build WHERE clause — always include food filter
    let whereClause = `WHERE category_id IN ${FOOD_CATEGORY_SQL}`;
    if (search) {
      whereClause += ` AND item_name LIKE '%${esc(search)}%'`;
    }
    if (categoryId) {
      whereClause += ` AND category_id = '${esc(categoryId)}'`;
    }

    // $queryRawUnsafe needed for dynamic TOP + WHERE
    const query = `
      SELECT TOP ${limit}
        item_id, item_name, category_id,
        Unit as unit,
        whole_sale_Price as wholesale_price,
        Average_Unit_Price as avg_price,
        min_price, max_price, status
      FROM Items_Catalog WITH (NOLOCK)
      ${whereClause}
      ORDER BY category_id, item_name ASC
    `;

    const items = (await prisma.$queryRawUnsafe(query)) as any[];

    const formatted = items.map((item: any) => ({
      item_id: item.item_id,
      item_name: item.item_name,
      category_id: String(item.category_id || ""),
      category_name: CATEGORY_MAP[String(item.category_id || "")] || "Food",
      unit: item.unit || "",
      wholesale_price: parseFloat(item.wholesale_price) || 0,
      avg_price: parseFloat(item.avg_price) || 0,
      min_price: parseFloat(item.min_price) || 0,
      max_price: parseFloat(item.max_price) || 0,
      status: item.status || "ACTIVE",
    }));

    // Category summary
    const categorySummary = Object.entries(CATEGORY_MAP).map(([id, name]) => ({
      category_id: id,
      category_name: name,
      item_count: formatted.filter(i => i.category_id === id).length,
    })).filter(c => c.item_count > 0);

    return NextResponse.json({
      success: true,
      data: formatted,
      count: formatted.length,
      categories: categorySummary,
      total_food_categories: Object.keys(CATEGORY_MAP).length,
    });

  } catch (error: any) {
    console.error("Items API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load items", data: [] },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
