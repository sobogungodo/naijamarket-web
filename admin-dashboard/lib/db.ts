import sql from 'mssql';

// ============================================
// AZURE SQL DATABASE CONNECTION
// NaijaMarket Intel Admin Dashboard
// ============================================

const config: sql.config = {
  user: process.env.AZURE_SQL_USER || '',
  password: process.env.AZURE_SQL_PASSWORD || '',
  server: process.env.AZURE_SQL_SERVER || 'naijafood.database.windows.net',
  database: process.env.AZURE_SQL_DATABASE || 'NaijaMarketIntel',
  options: {
    encrypt: true, // Required for Azure
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

// Global connection pool
let pool: sql.ConnectionPool | null = null;

/**
 * Get database connection pool
 * Creates new pool if not exists, reuses existing pool otherwise
 */
export async function getConnection(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }

  try {
    pool = await sql.connect(config);
    console.log('✅ Connected to Azure SQL Database');
    return pool;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

/**
 * Execute a query and return results
 */
export async function query<T>(
  sqlQuery: string,
  params?: Record<string, unknown>
): Promise<T[]> {
  const connection = await getConnection();
  const request = connection.request();

  // Add parameters if provided
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });
  }

  const result = await request.query(sqlQuery);
  return result.recordset as T[];
}

/**
 * Execute a query and return single result
 */
export async function queryOne<T>(
  sqlQuery: string,
  params?: Record<string, unknown>
): Promise<T | null> {
  const results = await query<T>(sqlQuery, params);
  return results[0] || null;
}

/**
 * Execute a stored procedure
 */
export async function executeProc<T>(
  procName: string,
  params?: Record<string, unknown>
): Promise<T[]> {
  const connection = await getConnection();
  const request = connection.request();

  // Add parameters if provided
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });
  }

  const result = await request.execute(procName);
  return result.recordset as T[];
}

/**
 * Execute a non-query command (INSERT, UPDATE, DELETE)
 */
export async function execute(
  sqlQuery: string,
  params?: Record<string, unknown>
): Promise<number> {
  const connection = await getConnection();
  const request = connection.request();

  // Add parameters if provided
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });
  }

  const result = await request.query(sqlQuery);
  return result.rowsAffected[0];
}

/**
 * Close the database connection
 */
export async function closeConnection(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('Database connection closed');
  }
}

// ============================================
// DASHBOARD-SPECIFIC QUERIES
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

/**
 * Get dashboard overview statistics
 */
export async function getDashboardStats(): Promise<DashboardStatsResult> {
  const statsQuery = `
    -- Get trader stats
    DECLARE @totalTraders INT = (SELECT COUNT(*) FROM dbo.Traders);
    DECLARE @activeTraders INT = (
      SELECT COUNT(*) FROM dbo.Traders 
      WHERE LastActive >= DATEADD(day, -7, GETUTCDATE()) AND Status = 'active'
    );
    
    -- Get validator stats
    DECLARE @totalValidators INT = (SELECT COUNT(*) FROM dbo.Validators);
    DECLARE @activeValidators INT = (
      SELECT COUNT(*) FROM dbo.Validators 
      WHERE LastActive >= DATEADD(day, -7, GETUTCDATE()) AND Status = 'active'
    );
    
    -- Get submission stats
    DECLARE @totalSubmissions INT = (SELECT COUNT(*) FROM dbo.Submissions);
    DECLARE @submissionsToday INT = (
      SELECT COUNT(*) FROM dbo.Submissions 
      WHERE CAST(SubmittedAt AS DATE) = CAST(GETUTCDATE() AS DATE)
    );
    DECLARE @pendingValidations INT = (
      SELECT COUNT(*) FROM dbo.Submissions 
      WHERE Status = 'pending_validation'
    );
    DECLARE @approvedCount INT = (
      SELECT COUNT(*) FROM dbo.Submissions WHERE Status = 'approved'
    );
    DECLARE @approvalRate DECIMAL(5,2) = 
      CASE WHEN @totalSubmissions > 0 
        THEN CAST(@approvedCount AS DECIMAL) / @totalSubmissions * 100 
        ELSE 0 
      END;
    
    -- Get financial stats
    DECLARE @totalPendingPayout DECIMAL(18,2) = (
      SELECT ISNULL(SUM(Amount), 0) FROM dbo.RewardsLedger WHERE Status = 'pending'
    );
    DECLARE @totalPaidOut DECIMAL(18,2) = (
      SELECT ISNULL(SUM(Amount), 0) FROM dbo.RewardsLedger WHERE Status = 'paid'
    );
    
    -- Get market stats
    DECLARE @marketsActive INT = (SELECT COUNT(*) FROM dbo.Markets WHERE IsActive = 1);
    DECLARE @commoditiesTracked INT = (SELECT COUNT(*) FROM dbo.ItemsCatalog WHERE IsActive = 1);
    
    SELECT 
      @totalTraders as totalTraders,
      @activeTraders as activeTraders,
      @totalValidators as totalValidators,
      @activeValidators as activeValidators,
      @totalSubmissions as totalSubmissions,
      @submissionsToday as submissionsToday,
      @pendingValidations as pendingValidations,
      @approvalRate as approvalRate,
      @totalPendingPayout as totalPendingPayout,
      @totalPaidOut as totalPaidOut,
      @marketsActive as marketsActive,
      @commoditiesTracked as commoditiesTracked;
  `;

  const result = await queryOne<DashboardStatsResult>(statsQuery);
  return result || {
    totalTraders: 0,
    activeTraders: 0,
    totalValidators: 0,
    activeValidators: 0,
    totalSubmissions: 0,
    submissionsToday: 0,
    pendingValidations: 0,
    approvalRate: 0,
    totalPendingPayout: 0,
    totalPaidOut: 0,
    marketsActive: 0,
    commoditiesTracked: 0,
  };
}

