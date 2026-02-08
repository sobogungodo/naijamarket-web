// src/lib/reports/queries/report-data.ts
// NaijaMarket Intel - Report Data Queries
// Fetches and processes data for all report types
// Updated: 2026-02-08

import { prisma } from "@/lib/prisma";

// ============================================================================
// TYPES
// ============================================================================

export interface PriceData {
  item_name: string;
  brand_name: string | null;
  market_name: string;
  state: string;
  price: number;
  unit: string;
  category_name: string;
  validated_at: Date;
}

export interface PriceChange {
  item_name: string;
  market_name: string;
  current_price: number;
  previous_price: number;
  change_amount: number;
  change_percent: number;
}

export interface MarketComparison {
  item_name: string;
  markets: {
    market_name: string;
    state: string;
    min_price: number;
    max_price: number;
    avg_price: number;
  }[];
  cheapest: { market: string; price: number };
  most_expensive: { market: string; price: number };
  price_spread: number;
}

export interface ArbitrageOpportunity {
  item_name: string;
  buy_market: string;
  buy_price: number;
  sell_market: string;
  sell_price: number;
  profit_margin: number;
  profit_percent: number;
}

// ============================================================================
// DAILY MARKET SUMMARY DATA
// ============================================================================

export async function getDailyMarketSummaryData() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Get today's prices
  const todayPrices = await prisma.$queryRaw`
    SELECT 
      item_name,
      brand_name,
      market_name,
      state,
      category_name,
      price,
      unit,
      validated_at
    FROM Approved_Prices
    WHERE validation_status = 'APPROVED'
      AND validated_at >= ${today.toISOString()}
    ORDER BY validated_at DESC
  ` as PriceData[];

  // Get yesterday's prices for comparison
  const yesterdayPrices = await prisma.$queryRaw`
    SELECT 
      item_name,
      market_name,
      AVG(price) as avg_price
    FROM Approved_Prices
    WHERE validation_status = 'APPROVED'
      AND validated_at >= ${yesterday.toISOString()}
      AND validated_at < ${today.toISOString()}
    GROUP BY item_name, market_name
  ` as any[];

  // Calculate price changes
  const priceChanges: PriceChange[] = [];
  const todayGrouped = new Map<string, PriceData>();
  
  todayPrices.forEach(p => {
    const key = `${p.item_name}-${p.market_name}`;
    if (!todayGrouped.has(key)) {
      todayGrouped.set(key, p);
    }
  });

  yesterdayPrices.forEach(yp => {
    const key = `${yp.item_name}-${yp.market_name}`;
    const todayPrice = todayGrouped.get(key);
    if (todayPrice) {
      const change = Number(todayPrice.price) - Number(yp.avg_price);
      const changePercent = (change / Number(yp.avg_price)) * 100;
      priceChanges.push({
        item_name: yp.item_name,
        market_name: yp.market_name,
        current_price: Number(todayPrice.price),
        previous_price: Number(yp.avg_price),
        change_amount: change,
        change_percent: changePercent
      });
    }
  });

  // Sort by change percent
  const topGainers = [...priceChanges]
    .filter(p => p.change_percent > 0)
    .sort((a, b) => b.change_percent - a.change_percent)
    .slice(0, 10);

  const topLosers = [...priceChanges]
    .filter(p => p.change_percent < 0)
    .sort((a, b) => a.change_percent - b.change_percent)
    .slice(0, 10);

  // Market summary
  const marketSummary = await prisma.$queryRaw`
    SELECT 
      market_name,
      state,
      COUNT(DISTINCT item_name) as items_count,
      COUNT(*) as submissions_count,
      AVG(price) as avg_price
    FROM Approved_Prices
    WHERE validation_status = 'APPROVED'
      AND validated_at >= ${today.toISOString()}
    GROUP BY market_name, state
    ORDER BY submissions_count DESC
  ` as any[];

  // Category breakdown
  const categoryBreakdown = await prisma.$queryRaw`
    SELECT 
      category_name,
      COUNT(DISTINCT item_name) as items_count,
      AVG(price) as avg_price,
      MIN(price) as min_price,
      MAX(price) as max_price
    FROM Approved_Prices
    WHERE validation_status = 'APPROVED'
      AND validated_at >= ${today.toISOString()}
    GROUP BY category_name
    ORDER BY items_count DESC
  ` as any[];

  return {
    date: today,
    totalPrices: todayPrices.length,
    uniqueItems: new Set(todayPrices.map(p => p.item_name)).size,
    uniqueMarkets: new Set(todayPrices.map(p => p.market_name)).size,
    topGainers,
    topLosers,
    marketSummary,
    categoryBreakdown,
    recentPrices: todayPrices.slice(0, 50)
  };
}

