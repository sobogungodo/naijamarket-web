/**
 * ============================================================================
 * NAIJAMARKET INTEL - DATA ACCESS LIBRARY
 * ============================================================================
 * 
 * HYBRID DATA LAYER:
 * - PRIMARY: Azure SQL Database (faster, more reliable)
 * - FALLBACK: Google Sheets (backup if Azure is unavailable)
 * 
 * Azure SQL: naijafood.database.windows.net/NaijaMarketIntel
 * Google Sheets: 1n-7MXdoqvIoSHteBJaUYBmIPLjJBNtrE_jVuUxO5kr8
 * 
 * ============================================================================
 */

import { google } from 'googleapis';
import sql from 'mssql';

// ============================================================================
// CONFIGURATION
// ============================================================================

export const SHEETS_CONFIG = {
  SPREADSHEET_ID: '1n-7MXdoqvIoSHteBJaUYBmIPLjJBNtrE_jVuUxO5kr8',
  
  SHEETS: {
    VALIDATORS: 'Validators',
    VALIDATOR_VOTES: 'Validator_Votes',
    VALIDATION_QUEUE: 'Validation_Queue',
    SUBMISSIONS: 'Submissions',
    NOTIFICATION_QUEUE: 'Notification_Queue',
    USER_ROLES: 'User_Roles',
    VALIDATOR_REG_SESSIONS: 'Validator_Reg_Sessions',
    VALIDATOR_INVITE_CODES: 'Validator_Invite_Codes',
    COLLUSION_MONITOR: 'Collusion_Monitor',
    VALIDATOR_REPLACEMENTS: 'Validator_Replacements',
    REWARDS_LEDGER: 'Rewards_Ledger',
    GPS_VERIFICATION_LOG: 'GPS_Verification_Log',
    DEVICE_FINGERPRINTS: 'Device_Fingerprints',
    RE_VERIFICATION_LOG: 'Re_Verification_Log',
    FRAUD_FLAGS: 'Fraud_Flags',
    VALIDATOR_SUSPENSIONS: 'Validator_Suspensions',
    MARKETS: 'Markets',
    VALIDATOR_PAYOUT_LOG: 'Validator_Payout_Log',
    PAYOUT_SUMMARY: 'Payout_Summary',
    BANK_CODES: 'Bank_Codes',
    TRADERS: 'Traders',
    TRADER_SUBMISSIONS: 'Trader_Submissions',
    VALIDATED_PRICES: 'Validated_Prices',
  },
  
  // Synced with validators.txt CONFIG
  VALIDATION: {
    TIMEOUT_MINUTES: 30,
    VALIDATORS_REQUIRED: 3,
    CONSENSUS_REQUIRED: 2,
    MAX_DAILY_VALIDATIONS: 10,
  },
  
  REWARDS: {
    TRADER_APPROVED: 20,
    VALIDATOR_CORRECT: 100,
    VALIDATOR_INCORRECT: 0,
  },
  
  PAYOUT: {
    MINIMUM_BALANCE: 500,
    FREQUENCY_DAYS: 14,
    PAYMENT_METHODS: ['BANK_TRANSFER', 'AIRTIME'],
    DEFAULT_METHOD: 'BANK_TRANSFER',
    MAX_RETRIES: 3,
  },
  
  GPS: {
    DEFAULT_LATITUDE: 6.4541,
    DEFAULT_LONGITUDE: 3.3947,
    DEFAULT_ACCURACY: 10,
    DEFAULT_MARKET_RADIUS: 500,
    MAX_GPS_AGE_SECONDS: 300,
    SUSPICIOUS_VELOCITY_KMH: 120,
  },
  
  FRAUD: {
    PRICE_DEVIATION_THRESHOLD: 30,
    COLLUSION_WINDOW_DAYS: 7,
    GPS_RADIUS_METERS: 500,
    RAPID_SUBMISSION_THRESHOLD: 5,
  },
};

// ============================================================================
// AZURE SQL CONNECTION
// ============================================================================