/**
 * Get fraud alerts
 */
export async function getFraudAlerts(limit = 50) {
  const alertsQuery = `
    SELECT TOP (@limit)
      fa.Id,
      fa.Type,
      fa.Severity,
      fa.Title,
      fa.Description,
      fa.DetectedAt,
      fa.Status,
      fa.SubmissionId,
      fa.TraderId,
      fa.ValidatorId,
      fa.ResolvedBy,
      fa.ResolvedAt,
      fa.Resolution,
      t.Name as TraderName,
      t.PhoneNumber as TraderPhone,
      v.Name as ValidatorName
    FROM dbo.FraudAlerts fa
    LEFT JOIN dbo.Traders t ON fa.TraderId = t.Id
    LEFT JOIN dbo.Validators v ON fa.ValidatorId = v.Id
    ORDER BY 
      CASE fa.Severity 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
      END,
      fa.DetectedAt DESC
  `;

  return query(alertsQuery, { limit });
}

/**
 * Get recent submissions
 */
export async function getRecentSubmissions(limit = 100) {
  const submissionsQuery = `
    SELECT TOP (@limit)
      s.Id,
      s.TraderId,
      s.TraderName,
      s.TraderPhone,
      s.MarketId,
      m.Name as MarketName,
      s.CommodityId,
      c.Name as CommodityName,
      s.Price,
      s.Unit,
      s.GpsLatitude,
      s.GpsLongitude,
      s.DistanceFromMarket,
      s.SubmittedAt,
      s.Status,
      s.ValidationDeadline,
      s.PriceDeviation,
      s.InstantApproval
    FROM dbo.Submissions s
    LEFT JOIN dbo.Markets m ON s.MarketId = m.Id
    LEFT JOIN dbo.ItemsCatalog c ON s.CommodityId = c.Id
    ORDER BY s.SubmittedAt DESC
  `;

  return query(submissionsQuery, { limit });
}

/**
 * Get pending payouts
 */
export async function getPendingPayouts() {
  const payoutsQuery = `
    SELECT 
      r.Id,
      r.RecipientId,
      r.RecipientType,
      r.RecipientPhone,
      r.RecipientName,
      r.Amount,
      r.Network,
      r.Status,
      r.Reference,
      r.CreatedAt,
      r.RetryCount
    FROM dbo.RewardsLedger r
    WHERE r.Status IN ('pending', 'failed')
    ORDER BY r.CreatedAt ASC
  `;

  return query(payoutsQuery);
}

/**
 * Get traders with filters
 */
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
    whereClause += ` AND (t.Name LIKE @search OR t.PhoneNumber LIKE @search)`;
    params.search = `%${filters.search}%`;
  }

  if (filters?.status) {
    whereClause += ` AND t.Status = @status`;
    params.status = filters.status;
  }

  if (filters?.marketId) {
    whereClause += ` AND t.MarketId = @marketId`;
    params.marketId = filters.marketId;
  }

  if (filters?.minReputation !== undefined) {
    whereClause += ` AND t.Reputation >= @minReputation`;
    params.minReputation = filters.minReputation;
  }

  if (filters?.maxReputation !== undefined) {
    whereClause += ` AND t.Reputation <= @maxReputation`;
    params.maxReputation = filters.maxReputation;
  }

  const tradersQuery = `
    SELECT 
      t.Id,
      t.PhoneNumber,
      t.Name,
      t.MarketId,
      m.Name as MarketName,
      t.Reputation,
      t.TotalSubmissions,
      t.ApprovedSubmissions,
      t.RejectedSubmissions,
      t.PendingBalance,
      t.TotalEarned,
      t.TotalPaid,
      t.RegisteredAt,
      t.LastActive,
      t.Status,
      t.BankVerified,
      t.GpsVerified
    FROM dbo.Traders t
    LEFT JOIN dbo.Markets m ON t.MarketId = m.Id
    ${whereClause}
    ORDER BY t.LastActive DESC
    OFFSET @offset ROWS
    FETCH NEXT @pageSize ROWS ONLY;
    
    SELECT COUNT(*) as total FROM dbo.Traders t ${whereClause};
  `;

  const connection = await getConnection();
  const request = connection.request();
  
  Object.entries(params).forEach(([key, value]) => {
    request.input(key, value);
  });

  const result = await request.query(tradersQuery);
  
  return {
    items: result.recordsets[0],
    total: result.recordsets[1][0]?.total || 0,
  };
}

/**
 * Update trader status
 */
export async function updateTraderStatus(
  traderId: string,
  status: string,
  reason?: string,
  updatedBy?: string
) {
  const updateQuery = `
    UPDATE dbo.Traders
    SET 
      Status = @status,
      UpdatedAt = GETUTCDATE(),
      UpdatedBy = @updatedBy,
      StatusReason = @reason
    WHERE Id = @traderId;
    
    INSERT INTO dbo.AuditLog (EntityType, EntityId, Action, OldValue, NewValue, Reason, PerformedBy, PerformedAt)
    SELECT 
      'Trader', @traderId, 'STATUS_CHANGE',
      (SELECT Status FROM dbo.Traders WHERE Id = @traderId),
      @status, @reason, @updatedBy, GETUTCDATE();
  `;

  return execute(updateQuery, { traderId, status, reason, updatedBy });
}

export default {
  getConnection,
  query,
  queryOne,
  execute,
  executeProc,
  closeConnection,
  getDashboardStats,
  getFraudAlerts,
  getRecentSubmissions,
  getPendingPayouts,
  getTraders,
  updateTraderStatus,
};
