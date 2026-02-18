// ============================================================================
// NAIJAMARKET INTEL - ARBITRAGE OPPORTUNITIES API
// File: src/app/api/arbitrage/route.ts
// Bloomberg Equivalent: ARBI <GO>
// Version: 4.0 - Real GPS from Markets table, Nigerian transport cost model
// Date: 2026-02-18
//
// TRANSPORT COST MODEL (Feb 2026):
//   Diesel: ₦907.5/litre | Truck: ~3km/litre | ~₦302/km fuel cost
//   30-ton truck total cost: ~₦450/km (fuel + driver + maintenance)
//   Per 50kg bag shared-truck rate: ₦3-5/km (fragmentation premium)
//   Fixed costs: loading ₦800 + offloading ₦700 = ₦1,500/bag
//   Checkpoint levies: ₦50,000-100,000/trip spread across cargo
//
// Sources: NBS Transport Fare Watch, NARTO, Nigerian Shippers Council,
//   Mordor Intelligence Nigeria Freight Report 2025-2030
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// SINGLETON PRISMA
// ============================================================================

let prismaClient: any = null;

async function getPrisma() {
  if (!prismaClient) {
    const { PrismaClient } = await import("@prisma/client");
    prismaClient = new PrismaClient();
  }
  return prismaClient;
}

// ============================================================================
// TYPES
// ============================================================================

interface TierConfig {
  hasAccess: boolean;
  minProfitFloor: number;
  maxResults: number;
}

interface MarketGPS {
  lat: number;
  lon: number;
  state: string;
}

interface TransportResult {
  distance: number;
  fuelCost: number;
  loadingCost: number;
  checkpointCost: number;
  totalCost: number;
  label: string;
  ratePerKm: number;
}

interface ConfidenceResult {
  score: number;
  label: string;
  color: string;
}

