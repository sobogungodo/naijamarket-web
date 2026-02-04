import { NextRequest, NextResponse } from 'next/server';
import { getItems } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId') || '';
    
    const items = await getItems(categoryId);
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Items error:', error);
    return NextResponse.json({ items: [] });
  }
}
