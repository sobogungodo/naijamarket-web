// src/app/api/categories/route.ts
// NaijaMarket Intel - Categories API

import { NextRequest, NextResponse } from "next/server";
import { prisma as sharedPrisma } from "@/lib/db";
import { PrismaClient } from "@prisma/client";

const prisma = sharedPrisma;

// GET - List all categories
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    // const marketId = searchParams.get("market_id");
    const withItems = searchParams.get("with_items") === "true";

    // Get categories
    const categories = await prisma.categories.findMany({
      orderBy: { category_name: "asc" },
    });

    // If with_items, get items for each category
    if (withItems) {
      const categoriesWithItems = await Promise.all(
        categories.map(async (cat: any) => {
          const items = await prisma.items_Catalog.findMany({
            where: { category_id: cat.category_id },
            orderBy: { item_name: "asc" },
          });
          return {
            ...cat,
            items: items.map((item: any) => ({
              item_id: item.item_id,
              item_name: item.item_name,
              unit: item.unit,
            })),
            item_count: items.length,
          };
        })
      );

      return NextResponse.json({
        success: true,
        data: categoriesWithItems,
        count: categoriesWithItems.length,
      });
    }

    // Return categories only
    const formattedCategories = categories.map((cat: any) => ({
      category_id: cat.category_id,
      category_name: cat.category_name,
      category_code: cat.category_code,
      emoji: getCategoryEmoji(cat.category_name),
    }));

    return NextResponse.json({
      success: true,
      data: formattedCategories,
      count: formattedCategories.length,
    });
  } catch (error) {
    console.error("Categories Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

// Helper function to get category emoji
function getCategoryEmoji(categoryName: string): string {
  const emojiMap: Record<string, string> = {
    "Grains": "🌾",
    "Grains & Cereals": "🌾",
    "Rice": "🍚",
    "Beans": "🫘",
    "Proteins": "🍖",
    "Meat": "🥩",
    "Fish": "🐟",
    "Poultry": "🍗",
    "Vegetables": "🥬",
    "Fruits": "🍎",
    "Oils": "🫒",
    "Cooking Oil": "🫒",
    "Dairy": "🥛",
    "Spices": "🌶️",
    "Tubers": "🥔",
    "Root Crops": "🥔",
    "Beverages": "🥤",
    "Snacks": "🍪",
    "Condiments": "🧂",
    "Flour": "🌾",
    "Sugar": "🍬",
    "Pasta": "🍝",
    "Canned Goods": "🥫",
    "Building Materials": "🧱",
    "Electronics": "📱",
    "Textiles": "👕",
    "Default": "📦",
  };

  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (categoryName.toLowerCase().includes(key.toLowerCase())) {
      return emoji;
    }
  }
  return emojiMap["Default"] || "??";
}
