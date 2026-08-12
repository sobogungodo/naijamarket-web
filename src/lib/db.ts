import { PrismaClient } from "@prisma/client";
import { google } from 'googleapis';
import { translateTSQL } from './tsql-translate';

// =============================================================================
// PRISMA CLIENT (EXISTING)
// =============================================================================
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const realPrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = realPrisma;

// =============================================================================
// SUPABASE DEV BACKEND — backend-aware prisma proxy (DB_BACKEND=supabase)
// =============================================================================
// The consumer web reaches the DB almost entirely through Prisma's RAW methods
// ($queryRaw / $queryRawUnsafe / $executeRaw / $executeRawUnsafe). When DB_BACKEND=supabase
// we route those four methods to the Supabase pg pool, applying translateTSQL() to the
// (T-SQL) text so the ~220 raw sites run on Postgres without per-file edits. Production
// leaves DB_BACKEND unset → the real Prisma/Azure client is returned untouched.
//
// NOT proxied: Prisma model-builder methods (prisma.<model>.findMany/…, ~65 sites) still
// hit the real client — port those separately (raw-ify or a pg-generated client) for a pure
// Supabase run. int8 is parsed to Number so COUNT(*) arithmetic in routes keeps working.
const USE_SUPABASE = process.env.DB_BACKEND === 'supabase';

function taggedToPg(strings: TemplateStringsArray, values: unknown[]): { text: string; values: unknown[] } {
  let text = '';
  strings.forEach((s, i) => { text += s; if (i < values.length) text += '$' + (i + 1); });
  return { text: translateTSQL(text), values };
}
// $queryRawUnsafe/$executeRawUnsafe: most callers pass a prebuilt string (no params). Convert
// any `?` placeholders to $n, leave $n as-is, then translate.
function normalizeUnsafe(sql: string): string {
  let i = 0;
  const s = sql.replace(/\?/g, () => '$' + (++i));
  return translateTSQL(s);
}

async function sbPool() {
  const { supabasePool } = await import('./db-supabase');
  return supabasePool();
}

export const prisma: PrismaClient = USE_SUPABASE
  ? (new Proxy(realPrisma, {
      get(target, prop, receiver) {
        switch (prop) {
          case '$queryRaw':
            return async (strings: TemplateStringsArray, ...values: unknown[]) => {
              const { text, values: v } = taggedToPg(strings, values);
              return (await (await sbPool()).query(text, v)).rows;
            };
          case '$executeRaw':
            return async (strings: TemplateStringsArray, ...values: unknown[]) => {
              const { text, values: v } = taggedToPg(strings, values);
              return (await (await sbPool()).query(text, v)).rowCount ?? 0;
            };
          case '$queryRawUnsafe':
            return async (sql: string, ...params: unknown[]) =>
              (await (await sbPool()).query(normalizeUnsafe(sql), params)).rows;
          case '$executeRawUnsafe':
            return async (sql: string, ...params: unknown[]) =>
              (await (await sbPool()).query(normalizeUnsafe(sql), params)).rowCount ?? 0;
          default: {
            const val = Reflect.get(target, prop, receiver);
            return typeof val === 'function' ? val.bind(target) : val;
          }
        }
      },
    }) as unknown as PrismaClient)
  : realPrisma;

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

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

// =============================================================================
// GOOGLE SHEETS CONFIGURATION (FALLBACK)
// =============================================================================
const getSheets = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
};

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '1n-7MXdoqvIoSHteBJaUYBmIPLjJBNtrE_jVuUxO5kr8';

// =============================================================================
// TRADER FUNCTIONS (PRISMA PRIMARY + GOOGLE SHEETS FALLBACK)
// =============================================================================

