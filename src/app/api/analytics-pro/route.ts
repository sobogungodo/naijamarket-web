// src/app/api/analytics-pro/route.ts
// NAIJAMARKET INTEL - Analytics Pro API
// Fetches data from Azure SQL reporting views for the enhanced dashboard

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import sql from 'mssql';

// =============================================================================
// DATABASE CONFIGURATION
// =============================================================================

const sqlConfig: sql.config = {
  user: process.env.AZURE_SQL_USER || 'igiiwe',
  password: process.env.AZURE_SQL_PASSWORD,
  server: process.env.AZURE_SQL_SERVER || 'naijafood.database.windows.net',
  database: process.env.AZURE_SQL_DATABASE || 'naijafoodmarket',
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 30000,
    requestTimeout: 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// =============================================================================
// TIER CONFIGURATION
// =============================================================================

const TIER_DAYS_ACCESS: Record<string, number> = {
  FREE: 3,
  SILVER: 7,
  GOLD: 14,
  BUSINESS: 30,
  CORPORATE: 90,
  ENTERPRISE: 365,
};

const TIER_FEATURES: Record<string, {
  hasHeatmap: boolean;
  hasVolatility: boolean;
  hasComparison: boolean;
}> = {
  FREE: { hasHeatmap: false, hasVolatility: false, hasComparison: false },
  SILVER: { hasHeatmap: false, hasVolatility: false, hasComparison: true },
  GOLD: { hasHeatmap: true, hasVolatility: false, hasComparison: true },
  BUSINESS: { hasHeatmap: true, hasVolatility: true, hasComparison: true },
  CORPORATE: { hasHeatmap: true, hasVolatility: true, hasComparison: true },
  ENTERPRISE: { hasHeatmap: true, hasVolatility: true, hasComparison: true },
};

// =============================================================================
// CONNECTION POOL MANAGEMENT
// =============================================================================

let pool: sql.ConnectionPool | null = null;

async function getPool(): Promise<sql.ConnectionPool> {
  if (!pool) {
    pool = await new sql.ConnectionPool(sqlConfig).connect();
    console.log('✅ Connected to Azure SQL for analytics');
  }
  return pool;
}

// =============================================================================
// DATA FETCHING FUNCTIONS
// =============================================================================

async function fetchNFPIData(daysAccess: number): Promise<any[]> {
  const pool = await getPool();
  
  try {
    const result = await pool.request()
      .input('days', sql.Int, daysAccess)
      .query(`
        SELECT TOP (@days)
          index_date,
          nfpi_value,
          nfpi_northwest,
          nfpi_northeast,
          nfpi_northcentral,
          nfpi_southwest,
          nfpi_southeast,
          nfpi_southsouth,
          daily_change,
          nfpi_7day_ma
        FROM reporting.vw_NFPI_Index
        ORDER BY index_date DESC
      `);
    
    return result.recordset.reverse(); // Return in chronological order
  } catch (error) {
    console.error('Error fetching NFPI data:', error);
    return generateDemoNFPIData(daysAccess);
  }
}

async function fetchTopMovers(): Promise<{ gainers: any[]; losers: any[] }> {
  const pool = await getPool();
  
  try {
    const gainersResult = await pool.request().query(`
      SELECT TOP 10
        item_name,
        market_name,
        category,
        current_avg_price,
        price_change_percent,
        movement_type
      FROM reporting.vw_TopMovers
      WHERE movement_type = 'GAINER'
      ORDER BY price_change_percent DESC
    `);
    
    const losersResult = await pool.request().query(`
      SELECT TOP 10
        item_name,
        market_name,
        category,
        current_avg_price,
        price_change_percent,
        movement_type
      FROM reporting.vw_TopMovers
      WHERE movement_type = 'LOSER'
      ORDER BY price_change_percent ASC
    `);
    
    return {
      gainers: gainersResult.recordset,
      losers: losersResult.recordset,
    };
  } catch (error) {
    console.error('Error fetching top movers:', error);
    return generateDemoTopMovers();
  }
}

async function fetchMarketHeatmap(): Promise<any[]> {
  const pool = await getPool();
  
  try {
    const result = await pool.request().query(`
      SELECT 
        market_name,
        state,
        region,
        latitude,
        longitude,
        market_type,
        items_tracked,
        total_submissions,
        active_traders,
        avg_price_all_items,
        activity_score,
        hours_since_update,
        coverage_percent,
        CASE 
          WHEN hours_since_update <= 24 THEN 'ACTIVE'
          WHEN hours_since_update <= 72 THEN 'STALE'
          ELSE 'INACTIVE'
        END AS data_status
      FROM reporting.vw_MarketHeatmap
      ORDER BY activity_score DESC
    `);
    
    return result.recordset;
  } catch (error) {
    console.error('Error fetching heatmap data:', error);
    return generateDemoHeatmapData();
  }
}

async function fetchVolatilityData(daysAccess: number): Promise<any[]> {
  const pool = await getPool();
  
  try {
    const result = await pool.request()
      .input('days', sql.Int, Math.min(daysAccess, 90))
      .query(`
        SELECT 
          price_date,
          item_name,
          market_name,
          category,
          current_price,
          daily_change_percent,
          weekly_change_percent,
          monthly_change_percent,
          volatility_level
        FROM reporting.vw_PriceVolatility
        WHERE price_date >= DATEADD(DAY, -@days, GETUTCDATE())
        ORDER BY price_date DESC, item_name
      `);
    
    return result.recordset;
  } catch (error) {
    console.error('Error fetching volatility data:', error);
    return generateDemoVolatilityData();
  }
}

async function fetchPlatformKPIs(): Promise<any> {
  const pool = await getPool();
  
  try {
    const result = await pool.request().query(`
      SELECT * FROM reporting.vw_PlatformKPIs
    `);
    
    return result.recordset[0] || null;
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    return generateDemoKPIs();
  }
}

// =============================================================================
// DEMO DATA GENERATORS (Fallback when DB tables are empty)
// =============================================================================

function generateDemoNFPIData(days: number): any[] {
  const data = [];
  const baseValue = 100;
  let currentValue = baseValue;
  
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    const dailyChange = (Math.random() - 0.5) * 3;
    currentValue += dailyChange;
    
    data.push({
      index_date: date.toISOString().split('T')[0],
      nfpi_value: Number(currentValue.toFixed(2)),
      nfpi_northwest: Number((currentValue + (Math.random() - 0.5) * 10).toFixed(2)),
      nfpi_northeast: Number((currentValue + (Math.random() - 0.5) * 10).toFixed(2)),
      nfpi_northcentral: Number((currentValue + (Math.random() - 0.5) * 10).toFixed(2)),
      nfpi_southwest: Number((currentValue + (Math.random() - 0.5) * 10).toFixed(2)),
      nfpi_southeast: Number((currentValue + (Math.random() - 0.5) * 10).toFixed(2)),
      nfpi_southsouth: Number((currentValue + (Math.random() - 0.5) * 10).toFixed(2)),
      daily_change: Number(dailyChange.toFixed(2)),
      nfpi_7day_ma: Number((currentValue - 1.5).toFixed(2)),
    });
  }
  
  return data;
}

