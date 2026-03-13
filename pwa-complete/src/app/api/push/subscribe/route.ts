// src/app/api/push/subscribe/route.ts
// Handle push notification subscription

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Parse subscription data
    const subscription = await request.json();
    
    if (!subscription.endpoint || !subscription.keys) {
      return NextResponse.json(
        { error: 'Invalid subscription data' },
        { status: 400 }
      );
    }
    
    // Store subscription in database
    // Using upsert to handle re-subscriptions
    const result = await prisma.push_Subscription.upsert({
      where: {
        user_id_endpoint: {
          user_id: session.user.id,
          endpoint: subscription.endpoint
        }
      },
      update: {
        p256dh_key: subscription.keys.p256dh,
        auth_key: subscription.keys.auth,
        updated_at: new Date()
      },
      create: {
        user_id: session.user.id,
        endpoint: subscription.endpoint,
        p256dh_key: subscription.keys.p256dh,
        auth_key: subscription.keys.auth,
        is_active: true
      }
    });
    
    console.log(`[Push] Subscription saved for user ${session.user.id}`);
    
    return NextResponse.json({
      success: true,
      message: 'Push subscription saved',
      subscription_id: result.id
    });
    
  } catch (error) {
    console.error('[Push] Subscription error:', error);
    
    return NextResponse.json(
      { error: 'Failed to save subscription' },
      { status: 500 }
    );
  }
}

// Handle subscription check
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { subscribed: false },
        { status: 200 }
      );
    }
    
    const subscription = await prisma.push_Subscription.findFirst({
      where: {
        user_id: session.user.id,
        is_active: true
      }
    });
    
    return NextResponse.json({
      subscribed: !!subscription,
      subscription_count: subscription ? 1 : 0
    });
    
  } catch (error) {
    console.error('[Push] Check subscription error:', error);
    return NextResponse.json(
      { subscribed: false, error: 'Check failed' },
      { status: 500 }
    );
  }
}
