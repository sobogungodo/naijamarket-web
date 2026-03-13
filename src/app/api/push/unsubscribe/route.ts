// src/app/api/push/unsubscribe/route.ts
// Handle push notification unsubscription

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { endpoint } = await request.json();
    
    if (!endpoint) {
      return NextResponse.json(
        { error: 'Endpoint required' },
        { status: 400 }
      );
    }
    
    // Soft delete - mark as inactive
    const result = await prisma.push_Subscription.updateMany({
      where: {
        user_id: session.user.id,
        endpoint: endpoint
      },
      data: {
        is_active: false,
        updated_at: new Date()
      }
    });
    
    console.log(`[Push] Unsubscribed user ${session.user.id}, affected: ${result.count}`);
    
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
