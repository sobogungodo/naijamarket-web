/**
 * ============================================================================
 * NAIJAMARKET INTEL - GOOGLE SHEETS TO AZURE SQL SYNC
 * ============================================================================
 * 
 * This script syncs data from Google Sheets to Azure SQL Server.
 * Run this as an Azure Function on a schedule (e.g., every hour or daily).
 * 
 * Prerequisites:
 * - GOOGLE_SERVICE_ACCOUNT_KEY environment variable with service account JSON
 * - AZURE_SQL_CONNECTION_STRING environment variable
 * 
 * ============================================================================
 */

import { google } from 'googleapis';
import sql from 'mssql';

// Configuration
const CONFIG = {
  SPREADSHEET_ID: '1n-7MXdoqvIoSHteBJaUYBmIPLjJBNtrE_jVuUxO5kr8',
  
  // Sheets to sync
  SHEETS_TO_SYNC: [
    { sheet: 'Validators', table: 'dbo.Validators', keyColumn: 'validator_id' },
    { sheet: 'Traders', table: 'dbo.Traders', keyColumn: 'trader_id' },
    { sheet: 'Submissions', table: 'dbo.Submissions', keyColumn: 'submission_id' },
    { sheet: 'Validator_Votes', table: 'dbo.Validator_Votes', keyColumn: 'vote_id' },
    { sheet: 'Validation_Queue', table: 'dbo.Validation_Queue', keyColumn: 'submission_id' },
    { sheet: 'Rewards_Ledger', table: 'dbo.Rewards_Ledger', keyColumn: 'ledger_id' },
    { sheet: 'Fraud_Flags', table: 'dbo.Fraud_Flags', keyColumn: 'alert_id' },
    { sheet: 'Validator_Payout_Log', table: 'dbo.Validator_Payout_Log', keyColumn: 'payout_id' },
    { sheet: 'Markets', table: 'dbo.Markets', keyColumn: 'market_id' },
    { sheet: 'GPS_Verification_Log', table: 'dbo.GPS_Verification_Log', keyColumn: 'log_id' },
    { sheet: 'Collusion_Monitor', table: 'dbo.Collusion_Monitor', keyColumn: 'monitor_id' },
  ],
};

// Column type mappings for SQL Server
const COLUMN_TYPES: Record<string, Record<string, string>> = {
  'Validators': {
    phone_number: 'NVARCHAR(20)',
    full_name: 'NVARCHAR(100)',
    status: 'NVARCHAR(20)',
    tier: 'NVARCHAR(20)',
    total_votes: 'INT',
    correct_votes: 'INT',
    accuracy_rate: 'DECIMAL(5,2)',
    avg_response_time_sec: 'DECIMAL(10,2)',
    total_earnings: 'DECIMAL(18,2)',
    pending_balance: 'DECIMAL(18,2)',
    registered_at: 'DATETIME2',
    last_vote_at: 'DATETIME2',
  },
  'Traders': {
    phone_number: 'NVARCHAR(20)',
    full_name: 'NVARCHAR(100)',
    status: 'NVARCHAR(20)',
    reputation_score: 'INT',
    total_submissions: 'INT',
    approved_submissions: 'INT',
    rejected_submissions: 'INT',
    total_earnings: 'DECIMAL(18,2)',
    pending_balance: 'DECIMAL(18,2)',
    registered_at: 'DATETIME2',
    last_submission_at: 'DATETIME2',
  },
  'Fraud_Flags': {
    alert_type: 'NVARCHAR(50)',
    severity: 'NVARCHAR(20)',
    status: 'NVARCHAR(20)',
    user_phone: 'NVARCHAR(20)',
    user_name: 'NVARCHAR(100)',
    user_type: 'NVARCHAR(20)',
    description: 'NVARCHAR(MAX)',
    evidence: 'NVARCHAR(MAX)',
    created_at: 'DATETIME2',
    resolved_at: 'DATETIME2',
  },
};

// Initialize Google Sheets client
async function getGoogleSheetsClient() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!credentials) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set');
  }
  
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(credentials),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  
  return google.sheets({ version: 'v4', auth });
}

// Initialize Azure SQL connection
async function getAzureSqlPool(): Promise<sql.ConnectionPool> {
  const connectionString = process.env.AZURE_SQL_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('AZURE_SQL_CONNECTION_STRING not set');
  }
  
  return await sql.connect(connectionString);
}

// Read data from a Google Sheet
async function readGoogleSheet(sheetName: string): Promise<{ headers: string[]; rows: string[][] }> {
  const sheets = await getGoogleSheetsClient();
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
  });
  
  const values = response.data.values;
  if (!values || values.length < 2) {
    return { headers: [], rows: [] };
  }
  
  const headers = values[0].map((h: string) => String(h).toLowerCase().trim().replace(/\s+/g, '_'));
  const rows = values.slice(1);
  
  return { headers, rows };
}

