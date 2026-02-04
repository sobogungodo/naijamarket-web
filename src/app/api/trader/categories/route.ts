// categories/route.ts
import { NextResponse } from 'next/server';
import { getCategories } from '@/lib/db';

export async function GET() {
  try {
    const categories = await getCategories();
    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Categories error:', error);
    return NextResponse.json({
      categories: [
        { id: 'food', name: 'Food', icon: '🍚' },
        { id: 'building', name: 'Building Materials', icon: '🧱' },
        { id: 'manufacturing', name: 'Manufacturing', icon: '🏭' },
      ]
    });
  }
}