export async function findTrader(phone: string) {
  // Try Prisma/Azure SQL first
  try {
    const trader = await prisma.$queryRaw<any[]>`
      SELECT 
        phone_number,
        full_name,
        first_name,
        registration_status,
        trader_id,
        assigned_market_id,
        assigned_market_name,
        assigned_state,
        reputation,
        tier_name,
        balance,
        total_earned,
        total_submissions,
        approved_submissions,
        rejected_submissions
      FROM Traders_register
      WHERE phone_number = ${phone} AND registration_status = 'APPROVED'
    `;

    if (trader && trader.length > 0) {
      const row = trader[0];
      return {
        phone: row.phone_number,
        fullName: row.full_name || row.first_name || 'Trader',
        firstName: row.first_name,
        status: row.registration_status,
        traderId: row.trader_id,
        marketId: row.assigned_market_id,
        marketName: row.assigned_market_name || 'Unknown Market',
        marketState: row.assigned_state,
        marketLat: 6.4541,  // Default Lagos coordinates (market GPS not in table)
        marketLng: 3.3947,
        reputation: parseInt(row.reputation || '50'),
        tier: row.tier_name || 'New',
        balance: parseFloat(row.balance || '0'),
        totalEarned: parseFloat(row.total_earned || '0'),
        totalSubmissions: parseInt(row.total_submissions || '0'),
        approvedSubmissions: parseInt(row.approved_submissions || '0'),
        rejectedSubmissions: parseInt(row.rejected_submissions || '0')
      };
    }
  } catch (error) {
    console.error('Prisma query failed, falling back to Sheets:', error);
  }

  // Fallback to Google Sheets
  try {
    const sheets = getSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Traders_register!A:AZ',
    });

    const rows = response.data.values || [];
    if (rows.length < 2) return null;

    const headers = rows[0];
    const getIdx = (name: string) => headers.indexOf(name);

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[getIdx('phone_number')] === phone && row[getIdx('registration_status')] === 'APPROVED') {
        return {
          phone: row[getIdx('phone_number')],
          fullName: row[getIdx('full_name')] || row[getIdx('first_name')] || 'Trader',
          firstName: row[getIdx('first_name')],
          status: row[getIdx('registration_status')],
          traderId: row[getIdx('trader_id')],
          marketId: row[getIdx('assigned_market_id')],
          marketName: row[getIdx('assigned_market_name')] || 'Unknown Market',
          marketState: row[getIdx('assigned_state')],
          marketLat: 6.4541,  // Default Lagos coordinates
          marketLng: 3.3947,
          reputation: parseInt(row[getIdx('reputation')] || '50'),
          tier: row[getIdx('tier_name')] || 'New',
          balance: parseFloat(row[getIdx('balance')] || '0'),
          totalEarned: parseFloat(row[getIdx('total_earned')] || '0'),
          totalSubmissions: parseInt(row[getIdx('total_submissions')] || '0'),
          approvedSubmissions: parseInt(row[getIdx('approved_submissions')] || '0'),
          rejectedSubmissions: parseInt(row[getIdx('rejected_submissions')] || '0')
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Google Sheets fallback failed:', error);
    return null;
  }
}

export async function storeOTP(phone: string, otp: string, traderName: string): Promise<boolean> {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  const createdAt = new Date();

  // Try Prisma/Azure SQL first
  try {
    await prisma.$executeRaw`UPDATE OTP_Sessions SET otp = 'USED' WHERE phone = ${phone} AND otp <> 'USED'`;
    await prisma.$executeRaw`
      INSERT INTO OTP_Sessions (phone, otp, expires_at, trader_name, created_at)
      VALUES (${phone}, ${otp}, ${expiresAt}, ${traderName}, ${createdAt})
    `;
    return true;
  } catch (error) {
    console.error('Prisma OTP store failed, falling back to Sheets:', error);
  }

  // Fallback to Google Sheets
  try {
    const sheets = getSheets();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'OTP_Sessions!A:E',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[phone, otp, expiresAt.toISOString(), traderName, createdAt.toISOString()]]
      }
    });
    return true;
  } catch (error) {
    console.error('Google Sheets OTP store failed:', error);
    return false;
  }
}

