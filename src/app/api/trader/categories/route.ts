// ============================================================================
// FILE: src/app/api/trader/categories/route.ts
// PURPOSE: Get commodity categories for trader submission flow
// FIX: Handles missing super_category column gracefully
// ============================================================================

import { NextResponse } from 'next/server';
import { prisma as sharedPrisma } from "@/lib/db";
import { PrismaClient } from '@prisma/client';

const prisma = sharedPrisma;

// Hardcoded categories as fallback (always works)
const DEFAULT_CATEGORIES = [
  {
    id: 'food',
    name: 'Food Items',
    icon: '🍚',
    description: 'Rice, Beans, Garri, Tomatoes, Onions, Oil, etc.',
    itemCount: 50
  },
  {
    id: 'building',
    name: 'Building Materials',
    icon: '🧱',
    description: 'Cement, Iron Rods, Zinc, Blocks, Sand, Paint, etc.',
    itemCount: 25
  },
  {
    id: 'manufacturing',
    name: 'Manufacturing Materials',
    icon: '🏭',
    description: 'Leather, Fabric, Thread, Foam, Buttons, etc.',
    itemCount: 15
  }
];

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('Categories API: Starting request');
    
    // Try to get categories from database
    let categories = await getCategoriesFromDatabase();
    
    // If database returns empty or fails, use defaults
    if (!categories || categories.length === 0) {
      console.log('Categories API: Using default categories');
      categories = DEFAULT_CATEGORIES;
    }
    
    console.log(`Categories API: Returning ${categories.length} categories`);
    
    return NextResponse.json({
      success: true,
      categories,
      source: categories === DEFAULT_CATEGORIES ? 'default' : 'database'
    });
    
  } catch (error) {
    console.error('Categories API error:', error);
    
    // Always return defaults on error - don't break the UI
    return NextResponse.json({
      success: true,
      categories: DEFAULT_CATEGORIES,
      source: 'default_fallback'
    });
  }
}

async function getCategoriesFromDatabase() {
  try {
    // First, check if super_category column exists
    const columnCheck = await prisma.$queryRaw<any[]>`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Items_Catalog' 
      AND COLUMN_NAME = 'super_category'
    `;
    
    const hasSuperCategory = columnCheck && columnCheck.length > 0;
    console.log(`Categories API: super_category column exists = ${hasSuperCategory}`);
    
    if (hasSuperCategory) {
      // Use super_category column
      const result = await prisma.$queryRaw<any[]>`
        SELECT 
          super_category as id,
          super_category as name,
          COUNT(*) as itemCount
        FROM Items_Catalog
        WHERE super_category IS NOT NULL
        GROUP BY super_category
        ORDER BY super_category
      `;
      
      if (result && result.length > 0) {
        return result.map((row: any) => ({
          id: row.id?.toLowerCase() || 'other',
          name: formatCategoryName(row.name),
          icon: getCategoryIcon(row.id),
          description: getCategoryDescription(row.id),
          itemCount: Number(row.itemCount) || 0
        }));
      }
    }
    
    // Fallback: Check if there's a category_id or category column
    const altColumnCheck = await prisma.$queryRaw<any[]>`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Items_Catalog' 
      AND COLUMN_NAME IN ('category_id', 'category', 'item_category')
    `;
    
    if (altColumnCheck && altColumnCheck.length > 0) {
      const columnName = altColumnCheck[0].COLUMN_NAME;
      console.log(`Categories API: Using alternative column: ${columnName}`);
      
      // Dynamic query based on found column
      const result = await prisma.$queryRaw<any[]>`
        SELECT 
          ${columnName} as id,
          ${columnName} as name,
          COUNT(*) as itemCount
        FROM Items_Catalog
        WHERE ${columnName} IS NOT NULL
        GROUP BY ${columnName}
        ORDER BY ${columnName}
      `;
      
      if (result && result.length > 0) {
        return result.map((row: any) => ({
          id: String(row.id || 'other').toLowerCase(),
          name: formatCategoryName(row.name),
          icon: getCategoryIcon(row.id),
          description: getCategoryDescription(row.id),
          itemCount: Number(row.itemCount) || 0
        }));
      }
    }
    
    // No category column found - return null to trigger defaults
    console.log('Categories API: No category column found in Items_Catalog');
    return null;
    
  } catch (error) {
    console.error('Categories API: Database query failed:', error);
    return null;
  }
}

function formatCategoryName(name: string | null): string {
  if (!name) return 'Other Items';
  
  const nameMap: Record<string, string> = {
    'food': 'Food Items',
    'building': 'Building Materials',
    'manufacturing': 'Manufacturing Materials',
    'other': 'Other Items'
  };
  
  const lower = name.toLowerCase();
  return nameMap[lower] || name.charAt(0).toUpperCase() + name.slice(1) + ' Items';
}

function getCategoryIcon(categoryId: string | null): string {
  if (!categoryId) return '📦';
  
  const iconMap: Record<string, string> = {
    'food': '🍚',
    'building': '🧱',
    'manufacturing': '🏭',
    'other': '📦'
  };
  
  return iconMap[categoryId.toLowerCase()] || '📦';
}

function getCategoryDescription(categoryId: string | null): string {
  if (!categoryId) return 'Other commodities';
  
  const descMap: Record<string, string> = {
    'food': 'Rice, Beans, Garri, Tomatoes, Onions, Oil, etc.',
    'building': 'Cement, Iron Rods, Zinc, Blocks, Sand, Paint, etc.',
    'manufacturing': 'Leather, Fabric, Thread, Foam, Buttons, etc.',
    'other': 'Other commodities and materials'
  };
  
  return descMap[categoryId.toLowerCase()] || 'Various commodities';
}
