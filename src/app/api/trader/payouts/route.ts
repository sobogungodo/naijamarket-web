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

function getNextFriday(): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
  const nextFriday = new Date(today);
  nextFriday.setDate(today.getDate() + daysUntilFriday);
  nextFriday.setHours(18, 0, 0, 0);
  return nextFriday.toISOString();
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
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone || phone !== tokenPhone) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sheets = getSheets();
    let totalEarned = 0, totalPaid = 0, pendingPayout = 0;
    const payouts: any[] = [];

    try {
      const rewardsRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Rewards_Ledger!A:H',
      });

      const rewardsRows = rewardsRes.data.values || [];
      if (rewardsRows.length >= 2) {
        const headers = rewardsRows[0];
        const phoneIdx = headers.indexOf('phone');
        const typeIdx = headers.indexOf('type');
        const amountIdx = headers.indexOf('amount');
        const statusIdx = headers.indexOf('status');

        for (let i = 1; i < rewardsRows.length; i++) {
          const row = rewardsRows[i];
          if (row[phoneIdx] === phone) {
            const amount = parseFloat(row[amountIdx] || '0');
            const type = row[typeIdx];
            const status = row[statusIdx];

            if (type === 'SUBMISSION' || type === 'VALIDATION') {
              if (status === 'APPROVED' || status === 'PAID') totalEarned += amount;
              else if (status === 'PENDING' || status === 'PENDING_VALIDATION') pendingPayout += amount;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error getting rewards:', error);
    }

    try {
      const payoutsRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Payout_Log!A:J',
      });

      const payoutsRows = payoutsRes.data.values || [];
      if (payoutsRows.length >= 2) {
        const headers = payoutsRows[0];
        const payoutIdIdx = headers.indexOf('payout_id');
        const phoneIdx = headers.indexOf('phone');
        const amountIdx = headers.indexOf('amount');
        const statusIdx = headers.indexOf('status');
        const methodIdx = headers.indexOf('method');
        const paidAtIdx = headers.indexOf('paid_at') !== -1 ? headers.indexOf('paid_at') : headers.indexOf('created_at');

        for (let i = 1; i < payoutsRows.length; i++) {
          const row = payoutsRows[i];
          if (row[phoneIdx] === phone) {
            const amount = parseFloat(row[amountIdx] || '0');
            const status = row[statusIdx];
            if (status === 'PAID') totalPaid += amount;

            payouts.push({
              id: row[payoutIdIdx] || `payout_${i}`,
              amount,
              status: status || 'PENDING',
              method: row[methodIdx] || 'Airtime',
              paidAt: row[paidAtIdx] || new Date().toISOString(),
            });
          }
        }
      }
    } catch (error) {
      console.error('Error getting payouts:', error);
    }

    payouts.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());

    return NextResponse.json({
      payouts,
      summary: {
        totalEarned,
        totalPaid,
        pendingPayout,
        availableBalance: totalEarned - totalPaid,
        nextPayoutDate: getNextFriday(),
        minimumPayout: 500
      }
    });

  } catch (error) {
    console.error('Payouts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
