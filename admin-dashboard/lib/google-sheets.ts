/**
 * ============================================================================
 * NAIJAMARKET INTEL - GOOGLE SHEETS INTEGRATION LIBRARY
 * ============================================================================
 * 
 * This library provides functions to read/write data from the NaijaMarket
 * Google Sheets database used by the WhatsApp bot (validators.txt).
 * 
 * Spreadsheet ID: 1n-7MXdoqvIoSHteBJaUYBmIPLjJBNtrE_jVuUxO5kr8
 * 
 * ============================================================================
 */

import { google } from 'googleapis';

// ============================================================================
// CONFIGURATION - Synced with validators.txt CONFIG
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
    // Trader sheets
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
    TRADER_APPROVED: 20,      // ₦20 per approved submission
    VALIDATOR_CORRECT: 100,   // ₦100 per correct vote (from script)
    VALIDATOR_INCORRECT: 0,
  },
  
  PAYOUT: {
    MINIMUM_BALANCE: 500,
    FREQUENCY_DAYS: 14,       // Bi-weekly
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
    PRICE_DEVIATION_THRESHOLD: 30,  // 30% deviation triggers flag
    COLLUSION_WINDOW_DAYS: 7,
    GPS_RADIUS_METERS: 500,
    RAPID_SUBMISSION_THRESHOLD: 5,  // per hour
  },
};

// ============================================================================
// GOOGLE SHEETS CLIENT
// ============================================================================

let sheetsClient: ReturnType<typeof google.sheets> | null = null;

/**
 * Initialize Google Sheets client with service account credentials
 */
export async function getGoogleSheetsClient() {
  if (sheetsClient) return sheetsClient;
  
  // Check for credentials in environment
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
    console.error('Failed to initialize Google Sheets client:', error);
    throw error;
  }
}

// ============================================================================
// GENERIC SHEET OPERATIONS
// ============================================================================

/**
 * Read all data from a sheet and convert to objects
 */
export async function readSheet<T extends Record<string, unknown>>(
  sheetName: string
): Promise<T[]> {
  const sheets = await getGoogleSheetsClient();
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEETS_CONFIG.SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
  });
  
  const rows = response.data.values;
  if (!rows || rows.length < 2) return [];
  
  const headers = rows[0].map((h: string) => String(h).toLowerCase().trim().replace(/\s+/g, '_'));
  
  return rows.slice(1).map((row: unknown[]) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((header: string, index: number) => {
      obj[header] = row[index] ?? null;
    });
    return obj as T;
  });
}

/**
 * Append a row to a sheet
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
 * Update a specific cell
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
 * Update a row by finding a match in a column
 */
export async function updateRowByMatch(
  sheetName: string,
  matchColumn: string,
  matchValue: string,
  updates: Record<string, unknown>
): Promise<boolean> {
  const sheets = await getGoogleSheetsClient();
  
  // First, read the sheet to find the row
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEETS_CONFIG.SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
  });
  
  const rows = response.data.values;
  if (!rows || rows.length < 2) return false;
  
  const headers = rows[0].map((h: string) => String(h).toLowerCase().trim().replace(/\s+/g, '_'));
  const matchColIndex = headers.indexOf(matchColumn.toLowerCase());
  
  if (matchColIndex === -1) return false;
  
  // Find the row
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][matchColIndex]) === matchValue) {
      rowIndex = i + 1; // 1-indexed for Sheets
      break;
    }
  }
  
  if (rowIndex === -1) return false;
  
  // Update each field
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
  
  // Batch update
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEETS_CONFIG.SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: updateRequests,
    },
  });
  
  return true;
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
  evidence: string; // JSON string
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
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
}

// ============================================================================
// SPECIFIC DATA FETCHERS
// ============================================================================

/**
 * Get all validators with computed stats
 */
export async function getValidators(): Promise<Validator[]> {
  const data = await readSheet<Validator>(SHEETS_CONFIG.SHEETS.VALIDATORS);
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
  const data = await readSheet<Trader>(SHEETS_CONFIG.SHEETS.TRADERS);
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
  let data = await readSheet<FraudAlert>(SHEETS_CONFIG.SHEETS.FRAUD_FLAGS);
  
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
  
  // Sort by created_at descending
  data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  return data;
}

/**
 * Get payouts with optional filters
 */