interface ArbitrageOpportunity {
  id: string;
  itemId: string;
  itemName: string;
  categoryName: string;
  unit: string;
  buyMarket: {
    id: string; name: string; state: string; price: number; updatedAt: string;
  };
  sellMarket: {
    id: string; name: string; state: string; price: number; updatedAt: string;
  };
  grossProfit: number;
  transportCost: number;
  netProfit: number;
  profitPercentage: number;
  distance: number;
  confidence: ConfidenceResult;
  transportLabel: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CATEGORY_MAP: Record<string, string> = {
  "1": "Grains & Cereals", "2": "Tubers", "3": "Vegetables", "4": "Fruits",
  "5": "Oils & Fats", "6": "Protein", "7": "Dairy", "8": "Sweeteners",
  "9": "Beverages", "10": "Building Materials", "11": "Livestock",
  "12": "Fish & Seafood", "13": "Condiments", "14": "Processed Foods",
};

// ── NIGERIAN TRANSPORT COST MODEL (Feb 2026) ───────────────────────────
// Based on: Diesel ₦907.5/L, truck ~3km/L, shared truck rates from NARTO
//
// COST PER 50KG BAG = Fixed + Variable
//   Fixed: ₦1,500 (loading ₦800 + offloading ₦700)
//   Variable: distance × rate_per_km
//
// Rate tiers (₦/km per 50kg bag) - decreasing with distance (economies of scale)
// Short haul trucks charge more per-km, long haul spread costs better
const TRANSPORT_RATE_TIERS = [
  { maxKm: 30,   ratePerKm: 25,  label: "Same City (Danfo/Keke)" },
  { maxKm: 80,   ratePerKm: 15,  label: "Same State" },
  { maxKm: 200,  ratePerKm: 10,  label: "Neighboring State" },
  { maxKm: 400,  ratePerKm: 8,   label: "Regional" },
  { maxKm: 700,  ratePerKm: 6,   label: "Long Distance" },
  { maxKm: 1200, ratePerKm: 5,   label: "Cross Country" },
  { maxKm: 99999, ratePerKm: 4.5, label: "Extreme Distance" },
];

// Fixed costs per 50kg bag
const LOADING_COST = 800;     // Loading at origin market
const OFFLOADING_COST = 700;  // Offloading at destination market
const FIXED_COST = LOADING_COST + OFFLOADING_COST; // ₦1,500

// Checkpoint/security levy per km (spread per bag)
// Based on Mordor Intelligence: ₦50K-100K per trip / ~600 bags = ₦83-167/bag
// We model as per-km since longer routes = more checkpoints
const CHECKPOINT_RATE_PER_KM = 0.5; // ₦0.50/km per bag

// Road condition multiplier by region (bad roads = slower = more expensive)
const ROAD_QUALITY: Record<string, number> = {
  "Lagos": 1.15,      // Apapa gridlock, heavy traffic
  "Ogun": 1.05,
  "Oyo": 1.0,
  "Osun": 1.0,
  "Ondo": 1.05,
  "Ekiti": 1.10,
  "FCT": 0.95,        // Best roads in Nigeria
  "Abuja": 0.95,
  "Kano": 1.0,
  "Kaduna": 1.05,
  "Katsina": 1.10,
  "Sokoto": 1.15,
  "Kebbi": 1.15,
  "Zamfara": 1.20,     // Security premium
  "Jigawa": 1.10,
  "Borno": 1.30,       // Security premium (insurgency corridor)
  "Yobe": 1.25,
  "Adamawa": 1.20,
  "Bauchi": 1.10,
  "Gombe": 1.10,
  "Taraba": 1.15,
  "Niger": 1.15,       // Banditry corridor
  "Kwara": 1.0,
  "Kogi": 1.05,
  "Benue": 1.10,
  "Plateau": 1.10,
  "Nasarawa": 1.05,
  "Anambra": 1.0,
  "Enugu": 1.0,
  "Ebonyi": 1.10,
  "Imo": 1.05,
  "Abia": 1.05,
  "Rivers": 1.10,
  "Delta": 1.05,
  "Bayelsa": 1.15,
  "Akwa Ibom": 1.10,
  "Cross River": 1.10,
  "Edo": 1.0,
};

const DEFAULT_TIER_CONFIG: TierConfig = { hasAccess: false, minProfitFloor: 100, maxResults: 0 };

const TIER_ACCESS: Record<string, TierConfig> = {
  FREE: { hasAccess: false, minProfitFloor: 100, maxResults: 0 },
  SILVER: { hasAccess: false, minProfitFloor: 100, maxResults: 0 },
  GOLD: { hasAccess: true, minProfitFloor: 2, maxResults: 25 },
  BUSINESS: { hasAccess: true, minProfitFloor: 1, maxResults: 50 },
  BUSINESS_PLUS: { hasAccess: true, minProfitFloor: 0, maxResults: 75 },
  CORPORATE: { hasAccess: true, minProfitFloor: 0, maxResults: 100 },
  ENTERPRISE: { hasAccess: true, minProfitFloor: 0, maxResults: 200 },
  OGA_BOSS: { hasAccess: true, minProfitFloor: 0, maxResults: 200 },
  GOVERNMENT: { hasAccess: true, minProfitFloor: 0, maxResults: 200 },
};

// ============================================================================
// GPS CACHE — loaded once from Markets table (226 markets)
// ============================================================================

let gpsCache: Record<string, MarketGPS> | null = null;
let gpsCacheTime = 0;
const GPS_CACHE_TTL = 3600000; // 1 hour

async function getMarketCoordinates(prisma: any): Promise<Record<string, MarketGPS>> {
  const now = Date.now();
  if (gpsCache && (now - gpsCacheTime) < GPS_CACHE_TTL) {
    return gpsCache;
  }

  try {
    const markets = await prisma.$queryRaw`
      SELECT market_name, state, latitude, longitude
      FROM Markets WITH (NOLOCK)
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        AND latitude != 0 AND longitude != 0
    ` as any[];

    const coords: Record<string, MarketGPS> = {};
    for (const m of markets) {
      const lat = parseFloat(m.latitude);
      const lon = parseFloat(m.longitude);
      if (lat && lon && lat > 3 && lat < 15 && lon > 2 && lon < 16) {
        coords[m.market_name] = { lat, lon, state: m.state || "" };
      }
    }

    if (Object.keys(coords).length > 0) {
      gpsCache = coords;
      gpsCacheTime = now;
      console.log(`[Arbitrage] GPS cache loaded: ${Object.keys(coords).length} markets`);
    }

    return coords;
  } catch (e: any) {
    console.warn("[Arbitrage] Failed to load GPS from Markets table:", e.message?.substring(0, 100));
    return gpsCache || {};
  }
}

// ============================================================================
// TRANSPORT COST CALCULATOR
// ============================================================================

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  // Multiply by 1.3 for road distance (roads aren't straight lines)
  return Math.round(R * c * 1.3);
}