function generateDemoTopMovers(): { gainers: any[]; losers: any[] } {
  const items = [
    { item: 'Rice (50kg)', market: 'Mile 12', category: 'Food', basePrice: 85000 },
    { item: 'Tomatoes (basket)', market: 'Bodija', category: 'Food', basePrice: 45000 },
    { item: 'Cement (bag)', market: 'Iddo', category: 'Building', basePrice: 7500 },
    { item: 'Palm Oil (25L)', market: 'Onitsha', category: 'Food', basePrice: 65000 },
    { item: 'Beans (bag)', market: 'Dawanau', category: 'Food', basePrice: 95000 },
    { item: 'Onions (bag)', market: 'Yankaba', category: 'Food', basePrice: 55000 },
    { item: 'Iron Rods 12mm', market: 'Alaba', category: 'Building', basePrice: 380000 },
    { item: 'Groundnut Oil (25L)', market: 'Ariaria', category: 'Food', basePrice: 72000 },
    { item: 'Garri (bag)', market: 'Wuse', category: 'Food', basePrice: 35000 },
    { item: 'Yam (tuber)', market: 'Zaki Biam', category: 'Food', basePrice: 2500 },
  ];
  
  const gainers = items.slice(0, 5).map((item, idx) => ({
    item_name: item.item,
    market_name: item.market,
    category: item.category,
    current_avg_price: item.basePrice * (1 + (0.15 - idx * 0.02)),
    price_change_percent: 15 - idx * 2.5,
    movement_type: 'GAINER',
  }));
  
  const losers = items.slice(5).map((item, idx) => ({
    item_name: item.item,
    market_name: item.market,
    category: item.category,
    current_avg_price: item.basePrice * (1 - (0.12 - idx * 0.02)),
    price_change_percent: -(12 - idx * 2),
    movement_type: 'LOSER',
  }));
  
  return { gainers, losers };
}

