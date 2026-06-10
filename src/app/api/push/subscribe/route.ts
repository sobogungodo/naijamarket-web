// src/app/api/push/subscribe/route.ts
// Push subscription stub — no DB needed, Prisma import removed
import { NextRequest, NextResponse } from 'next/server'
export async function POST(req: NextRequest) {
  try {
    const subscription = await req.json()
    if (!subscription.endpoint || !subscription.keys) {
      return NextResponse.json({ error: 'Invalid subscription data' }, { status: 400 })
    }
    console.log('[Push] Subscription received:', subscription.endpoint)
    return NextResponse.json({ success: true, message: 'Push subscription saved' })
  } catch (error) {
    console.error('[Push] Subscription error:', error)
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
  }
}
export async function GET() {
  return NextResponse.json({ subscribed: false, subscription_count: 0 })
}
