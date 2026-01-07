import { PrismaClient } from "@prisma/client";

// ============================================================================
// PRISMA CLIENT SINGLETON
// ============================================================================

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ============================================================================
// DATABASE UTILITIES
// ============================================================================

/**
 * Check database connection health
 */
export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  latency?: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1 as health_check`;
    return {
      connected: true,
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Disconnect from database (for cleanup)
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

// ============================================================================
// RAW SQL HELPERS FOR COMPLEX QUERIES
// ============================================================================

/**
 * Execute raw SQL query with parameters
 */
export async function executeRawQuery<T>(
  query: string,
  params: unknown[] = []
): Promise<T[]> {
  try {
    const result = await prisma.$queryRawUnsafe<T[]>(query, ...params);
    return result;
  } catch (error) {
    console.error("Raw query execution error:", error);
    throw error;
  }
}

/**
 * Get current prices with market and item details
 */
export async function getCurrentPrices(options: {
  marketId?: string;
  categoryId?: string;
  itemId?: string;
  state?: string;
  limit?: number;
  offset?: number;
}) {
  const { marketId, categoryId, itemId, state, limit = 50, offset = 0 } = options;

  let whereClause = "WHERE ap.validation_status = 'APPROVED'";
  const params: unknown[] = [];
  let paramIndex = 1;

  if (marketId) {
    whereClause += ` AND ap.market_id = @p${paramIndex}`;
    params.push(marketId);
    paramIndex++;
  }

  if (categoryId) {
    whereClause += ` AND ap.category_id = @p${paramIndex}`;
    params.push(categoryId);
    paramIndex++;
  }

  if (itemId) {
    whereClause += ` AND ap.item_id = @p${paramIndex}`;
    params.push(itemId);
    paramIndex++;
  }

  if (state) {
    whereClause += ` AND ap.state = @p${paramIndex}`;
    params.push(state);
    paramIndex++;
  }

  const query = `
    SELECT 
      ap.price_id,
      ap.item_id,
      ap.item_name,
      ap.market_id,
      ap.market_name,
      ap.state,
      ap.category_id,
      ap.category_name,
      ap.brand_id,
      ap.brand_name,
      ap.price,
      ap.unit,
      ap.currency,
      ap.validated_at,
      ap.validators_count,
      ap.approval_count,
      ap.previous_price,
      ap.price_change_amount,
      ap.price_change_percent,
      ap.price_trend,
      ap.confidence_score,
      ap.data_source
    FROM dbo.Approved_Prices ap
    ${whereClause}
    ORDER BY ap.validated_at DESC
    OFFSET ${offset} ROWS
    FETCH NEXT ${limit} ROWS ONLY
  `;

  return executeRawQuery(query, params);
}

/**
 * Get NFPI weekly data
 */
export async function getNFPIData(weeks: number = 12) {
  const query = `
    SELECT TOP ${weeks}
      week_id,
      week_start,
      week_end,
      is_baseline,
      national_index,
      national_change_pct,
      national_change_direction,
      nw_index,
      ne_index,
      nc_index,
      sw_index,
      se_index,
      ss_index,
      grains_index,
      proteins_index,
      vegetables_index,
      oils_index,
      basket_value_naira,
      baseline_value,
      data_quality_score,
      items_with_data,
      total_submissions,
      top_gainers,
      top_losers,
      insight,
      calculated_at,
      published_at
    FROM dbo.NFPI_Weekly
    ORDER BY week_start DESC
  `;

  return executeRawQuery(query);
}

/**
 * Get price history for an item
 */
export async function getPriceHistory(options: {
  itemId: string;
  marketId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  const { itemId, marketId, startDate, endDate, limit = 365 } = options;

  let whereClause = "WHERE item_id = @p1";
  const params: unknown[] = [itemId];
  let paramIndex = 2;

  if (marketId) {
    whereClause += ` AND market_id = @p${paramIndex}`;
    params.push(marketId);
    paramIndex++;
  }

  if (startDate) {
    whereClause += ` AND observation_date >= @p${paramIndex}`;
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    whereClause += ` AND observation_date <= @p${paramIndex}`;
    params.push(endDate);
    paramIndex++;
  }

  const query = `
    SELECT TOP ${limit}
      history_id,
      item_id,
      item_name_standard as item_name,
      market_id,
      market_name,
      price_naira as price,
      observation_date,
      year,
      month,
      data_source
    FROM dbo.Price_History_NBS
    ${whereClause}
    ORDER BY observation_date DESC
  `;

  return executeRawQuery(query, params);
}

/**
 * Get market statistics
 */
export async function getMarketStats() {
  const query = `
    SELECT 
      m.market_id,
      m.market_name,
      m.state,
      m.latitude,
      m.longitude,
      m.status,
      COUNT(DISTINCT ap.item_id) as items_count,
      COUNT(ap.price_id) as prices_count,
      AVG(ap.confidence_score) as avg_confidence,
      MAX(ap.validated_at) as last_update
    FROM dbo.Markets m
    LEFT JOIN dbo.Approved_Prices ap ON m.market_id = ap.market_id
      AND ap.validation_status = 'APPROVED'
      AND ap.validated_at >= DATEADD(day, -7, GETDATE())
    WHERE m.status = 'ACTIVE'
    GROUP BY m.market_id, m.market_name, m.state, m.latitude, m.longitude, m.status
    ORDER BY prices_count DESC
  `;

  return executeRawQuery(query);
}

/**
 * Get top price movers
 */
export async function getTopMovers(direction: "gainers" | "losers", limit: number = 10) {
  const orderDirection = direction === "gainers" ? "DESC" : "ASC";
  const filterCondition = direction === "gainers" 
    ? "AND ap.price_change_percent > 0" 
    : "AND ap.price_change_percent < 0";

  const query = `
    SELECT TOP ${limit}
      ap.price_id,
      ap.item_id,
      ap.item_name,
      ap.market_id,
      ap.market_name,
      ap.price,
      ap.previous_price,
      ap.price_change_percent,
      ap.price_trend,
      ap.validated_at
    FROM dbo.Approved_Prices ap
    WHERE ap.validation_status = 'APPROVED'
      AND ap.validated_at >= DATEADD(day, -1, GETDATE())
      AND ap.price_change_percent IS NOT NULL
      ${filterCondition}
    ORDER BY ABS(ap.price_change_percent) ${orderDirection}
  `;

  return executeRawQuery(query);
}

export default prisma;
