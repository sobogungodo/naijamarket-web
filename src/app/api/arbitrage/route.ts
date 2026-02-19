// ============================================================================
// UPDATED ARBITRAGE QUERY — uses precomputed dbo.vw_Market_Transport
// Replace the findArbitrageOpportunities function in route-arbitrage.ts
//
// BEFORE: Runtime Haversine for every market pair (slow, 50k+ calculations)
// AFTER:  JOIN to precomputed table (instant lookup, 25k pairs pre-stored)
// ============================================================================

async function findArbitrageOpportunities(
  prisma: any,
  minProfitPct: number,
  maxResults: number,
  filterItem?: string,
  filterCategory?: string
): Promise<ArbitrageOpportunity[]> {

  // Build WHERE filters
  const conditions: string[] = [];
  const params: any[] = [];

  if (filterItem) {
    conditions.push(`AND p1.item_name LIKE @p0`);
    params.push(`%${filterItem}%`);
  }
  if (filterCategory) {
    conditions.push(`AND ic.category_id = @p1`);
    params.push(filterCategory);
  }

  const whereClause = conditions.join(' ');

  // Single SQL query: prices × prices × precomputed transport
  const sql = `
    WITH LatestPrices AS (
      SELECT 
        dp.item_id,
        dp.market_id,
        dp.price_naira,
        dp.price_date,
        dp.time_slot,
        ic.item_name,
        ic.unit,
        ic.category_id,
        m.market_name,
        m.state,
        ROW_NUMBER() OVER (
          PARTITION BY dp.item_id, dp.market_id 
          ORDER BY dp.price_date DESC, dp.time_slot DESC
        ) AS rn
      FROM dbo.Daily_Prices dp
      JOIN dbo.Items_Catalog ic ON dp.item_id = ic.item_id
      JOIN dbo.Markets m ON dp.market_id = m.market_id
      WHERE dp.price_naira > 0
        AND dp.price_date >= DATEADD(DAY, -7, CAST(GETDATE() AS DATE))
        ${whereClause}
    )
    SELECT TOP ${Math.min(maxResults * 3, 150)}
      p1.item_id,
      p1.item_name,
      p1.unit,
      p1.category_id,
      
      -- Buy side (cheaper)
      p1.market_id AS buy_market_id,
      p1.market_name AS buy_market,
      p1.state AS buy_state,
      p1.price_naira AS buy_price,
      p1.price_date AS buy_date,
      
      -- Sell side (more expensive)
      p2.market_id AS sell_market_id,
      p2.market_name AS sell_market,
      p2.state AS sell_state,
      p2.price_naira AS sell_price,
      p2.price_date AS sell_date,
      
      -- Transport (precomputed!)
      t.road_distance_km AS distance_km,
      t.total_cost_per_bag AS transport_cost,
      t.distance_band,
      t.rate_per_km,
      t.road_quality_mult,
      t.fuel_haulage_cost,
      t.checkpoint_cost,
      t.fixed_cost,
      
      -- Profit calculation (in SQL — no JS needed)
      (p2.price_naira - p1.price_naira) AS gross_profit,
      (p2.price_naira - p1.price_naira - t.total_cost_per_bag) AS net_profit,
      ROUND(
        ((p2.price_naira - p1.price_naira - t.total_cost_per_bag) / p1.price_naira) * 100, 
        1
      ) AS profit_pct
      
    FROM LatestPrices p1
    JOIN LatestPrices p2 
      ON p1.item_id = p2.item_id 
      AND p1.market_id != p2.market_id
      AND p2.price_naira > p1.price_naira
      AND p1.rn = 1 
      AND p2.rn = 1
    JOIN dbo.vw_Market_Transport t
      ON t.market_a_id = p1.market_id 
      AND t.market_b_id = p2.market_id
    WHERE (p2.price_naira - p1.price_naira - t.total_cost_per_bag) > 0
      AND ((p2.price_naira - p1.price_naira - t.total_cost_per_bag) / p1.price_naira) * 100 >= ${minProfitPct}
    ORDER BY 
      ((p2.price_naira - p1.price_naira - t.total_cost_per_bag) / p1.price_naira) * 100 DESC
  `;

  const results = await prisma.$queryRawUnsafe(sql, ...params) as any[];

  // Map to ArbitrageOpportunity objects
  return results.slice(0, maxResults).map((r: any, idx: number) => {
    const buyPrice = parseFloat(r.buy_price);
    const sellPrice = parseFloat(r.sell_price);
    const transportCost = parseFloat(r.transport_cost);
    const netProfit = parseFloat(r.net_profit);
    const profitPct = parseFloat(r.profit_pct);
    const distance = parseFloat(r.distance_km);

    // Confidence based on data freshness
    const oldestDate = r.buy_date < r.sell_date ? r.buy_date : r.sell_date;
    const confidence = calculateConfidence(oldestDate);

    // Category-aware transport multiplier
    const catId = String(r.category_id || "");
    const weightMult = CATEGORY_WEIGHT_MULTIPLIER[catId] || 1.0;
    const adjustedTransport = Math.round(transportCost * weightMult);
    const adjustedNet = Math.round(sellPrice - buyPrice - adjustedTransport);
    const adjustedPct = buyPrice > 0 
      ? Math.round((adjustedNet / buyPrice) * 1000) / 10 
      : 0;

    return {
      id: `${r.item_id}-${r.buy_market_id}-${r.sell_market_id}`,
      itemId: r.item_id,
      itemName: r.item_name,
      categoryName: CATEGORY_MAP[catId] || "Other",
      unit: r.unit || "unit",
      buyMarket: {
        id: r.buy_market_id,
        name: r.buy_market,
        state: r.buy_state,
        price: Math.round(buyPrice),
        updatedAt: r.buy_date?.toISOString?.() || "",
      },
      sellMarket: {
        id: r.sell_market_id,
        name: r.sell_market,
        state: r.sell_state,
        price: Math.round(sellPrice),
        updatedAt: r.sell_date?.toISOString?.() || "",
      },
      grossProfit: Math.round(sellPrice - buyPrice),
      transportCost: adjustedTransport,
      netProfit: adjustedNet,
      profitPercentage: adjustedPct,
      distance: Math.round(distance),
      confidence,
      transportLabel: r.distance_band || "Unknown",
    };
  }).filter((opp: ArbitrageOpportunity) => opp.netProfit > 0 && opp.profitPercentage >= minProfitPct);
}