export async function verifyOTP(phone: string, otp: string): Promise<{ valid: boolean; traderName?: string }> {
  // Try Prisma/Azure SQL first
  try {
    const result = await prisma.$queryRaw<any[]>`
      SELECT otp_session_id, trader_name
      FROM OTP_Sessions
      WHERE phone = ${phone} AND otp = ${otp} AND expires_at > GETUTCDATE() AND otp <> 'USED'
    `;

    if (result && result.length > 0) {
      const { otp_session_id, trader_name } = result[0];
      await prisma.$executeRaw`
        UPDATE OTP_Sessions SET otp = 'USED', verified_at = GETUTCDATE() WHERE otp_session_id = ${otp_session_id}
      `;
      return { valid: true, traderName: trader_name };
    }
  } catch (error) {
    console.error('Prisma OTP verify failed, falling back to Sheets:', error);
  }

  // Fallback to Google Sheets
  try {
    const sheets = getSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'OTP_Sessions!A:E',
    });

    const rows = response.data.values || [];
    if (rows.length < 2) return { valid: false };

    const now = new Date();

    for (let i = rows.length - 1; i >= 1; i--) {
      const row = rows[i];
      if (row[0] === phone && row[1] === otp && new Date(row[2]) > now) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `OTP_Sessions!B${i + 1}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [['USED']] }
        });
        return { valid: true, traderName: row[3] };
      }
    }
    return { valid: false };
  } catch (error) {
    console.error('Google Sheets OTP verify failed:', error);
    return { valid: false };
  }
}

export async function getTraderBalance(phone: string) {
  // Try Prisma/Azure SQL first
  try {
    const result = await prisma.$queryRaw<any[]>`
      SELECT 
        ISNULL(SUM(CASE WHEN type IN ('SUBMISSION', 'VALIDATION') AND status IN ('APPROVED', 'PAID') THEN amount ELSE 0 END), 0) as earned,
        ISNULL(SUM(CASE WHEN type = 'PAYOUT' AND status = 'PAID' THEN amount ELSE 0 END), 0) as paid,
        ISNULL(SUM(CASE WHEN status IN ('PENDING', 'PENDING_VALIDATION') THEN amount ELSE 0 END), 0) as pending
      FROM Rewards_Ledger
      WHERE phone = ${phone}
    `;

    if (result && result.length > 0) {
      const { earned, paid, pending } = result[0];
      return { balance: Math.max(0, Number(earned) - Number(paid)), pendingBalance: Number(pending) };
    }
  } catch (error) {
    console.error('Prisma balance query failed, falling back to Sheets:', error);
  }

  // Fallback to Google Sheets
  try {
    const sheets = getSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Rewards_Ledger!A:H',
    });

    const rows = response.data.values || [];
    if (rows.length < 2) return { balance: 0, pendingBalance: 0 };

    const headers = rows[0];
    const phoneIdx = headers.indexOf('phone');
    const amountIdx = headers.indexOf('amount');
    const statusIdx = headers.indexOf('status');
    const typeIdx = headers.indexOf('type');

    let balance = 0, pendingBalance = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[phoneIdx] === phone) {
        const amount = parseFloat(row[amountIdx] || '0');
        const status = row[statusIdx];
        const type = row[typeIdx];

        if (type === 'PAYOUT' && status === 'PAID') balance -= amount;
        else if (status === 'APPROVED' || status === 'PAID') balance += amount;
        else if (status === 'PENDING' || status === 'PENDING_VALIDATION') pendingBalance += amount;
      }
    }
    return { balance: Math.max(0, balance), pendingBalance };
  } catch (error) {
    return { balance: 0, pendingBalance: 0 };
  }
}

export async function getTodaySubmissions(phone: string) {
  const today = new Date().toISOString().split('T')[0];

  // Try Prisma/Azure SQL first
  try {
    const result = await prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(CASE WHEN CAST(submitted_at AS DATE) = CAST(${today} AS DATE) THEN 1 END) as today_count,
        COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as total_approved,
        COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) as total_rejected
      FROM Submissions
      WHERE trader_phone = ${phone}
    `;

    if (result && result.length > 0) {
      return {
        todayCount: Number(result[0].today_count) || 0,
        totalApproved: Number(result[0].total_approved) || 0,
        totalRejected: Number(result[0].total_rejected) || 0
      };
    }
  } catch (error) {
    console.error('Prisma submissions query failed, falling back to Sheets:', error);
  }

  // Fallback to Google Sheets
  try {
    const sheets = getSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Submissions!A:Z',
    });

    const rows = response.data.values || [];
    if (rows.length < 2) return { todayCount: 0, totalApproved: 0, totalRejected: 0 };

    const headers = rows[0];
    const phoneIdx = headers.indexOf('trader_phone');
    const dateIdx = headers.indexOf('submitted_at');
    const statusIdx = headers.indexOf('status');

    let todayCount = 0, totalApproved = 0, totalRejected = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[phoneIdx] === phone) {
        if ((row[dateIdx] || '').split('T')[0] === today) todayCount++;
        if (row[statusIdx] === 'APPROVED') totalApproved++;
        else if (row[statusIdx] === 'REJECTED') totalRejected++;
      }
    }
    return { todayCount, totalApproved, totalRejected };
  } catch (error) {
    return { todayCount: 0, totalApproved: 0, totalRejected: 0 };
  }
}

