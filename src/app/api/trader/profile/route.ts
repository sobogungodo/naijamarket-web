import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { jwtVerify } from 'jose';

const getSheets = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
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

async function getTraderProfile(phone: string) {
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
          fullName: row[getIdx('full_name')] || 'Trader',
          marketId: row[getIdx('market_id')],
          marketName: row[getIdx('market_name')] || 'Unknown Market',
          marketLat: parseFloat(row[getIdx('market_lat')] || '6.4541'),
          marketLng: parseFloat(row[getIdx('market_lng')] || '3.3947'),
          reputation: parseInt(row[getIdx('reputation_score')] || '50'),
          tier: row[getIdx('tier')] || 'STARTER',
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting trader profile:', error);
    return null;
  }
}

async function getTraderBalance(phone: string) {
  const sheets = getSheets();
  
  try {
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

    let balance = 0;
    let pendingBalance = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[phoneIdx] === phone) {
        const amount = parseFloat(row[amountIdx] || '0');
        const status = row[statusIdx];
        const type = row[typeIdx];

        if (type === 'PAYOUT' && status === 'PAID') {
          balance -= amount;
        } else if (status === 'APPROVED' || status === 'PAID') {
          balance += amount;
        } else if (status === 'PENDING' || status === 'PENDING_VALIDATION') {
          pendingBalance += amount;
        }
      }
    }

    return { balance: Math.max(0, balance), pendingBalance };
  } catch (error) {
    return { balance: 0, pendingBalance: 0 };
  }
}

async function getTodaySubmissions(phone: string) {
  const sheets = getSheets();
  
  try {
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

    const today = new Date().toISOString().split('T')[0];
    let todayCount = 0, totalApproved = 0, totalRejected = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[phoneIdx] === phone) {
        const submittedDate = (row[dateIdx] || '').split('T')[0];
        if (submittedDate === today) todayCount++;
        if (row[statusIdx] === 'APPROVED') totalApproved++;
        else if (row[statusIdx] === 'REJECTED') totalRejected++;
      }
    }

    return { todayCount, totalApproved, totalRejected };
  } catch (error) {
    return { todayCount: 0, totalApproved: 0, totalRejected: 0 };
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const tokenPhone = await verifyToken(token);

    if (!tokenPhone) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone || phone !== tokenPhone) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getTraderProfile(phone);
    if (!profile) {
      return NextResponse.json({ error: 'Trader not found' }, { status: 404 });
    }

    const { balance, pendingBalance } = await getTraderBalance(phone);
    const { todayCount, totalApproved, totalRejected } = await getTodaySubmissions(phone);

    return NextResponse.json({
      ...profile,
      balance,
      pendingBalance,
      todaySubmissions: todayCount,
      dailyLimit: 8,
      totalApproved,
      totalRejected
    });

  } catch (error) {
    console.error('Profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