// ============================================================================
// ALSO UPDATE: Detail endpoint transport lookup
// Replace the getTransportCost() call with a DB query
// ============================================================================

async function getTransportFromDB(
  prisma: any, 
  fromMarketId: string, 
  toMarketId: string
): Promise<TransportResult | null> {
  const sql = `
    SELECT 
      road_distance_km, total_cost_per_bag, distance_band,
      rate_per_km, road_quality_mult,
      fuel_haulage_cost, checkpoint_cost, fixed_cost
    FROM dbo.vw_Market_Transport
    WHERE market_a_id = @p0 AND market_b_id = @p1
  `;
  
  const rows = await prisma.$queryRawUnsafe(sql, fromMarketId, toMarketId) as any[];
  
  if (!rows || rows.length === 0) return null;
  
  const r = rows[0];
  return {
    distance: parseFloat(r.road_distance_km),
    fuelCost: parseFloat(r.fuel_haulage_cost),
    loadingCost: parseFloat(r.fixed_cost),
    checkpointCost: parseFloat(r.checkpoint_cost),
    totalCost: parseFloat(r.total_cost_per_bag),
    label: r.distance_band,
    ratePerKm: parseFloat(r.rate_per_km),
    weightMultiplier: 1.0,
    categoryNote: "Base rate (before category adjustment)",
  };
}
