import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { checkDuplicate } from '@/lib/db';

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
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const marketId = searchParams.get('marketId');
    const itemId = searchParams.get('itemId');

    if (!marketId || !itemId) return NextResponse.json({ exists: false });

    const exists = await checkDuplicate(marketId, itemId);

    return NextResponse.json({ 
      exists, 
      message: exists ? 'Price already approved today' : '' 
    });
  } catch (error) {
    console.error('Check duplicate error:', error);
    return NextResponse.json({ exists: false });
  }
}