function generateDemoHeatmapData(): any[] {
  const markets = [
    { name: 'Mile 12 Market', state: 'Lagos', region: 'South-West', lat: 6.6018, lng: 3.3792 },
    { name: 'Onitsha Main Market', state: 'Anambra', region: 'South-East', lat: 6.1319, lng: 6.7865 },
    { name: 'Iddo Market', state: 'Lagos', region: 'South-West', lat: 6.4631, lng: 3.3868 },
    { name: 'Alaba International', state: 'Lagos', region: 'South-West', lat: 6.4671, lng: 3.2789 },
    { name: 'Ariaria Market', state: 'Abia', region: 'South-East', lat: 5.1215, lng: 7.3733 },
    { name: 'Wuse Market', state: 'Abuja', region: 'North-Central', lat: 9.0765, lng: 7.4897 },
    { name: 'Dawanau Market', state: 'Kano', region: 'North-West', lat: 12.0022, lng: 8.5139 },
    { name: 'Bodija Market', state: 'Oyo', region: 'South-West', lat: 7.4195, lng: 3.9003 },
  ];
  
  return markets.map((m, idx) => ({
    market_name: m.name,
    state: m.state,
    region: m.region,
    latitude: m.lat,
    longitude: m.lng,
    market_type: 'WHOLESALE',
    items_tracked: 15 + Math.floor(Math.random() * 10),
    total_submissions: 100 + Math.floor(Math.random() * 500),
    active_traders: 20 + Math.floor(Math.random() * 30),
    avg_price_all_items: 45000 + Math.random() * 20000,
    activity_score: 70 + Math.floor(Math.random() * 30),
    hours_since_update: idx < 4 ? Math.floor(Math.random() * 12) : 24 + Math.floor(Math.random() * 48),
    coverage_percent: 60 + Math.random() * 35,
    data_status: idx < 4 ? 'ACTIVE' : idx < 6 ? 'STALE' : 'INACTIVE',
  }));
}

function generateDemoVolatilityData(): any[] {
  const items = ['Rice (50kg)', 'Tomatoes (basket)', 'Onions (bag)', 'Palm Oil (25L)', 'Cement (bag)'];
  const markets = ['Mile 12', 'Onitsha', 'Bodija'];
  const data = [];
  
  for (let day = 0; day < 30; day++) {
    const date = new Date();
    date.setDate(date.getDate() - day);
    
    for (const item of items) {
      for (const market of markets) {
        const dailyChange = (Math.random() - 0.5) * 20;
        const weeklyChange = (Math.random() - 0.5) * 30;
        
        data.push({
          price_date: date.toISOString().split('T')[0],
          item_name: item,
          market_name: market,
          category: item.includes('Cement') ? 'Building' : 'Food',
          current_price: 50000 + Math.random() * 50000,
          daily_change_percent: Number(dailyChange.toFixed(2)),
          weekly_change_percent: Number(weeklyChange.toFixed(2)),
          monthly_change_percent: Number((weeklyChange * 2).toFixed(2)),
          volatility_level: Math.abs(dailyChange) > 10 ? 'HIGH' : Math.abs(dailyChange) > 5 ? 'MEDIUM' : 'LOW',
        });
      }
    }
  }
  
  return data;
}

function generateDemoKPIs(): any {
  return {
    active_traders: 1247,
    active_validators: 423,
    active_consumers: 3891,
    submissions_today: 342,
    submissions_week: 2156,
    submissions_month: 8934,
    approval_rate_30d: 87.3,
    markets_active_week: 6,
    total_markets: 8,
    items_active_week: 22,
    total_items: 24,
    pending_payouts_naira: 145600,
    paid_last_30d_naira: 892400,
    minutes_since_last_price: 12,
    calculated_at: new Date().toISOString(),
  };
}

// =============================================================================
// API ROUTE HANDLER
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    // Get tier from query params (for testing) or session
    const { searchParams } = new URL(request.url);
    let tier = searchParams.get('tier') || 'FREE';
    
    // Validate tier
    if (!TIER_DAYS_ACCESS[tier]) {
      tier = 'FREE';
    }
    
    const daysAccess = TIER_DAYS_ACCESS[tier];
    const features = TIER_FEATURES[tier];
    
    // Fetch data based on tier
    const [nfpi, movers, kpis] = await Promise.all([
      fetchNFPIData(daysAccess),
      fetchTopMovers(),
      fetchPlatformKPIs(),
    ]);
    
    // Fetch feature-gated data
    let heatmap: any[] = [];
    let volatility: any[] = [];
    
    if (features.hasHeatmap) {
      heatmap = await fetchMarketHeatmap();
    }
    
    if (features.hasVolatility) {
      volatility = await fetchVolatilityData(daysAccess);
    }
    
    return NextResponse.json({
      success: true,
      tier,
      daysAccess,
      features,
      nfpi,
      gainers: movers.gainers,
      losers: movers.losers,
      heatmap,
      volatility,
      kpis,
      generatedAt: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Analytics Pro API Error:', error);
    
    // Return demo data on error
    const tier = 'FREE';
    const daysAccess = 7;
    
    return NextResponse.json({
      success: false,
      error: 'Database connection failed, showing demo data',
      tier,
      daysAccess,
      features: TIER_FEATURES[tier],
      nfpi: generateDemoNFPIData(daysAccess),
      ...generateDemoTopMovers(),
      heatmap: generateDemoHeatmapData(),
      volatility: generateDemoVolatilityData(),
      kpis: generateDemoKPIs(),
      generatedAt: new Date().toISOString(),
    });
  }
}

// =============================================================================
// CLEANUP ON MODULE UNLOAD
// =============================================================================

process.on('SIGTERM', async () => {
  if (pool) {
    await pool.close();
    console.log('🔌 Closed Azure SQL connection pool');
  }
});
