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
    const phone = searchParams.get('phone');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!phone || phone !== tokenPhone) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sheets = getSheets();
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Submissions!A:Z',
    });

    const rows = response.data.values || [];
    if (rows.length < 2) return NextResponse.json({ submissions: [], total: 0 });

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
          reward: row[getIdx('status')] === 'APPROVED' ? 200 : 0,
        });
      }
    }

    allSubmissions.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    const paginatedSubmissions = allSubmissions.slice(offset, offset + limit);

    return NextResponse.json({ submissions: paginatedSubmissions, total: allSubmissions.length, limit, offset });

  } catch (error) {
    console.error('Submissions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