// ============================================================================
// WEEKLY TREND ANALYSIS DATA
// ============================================================================

export async function getWeeklyTrendData() {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  // Daily prices for the past week
  const dailyPrices = await prisma.$queryRaw`
    SELECT 
      CAST(validated_at AS DATE) as date,
      item_name,
      category_name,
      AVG(price) as avg_price,
      MIN(price) as min_price,
      MAX(price) as max_price,
      COUNT(*) as submissions
    FROM Approved_Prices
    WHERE validation_status = 'APPROVED'
      AND validated_at >= ${weekAgo.toISOString()}
    GROUP BY CAST(validated_at AS DATE), item_name, category_name
    ORDER BY date DESC, item_name
  ` as any[];

  // Week-over-week comparison
  const thisWeekAvg = await prisma.$queryRaw`
    SELECT 
      item_name,
      AVG(price) as avg_price
    FROM Approved_Prices
    WHERE validation_status = 'APPROVED'
      AND validated_at >= ${weekAgo.toISOString()}
    GROUP BY item_name
  ` as any[];

  const lastWeekAvg = await prisma.$queryRaw`
    SELECT 
      item_name,
      AVG(price) as avg_price
    FROM Approved_Prices
    WHERE validation_status = 'APPROVED'
      AND validated_at >= ${twoWeeksAgo.toISOString()}
      AND validated_at < ${weekAgo.toISOString()}
    GROUP BY item_name
  ` as any[];

  // Calculate trends
  const trends: any[] = [];
  const lastWeekMap = new Map(lastWeekAvg.map(p => [p.item_name, Number(p.avg_price)]));
  
  thisWeekAvg.forEach(tw => {
    const lastWeekPrice = lastWeekMap.get(tw.item_name);
    if (lastWeekPrice) {
      const change = Number(tw.avg_price) - lastWeekPrice;
      const changePercent = (change / lastWeekPrice) * 100;
      trends.push({
        item_name: tw.item_name,
        this_week_avg: Number(tw.avg_price),
        last_week_avg: lastWeekPrice,
        change_amount: change,
        change_percent: changePercent,
        trend: changePercent > 2 ? 'UP' : changePercent < -2 ? 'DOWN' : 'STABLE'
      });
    }
  });

  // Volatility analysis
  const volatility = await prisma.$queryRaw`
    SELECT 
      item_name,
      STDEV(price) as price_std,
      AVG(price) as avg_price,
      (STDEV(price) / AVG(price)) * 100 as volatility_index
    FROM Approved_Prices
    WHERE validation_status = 'APPROVED'
      AND validated_at >= ${weekAgo.toISOString()}
    GROUP BY item_name
    HAVING COUNT(*) >= 3
    ORDER BY volatility_index DESC
  ` as any[];

  return {
    startDate: weekAgo,
    endDate: today,
    dailyPrices,
    trends: trends.sort((a, b) => Math.abs(b.change_percent) - Math.abs(a.change_percent)),
    volatility: volatility.slice(0, 20),
    summary: {
      totalItems: trends.length,
      upTrend: trends.filter(t => t.trend === 'UP').length,
      downTrend: trends.filter(t => t.trend === 'DOWN').length,
      stable: trends.filter(t => t.trend === 'STABLE').length
    }
  };
}

// ============================================================================
// MARKET COMPARISON DATA
// ============================================================================