const azureConfig: sql.config = {
  server: process.env.AZURE_SQL_SERVER || 'naijafood.database.windows.net',
  database: process.env.AZURE_SQL_DATABASE || 'NaijaMarketIntel',
  user: process.env.AZURE_SQL_USER || '',
  password: process.env.AZURE_SQL_PASSWORD || '',
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let azurePool: sql.ConnectionPool | null = null;
let azureAvailable = true;
let lastAzureCheck = 0;
const AZURE_CHECK_INTERVAL = 60000; // Re-check Azure every 60 seconds if it was down

/**
 * Get Azure SQL connection pool
 */
async function getAzurePool(): Promise<sql.ConnectionPool | null> {
  // Skip if we know Azure is unavailable (with periodic recheck)
  if (!azureAvailable && Date.now() - lastAzureCheck < AZURE_CHECK_INTERVAL) {
    return null;
  }

  // Check if credentials are configured
  if (!process.env.AZURE_SQL_USER || !process.env.AZURE_SQL_PASSWORD) {
    console.log('[DataLayer] Azure SQL credentials not configured, using Google Sheets');
    azureAvailable = false;
    return null;
  }

  try {
    if (!azurePool || !azurePool.connected) {
      azurePool = await sql.connect(azureConfig);
      console.log('[DataLayer] Connected to Azure SQL');
    }
    azureAvailable = true;
    return azurePool;
  } catch (error) {
    console.error('[DataLayer] Azure SQL connection failed:', error);
    azureAvailable = false;
    lastAzureCheck = Date.now();
    return null;
  }
}

// ============================================================================
// GOOGLE SHEETS CONNECTION (FALLBACK)
// ============================================================================

let sheetsClient: ReturnType<typeof google.sheets> | null = null;

/**
 * Initialize Google Sheets client with service account credentials
 */
async function getGoogleSheetsClient() {
  if (sheetsClient) return sheetsClient;
  
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  
  if (!credentials) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable not set');
  }
  
  try {
    const serviceAccount = JSON.parse(credentials);
    
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    sheetsClient = google.sheets({ version: 'v4', auth });
    return sheetsClient;
  } catch (error) {
    console.error('[DataLayer] Failed to initialize Google Sheets client:', error);
    throw error;
  }
}

// ============================================================================
// DATA SOURCE TRACKING
// ============================================================================

export type DataSource = 'AZURE_SQL' | 'GOOGLE_SHEETS';

let lastDataSource: DataSource = 'GOOGLE_SHEETS';

/**
 * Get the last data source used
 */
export function getLastDataSource(): DataSource {
  return lastDataSource;
}

/**
 * Check if Azure SQL is currently available
 */
export function isAzureAvailable(): boolean {
  return azureAvailable;
}

// ============================================================================
// GENERIC READ OPERATIONS
// ============================================================================

/**
 * Read from Google Sheets (fallback)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readFromSheets<T = any>(sheetName: string): Promise<T[]> {
  const sheets = await getGoogleSheetsClient();
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEETS_CONFIG.SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
  });
  
  const rows = response.data.values;
  if (!rows || rows.length < 2) return [];
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const headers = rows[0].map((h: any) => String(h).toLowerCase().trim().replace(/\s+/g, '_'));
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rows.slice(1).map((row: any[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj: Record<string, any> = {};
    headers.forEach((header: string, index: number) => {
      obj[header] = row[index] ?? null;
    });
    return obj as T;
  });
}

/**
 * Read from Azure SQL (primary)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readFromAzure<T = any>(tableName: string, orderBy?: string): Promise<T[]> {
  const pool = await getAzurePool();
  if (!pool) return [];
  
  try {
    const orderClause = orderBy ? `ORDER BY ${orderBy}` : '';
    const result = await pool.request().query(`SELECT * FROM dbo.${tableName} ${orderClause}`);
    return result.recordset as T[];
  } catch (error) {
    console.error(`[DataLayer] Azure SQL query failed for ${tableName}:`, error);
    throw error;
  }
}

/**
 * Hybrid read - tries Azure first, falls back to Google Sheets
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readSheet<T = any>(
  sheetName: string,
  azureTableName?: string,
  orderBy?: string
): Promise<T[]> {
  const tableName = azureTableName || sheetName;
  
  // Try Azure SQL first
  try {
    const pool = await getAzurePool();
    if (pool) {
      const data = await readFromAzure<T>(tableName, orderBy);
      lastDataSource = 'AZURE_SQL';
      console.log(`[DataLayer] Read ${data.length} rows from Azure SQL: ${tableName}`);
      return data;
    }
  } catch (error) {
    console.warn(`[DataLayer] Azure failed for ${tableName}, falling back to Sheets:`, error);
  }
  
  // Fallback to Google Sheets
  try {
    const data = await readFromSheets<T>(sheetName);
    lastDataSource = 'GOOGLE_SHEETS';
    console.log(`[DataLayer] Read ${data.length} rows from Google Sheets: ${sheetName}`);
    return data;
  } catch (error) {
    console.error(`[DataLayer] Both Azure and Sheets failed for ${sheetName}:`, error);
    throw error;
  }
}

// ============================================================================
// WRITE OPERATIONS (Always write to both for sync)
// ============================================================================

/**
 * Append a row to Google Sheets
 */