function getTransportCost(
  fromMarket: string, 
  toMarket: string,
  fromState: string,
  toState: string,
  coords: Record<string, MarketGPS>
): TransportResult {
  const from = coords[fromMarket];
  const to = coords[toMarket];

  if (!from || !to) {
    // Fallback: estimate from state if we know them
    const estDistance = fromState === toState ? 50 : 400;
    return estimateTransport(estDistance, fromState, toState);
  }

  const distance = calculateDistance(from.lat, from.lon, to.lat, to.lon);
  return estimateTransport(distance, from.state || fromState, to.state || toState);
}

function estimateTransport(distance: number, fromState: string, toState: string): TransportResult {
  // Find rate tier
  let ratePerKm = 5;
  let label = "Estimated";

  for (const tier of TRANSPORT_RATE_TIERS) {
    if (distance <= tier.maxKm) {
      ratePerKm = tier.ratePerKm;
      label = tier.label;
      break;
    }
  }

  // Road quality multiplier (average of origin and destination)
  const fromMultiplier = ROAD_QUALITY[fromState] || 1.05;
  const toMultiplier = ROAD_QUALITY[toState] || 1.05;
  const roadMultiplier = (fromMultiplier + toMultiplier) / 2;

  // Calculate costs
  const fuelAndHaulage = Math.round(distance * ratePerKm * roadMultiplier);
  const checkpointCost = Math.round(distance * CHECKPOINT_RATE_PER_KM);
  const totalCost = FIXED_COST + fuelAndHaulage + checkpointCost;

  return {
    distance,
    fuelCost: fuelAndHaulage,
    loadingCost: FIXED_COST,
    checkpointCost,
    totalCost,
    label,
    ratePerKm: Math.round(ratePerKm * roadMultiplier * 10) / 10,
  };
}

// ============================================================================
// CONFIDENCE SCORER
// ============================================================================

function calculateConfidence(priceDate: string | Date | null): ConfidenceResult {
  if (!priceDate) return { score: 50, label: "Unknown", color: "gray" };
  const now = new Date();
  const date = priceDate instanceof Date ? priceDate : new Date(priceDate);
  const daysOld = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

  if (daysOld < 1) return { score: 95, label: "Very Fresh", color: "green" };
  if (daysOld < 3) return { score: 85, label: "Fresh", color: "green" };
  if (daysOld < 7) return { score: 65, label: "Recent", color: "yellow" };
  if (daysOld < 14) return { score: 45, label: "Moderate", color: "orange" };
  return { score: 25, label: "Stale", color: "red" };
}

// ============================================================================
// TIER HELPERS
// ============================================================================

function getTierConfig(tier: string): TierConfig {
  return TIER_ACCESS[tier] || TIER_ACCESS["FREE"] || DEFAULT_TIER_CONFIG;
}

// ============================================================================
// ARBITRAGE FINDER
// ============================================================================

