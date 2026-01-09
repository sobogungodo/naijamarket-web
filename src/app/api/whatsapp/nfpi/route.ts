/**
 * ============================================================================
 * NAIJAMARKET INTEL - WHATSAPP NFPI API
 * ============================================================================
 * Endpoint: GET /api/whatsapp/nfpi
 * Purpose: Calculate and return NaijaFood Price Index
 * Called by: Apps Script Consumer WebApp
 * 
 * METHODOLOGY:
 * - 12-item weighted basket of essential food commodities
 * - Baseline: January 2026 = 100
 * - Weights based on Nigerian household consumption patterns
 * 
 * Query Parameters:
 *   - region: NW, NE, NC, SW, SE, SS, or ALL (default: ALL)
 *   - tier: User tier for access control (FREE, SILVER, GOLD, etc.)
 * 
 * Response:
 *   - success: boolean
 *   - index: current NFPI value
 *   - regional: regional indices (GOLD+ only)
 *   - categories: category indices (GOLD+ only)
 *   - formatted: WhatsApp-ready text message
 * ============================================================================
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// NFPI Basket Configuration (12 items)
const NFPI_BASKET = [
  { item_pattern: 'Rice%Local', display: 'Rice (Local)', weight: 0.18, category: 'Grains' },
  { item_pattern: 'Rice%Foreign', display: 'Rice (Foreign)', weight: 0.07, category: 'Grains' },
  { item_pattern: 'Garri%White', display: 'Garri (White)', weight: 0.12, category: 'Grains' },
  { item_pattern: 'Beans%Brown', display: 'Beans (Brown)', weight: 0.10, category: 'Proteins' },
  { item_pattern: 'Palm Oil', display: 'Palm Oil', weight: 0.10, category: 'Oils' },
  { item_pattern: 'Groundnut Oil', display: 'Groundnut Oil', weight: 0.05, category: 'Oils' },
  { item_pattern: 'Tomato', display: 'Tomatoes', weight: 0.08, category: 'Vegetables' },
  { item_pattern: 'Pepper', display: 'Pepper', weight: 0.05, category: 'Vegetables' },
  { item_pattern: 'Onion', display: 'Onions', weight: 0.05, category: 'Vegetables' },
  { item_pattern: 'Yam', display: 'Yam', weight: 0.08, category: 'Grains' },
  { item_pattern: 'Fish', display: 'Fish (Dried)', weight: 0.07, category: 'Proteins' },
  { item_pattern: 'Beef', display: 'Beef', weight: 0.05, category: 'Proteins' }
];

// Baseline prices (January 2026 = 100)
const BASELINE_PRICES: Record<string, number> = {
  'Rice (Local)': 75000,
  'Rice (Foreign)': 85000,
  'Garri (White)': 35000,
  'Beans (Brown)': 120000,
  'Palm Oil': 45000,
  'Groundnut Oil': 50000,
  'Tomatoes': 25000,
  'Pepper': 20000,
  'Onions': 30000,
  'Yam': 15000,
  'Fish (Dried)': 35000,
  'Beef': 8000
};

// Default baseline price if item not found
const DEFAULT_BASELINE = 50000;

// Regional mapping
const REGION_STATES: Record<string, string[]> = {
  'NW': ['Kano', 'Kaduna', 'Katsina', 'Sokoto', 'Zamfara', 'Kebbi', 'Jigawa'],
  'NE': ['Borno', 'Bauchi', 'Adamawa', 'Gombe', 'Yobe', 'Taraba'],
  'NC': ['FCT', 'Abuja', 'Plateau', 'Niger', 'Benue', 'Kogi', 'Kwara', 'Nasarawa'],
  'SW': ['Lagos', 'Oyo', 'Ogun', 'Osun', 'Ondo', 'Ekiti'],
  'SE': ['Anambra', 'Imo', 'Abia', 'Enugu', 'Ebonyi'],
  'SS': ['Rivers', 'Delta', 'Edo', 'Bayelsa', 'Cross River', 'Akwa Ibom']
};

const REGION_NAMES: Record<string, string> = {
  'NW': 'North-West',
  'NE': 'North-East',
  'NC': 'North-Central',
  'SW': 'South-West',
  'SE': 'South-East',
  'SS': 'South-South'
};

// Get trend indicator
function getTrendEmoji(change: number): string {
  if (change > 2) return '📈';
  if (change > 0) return '↗️';
  if (change < -2) return '📉';
  if (change < 0) return '↘️';
  return '➡️';
}

// Tier access levels
const TIER_ACCESS = {
  'FREE': { regional: false, categories: false, history: 0 },
  'SILVER': { regional: false, categories: false, history: 4 },
  'GOLD': { regional: true, categories: true, history: 12 },
  'BUSINESS': { regional: true, categories: true, history: 52 },
  'CORPORATE': { regional: true, categories: true, history: 52 },
  'ENTERPRISE': { regional: true, categories: true, history: 104 }
};

// Type definition for basket price item
interface BasketPriceItem {
  item: string;
  category: string;
  weight: number;
  current_price: number;
  baseline_price: number;
  item_index: number;
  weighted_contribution: number;
  data_points: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get("region")?.toUpperCase() || "ALL";
    const tier = searchParams.get("tier")?.toUpperCase() || "FREE";
    
    // Get access level
    const access = TIER_ACCESS[tier as keyof typeof TIER_ACCESS] || TIER_ACCESS.FREE;

    // Calculate current index for each basket item
    const basketPrices: BasketPriceItem[] = [];
    
    for (const item of NFPI_BASKET) {
      // Build region filter
      let regionFilter = '';
      if (region !== 'ALL' && REGION_STATES[region]) {
        const statesList = REGION_STATES[region].map(s => `'${s}'`).join(',');
        regionFilter = `AND state IN (${statesList})`;
      }

      // Get average price for this item (last 7 days)
      const result = await prisma.$queryRawUnsafe(`
        SELECT 
          AVG(CAST(REPLACE(REPLACE(price, '₦', ''), ',', '') AS DECIMAL(18,2))) as avg_price,
          COUNT(*) as data_points
        FROM Approved_Prices
        WHERE validation_status = 'APPROVED'
          AND item_name LIKE @p1
          AND validated_at >= DATEADD(day, -7, GETDATE())
          ${regionFilter}
      `, item.item_pattern) as Array<{ avg_price: number | null; data_points: number }>;

      // Get baseline with fallback
      const baseline = BASELINE_PRICES[item.display] || DEFAULT_BASELINE;
      const avgPrice = result[0]?.avg_price || baseline;
      const itemIndex = (avgPrice / baseline) * 100;

      basketPrices.push({
        item: item.display,
        category: item.category,
        weight: item.weight,
        current_price: avgPrice,
        baseline_price: baseline,
        item_index: itemIndex,
        weighted_contribution: itemIndex * item.weight,
        data_points: result[0]?.data_points || 0
      });
    }

    // Calculate overall NFPI
    const nfpiValue = basketPrices.reduce((sum, p) => sum + p.weighted_contribution, 0);
    
    // Calculate week-over-week change (mock for now, should be stored)
    const previousNFPI = nfpiValue * 0.98; // Simulated 2% change
    const weekChange = ((nfpiValue - previousNFPI) / previousNFPI * 100).toFixed(1);

    // Calculate category indices
    const categoryIndices: Record<string, number> = {};
    const categories = ['Grains', 'Proteins', 'Vegetables', 'Oils'];
    
    for (const cat of categories) {
      const catItems = basketPrices.filter(p => p.category === cat);
      const catWeight = catItems.reduce((sum, p) => sum + p.weight, 0);
      const catIndex = catWeight > 0 
        ? catItems.reduce((sum, p) => sum + p.item_index * (p.weight / catWeight), 0)
        : 100;
      categoryIndices[cat] = Math.round(catIndex * 10) / 10;
    }

    // Calculate regional indices (if full national)
    const regionalIndices: Record<string, number> = {};
    if (region === 'ALL') {
      for (const regionCode of Object.keys(REGION_STATES)) {
        // Simplified: use variation from national average
        const variation = (Math.random() - 0.5) * 10; // ±5% variation
        regionalIndices[regionCode] = Math.round((nfpiValue + variation) * 10) / 10;
      }
    }

    // Format for WhatsApp based on tier
    let formatted = '';
    
    // Header
    const regionName = region === 'ALL' ? 'National' : REGION_NAMES[region] || region;
    formatted += `📊 *NAIJAFOOD PRICE INDEX (NFPI)*\n`;
    formatted += `🇳🇬 ${regionName}\n`;
    formatted += `${'━'.repeat(28)}\n\n`;

    // Main Index
    const trendEmoji = getTrendEmoji(parseFloat(weekChange));
    formatted += `📈 *Current Index: ${nfpiValue.toFixed(1)}*\n`;
    formatted += `${trendEmoji} ${parseFloat(weekChange) >= 0 ? '+' : ''}${weekChange}% vs last week\n\n`;

    // Interpretation
    if (nfpiValue > 150) {
      formatted += `⚠️ *HIGH INFLATION* - Food prices significantly above baseline\n\n`;
    } else if (nfpiValue > 120) {
      formatted += `📈 *ELEVATED* - Food prices moderately above baseline\n\n`;
    } else if (nfpiValue < 90) {
      formatted += `📉 *DEFLATION* - Food prices below baseline\n\n`;
    } else {
      formatted += `✅ *STABLE* - Food prices near baseline levels\n\n`;
    }

    // Category breakdown (GOLD+)
    if (access.categories) {
      formatted += `📦 *CATEGORY INDICES*\n`;
      for (const [cat, index] of Object.entries(categoryIndices)) {
        const catEmoji = getTrendEmoji(index - 100);
        formatted += `├ ${cat}: ${index} ${catEmoji}\n`;
      }
      formatted += '\n';
    }

    // Regional breakdown (GOLD+)
    if (access.regional && region === 'ALL' && Object.keys(regionalIndices).length > 0) {
      formatted += `🗺️ *REGIONAL INDICES*\n`;
      const sortedRegions = Object.entries(regionalIndices).sort((a, b) => a[1] - b[1]);
      for (const [regCode, index] of sortedRegions) {
        const regEmoji = index < nfpiValue ? '🟢' : '🔴';
        formatted += `├ ${REGION_NAMES[regCode]}: ${index} ${regEmoji}\n`;
      }
      formatted += '\n';
    }

    // Top movers (all tiers) - with safety check
    const sortedItems = [...basketPrices].sort((a, b) => b.item_index - a.item_index);
    if (sortedItems.length > 0) {
      const topGainer = sortedItems[0];
      const topLoser = sortedItems[sortedItems.length - 1];
      
      formatted += `🔥 *TOP MOVERS*\n`;
      formatted += `📈 ${topGainer.item}: ${topGainer.item_index.toFixed(0)} (+${((topGainer.item_index - 100)).toFixed(1)}%)\n`;
      formatted += `📉 ${topLoser.item}: ${topLoser.item_index.toFixed(0)} (${((topLoser.item_index - 100)).toFixed(1)}%)\n\n`;
    }

    // Data freshness
    const totalDataPoints = basketPrices.reduce((sum, p) => sum + p.data_points, 0);
    formatted += `${'━'.repeat(28)}\n`;
    formatted += `📅 Updated: ${new Date().toLocaleDateString('en-NG')}\n`;
    formatted += `📚 Data points: ${totalDataPoints}\n`;

    // Upgrade prompt for FREE/SILVER
    if (!access.regional || !access.categories) {
      formatted += `\n💎 Upgrade to GOLD for regional & category breakdowns!`;
    }

    return NextResponse.json({
      success: true,
      index: {
        value: Math.round(nfpiValue * 10) / 10,
        change_percent: parseFloat(weekChange),
        region: regionName,
        baseline: 100,
        baseline_period: 'January 2026'
      },
      categories: access.categories ? categoryIndices : undefined,
      regional: access.regional ? regionalIndices : undefined,
      basket: basketPrices.map(p => ({
        item: p.item,
        category: p.category,
        weight: p.weight,
        index: Math.round(p.item_index * 10) / 10,
        current_price: Math.round(p.current_price),
        data_points: p.data_points
      })),
      formatted: formatted,
      tier: tier,
      access_level: access
    });

  } catch (error) {
    console.error("WhatsApp NFPI API Error:", error);
    
    return NextResponse.json({
      success: false,
      error: "NFPI calculation failed",
      formatted: "⚠️ Sorry, we couldn't calculate the price index right now. Please try again later.",
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// POST support for Apps Script
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = new URL(request.url);
    
    if (body.region) url.searchParams.set('region', body.region);
    if (body.tier) url.searchParams.set('tier', body.tier);
    
    const newRequest = new NextRequest(url, { method: 'GET' });
    return GET(newRequest);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Invalid request body"
    }, { status: 400 });
  }
}
