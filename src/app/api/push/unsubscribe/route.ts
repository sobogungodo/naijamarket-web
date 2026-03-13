// src/app/api/push/unsubscribe/route.ts
// Handle push notification unsubscription
// Note: Add authentication later once auth module path is confirmed

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    // For now, allow unauthenticated unsubscriptions
    // In production, add auth check
    
    const { endpoint } = await request.json();
    
    if (!endpoint) {
      return NextResponse.json(
        { error: 'Endpoint required' },
        { status: 400 }
      );
    }
    
    // Log unsubscription (database update will be added later)
    console.log('[Push] Unsubscribed:', endpoint);
    
    return NextResponse.json({
      success: true,
      message: 'Push subscription removed'
    });
    
  } catch (error) {
    console.error('[Push] Unsubscribe error:', error);
    
    return NextResponse.json(
      { error: 'Failed to unsubscribe' },
      { status: 500 }
    );
  }
}