export async function getPayouts(filters?: {
  status?: string;
  user_type?: string;
}): Promise<Payout[]> {
  let data = await readSheet<Payout>(SHEETS_CONFIG.SHEETS.VALIDATOR_PAYOUT_LOG);
  
  // Also get trader payouts if they exist in a separate sheet
  // For now, assuming all payouts are in one sheet
  
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
  
  // Sort by created_at descending
  data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  return data;
}

/**
 * Get submissions with optional filters
 */
export async function getSubmissions(filters?: {
  status?: string;
  market_id?: string;
}): Promise<Submission[]> {
  let data = await readSheet<Submission>(SHEETS_CONFIG.SHEETS.SUBMISSIONS);
  
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
  
  // Sort by created_at descending
  data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  return data;
}

/**
 * Get markets
 */
export async function getMarkets(): Promise<Market[]> {
  const data = await readSheet<Market>(SHEETS_CONFIG.SHEETS.MARKETS);
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
  const data = await readSheet<Submission>(SHEETS_CONFIG.SHEETS.VALIDATION_QUEUE);
  return data.filter(s => s.status === 'VALIDATING' || s.status === 'PENDING');
}

/**
 * Get rewards ledger for a user
 */
export async function getRewardsLedger(userId?: string): Promise<RewardsLedger[]> {
  let data = await readSheet<RewardsLedger>(SHEETS_CONFIG.SHEETS.REWARDS_LEDGER);
  
  if (userId) {
    data = data.filter(r => r.user_id === userId);
  }
  
  data = data.map(r => ({
    ...r,
    amount: Number(r.amount) || 0,
    balance_after: Number(r.balance_after) || 0,
  }));
  
  // Sort by created_at descending
  data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  return data;
}

// ============================================================================
// DASHBOARD STATISTICS
// ============================================================================

export interface DashboardStats {
  // Users
  totalTraders: number;
  activeTraders: number;
  totalValidators: number;
  activeValidators: number;
  
  // Submissions
  totalSubmissions: number;
  submissionsToday: number;
  pendingValidations: number;
  approvalRate: number;
  
  // Financial
  totalEarningsDistributed: number;
  pendingPayouts: number;
  pendingPayoutAmount: number;
  weeklyPayoutAmount: number;
  
  // Fraud
  totalFraudAlerts: number;
  criticalAlerts: number;
  unresolvedAlerts: number;
  resolutionRate: number;
  
  // Markets
  activeMarkets: number;
  topMarketBySubmissions: string;
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
  
  // Find top market
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
    weeklyPayoutAmount: pendingPayoutAmount, // Simplified
    
    totalFraudAlerts: fraudAlerts.length,
    criticalAlerts: fraudAlerts.filter(a => a.severity === 'CRITICAL').length,
    unresolvedAlerts,
    resolutionRate: Math.round(resolutionRate * 10) / 10,
    
    activeMarkets: markets.filter(m => m.status === 'ACTIVE').length,
    topMarketBySubmissions: topMarket,
  };
}

// ============================================================================
// ACTION FUNCTIONS
// ============================================================================

/**
 * Suspend a user (trader or validator)
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
  
  const idColumn = userType === 'VALIDATOR' ? 'validator_id' : 'trader_id';
  
  const updated = await updateRowByMatch(sheet, idColumn, userId, {
    status: 'SUSPENDED',
    suspended_at: new Date().toISOString(),
    suspended_by: suspendedBy,
    suspension_reason: reason,
  });
  
  // Also log to suspensions sheet
  if (updated) {
    await appendRow(SHEETS_CONFIG.SHEETS.VALIDATOR_SUSPENSIONS, [
      `SUSP_${Date.now()}`,
      userId,
      userType,
      reason,
      suspendedBy,
      new Date().toISOString(),
      '', // reinstated_at
      '', // reinstated_by
    ]);
  }
  
  return updated;
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
  return await updateRowByMatch(SHEETS_CONFIG.SHEETS.FRAUD_FLAGS, 'alert_id', alertId, {
    status: resolution,
    resolution_notes: notes,
    resolved_by: resolvedBy,
    resolved_at: new Date().toISOString(),
  });
}

/**
 * Retry a failed payout
 */
export async function retryPayout(payoutId: string): Promise<boolean> {
  return await updateRowByMatch(SHEETS_CONFIG.SHEETS.VALIDATOR_PAYOUT_LOG, 'payout_id', payoutId, {
    status: 'PENDING',
    retry_count: 0, // Will be incremented by the payout processor
    failure_reason: '',
  });
}

export default {
  SHEETS_CONFIG,
  getGoogleSheetsClient,
  readSheet,
  appendRow,
  updateCell,
  updateRowByMatch,
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
};
