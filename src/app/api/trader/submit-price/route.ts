import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { jwtVerify } from 'jose';

const getSheets = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
};

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '1n-7MXdoqvIoSHteBJaUYBmIPLjJBNtrE_jVuUxO5kr8';
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'naijamarket-trader-secret-key-2026');

async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload.phone as string;
  } catch {
    return null;
  }
}

function generateSubmissionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `SUB-${timestamp}-${random}`.toUpperCase();
}

async function getTraderDetails(phone: string) {
  const sheets = getSheets();
  
  try {
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
          fullName: row[getIdx('full_name')],
          traderId: row[getIdx('trader_id')],
          marketId: row[getIdx('market_id')],
          marketName: row[getIdx('market_name')],
          reputation: parseInt(row[getIdx('reputation_score')] || '50'),
        };
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function getItemDetails(itemId: string) {
  const sheets = getSheets();
  
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Items_Catalog!A:Z',
    });

    const rows = response.data.values || [];
    if (rows.length < 2) return null;

    const headers = rows[0];
    const itemIdIdx = headers.indexOf('item_id');
    const itemNameIdx = headers.indexOf('item_name');
    const categoryIdx = headers.indexOf('super_category') !== -1 ? headers.indexOf('super_category') : headers.indexOf('category');
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[itemIdIdx] === itemId) {
        return { itemId: row[itemIdIdx], itemName: row[itemNameIdx], category: row[categoryIdx] };
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function checkRateLimits(phone: string): Promise<{ allowed: boolean; message?: string }> {
  const sheets = getSheets();
  
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Submissions!A:Z',
    });

    const rows = response.data.values || [];
    if (rows.length < 2) return { allowed: true };

    const headers = rows[0];
    const phoneIdx = headers.indexOf('trader_phone');
    const submittedAtIdx = headers.indexOf('submitted_at');

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const todayStart = new Date(now.toISOString().split('T')[0]);

    let hourlyCount = 0, dailyCount = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[phoneIdx] === phone) {
        const submittedAt = new Date(row[submittedAtIdx] || '');
        if (submittedAt >= oneHourAgo) hourlyCount++;
        if (submittedAt >= todayStart) dailyCount++;
      }
    }

    if (hourlyCount >= 2) return { allowed: false, message: 'Maximum 2 submissions per hour. Please wait.' };
    if (dailyCount >= 8) return { allowed: false, message: 'Maximum 8 submissions per day. Try again tomorrow.' };

    return { allowed: true };
  } catch (error) {
    return { allowed: true };
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const tokenPhone = await verifyToken(token);
    if (!tokenPhone) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { phone, marketId, categoryId, itemId, brandId, price, unitId, gpsLat, gpsLng } = body;

    if (phone !== tokenPhone) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!marketId || !itemId || !price || !unitId || gpsLat === undefined || gpsLng === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const trader = await getTraderDetails(phone);
    if (!trader) {
      return NextResponse.json({ error: 'Trader not found' }, { status: 404 });
    }

    if (trader.marketId !== marketId) {
      return NextResponse.json({ error: 'You can only submit prices for your assigned market' }, { status: 403 });
    }

    const rateLimitCheck = await checkRateLimits(phone);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json({ error: rateLimitCheck.message }, { status: 429 });
    }

    const item = await getItemDetails(itemId);
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const isInstantApproval = trader.reputation >= 80;
    const status = isInstantApproval ? 'APPROVED' : 'PENDING_VALIDATION';
    const submissionId = generateSubmissionId();
    const submittedAt = new Date().toISOString();

    const sheets = getSheets();
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Submissions!A:Z',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          submissionId, trader.traderId || phone, phone, trader.fullName,
          trader.marketId, trader.marketName, categoryId || item.category,
          itemId, item.itemName, brandId || 'generic', price, unitId,
          gpsLat, gpsLng, submittedAt, status, '', '', 'WEB', trader.reputation
        ]]
      }
    });

    if (isInstantApproval) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Rewards_Ledger!A:H',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            `RWD-${Date.now().toString(36)}`.toUpperCase(),
            phone, 'TRADER', 'SUBMISSION', submissionId, 200, 'APPROVED', new Date().toISOString()
          ]]
        }
      });
    }

    return NextResponse.json({
      success: true, submissionId, status, isInstantApproval,
      message: isInstantApproval 
        ? 'Price submitted and instantly approved! ₦200 added to your balance.'
        : 'Price submitted for validation. You\'ll earn ₦200 when approved.'
    });

  } catch (error) {
    console.error('Submit price error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