export async function getMarketComparisonData(selectedItems?: string[]) {
  // Get latest prices grouped by item and market
  const priceData = await prisma.$queryRaw`
    SELECT 
      item_name,
      market_name,
      state,
      MIN(price) as min_price,
      MAX(price) as max_price,
      AVG(price) as avg_price,
      COUNT(*) as submissions,
      MAX(validated_at) as last_updated
    FROM Approved_Prices
    WHERE validation_status = 'APPROVED'
      AND validated_at >= DATEADD(day, -7, GETDATE())
    GROUP BY item_name, market_name, state
    ORDER BY item_name, avg_price ASC
  ` as any[];

  // Group by item
  const itemsMap = new Map<string, any[]>();
  priceData.forEach(p => {
    const existing = itemsMap.get(p.item_name) || [];
    existing.push({
      market_name: p.market_name,
      state: p.state,
      min_price: Number(p.min_price),
      max_price: Number(p.max_price),
      avg_price: Number(p.avg_price),
      submissions: p.submissions
    });
    itemsMap.set(p.item_name, existing);
  });

  // Build comparison data
  const comparisons: MarketComparison[] = [];
  
  itemsMap.forEach((markets, item_name) => {
    if (markets.length >= 2) {  // Only include items with multiple markets
      const sorted = markets.sort((a, b) => a.avg_price - b.avg_price);
      comparisons.push({
        item_name,
        markets: sorted,
        cheapest: { market: sorted[0].market_name, price: sorted[0].avg_price },
        most_expensive: { market: sorted[sorted.length - 1].market_name, price: sorted[sorted.length - 1].avg_price },
        price_spread: sorted[sorted.length - 1].avg_price - sorted[0].avg_price
      });
    }
  });

  // Sort by price spread (biggest differences first)
  comparisons.sort((a, b) => b.price_spread - a.price_spread);

  // Filter by selected items if provided
  const filtered = selectedItems?.length 
    ? comparisons.filter(c => selectedItems.includes(c.item_name))
    : comparisons;

  return {
    generatedAt: new Date(),
    totalItems: filtered.length,
    totalMarkets: new Set(priceData.map(p => p.market_name)).size,
    comparisons: filtered,
    summary: {
      avgPriceSpread: filtered.reduce((sum, c) => sum + c.price_spread, 0) / filtered.length,
      maxPriceSpread: Math.max(...filtered.map(c => c.price_spread)),
      topSavingsOpportunities: filtered.slice(0, 10)
    }
  };
}

// ============================================================================
// ARBITRAGE OPPORTUNITIES DATA
// ============================================================================

export async function getArbitrageData() {
  const comparisonData = await getMarketComparisonData();
  
  const opportunities: ArbitrageOpportunity[] = [];
  
  comparisonData.comparisons.forEach(item => {
    if (item.markets.length >= 2) {
      const buyMarket = item.markets[0];  // Cheapest
      const sellMarket = item.markets[item.markets.length - 1];  // Most expensive
      
      const profitMargin = sellMarket.avg_price - buyMarket.avg_price;
      const profitPercent = (profitMargin / buyMarket.avg_price) * 100;
      
      // Only include if profit margin is significant (>5%)
      if (profitPercent >= 5) {
        opportunities.push({
          item_name: item.item_name,
          buy_market: buyMarket.market_name,
          buy_price: buyMarket.avg_price,
          sell_market: sellMarket.market_name,
          sell_price: sellMarket.avg_price,
          profit_margin: profitMargin,
          profit_percent: profitPercent
        });
      }
    }
  });

  // Sort by profit percent
  opportunities.sort((a, b) => b.profit_percent - a.profit_percent);

  return {
    generatedAt: new Date(),
    totalOpportunities: opportunities.length,
    opportunities: opportunities.slice(0, 50),
    summary: {
      avgProfitPercent: opportunities.reduce((sum, o) => sum + o.profit_percent, 0) / opportunities.length,
      maxProfitPercent: Math.max(...opportunities.map(o => o.profit_percent)),
      topOpportunities: opportunities.slice(0, 10)
    }
  };
}

// ============================================================================
// INFLATION IMPACT DATA
// ============================================================================