async function findArbitrageOpportunities(
  prisma: any,
  minProfitPct: number,
  maxResults: number,
  filterItem?: string,
  filterCategory?: string
): Promise<ArbitrageOpportunity[]> {
  // Load GPS coordinates from Markets table (cached 1hr)
  const coords = await getMarketCoordinates(prisma);

  // Build SQL filters
  const itemFilter = filterItem ? `AND item_name LIKE '%${filterItem.replace(/'/g, "''")}%'` : "";
  const categoryFilter = filterCategory ? `AND category_id = '${filterCategory.replace(/'/g, "''")}'` : "";

  // Get latest prices from Summary table
  const prices = await prisma.$queryRawUnsafe(`
    SELECT 
      item_name, market_name, state, category_id, unit,
      CAST(price_naira AS FLOAT) as price,
      price_date
    FROM Latest_Prices_Summary WITH (NOLOCK)
    WHERE price_naira > 0
      ${itemFilter}
      ${categoryFilter}
    ORDER BY item_name, market_name
  `) as any[];

  if (prices.length === 0) return [];

  // Group by item
  const pricesByItem: Record<string, typeof prices> = {};
  for (const p of prices) {
    const key = p.item_name || "unknown";
    if (!pricesByItem[key]) pricesByItem[key] = [];
    pricesByItem[key].push(p);
  }

  const opportunities: ArbitrageOpportunity[] = [];

  for (const [itemName, itemPrices] of Object.entries(pricesByItem)) {
    if (itemPrices.length < 2) continue;

    // OUTLIER FILTER: median ±25%
    const sorted = itemPrices.map(p => parseFloat(p.price) || 0).filter(p => p > 0).sort((a, b) => a - b);
    if (sorted.length < 2) continue;
    const median = sorted[Math.floor(sorted.length / 2)];
    if (median <= 0) continue;
    const lower = median * 0.75;
    const upper = median * 1.25;

    const valid = itemPrices.filter(p => {
      const price = parseFloat(p.price) || 0;
      return price >= lower && price <= upper;
    });
    if (valid.length < 2) continue;

    // Compare pairs
    for (let i = 0; i < valid.length; i++) {
      for (let j = i + 1; j < valid.length; j++) {
        const a = valid[i];
        const b = valid[j];
        const priceA = parseFloat(a.price) || 0;
        const priceB = parseFloat(b.price) || 0;
        if (priceA <= 0 || priceB <= 0) continue;
        if (Math.abs(priceA - priceB) < 50) continue;

        const [buyRec, sellRec, buyPrice, sellPrice] = priceA < priceB
          ? [a, b, priceA, priceB]
          : [b, a, priceB, priceA];

        const buyMarket = buyRec.market_name || "";
        const sellMarket = sellRec.market_name || "";
        if (buyMarket === sellMarket) continue;

        // Calculate real transport cost
        const transport = getTransportCost(
          buyMarket, sellMarket,
          buyRec.state || "", sellRec.state || "",
          coords
        );

        const grossProfit = sellPrice - buyPrice;
        const netProfit = grossProfit - transport.totalCost;
        if (netProfit <= 0) continue;

        const profitPct = (netProfit / buyPrice) * 100;
        if (profitPct < minProfitPct) continue;
        if (profitPct > 30) continue; // Data anomaly cap

        const buyConf = calculateConfidence(buyRec.price_date);
        const sellConf = calculateConfidence(sellRec.price_date);
        const avgScore = Math.round((buyConf.score + sellConf.score) / 2);

        const catId = String(buyRec.category_id || "");

        opportunities.push({
          id: `${itemName}-${buyMarket}-${sellMarket}`.replace(/\s+/g, "-").toLowerCase(),
          itemId: catId,
          itemName,
          categoryName: CATEGORY_MAP[catId] || `Category ${catId}`,
          unit: buyRec.unit || "unit",
          buyMarket: {
            id: buyMarket, name: buyMarket, state: buyRec.state || "",
            price: Math.round(buyPrice),
            updatedAt: buyRec.price_date?.toISOString?.() || String(buyRec.price_date || ""),
          },
          sellMarket: {
            id: sellMarket, name: sellMarket, state: sellRec.state || "",
            price: Math.round(sellPrice),
            updatedAt: sellRec.price_date?.toISOString?.() || String(sellRec.price_date || ""),
          },
          grossProfit: Math.round(grossProfit),
          transportCost: transport.totalCost,
          netProfit: Math.round(netProfit),
          profitPercentage: Math.round(profitPct * 10) / 10,
          distance: transport.distance,
          confidence: {
            score: avgScore,
            label: avgScore >= 75 ? "High" : avgScore >= 50 ? "Medium" : "Low",
            color: avgScore >= 75 ? "green" : avgScore >= 50 ? "yellow" : "red",
          },
          transportLabel: transport.label,
        });
      }
    }
  }

  opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
  return opportunities.slice(0, maxResults);
}

// ============================================================================
// GET — List arbitrage opportunities
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    const { searchParams } = new URL(request.url);

    const tier = (searchParams.get("tier") || "FREE").toUpperCase();
    const item = searchParams.get("item") || undefined;
    const category = searchParams.get("category") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const userMinProfit = searchParams.get("minProfit");

    const tierConfig = getTierConfig(tier);

    if (!tierConfig.hasAccess) {
      return NextResponse.json({
        success: false,
        error: "upgrade_required",
        message: "Arbitrage feature requires GOLD tier or higher",
        requiredTier: "GOLD",
        currentTier: tier,
      }, { status: 403 });
    }

    const minProfit = userMinProfit !== null
      ? Math.max(parseFloat(userMinProfit) || 0, tierConfig.minProfitFloor)
      : tierConfig.minProfitFloor;

    const allOpportunities = await findArbitrageOpportunities(
      prisma, minProfit, tierConfig.maxResults, item, category
    );

    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;
    const opportunities = allOpportunities.slice(startIdx, endIdx);

    return NextResponse.json({
      success: true,
      data: {
        opportunities,
        pagination: {
          page, limit,
          total: allOpportunities.length,
          totalPages: Math.ceil(allOpportunities.length / limit),
          hasMore: endIdx < allOpportunities.length,
        },
        tierInfo: {
          tier,
          minProfitFloor: tierConfig.minProfitFloor,
          appliedMinProfit: minProfit,
          maxResults: tierConfig.maxResults,
        },
        meta: {
          generatedAt: new Date().toISOString(),
          transportModel: "Nigerian Logistics Feb 2026",
          dieselPrice: "₦907.5/litre",
          gpsSource: "Markets table (226 markets)",
          dataSource: "Latest_Prices_Summary",
        },
      },
    });

  } catch (error) {
    console.error("[Arbitrage API Error]", error);
    return NextResponse.json({
      success: false, error: "server_error",
      message: "Failed to fetch arbitrage opportunities",
    }, { status: 500 });
  }
}

