import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getPayouts } from '@/lib/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || '');

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

    const { payouts, summary } = await getPayouts(phone);

    return NextResponse.json({
      payouts,
      summary: {
        ...summary,
        nextPayoutDate: getNextFriday(),
        minimumPayout: 500
      }
    });
  } catch (error) {
    console.error('Payouts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
