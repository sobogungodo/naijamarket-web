import { PrismaClient } from "@prisma/client";
import { google } from 'googleapis';

// =============================================================================
// PRISMA CLIENT (EXISTING)
// =============================================================================
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
      SELECT phone, full_name, status, trader_id, market_id, market_name,
             market_lat, market_lng, reputation_score, tier
      FROM Traders_register
      WHERE phone = ${phone} AND status = 'APPROVED'
    `;

    if (trader && trader.length > 0) {
      const row = trader[0];
      return {
        phone: row.phone,
        fullName: row.full_name,
        status: row.status,
        traderId: row.trader_id,
        marketId: row.market_id,
        marketName: row.market_name,
        marketLat: parseFloat(row.market_lat || '6.4541'),
        marketLng: parseFloat(row.market_lng || '3.3947'),
        reputation: parseInt(row.reputation_score || '50'),
        tier: row.tier || 'STARTER'
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
      range: 'Traders_register!A:Z',
    });

    const rows = response.data.values || [];
    if (rows.length < 2) return null;

    const headers = rows[0];
    const getIdx = (name: string) => headers.indexOf(name);

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[getIdx('phone')] === phone && row[getIdx('status')] === 'APPROVED') {
        return {
          phone: row[getIdx('phone')],
          fullName: row[getIdx('full_name')] || 'Trader',
          status: row[getIdx('status')],
          traderId: row[getIdx('trader_id')],
          marketId: row[getIdx('market_id')],
          marketName: row[getIdx('market_name')] || 'Unknown Market',
          marketLat: parseFloat(row[getIdx('market_lat')] || '6.4541'),
          marketLng: parseFloat(row[getIdx('market_lng')] || '3.3947'),
          reputation: parseInt(row[getIdx('reputation_score')] || '50'),
          tier: row[getIdx('tier')] || 'STARTER'
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

export default prisma;