export async function appendRow(
  sheetName: string,
  values: unknown[]
): Promise<void> {
  const sheets = await getGoogleSheetsClient();
  
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEETS_CONFIG.SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [values],
    },
  });
}

/**
 * Update a specific cell in Google Sheets
 */
export async function updateCell(
  sheetName: string,
  cell: string,
  value: unknown
): Promise<void> {
  const sheets = await getGoogleSheetsClient();
  
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEETS_CONFIG.SPREADSHEET_ID,
    range: `${sheetName}!${cell}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[value]],
    },
  });
}

/**
 * Update a row by finding a match in a column (Google Sheets)
 */
export async function updateRowByMatch(
  sheetName: string,
  matchColumn: string,
  matchValue: string,
  updates: Record<string, unknown>
): Promise<boolean> {
  const sheets = await getGoogleSheetsClient();
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEETS_CONFIG.SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
  });
  
  const rows = response.data.values;
  if (!rows || rows.length < 2) return false;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const headers = rows[0].map((h: any) => String(h).toLowerCase().trim().replace(/\s+/g, '_'));
  const matchColIndex = headers.indexOf(matchColumn.toLowerCase());
  
  if (matchColIndex === -1) return false;
  
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][matchColIndex]) === matchValue) {
      rowIndex = i + 1;
      break;
    }
  }
  
  if (rowIndex === -1) return false;
  
  const updateRequests: { range: string; values: unknown[][] }[] = [];
  
  Object.entries(updates).forEach(([key, value]) => {
    const colIndex = headers.indexOf(key.toLowerCase());
    if (colIndex !== -1) {
      const colLetter = String.fromCharCode(65 + colIndex);
      updateRequests.push({
        range: `${sheetName}!${colLetter}${rowIndex}`,
        values: [[value]],
      });
    }
  });
  
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEETS_CONFIG.SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: updateRequests,
    },
  });
  
  return true;
}

/**
 * Update a row in Azure SQL
 */
export async function updateAzureRow(
  tableName: string,
  idColumn: string,
  idValue: string,
  updates: Record<string, unknown>
): Promise<boolean> {
  const pool = await getAzurePool();
  if (!pool) return false;
  
  try {
    const setClauses = Object.keys(updates).map((key, i) => `${key} = @val${i}`).join(', ');
    const request = pool.request();
    
    Object.entries(updates).forEach(([, value], i) => {
      request.input(`val${i}`, value);
    });
    request.input('id', idValue);
    
    await request.query(`UPDATE dbo.${tableName} SET ${setClauses} WHERE ${idColumn} = @id`);
    return true;
  } catch (error) {
    console.error(`[DataLayer] Azure update failed for ${tableName}:`, error);
    return false;
  }
}

// ============================================================================
// TYPED DATA INTERFACES
// ============================================================================

export interface Validator {
  validator_id: string;
  phone_number: string;
  full_name: string;
  email?: string;
  market_id: string;
  market_name: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'PENDING';
  tier: 'STANDARD' | 'SILVER' | 'GOLD' | 'PLATINUM';
  total_votes: number;
  correct_votes: number;
  accuracy_rate: number;
  avg_response_time_sec: number;
  total_earnings: number;
  pending_balance: number;
  last_vote_at: string;
  registered_at: string;
  state: string;
  bank_name?: string;
  account_number?: string;
  [key: string]: unknown;
}

export interface Trader {
  trader_id: string;
  phone_number: string;
  full_name: string;
  market_id: string;
  market_name: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'PENDING';
  reputation_score: number;
  total_submissions: number;
  approved_submissions: number;
  rejected_submissions: number;
  total_earnings: number;
  pending_balance: number;
  last_submission_at: string;
  registered_at: string;
  [key: string]: unknown;
}

export interface FraudAlert {
  alert_id: string;
  alert_type: 'GPS_SPOOFING' | 'PRICE_MANIPULATION' | 'COLLUSION' | 'RAPID_SUBMISSION' | 'DUPLICATE_DEVICE';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';
  user_id: string;
  user_phone: string;
  user_name: string;
  user_type: 'TRADER' | 'VALIDATOR';
  market_id: string;
  market_name: string;
  description: string;
  evidence: string;
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
  [key: string]: unknown;
}

export interface Payout {
  payout_id: string;
  user_id: string;
  user_phone: string;
  user_name: string;
  user_type: 'TRADER' | 'VALIDATOR';
  amount: number;
  payment_method: 'BANK_TRANSFER' | 'AIRTIME';
  bank_name?: string;
  account_number?: string;
  network?: 'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  failure_reason?: string;
  retry_count: number;
  transaction_ref?: string;
  created_at: string;
  processed_at?: string;
  [key: string]: unknown;
}

export interface Submission {
  submission_id: string;
  trader_id: string;
  trader_phone: string;
  trader_name: string;
  market_id: string;
  market_name: string;
  item_id: string;
  item_name: string;
  brand?: string;
  price: number;
  unit: string;
  status: 'PENDING' | 'VALIDATING' | 'APPROVED' | 'REJECTED';
  validation_deadline?: string;
  gps_latitude: number;
  gps_longitude: number;
  gps_accuracy: number;
  created_at: string;
  validated_at?: string;
  [key: string]: unknown;
}

export interface ValidationVote {
  vote_id: string;
  submission_id: string;
  validator_id: string;
  validator_phone: string;
  vote: 'APPROVE' | 'REJECT';
  is_correct?: boolean;
  response_time_sec: number;
  gps_latitude?: number;
  gps_longitude?: number;
  created_at: string;
  [key: string]: unknown;
}

export interface Market {
  market_id: string;
  market_name: string;
  state: string;
  city: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  operating_hours: string;
  status: 'ACTIVE' | 'INACTIVE';
  total_traders: number;
  total_validators: number;
  total_submissions: number;
  [key: string]: unknown;
}

export interface RewardsLedger {
  ledger_id: string;
  user_id: string;
  user_phone: string;
  user_type: 'TRADER' | 'VALIDATOR';
  transaction_type: 'EARNING' | 'PAYOUT' | 'ADJUSTMENT';
  amount: number;
  balance_after: number;
  reference_id?: string;
  description: string;
  created_at: string;
  [key: string]: unknown;
}

// ============================================================================
// SPECIFIC DATA FETCHERS (Hybrid: Azure → Sheets)
// ============================================================================

/**
 * Get all validators with computed stats
 */
export async function getValidators(): Promise<Validator[]> {
  const data = await readSheet<Validator>(
    SHEETS_CONFIG.SHEETS.VALIDATORS,
    'Validators',
    'registered_at DESC'
  );
  
  return data.map(v => ({
    ...v,
    total_votes: Number(v.total_votes) || 0,
    correct_votes: Number(v.correct_votes) || 0,
    accuracy_rate: Number(v.accuracy_rate) || 0,
    avg_response_time_sec: Number(v.avg_response_time_sec) || 0,
    total_earnings: Number(v.total_earnings) || 0,
    pending_balance: Number(v.pending_balance) || 0,
  }));
}

/**
 * Get all traders with computed stats
 */
export async function getTraders(): Promise<Trader[]> {
  const data = await readSheet<Trader>(
    SHEETS_CONFIG.SHEETS.TRADERS,
    'Traders',
    'registered_at DESC'
  );
  
  return data.map(t => ({
    ...t,
    reputation_score: Number(t.reputation_score) || 50,
    total_submissions: Number(t.total_submissions) || 0,
    approved_submissions: Number(t.approved_submissions) || 0,
    rejected_submissions: Number(t.rejected_submissions) || 0,
    total_earnings: Number(t.total_earnings) || 0,
    pending_balance: Number(t.pending_balance) || 0,
  }));
}

/**
 * Get fraud alerts with optional filters
 */
export async function getFraudAlerts(filters?: {
  status?: string;
  severity?: string;
  type?: string;
}): Promise<FraudAlert[]> {
  let data = await readSheet<FraudAlert>(
    SHEETS_CONFIG.SHEETS.FRAUD_FLAGS,
    'Fraud_Flags',
    'created_at DESC'
  );
  
  if (filters) {
    if (filters.status) {
      data = data.filter(a => a.status === filters.status);
    }
    if (filters.severity) {
      data = data.filter(a => a.severity === filters.severity);
    }
    if (filters.type) {
      data = data.filter(a => a.alert_type === filters.type);
    }
  }
  
  // Only sort if from Sheets (Azure already sorted)
  if (lastDataSource === 'GOOGLE_SHEETS') {
    data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  
  return data;
}

/**
 * Get payouts with optional filters
 */
export async function getPayouts(filters?: {
  status?: string;
  user_type?: string;
}): Promise<Payout[]> {
  let data = await readSheet<Payout>(
    SHEETS_CONFIG.SHEETS.VALIDATOR_PAYOUT_LOG,
    'Validator_Payout_Log',
    'created_at DESC'
  );
  
  if (filters) {
    if (filters.status) {
      data = data.filter(p => p.status === filters.status);
    }
    if (filters.user_type) {
      data = data.filter(p => p.user_type === filters.user_type);
    }
  }
  
  data = data.map(p => ({
    ...p,
    amount: Number(p.amount) || 0,
    retry_count: Number(p.retry_count) || 0,
  }));
  
  if (lastDataSource === 'GOOGLE_SHEETS') {
    data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  
  return data;
}

/**
 * Get submissions with optional filters
 */
export async function getSubmissions(filters?: {
  status?: string;
  market_id?: string;
}): Promise<Submission[]> {
  let data = await readSheet<Submission>(
    SHEETS_CONFIG.SHEETS.SUBMISSIONS,
    'Submissions',
    'created_at DESC'
  );
  
  if (filters) {
    if (filters.status) {
      data = data.filter(s => s.status === filters.status);
    }
    if (filters.market_id) {
      data = data.filter(s => s.market_id === filters.market_id);
    }
  }
  
  data = data.map(s => ({
    ...s,
    price: Number(s.price) || 0,
    gps_latitude: Number(s.gps_latitude) || 0,
    gps_longitude: Number(s.gps_longitude) || 0,
    gps_accuracy: Number(s.gps_accuracy) || 0,
  }));
  
  if (lastDataSource === 'GOOGLE_SHEETS') {
    data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  
  return data;
}

/**
 * Get markets
 */
export async function getMarkets(): Promise<Market[]> {
  const data = await readSheet<Market>(
    SHEETS_CONFIG.SHEETS.MARKETS,
    'Markets'
  );
  
  return data.map(m => ({
    ...m,
    latitude: Number(m.latitude) || 0,
    longitude: Number(m.longitude) || 0,
    radius_meters: Number(m.radius_meters) || 500,
    total_traders: Number(m.total_traders) || 0,
    total_validators: Number(m.total_validators) || 0,
    total_submissions: Number(m.total_submissions) || 0,
  }));
}

/**
 * Get validation queue (pending validations)
 */
export async function getValidationQueue(): Promise<Submission[]> {
  const data = await readSheet<Submission>(
    SHEETS_CONFIG.SHEETS.VALIDATION_QUEUE,
    'Validation_Queue'
  );
  return data.filter(s => s.status === 'VALIDATING' || s.status === 'PENDING');
}

/**
 * Get rewards ledger for a user
 */
export async function getRewardsLedger(userId?: string): Promise<RewardsLedger[]> {
  let data = await readSheet<RewardsLedger>(
    SHEETS_CONFIG.SHEETS.REWARDS_LEDGER,
    'Rewards_Ledger',
    'created_at DESC'
  );
  
  if (userId) {
    data = data.filter(r => r.user_id === userId);
  }
  
  data = data.map(r => ({
    ...r,
    amount: Number(r.amount) || 0,
    balance_after: Number(r.balance_after) || 0,
  }));
  
  if (lastDataSource === 'GOOGLE_SHEETS') {
    data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  
  return data;
}

// ============================================================================
// DASHBOARD STATISTICS
// ============================================================================

export interface DashboardStats {
  totalTraders: number;
  activeTraders: number;
  totalValidators: number;
  activeValidators: number;
  totalSubmissions: number;
  submissionsToday: number;
  pendingValidations: number;
  approvalRate: number;
  totalEarningsDistributed: number;
  pendingPayouts: number;
  pendingPayoutAmount: number;
  weeklyPayoutAmount: number;
  totalFraudAlerts: number;
  criticalAlerts: number;
  unresolvedAlerts: number;
  resolutionRate: number;
  activeMarkets: number;
  topMarketBySubmissions: string;
  dataSource: DataSource; // Track which source was used
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [traders, validators, submissions, fraudAlerts, payouts, markets] = await Promise.all([
    getTraders(),
    getValidators(),
    getSubmissions(),
    getFraudAlerts(),
    getPayouts(),
    getMarkets(),
  ]);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const submissionsToday = submissions.filter(s => 
    new Date(s.created_at) >= today
  ).length;
  
  const approvedSubmissions = submissions.filter(s => s.status === 'APPROVED').length;
  const approvalRate = submissions.length > 0 
    ? (approvedSubmissions / submissions.length) * 100 
    : 0;
  
  const pendingPayoutsList = payouts.filter(p => p.status === 'PENDING');
  const pendingPayoutAmount = pendingPayoutsList.reduce((sum, p) => sum + p.amount, 0);
  
  const unresolvedAlerts = fraudAlerts.filter(a => 
    a.status === 'PENDING' || a.status === 'INVESTIGATING'
  ).length;
  
  const resolvedAlerts = fraudAlerts.filter(a => 
    a.status === 'RESOLVED' || a.status === 'DISMISSED'
  ).length;
  
  const resolutionRate = fraudAlerts.length > 0 
    ? (resolvedAlerts / fraudAlerts.length) * 100 
    : 100;
  
  const marketSubmissionCounts = new Map<string, number>();
  submissions.forEach(s => {
    const count = marketSubmissionCounts.get(s.market_name) || 0;
    marketSubmissionCounts.set(s.market_name, count + 1);
  });
  
  let topMarket = 'N/A';
  let maxCount = 0;
  marketSubmissionCounts.forEach((count, market) => {
    if (count > maxCount) {
      maxCount = count;
      topMarket = market;
    }
  });
  
  return {
    totalTraders: traders.length,
    activeTraders: traders.filter(t => t.status === 'ACTIVE').length,
    totalValidators: validators.length,
    activeValidators: validators.filter(v => v.status === 'ACTIVE').length,
    totalSubmissions: submissions.length,
    submissionsToday,
    pendingValidations: submissions.filter(s => s.status === 'VALIDATING').length,
    approvalRate: Math.round(approvalRate * 10) / 10,
    totalEarningsDistributed: payouts
      .filter(p => p.status === 'COMPLETED')
      .reduce((sum, p) => sum + p.amount, 0),
    pendingPayouts: pendingPayoutsList.length,
    pendingPayoutAmount,
    weeklyPayoutAmount: pendingPayoutAmount,
    totalFraudAlerts: fraudAlerts.length,
    criticalAlerts: fraudAlerts.filter(a => a.severity === 'CRITICAL').length,
    unresolvedAlerts,
    resolutionRate: Math.round(resolutionRate * 10) / 10,
    activeMarkets: markets.filter(m => m.status === 'ACTIVE').length,
    topMarketBySubmissions: topMarket,
    dataSource: lastDataSource,
  };
}

// ============================================================================
// ACTION FUNCTIONS
// ============================================================================

/**
 * Suspend a user (trader or validator)
 * Writes to both Azure and Sheets for sync
 */
export async function suspendUser(
  userId: string,
  userType: 'TRADER' | 'VALIDATOR',
  reason: string,
  suspendedBy: string
): Promise<boolean> {
  const sheet = userType === 'VALIDATOR' 
    ? SHEETS_CONFIG.SHEETS.VALIDATORS 
    : SHEETS_CONFIG.SHEETS.TRADERS;
  
  const tableName = userType === 'VALIDATOR' ? 'Validators' : 'Traders';
  const idColumn = userType === 'VALIDATOR' ? 'validator_id' : 'trader_id';
  
  const updates = {
    status: 'SUSPENDED',
    suspended_at: new Date().toISOString(),
    suspended_by: suspendedBy,
    suspension_reason: reason,
  };
  
  // Update Azure first (if available)
  await updateAzureRow(tableName, idColumn, userId, updates);
  
  // Always update Sheets (source of truth for WhatsApp bot)
  const sheetUpdated = await updateRowByMatch(sheet, idColumn, userId, updates);
  
  if (sheetUpdated) {
    await appendRow(SHEETS_CONFIG.SHEETS.VALIDATOR_SUSPENSIONS, [
      `SUSP_${Date.now()}`,
      userId,
      userType,
      reason,
      suspendedBy,
      new Date().toISOString(),
      '',
      '',
    ]);
  }
  
  return sheetUpdated;
}

/**
 * Resolve a fraud alert
 */
export async function resolveFraudAlert(
  alertId: string,
  resolution: 'RESOLVED' | 'DISMISSED',
  notes: string,
  resolvedBy: string
): Promise<boolean> {
  const updates = {
    status: resolution,
    resolution_notes: notes,
    resolved_by: resolvedBy,
    resolved_at: new Date().toISOString(),
  };
  
  // Update Azure
  await updateAzureRow('Fraud_Flags', 'alert_id', alertId, updates);
  
  // Update Sheets
  return await updateRowByMatch(SHEETS_CONFIG.SHEETS.FRAUD_FLAGS, 'alert_id', alertId, updates);
}

/**
 * Retry a failed payout
 */
export async function retryPayout(payoutId: string): Promise<boolean> {
  const updates = {
    status: 'PENDING',
    retry_count: 0,
    failure_reason: '',
  };
  
  // Update Azure
  await updateAzureRow('Validator_Payout_Log', 'payout_id', payoutId, updates);
  
  // Update Sheets
  return await updateRowByMatch(SHEETS_CONFIG.SHEETS.VALIDATOR_PAYOUT_LOG, 'payout_id', payoutId, updates);
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

export interface HealthStatus {
  azure: {
    available: boolean;
    latencyMs?: number;
    error?: string;
  };
  sheets: {
    available: boolean;
    latencyMs?: number;
    error?: string;
  };
}

export async function checkHealth(): Promise<HealthStatus> {
  const status: HealthStatus = {
    azure: { available: false },
    sheets: { available: false },
  };
  
  // Check Azure
  try {
    const start = Date.now();
    const pool = await getAzurePool();
    if (pool) {
      await pool.request().query('SELECT 1');
      status.azure.available = true;
      status.azure.latencyMs = Date.now() - start;
    }
  } catch (error) {
    status.azure.error = error instanceof Error ? error.message : 'Unknown error';
  }
  
  // Check Sheets
  try {
    const start = Date.now();
    const sheets = await getGoogleSheetsClient();
    await sheets.spreadsheets.get({
      spreadsheetId: SHEETS_CONFIG.SPREADSHEET_ID,
      fields: 'properties.title',
    });
    status.sheets.available = true;
    status.sheets.latencyMs = Date.now() - start;
  } catch (error) {
    status.sheets.error = error instanceof Error ? error.message : 'Unknown error';
  }
  
  return status;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { getGoogleSheetsClient };

export default {
  SHEETS_CONFIG,
  getGoogleSheetsClient,
  readSheet,
  appendRow,
  updateCell,
  updateRowByMatch,
  updateAzureRow,
  getValidators,
  getTraders,
  getFraudAlerts,
  getPayouts,
  getSubmissions,
  getMarkets,
  getValidationQueue,
  getRewardsLedger,
  getDashboardStats,
  suspendUser,
  resolveFraudAlert,
  retryPayout,
  checkHealth,
  getLastDataSource,
  isAzureAvailable,
};