// Convert value to appropriate SQL type
function convertValue(value: string | undefined, columnType: string): unknown {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  
  if (columnType.includes('INT')) {
    return parseInt(value) || 0;
  }
  
  if (columnType.includes('DECIMAL') || columnType.includes('FLOAT')) {
    return parseFloat(value) || 0;
  }
  
  if (columnType.includes('DATETIME')) {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  
  if (columnType.includes('BIT')) {
    return value.toLowerCase() === 'true' || value === '1';
  }
  
  return String(value);
}

// Sync a single sheet to SQL table
async function syncSheet(
  pool: sql.ConnectionPool,
  sheetConfig: { sheet: string; table: string; keyColumn: string }
): Promise<{ inserted: number; updated: number; errors: string[] }> {
  const { sheet, table, keyColumn } = sheetConfig;
  const result = { inserted: 0, updated: 0, errors: [] as string[] };
  
  try {
    console.log(`Syncing ${sheet} to ${table}...`);
    
    // Read from Google Sheets
    const { headers, rows } = await readGoogleSheet(sheet);
    
    if (rows.length === 0) {
      console.log(`  No data to sync for ${sheet}`);
      return result;
    }
    
    const columnTypes = COLUMN_TYPES[sheet] || {};
    
    // Process each row
    for (const row of rows) {
      const rowData: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        const columnType = columnTypes[header] || 'NVARCHAR(MAX)';
        rowData[header] = convertValue(row[index], columnType);
      });
      
      const keyValue = rowData[keyColumn];
      if (!keyValue) {
        result.errors.push(`Missing key column ${keyColumn} in row`);
        continue;
      }
      
      try {
        // Check if record exists
        const checkResult = await pool.request()
          .input('keyValue', sql.NVarChar, String(keyValue))
          .query(`SELECT COUNT(*) as count FROM ${table} WHERE ${keyColumn} = @keyValue`);
        
        const exists = checkResult.recordset[0].count > 0;
        
        if (exists) {
          // Update existing record
          const setClauses = Object.keys(rowData)
            .filter(k => k !== keyColumn)
            .map(k => `[${k}] = @${k}`)
            .join(', ');
          
          const request = pool.request();
          Object.entries(rowData).forEach(([key, value]) => {
            request.input(key, value);
          });
          
          await request.query(`UPDATE ${table} SET ${setClauses} WHERE ${keyColumn} = @${keyColumn}`);
          result.updated++;
        } else {
          // Insert new record
          const columns = Object.keys(rowData).map(k => `[${k}]`).join(', ');
          const values = Object.keys(rowData).map(k => `@${k}`).join(', ');
          
          const request = pool.request();
          Object.entries(rowData).forEach(([key, value]) => {
            request.input(key, value);
          });
          
          await request.query(`INSERT INTO ${table} (${columns}) VALUES (${values})`);
          result.inserted++;
        }
      } catch (rowError) {
        result.errors.push(`Error processing row ${keyValue}: ${rowError}`);
      }
    }
    
    console.log(`  Completed: ${result.inserted} inserted, ${result.updated} updated, ${result.errors.length} errors`);
    
  } catch (error) {
    result.errors.push(`Sheet sync error: ${error}`);
    console.error(`  Error syncing ${sheet}:`, error);
  }
  
  return result;
}

// Main sync function
export async function runSync(): Promise<{
  success: boolean;
  timestamp: string;
  results: Record<string, { inserted: number; updated: number; errors: string[] }>;
  summary: { totalInserted: number; totalUpdated: number; totalErrors: number };
}> {
  const timestamp = new Date().toISOString();
  const results: Record<string, { inserted: number; updated: number; errors: string[] }> = {};
  let pool: sql.ConnectionPool | null = null;
  
  try {
    console.log('='.repeat(60));
    console.log('Starting Google Sheets to Azure SQL sync');
    console.log('Timestamp:', timestamp);
    console.log('='.repeat(60));
    
    // Connect to Azure SQL
    pool = await getAzureSqlPool();
    console.log('Connected to Azure SQL Server');
    
    // Sync each sheet
    for (const sheetConfig of CONFIG.SHEETS_TO_SYNC) {
      results[sheetConfig.sheet] = await syncSheet(pool, sheetConfig);
    }
    
    // Calculate summary
    const summary = {
      totalInserted: Object.values(results).reduce((sum, r) => sum + r.inserted, 0),
      totalUpdated: Object.values(results).reduce((sum, r) => sum + r.updated, 0),
      totalErrors: Object.values(results).reduce((sum, r) => sum + r.errors.length, 0),
    };
    
    console.log('='.repeat(60));
    console.log('Sync complete!');
    console.log(`Total: ${summary.totalInserted} inserted, ${summary.totalUpdated} updated, ${summary.totalErrors} errors`);
    console.log('='.repeat(60));
    
    return {
      success: summary.totalErrors === 0,
      timestamp,
      results,
      summary,
    };
    
  } catch (error) {
    console.error('Sync failed:', error);
    return {
      success: false,
      timestamp,
      results,
      summary: { totalInserted: 0, totalUpdated: 0, totalErrors: 1 },
    };
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

// Azure Function handler
export default async function handler(context: { log: (...args: unknown[]) => void }): Promise<{
  status: number;
  body: unknown;
}> {
  context.log('Sync function triggered');
  
  const result = await runSync();
  
  return {
    status: result.success ? 200 : 500,
    body: result,
  };
}

// CLI execution
if (require.main === module) {
  runSync()
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
