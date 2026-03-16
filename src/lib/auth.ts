// src/lib/auth.ts
// JWT verification for subscription tiers
// Used by: /api/enterprise/news-feed
// NOTE: If your project already has this function, skip this file.
// Only add if verifySubscriptionToken does not exist in your codebase.

import { jwtVerify } from 'jose'

interface SubscriptionSession {
  user_id:           string
  phone_number:      string
  subscription_tier: string
  exp:               number
}

export async function verifySubscriptionToken(
  token: string
): Promise<SubscriptionSession | null> {
  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || ''
    )
    const { payload } = await jwtVerify(token, secret)

    return {
      user_id:           String(payload.sub || payload.user_id || ''),
      phone_number:      String(payload.phone_number || ''),
      subscription_tier: String(payload.subscription_tier || 'FREE'),
      exp:               Number(payload.exp || 0),
    }
  } catch {
    return null
  }
}