export async function getInflationData() {
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  
  const yearAgo = new Date(today);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);

  // Month-over-month
  const thisMonthPrices = await prisma.$queryRaw`
    SELECT 
      item_name,
      category_name,
      AVG(price) as avg_price
    FROM Approved_Prices
    WHERE validation_status = 'APPROVED'
      AND validated_at >= ${monthAgo.toISOString()}
    GROUP BY item_name, category_name
  ` as any[];

  const lastMonthStart = new Date(monthAgo);
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
  
  const lastMonthPrices = await prisma.$queryRaw`
    SELECT 
      item_name,
      AVG(price) as avg_price
    FROM Approved_Prices
    WHERE validation_status = 'APPROVED'
      AND validated_at >= ${lastMonthStart.toISOString()}
      AND validated_at < ${monthAgo.toISOString()}
    GROUP BY item_name
  ` as any[];

  // Calculate MoM inflation
  const lastMonthMap = new Map(lastMonthPrices.map(p => [p.item_name, Number(p.avg_price)]));
  
  const momInflation = thisMonthPrices.map(tp => {
    const lastPrice = lastMonthMap.get(tp.item_name);
    const change = lastPrice ? ((Number(tp.avg_price) - lastPrice) / lastPrice) * 100 : 0;
    return {
      item_name: tp.item_name,
      category_name: tp.category_name,
      current_price: Number(tp.avg_price),
      previous_price: lastPrice || 0,
      inflation_rate: change
    };
  }).filter(i => i.previous_price > 0);

  // Category-level inflation
  const categoryInflation = new Map<string, { total: number; count: number }>();
  momInflation.forEach(item => {
    const existing = categoryInflation.get(item.category_name) || { total: 0, count: 0 };
    existing.total += item.inflation_rate;
    existing.count += 1;
    categoryInflation.set(item.category_name, existing);
  });

  const categoryRates = Array.from(categoryInflation.entries()).map(([category, data]) => ({
    category,
    avg_inflation: data.total / data.count
  })).sort((a, b) => b.avg_inflation - a.avg_inflation);

  // Overall inflation
  const overallInflation = momInflation.reduce((sum, i) => sum + i.inflation_rate, 0) / momInflation.length;

  return {
    generatedAt: new Date(),
    period: {
      start: monthAgo,
      end: today
    },
    overallInflation,
    categoryRates,
    itemInflation: momInflation.sort((a, b) => b.inflation_rate - a.inflation_rate),
    summary: {
      highestInflation: momInflation[0],
      lowestInflation: momInflation[momInflation.length - 1],
      itemsWithIncrease: momInflation.filter(i => i.inflation_rate > 0).length,
      itemsWithDecrease: momInflation.filter(i => i.inflation_rate < 0).length
    }
  };
}

// ============================================================================
// SUPPLY CHAIN INTELLIGENCE DATA
// ============================================================================

export async function getSupplyChainData() {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  // Submission frequency as proxy for supply availability
  const supplyIndicators = await prisma.$queryRaw`
    SELECT 
      item_name,
      market_name,
      state,
      COUNT(*) as submission_count,
      AVG(price) as avg_price,
      STDEV(price) as price_volatility,
      MIN(validated_at) as first_submission,
      MAX(validated_at) as last_submission
    FROM Approved_Prices
    WHERE validation_status = 'APPROVED'
      AND validated_at >= ${weekAgo.toISOString()}
    GROUP BY item_name, market_name, state
    ORDER BY submission_count DESC
  ` as any[];

  // Items with declining submissions (potential shortage)
  const thisWeekCount = await prisma.$queryRaw`
    SELECT 
      item_name,
      COUNT(*) as count
    FROM Approved_Prices
    WHERE validation_status = 'APPROVED'
      AND validated_at >= ${weekAgo.toISOString()}
    GROUP BY item_name
  ` as any[];

  const twoWeeksAgo = new Date(weekAgo);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 7);

  const lastWeekCount = await prisma.$queryRaw`
    SELECT 
      item_name,
      COUNT(*) as count
    FROM Approved_Prices
    WHERE validation_status = 'APPROVED'
      AND validated_at >= ${twoWeeksAgo.toISOString()}
      AND validated_at < ${weekAgo.toISOString()}
    GROUP BY item_name
  ` as any[];

  // Calculate supply trends
  const lastWeekMap = new Map(lastWeekCount.map(p => [p.item_name, p.count]));
  
  const supplyTrends = thisWeekCount.map(tw => {
    const lastWeek = lastWeekMap.get(tw.item_name) || 0;
    const change = lastWeek > 0 ? ((tw.count - lastWeek) / lastWeek) * 100 : 0;
    return {
      item_name: tw.item_name,
      this_week: tw.count,
      last_week: lastWeek,
      change_percent: change,
      status: change < -30 ? 'SHORTAGE_RISK' : change < -10 ? 'DECLINING' : change > 10 ? 'INCREASING' : 'STABLE'
    };
  });

  // Shortage warnings
  const shortageWarnings = supplyTrends
    .filter(t => t.status === 'SHORTAGE_RISK' || t.status === 'DECLINING')
    .sort((a, b) => a.change_percent - b.change_percent);

  return {
    generatedAt: new Date(),
    period: { start: weekAgo, end: today },
    supplyIndicators: supplyIndicators.slice(0, 100),
    supplyTrends,
    shortageWarnings,
    summary: {
      totalItems: supplyTrends.length,
      stableSupply: supplyTrends.filter(t => t.status === 'STABLE').length,
      increasingSupply: supplyTrends.filter(t => t.status === 'INCREASING').length,
      decliningSupply: supplyTrends.filter(t => t.status === 'DECLINING').length,
      shortageRisk: supplyTrends.filter(t => t.status === 'SHORTAGE_RISK').length
    }
  };
}

