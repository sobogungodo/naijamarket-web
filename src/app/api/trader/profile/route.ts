import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { findTrader, getTraderBalance, getTodaySubmissions } from '@/lib/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || '');

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
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone || phone !== tokenPhone) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get trader profile from Azure SQL (primary) or Google Sheets (fallback)
    const profile = await findTrader(phone);
    if (!profile) {
      return NextResponse.json({ error: 'Trader not found' }, { status: 404 });
    }

    // Get balance and submissions stats
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
