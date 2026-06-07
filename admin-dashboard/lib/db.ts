import sql, { IRecordSet } from 'mssql';

// ============================================
// AZURE SQL DATABASE CONNECTION
// NaijaMarket Intel Admin Dashboard
// FIXED: correct DB fallback, confirmed table/column names
// ============================================

const config: sql.config = {
  user: process.env.SQL_USER || process.env.SQL_USERNAME || process.env.AZURE_SQL_USER || '',
  password: process.env.SQL_PASSWORD || process.env.AZURE_SQL_PASSWORD || '',
  server: process.env.SQL_SERVER || process.env.AZURE_SQL_SERVER || 'naijafood.database.windows.net',
  database: process.env.SQL_DATABASE || process.env.AZURE_SQL_DATABASE || 'naijafoodmarket-live',
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 30000,
    requestTimeout: 60000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getConnection(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }
  try {
    pool = await sql.connect(config);
    console.log('✅ Connected to Azure SQL:', config.database);
    return pool;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

export async function query<T>(
  sqlQuery: string,
  params?: Record<string, unknown>
): Promise<T[]> {
  const connection = await getConnection();
  const request = connection.request();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });
  }
  const result = await request.query(sqlQuery);
  return result.recordset as T[];
}

export async function queryOne<T>(
  sqlQuery: string,
  params?: Record<string, unknown>
): Promise<T | null> {
  const results = await query<T>(sqlQuery, params);
  return results[0] || null;
}

export async function executeProc<T>(
  procName: string,
  params?: Record<string, unknown>
): Promise<T[]> {
  const connection = await getConnection();
  const request = connection.request();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });
  }
  const result = await request.execute(procName);
  return result.recordset as T[];
}

export async function execute(
  sqlQuery: string,
  params?: Record<string, unknown>
): Promise<number> {
  const connection = await getConnection();
  const request = connection.request();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });
  }
  const result = await request.query(sqlQuery);
  return result.rowsAffected[0];
}