// ============================================================================
// CUSTOM ANALYTICS DATA
// ============================================================================

export async function getCustomAnalyticsData(params: {
  items?: string[];
  markets?: string[];
  categories?: string[];
  startDate?: Date;
  endDate?: Date;
}) {
  const { items, markets, categories, startDate, endDate } = params;
  
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate || new Date();

  let query = `
    SELECT 
      item_name,
      brand_name,
      market_name,
      state,
      category_name,
      price,
      unit,
      validated_at
    FROM Approved_Prices
    WHERE validation_status = 'APPROVED'
      AND validated_at >= '${start.toISOString()}'
      AND validated_at <= '${end.toISOString()}'
  `;

  if (items?.length) {
    query += ` AND item_name IN (${items.map(i => `'${i}'`).join(',')})`;
  }
  if (markets?.length) {
    query += ` AND market_name IN (${markets.map(m => `'${m}'`).join(',')})`;
  }
  if (categories?.length) {
    query += ` AND category_name IN (${categories.map(c => `'${c}'`).join(',')})`;
  }

  query += ` ORDER BY validated_at DESC`;

  const data = await prisma.$queryRawUnsafe(query) as any[];

  // Process data for various analyses
  const pricesByItem = new Map<string, number[]>();
  const pricesByMarket = new Map<string, number[]>();
  const pricesByCategory = new Map<string, number[]>();

  data.forEach(d => {
    // By item
    const itemPrices = pricesByItem.get(d.item_name) || [];
    itemPrices.push(Number(d.price));
    pricesByItem.set(d.item_name, itemPrices);

    // By market
    const marketPrices = pricesByMarket.get(d.market_name) || [];
    marketPrices.push(Number(d.price));
    pricesByMarket.set(d.market_name, marketPrices);

    // By category
    const catPrices = pricesByCategory.get(d.category_name) || [];
    catPrices.push(Number(d.price));
    pricesByCategory.set(d.category_name, catPrices);
  });

  const calculateStats = (prices: number[]) => ({
    count: prices.length,
    min: Math.min(...prices),
    max: Math.max(...prices),
    avg: prices.reduce((a, b) => a + b, 0) / prices.length,
    median: prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)]
  });

  return {
    generatedAt: new Date(),
    parameters: { items, markets, categories, startDate: start, endDate: end },
    totalRecords: data.length,
    rawData: data.slice(0, 500),
    itemAnalysis: Array.from(pricesByItem.entries()).map(([item, prices]) => ({
      item,
      ...calculateStats(prices)
    })),
    marketAnalysis: Array.from(pricesByMarket.entries()).map(([market, prices]) => ({
      market,
      ...calculateStats(prices)
    })),
    categoryAnalysis: Array.from(pricesByCategory.entries()).map(([category, prices]) => ({
      category,
      ...calculateStats(prices)
    }))
  };
}
