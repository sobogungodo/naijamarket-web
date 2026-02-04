import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get('itemId');

  // Return generic brand for all items - brands can be added to database later
  return NextResponse.json({ 
    brands: [{ id: 'generic', name: 'Generic / No Brand', itemId: itemId || '' }] 
  });
}