// ============================================================================
// POST — Detailed arbitrage analysis for a specific pair
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    const body = await request.json();
    const { buyMarket, sellMarket, itemName, tier = "FREE" } = body;

    const tierConfig = getTierConfig(tier.toUpperCase());
    if (!tierConfig.hasAccess) {
      return NextResponse.json({
        success: false, error: "upgrade_required",
        message: "Arbitrage feature requires GOLD tier or higher",
      }, { status: 403 });
    }

    const coords = await getMarketCoordinates(prisma);

    const itemSearch = (itemName || "").replace(/'/g, "''");
    const buySearch = (buyMarket || "").replace(/'/g, "''");
    const sellSearch = (sellMarket || "").replace(/'/g, "''");

    const results = await prisma.$queryRawUnsafe(`
      SELECT item_name, market_name, state, category_id, unit,
        CAST(price_naira AS FLOAT) as price, price_date
      FROM Latest_Prices_Summary WITH (NOLOCK)
      WHERE item_name LIKE '%${itemSearch}%'
        AND (market_name = '${buySearch}' OR market_name = '${sellSearch}')
        AND price_naira > 0
    `) as any[];

    const buyPrice = results.find((r: any) => r.market_name === buyMarket);
    const sellPrice = results.find((r: any) => r.market_name === sellMarket);

    if (!buyPrice || !sellPrice) {
      return NextResponse.json({
        success: false, error: "not_found",
        message: "Price data not found for specified markets/item",
      }, { status: 404 });
    }

    const buyNum = parseFloat(buyPrice.price) || 0;
    const sellNum = parseFloat(sellPrice.price) || 0;

    const transport = getTransportCost(
      buyMarket, sellMarket,
      buyPrice.state || "", sellPrice.state || "",
      coords
    );

    const quantities = [1, 5, 10, 25, 50, 100];
    const profitBreakdown = quantities.map(qty => {
      const totalBuy = buyNum * qty;
      const totalSell = sellNum * qty;
      const totalTransport = transport.totalCost * qty;
      const totalNet = totalSell - totalBuy - totalTransport;
      const roi = (totalBuy + totalTransport) > 0
        ? (totalNet / (totalBuy + totalTransport)) * 100
        : 0;
      return {
        quantity: qty,
        buyCost: Math.round(totalBuy),
        sellRevenue: Math.round(totalSell),
        transportCost: Math.round(totalTransport),
        netProfit: Math.round(totalNet),
        roi: Math.round(roi * 10) / 10,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        item: {
          name: buyPrice.item_name,
          category: CATEGORY_MAP[String(buyPrice.category_id)] || "Other",
          unit: buyPrice.unit,
        },
        buyMarket: {
          name: buyMarket, state: buyPrice.state,
          price: Math.round(buyNum),
          confidence: calculateConfidence(buyPrice.price_date),
        },
        sellMarket: {
          name: sellMarket, state: sellPrice.state,
          price: Math.round(sellNum),
          confidence: calculateConfidence(sellPrice.price_date),
        },
        transport: {
          distance: transport.distance,
          fuelCost: transport.fuelCost,
          loadingCost: transport.loadingCost,
          checkpointCost: transport.checkpointCost,
          totalCostPerUnit: transport.totalCost,
          label: transport.label,
          ratePerKm: transport.ratePerKm,
          model: "Nigerian Logistics Feb 2026 (Diesel ₦907.5/L)",
        },
        profitAnalysis: {
          unitPriceSpread: Math.round(sellNum - buyNum),
          unitNetProfit: Math.round(sellNum - buyNum - transport.totalCost),
          unitProfitPct: Math.round(((sellNum - buyNum - transport.totalCost) / buyNum) * 1000) / 10,
          breakdown: profitBreakdown,
        },
      },
    });

  } catch (error) {
    console.error("[Arbitrage Detail API Error]", error);
    return NextResponse.json({
      success: false, error: "server_error",
      message: "Failed to analyze arbitrage opportunity",
    }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
