import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getSubmissions } from '@/lib/db';

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
    const phone = searchParams.get('phone');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!phone || phone !== tokenPhone) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { submissions, total } = await getSubmissions(phone, limit, offset);

    return NextResponse.json({ submissions, total, limit, offset });
  } catch (error) {
    console.error('Submissions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