export async function closeConnection(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

// ============================================
// DASHBOARD-SPECIFIC QUERIES
// FIXED: all table/column names match confirmed live schema
// Confirmed tables: Traders_register, Validators, Submissions,
//                   Markets, Items_Catalog, Consumers
// Confirmed columns per INFORMATION_SCHEMA from sessions
// ============================================

export interface DashboardStatsResult {
  totalTraders: number;
  activeTraders: number;
  totalValidators: number;
  activeValidators: number;
  totalSubmissions: number;
  submissionsToday: number;
  pendingValidations: number;
  approvalRate: number;
  totalPendingPayout: number;
  totalPaidOut: number;
  marketsActive: number;
  commoditiesTracked: number;
}

export async function getDashboardStats(): Promise<DashboardStatsResult> {
  // FIXED: use confirmed column/table names from live schema
  // Traders_register: trader_id, trader_phone, trader_name, reputation_score,
  //                   total_submissions, approved_submissions, rejected_submissions,
  //                   status, registered_at, last_active
  // Validators: validator_id, validator_phone, validator_name, status,
  //             accuracy_score, total_votes, registered_at, last_active
  // Submissions: submission_id, trader_id, market_id, item_id,
  //              price (NOT price_naira), validation_status, submitted_at, created_at
  // Markets: market_id, market_name, state, latitude, longitude
  // Items_Catalog: item_id, item_name, category_id, Unit, status
  const statsQuery = `
    DECLARE @totalTraders     INT = (SELECT COUNT(*) FROM dbo.Traders_register);
    DECLARE @activeTraders    INT = (
      SELECT COUNT(*) FROM dbo.Traders_register
      WHERE last_active >= DATEADD(day, -7, GETUTCDATE())
        AND status = 'active'
    );

    DECLARE @totalValidators  INT = (SELECT COUNT(*) FROM dbo.Validators);
    DECLARE @activeValidators INT = (
      SELECT COUNT(*) FROM dbo.Validators
      WHERE last_active >= DATEADD(day, -7, GETUTCDATE())
        AND status = 'active'
    );

    DECLARE @totalSubmissions  INT = (SELECT COUNT(*) FROM dbo.Submissions);
    DECLARE @submissionsToday  INT = (
      SELECT COUNT(*) FROM dbo.Submissions
      WHERE CAST(submitted_at AS DATE) = CAST(GETUTCDATE() AS DATE)
    );
    DECLARE @pendingValidations INT = (
      SELECT COUNT(*) FROM dbo.Submissions
      WHERE validation_status = 'PENDING'
    );
    DECLARE @approvedCount     INT = (
      SELECT COUNT(*) FROM dbo.Submissions WHERE validation_status = 'APPROVED'
    );
    DECLARE @approvalRate DECIMAL(5,2) =
      CASE WHEN @totalSubmissions > 0
        THEN CAST(@approvedCount AS DECIMAL) / @totalSubmissions * 100
        ELSE 0
      END;

    -- Rewards: Rewards_Ledger table (may not exist yet — safe fallback)
    DECLARE @totalPendingPayout DECIMAL(18,2) = 0;
    DECLARE @totalPaidOut       DECIMAL(18,2) = 0;
    IF OBJECT_ID('dbo.Rewards_Ledger') IS NOT NULL
    BEGIN
      SELECT @totalPendingPayout = ISNULL(SUM(amount), 0)
      FROM dbo.Rewards_Ledger WHERE status = 'PENDING';
      SELECT @totalPaidOut = ISNULL(SUM(amount), 0)
      FROM dbo.Rewards_Ledger WHERE status = 'PAID';
    END

    DECLARE @marketsActive      INT = (SELECT COUNT(*) FROM dbo.Markets);
    DECLARE @commoditiesTracked INT = (
      SELECT COUNT(*) FROM dbo.Items_Catalog
      WHERE (status = 'ACTIVE' OR status IS NULL)
    );

    SELECT
      @totalTraders        AS totalTraders,
      @activeTraders       AS activeTraders,
      @totalValidators     AS totalValidators,
      @activeValidators    AS activeValidators,
      @totalSubmissions    AS totalSubmissions,
      @submissionsToday    AS submissionsToday,
      @pendingValidations  AS pendingValidations,
      @approvalRate        AS approvalRate,
      @totalPendingPayout  AS totalPendingPayout,
      @totalPaidOut        AS totalPaidOut,
      @marketsActive       AS marketsActive,
      @commoditiesTracked  AS commoditiesTracked;
  `;

  const result = await queryOne<DashboardStatsResult>(statsQuery);
  return result || {
    totalTraders: 0, activeTraders: 0,
    totalValidators: 0, activeValidators: 0,
    totalSubmissions: 0, submissionsToday: 0,
    pendingValidations: 0, approvalRate: 0,
    totalPendingPayout: 0, totalPaidOut: 0,
    marketsActive: 0, commoditiesTracked: 0,
  };
}

// FIXED: confirmed Submissions columns from live schema
export async function getRecentSubmissions(limit = 100) {
  return query(`
    SELECT TOP (${limit})
      s.submission_id,
      s.trader_id,
      s.trader_name,
      s.trader_phone,
      s.market_id,
      s.market         AS market_name,
      s.item_id,
      s.item           AS item_name,
      s.category,
      s.unit,
      s.price,
      s.gps_latitude,
      s.gps_longitude,
      s.gps_verified,
      s.distance_from_market,
      s.submitted_at,
      s.validation_status,
      s.status,
      s.fraud_flag,
      s.fraud_flag_reason,
      s.variance_from_baseline
    FROM dbo.Submissions s
    ORDER BY s.submitted_at DESC
  `);
}

// FIXED: confirmed Traders_register columns
export async function getTraders(
  page = 1,
  pageSize = 50,
  filters?: {
    search?: string;
    status?: string;
    marketId?: string;
    minReputation?: number;
    maxReputation?: number;
  }
) {
  let whereClause = 'WHERE 1=1';
  const params: Record<string, unknown> = {
    offset: (page - 1) * pageSize,
    pageSize,
  };

  if (filters?.search) {
    whereClause += ` AND (t.trader_name LIKE @search OR t.trader_phone LIKE @search)`;
    params.search = `%${filters.search}%`;
  }
  if (filters?.status) {
    whereClause += ` AND t.status = @status`;
    params.status = filters.status;
  }
  if (filters?.marketId) {
    whereClause += ` AND t.market_id = @marketId`;
    params.marketId = filters.marketId;
  }
  if (filters?.minReputation !== undefined) {
    whereClause += ` AND t.reputation_score >= @minReputation`;
    params.minReputation = filters.minReputation;
  }
  if (filters?.maxReputation !== undefined) {
    whereClause += ` AND t.reputation_score <= @maxReputation`;
    params.maxReputation = filters.maxReputation;
  }

  const tradersQuery = `
    SELECT
      t.trader_id,
      t.trader_phone,
      t.trader_name,
      t.market_id,
      t.market_name,
      t.state,
      t.reputation_score,
      t.total_submissions,
      t.approved_submissions,
      t.rejected_submissions,
      t.status,
      t.registered_at,
      t.last_active
    FROM dbo.Traders_register t
    ${whereClause}
    ORDER BY t.last_active DESC
    OFFSET @offset ROWS
    FETCH NEXT @pageSize ROWS ONLY;

    SELECT COUNT(*) AS total FROM dbo.Traders_register t ${whereClause};
  `;

  const connection = await getConnection();
  const request = connection.request();
  Object.entries(params).forEach(([key, value]) => {
    request.input(key, value);
  });
  const result = await request.query(tradersQuery);
  const recordsets = result.recordsets as IRecordSet<unknown>[];
  return {
    items: recordsets[0] || [],
    total: (recordsets[1]?.[0] as { total?: number })?.total || 0,
  };
}

// Fraud alerts — safe fallback if table doesn't exist
export async function getFraudAlerts(limit = 50) {
  try {
    return await query(`
      SELECT TOP (${limit})
        s.submission_id    AS id,
        s.trader_id,
        s.trader_name,
        s.trader_phone,
        s.market_id,
        s.market           AS market_name,
        s.item             AS item_name,
        s.price,
        s.variance_from_baseline,
        s.fraud_flag_reason AS description,
        s.submitted_at     AS detected_at,
        s.validation_status AS status
      FROM dbo.Submissions s
      WHERE s.fraud_flag = 1
      ORDER BY s.submitted_at DESC
    `);
  } catch {
    return [];
  }
}

// Pending payouts — safe fallback
export async function getPendingPayouts() {
  try {
    if (!(await query(`
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'Rewards_Ledger'
    `)).length) return [];

    return query(`
      SELECT
        ledger_id, recipient_id, recipient_type,
        recipient_phone, recipient_name,
        amount, network, status, reference,
        created_at, retry_count
      FROM dbo.Rewards_Ledger
      WHERE status IN ('PENDING', 'FAILED')
      ORDER BY created_at ASC
    `);
  } catch {
    return [];
  }
}

export default {
  getConnection, query, queryOne, execute, executeProc, closeConnection,
  getDashboardStats, getFraudAlerts, getRecentSubmissions,
  getPendingPayouts, getTraders,
};