export async function checkDuplicate(marketId: string, itemId: string): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];

  // Try Prisma/Azure SQL first
  try {
    const result = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) as count FROM Submissions
      WHERE market_id = ${marketId} AND item_id = ${itemId} AND status = 'APPROVED'
        AND CAST(submitted_at AS DATE) = CAST(${today} AS DATE)
    `;
    if (result && result.length > 0) return Number(result[0].count) > 0;
  } catch (error) {
    console.error('Prisma duplicate check failed, falling back to Sheets:', error);
  }

  // Fallback to Google Sheets
  try {
    const sheets = getSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Submissions!A:Z',
    });

    const rows = response.data.values || [];
    if (rows.length < 2) return false;

    const headers = rows[0];
    const marketIdIdx = headers.indexOf('market_id');
    const itemIdIdx = headers.indexOf('item_id');
    const statusIdx = headers.indexOf('status');
    const submittedAtIdx = headers.indexOf('submitted_at');

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[marketIdIdx] === marketId && row[itemIdIdx] === itemId &&
          row[statusIdx] === 'APPROVED' && (row[submittedAtIdx] || '').split('T')[0] === today) {
        return true;
      }
    }
    return false;
  } catch (error) {
    return false;
  }
}

export async function submitPrice(data: {
  submissionId: string; traderId: string; phone: string; traderName: string;
  marketId: string; marketName: string; categoryId: string; itemId: string;
  itemName: string; brandId: string; price: number; unitId: string;
  gpsLat: number; gpsLng: number; status: string; reputation: number;
}): Promise<boolean> {
  const submittedAt = new Date();

  // Try Prisma/Azure SQL first
  try {
    await prisma.$executeRaw`
      INSERT INTO Submissions 
      (submission_id, trader_id, trader_phone, trader_name, market_id, market_name,
       category_id, item_id, item_name, brand_id, price, unit_id, gps_lat, gps_lng,
       submitted_at, status, source, trader_reputation)
      VALUES 
      (${data.submissionId}, ${data.traderId}, ${data.phone}, ${data.traderName}, 
       ${data.marketId}, ${data.marketName}, ${data.categoryId}, ${data.itemId}, 
       ${data.itemName}, ${data.brandId}, ${data.price}, ${data.unitId}, 
       ${data.gpsLat}, ${data.gpsLng}, ${submittedAt}, ${data.status}, 'WEB', ${data.reputation})
    `;
    return true;
  } catch (error) {
    console.error('Prisma submission failed, falling back to Sheets:', error);
  }

  // Fallback to Google Sheets
  try {
    const sheets = getSheets();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Submissions!A:Z',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          data.submissionId, data.traderId, data.phone, data.traderName,
          data.marketId, data.marketName, data.categoryId, data.itemId, data.itemName,
          data.brandId, data.price, data.unitId, data.gpsLat, data.gpsLng,
          submittedAt.toISOString(), data.status, '', '', 'WEB', data.reputation
        ]]
      }
    });
    return true;
  } catch (error) {
    console.error('Google Sheets submission failed:', error);
    return false;
  }
}

export async function createReward(data: {
  rewardId: string; phone: string; role: string; type: string;
  referenceId: string; amount: number; status: string;
}): Promise<boolean> {
  const createdAt = new Date();

  // Try Prisma/Azure SQL first
  try {
    await prisma.$executeRaw`
      INSERT INTO Rewards_Ledger (reward_id, phone, role, type, reference_id, amount, status, created_at)
      VALUES (${data.rewardId}, ${data.phone}, ${data.role}, ${data.type}, ${data.referenceId}, ${data.amount}, ${data.status}, ${createdAt})
    `;
    return true;
  } catch (error) {
    console.error('Prisma reward creation failed, falling back to Sheets:', error);
  }

  // Fallback to Google Sheets
  try {
    const sheets = getSheets();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Rewards_Ledger!A:H',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[data.rewardId, data.phone, data.role, data.type, data.referenceId, data.amount, data.status, createdAt.toISOString()]]
      }
    });
    return true;
  } catch (error) {
    console.error('Google Sheets reward creation failed:', error);
    return false;
  }
}

export async function getSubmissions(phone: string, limit: number, offset: number) {
  // Try Prisma/Azure SQL first
  try {
    const countResult = await prisma.$queryRaw<any[]>`SELECT COUNT(*) as total FROM Submissions WHERE trader_phone = ${phone}`;
    const total = Number(countResult[0]?.total) || 0;

    const result = await prisma.$queryRaw<any[]>`
      SELECT submission_id, item_name, market_name, price, unit_id, status, submitted_at, source
      FROM Submissions WHERE trader_phone = ${phone}
      ORDER BY submitted_at DESC
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `;

    return {
      submissions: (result || []).map(row => ({
        id: row.submission_id, itemName: row.item_name, marketName: row.market_name,
        price: parseFloat(row.price), unit: row.unit_id, status: row.status,
        submittedAt: row.submitted_at, source: row.source || 'WHATSAPP',
        reward: row.status === 'APPROVED' ? 200 : 0
      })),
      total
    };
  } catch (error) {
    console.error('Prisma submissions query failed, falling back to Sheets:', error);
  }

  // Fallback to Google Sheets
  try {
    const sheets = getSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Submissions!A:Z',
    });

    const rows = response.data.values || [];
    if (rows.length < 2) return { submissions: [], total: 0 };

    const headers = rows[0];
    const getIdx = (name: string) => headers.indexOf(name);
    const allSubmissions = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[getIdx('trader_phone')] === phone) {
        allSubmissions.push({
          id: row[getIdx('submission_id')] || `sub_${i}`,
          itemName: row[getIdx('item_name')] || 'Unknown Item',
          marketName: row[getIdx('market_name')],
          price: parseFloat(row[getIdx('price')] || '0'),
          unit: row[getIdx('unit_id')] || 'unit',
          status: row[getIdx('status')] || 'PENDING',
          submittedAt: row[getIdx('submitted_at')] || new Date().toISOString(),
          source: row[getIdx('source')] || 'WHATSAPP',
          reward: row[getIdx('status')] === 'APPROVED' ? 200 : 0
        });
      }
    }
    allSubmissions.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    return { submissions: allSubmissions.slice(offset, offset + limit), total: allSubmissions.length };
  } catch (error) {
    return { submissions: [], total: 0 };
  }
}

export async function getCategories() {
  const ICONS: { [key: string]: string } = {
    'Food': '🍚', 'FOOD': '🍚', 'Building': '🧱', 'BUILDING': '🧱',
    'Building Materials': '🧱', 'Manufacturing': '🏭', 'MANUFACTURING': '🏭',
    'Electronics': '📱', 'ELECTRONICS': '📱', 'Textiles': '👕', 'TEXTILES': '👕',
    'Household': '🏠', 'HOUSEHOLD': '🏠',
  };

  // Try Prisma/Azure SQL first
  try {
    const result = await prisma.$queryRaw<any[]>`
      SELECT DISTINCT category_id, super_category as category_name
      FROM Items_Catalog WHERE status = 'ACTIVE' OR status IS NULL ORDER BY super_category
    `;
    if (result && result.length > 0) {
      return result.map(row => ({
        id: row.category_id || row.category_name?.toLowerCase().replace(/\s+/g, '_'),
        name: row.category_name,
        icon: ICONS[row.category_name] || '📦'
      }));
    }
  } catch (error) {
    console.error('Prisma categories query failed:', error);
  }

  // Fallback - return default categories
  return [
    { id: 'food', name: 'Food', icon: '🍚' },
    { id: 'building', name: 'Building Materials', icon: '🧱' },
    { id: 'manufacturing', name: 'Manufacturing', icon: '🏭' },
  ];
}

export async function getItems(categoryId: string) {
  // Try Prisma/Azure SQL first
  try {
    const result = await prisma.$queryRaw<any[]>`
      SELECT item_id, item_name, category_id, default_unit
      FROM Items_Catalog
      WHERE (category_id = ${categoryId} OR super_category = ${categoryId})
        AND (status = 'ACTIVE' OR status IS NULL)
      ORDER BY item_name
    `;
    if (result && result.length > 0) {
      return result.map(row => ({
        id: row.item_id, name: row.item_name,
        categoryId: row.category_id, defaultUnit: row.default_unit || 'unit'
      }));
    }
  } catch (error) {
    console.error('Prisma items query failed, falling back to Sheets:', error);
  }

  // Fallback to Google Sheets
  try {
    const sheets = getSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Items_Catalog!A:Z',
    });

    const rows = response.data.values || [];
    if (rows.length < 2) return [];

    const headers = rows[0];
    const itemIdIdx = headers.indexOf('item_id');
    const itemNameIdx = headers.indexOf('item_name');
    const categoryIdx = headers.indexOf('super_category') !== -1 ? headers.indexOf('super_category') : headers.indexOf('category');
    const categoryIdIdx = headers.indexOf('category_id');
    const defaultUnitIdx = headers.indexOf('default_unit');

    const items = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowCategoryId = row[categoryIdIdx] || row[categoryIdx]?.toLowerCase().replace(/\s+/g, '_');
      if (rowCategoryId === categoryId) {
        items.push({
          id: row[itemIdIdx] || `item_${i}`,
          name: row[itemNameIdx] || 'Unknown Item',
          categoryId: rowCategoryId,
          defaultUnit: row[defaultUnitIdx] || 'unit'
        });
      }
    }
    items.sort((a, b) => a.name.localeCompare(b.name));
    return items;
  } catch (error) {
    return [];
  }
}

export async function getPayouts(phone: string) {
  let totalEarned = 0, totalPaid = 0, pendingPayout = 0;
  const payouts: any[] = [];

  // Try Prisma/Azure SQL first
  try {
    const summaryResult = await prisma.$queryRaw<any[]>`
      SELECT 
        ISNULL(SUM(CASE WHEN type IN ('SUBMISSION', 'VALIDATION') AND status IN ('APPROVED', 'PAID') THEN amount ELSE 0 END), 0) as earned,
        ISNULL(SUM(CASE WHEN status IN ('PENDING', 'PENDING_VALIDATION') THEN amount ELSE 0 END), 0) as pending
      FROM Rewards_Ledger WHERE phone = ${phone}
    `;
    if (summaryResult && summaryResult.length > 0) {
      totalEarned = Number(summaryResult[0].earned);
      pendingPayout = Number(summaryResult[0].pending);
    }

    const payoutsResult = await prisma.$queryRaw<any[]>`
      SELECT payout_id, amount, status, method, COALESCE(paid_at, created_at) as paid_at
      FROM Payout_Log WHERE phone = ${phone} ORDER BY paid_at DESC
    `;
    for (const row of payoutsResult || []) {
      if (row.status === 'PAID') totalPaid += parseFloat(row.amount);
      payouts.push({
        id: row.payout_id, amount: parseFloat(row.amount), status: row.status,
        method: row.method || 'Airtime', paidAt: row.paid_at
      });
    }
    return { payouts, summary: { totalEarned, totalPaid, pendingPayout, availableBalance: totalEarned - totalPaid } };
  } catch (error) {
    console.error('Prisma payouts query failed, falling back to Sheets:', error);
  }

  // Fallback to Google Sheets
  const balanceData = await getTraderBalance(phone);
  return {
    payouts: [],
    summary: {
      totalEarned: balanceData.balance + balanceData.pendingBalance,
      totalPaid: 0, pendingPayout: balanceData.pendingBalance, availableBalance: balanceData.balance
    }
  };
}


// =============================================================================
// QUERY / EXECUTE SHIMS
// Several mobile API routes import { query, execute } from '@/lib/db'.
// These shim functions proxy to prisma.$queryRawUnsafe / $executeRawUnsafe
// so those routes work without modification.
// =============================================================================

/**
 * Execute a raw SQL SELECT and return rows as an array.
 * Usage: const rows = await query('SELECT * FROM Traders WHERE phone = ?', [phone])
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  try {
    return await prisma.$queryRawUnsafe<T[]>(sql, ...params);
  } catch (error) {
    console.error('[db.query] Error:', error);
    throw error;
  }
}

/**
 * Execute a raw SQL INSERT/UPDATE/DELETE and return affected row count.
 * Usage: const affected = await execute('UPDATE Traders SET balance = ? WHERE phone = ?', [100, phone])
 */
export async function execute(sql: string, params: any[] = []): Promise<number> {
  try {
    return await prisma.$executeRawUnsafe(sql, ...params);
  } catch (error) {
    console.error('[db.execute] Error:', error);
    throw error;
  }
}

export default prisma;

// =============================================================================
// AZURE SQL CONNECTION SHIM FOR FRS v2.2 BLOG + NEWS ROUTES
// =============================================================================
// getAzureSqlConnection() wraps Prisma so the blog API routes
// (/api/blog/food-news, /api/enterprise/news-feed) can call:
//   const pool = await getAzureSqlConnection()
//   const result = await pool.request().input('slug', slug).query('SELECT ...')
// without adding the mssql package — Prisma handles the actual connection.
// =============================================================================

interface PrismaRequest {
  input: (name: string, value: unknown) => PrismaRequest;
  query: (sql: string) => Promise<{ recordset: any[] }>;
}

interface PrismaPool {
  request: () => PrismaRequest;
  connected: boolean;
}

export async function getAzureSqlConnection(): Promise<PrismaPool> {
  // Verify Prisma connection is alive
  await prisma.$queryRaw`SELECT 1`;

  return {
    connected: true,
    request: () => {
      const params: Record<string, unknown> = {};

      const builder: PrismaRequest = {
        input(name: string, value: unknown) {
          params[name] = value;
          return builder;
        },
        async query(sqlTemplate: string): Promise<{ recordset: any[] }> {
          // Replace named @param placeholders with positional values
          // Builds a parameterised query safe for Prisma.$queryRawUnsafe
          const keys   = Object.keys(params);
          let   filled = sqlTemplate;
          const values: unknown[] = [];

          for (const key of keys) {
            const placeholder = new RegExp(`@${key}\\b`, 'g');
            if (placeholder.test(filled)) {
              values.push(params[key]);
              filled = filled.replace(placeholder, `$${values.length}`);
            }
          }

          try {
            const rows = await prisma.$queryRawUnsafe<any[]>(filled, ...values);
            return { recordset: rows ?? [] };
          } catch (error) {
            console.error('[getAzureSqlConnection.query] Error:', error);
            throw error;
          }
        },
      };

      return builder;
    },
  };
}
