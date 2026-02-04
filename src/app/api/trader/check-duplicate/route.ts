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
    const marketId = searchParams.get('marketId');
    const itemId = searchParams.get('itemId');

    if (!marketId || !itemId) return NextResponse.json({ exists: false });

    const sheets = getSheets();
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Submissions!A:Z',
    });

    const rows = response.data.values || [];
    if (rows.length < 2) return NextResponse.json({ exists: false });

    const headers = rows[0];
    const marketIdIdx = headers.indexOf('market_id');
    const itemIdIdx = headers.indexOf('item_id');
    const statusIdx = headers.indexOf('status');
    const submittedAtIdx = headers.indexOf('submitted_at');

    const today = new Date().toISOString().split('T')[0];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (
        row[marketIdIdx] === marketId &&
        row[itemIdIdx] === itemId &&
        row[statusIdx] === 'APPROVED' &&
        (row[submittedAtIdx] || '').split('T')[0] === today
      ) {
        return NextResponse.json({ exists: true, message: 'Price already approved today' });
      }
    }

    return NextResponse.json({ exists: false });

  } catch (error) {
    console.error('Check duplicate error:', error);
    return NextResponse.json({ exists: false });
  }
}
