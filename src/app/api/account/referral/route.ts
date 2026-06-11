// src/app/api/account/referral/route.ts
// SECURITY PATCH api-v5: Forward session token to Azure Function
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export const dynamic = 'force-dynamic'

const F = 'https://func-naijamarket-api.azurewebsites.net/api'
const K = process.env.NAIJAMARKET_API_KEY ?? ''

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.sessionToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const r = await fetch(`${F}/account_data?type=referral&code=${K}`, {
    headers: { Authorization: `Bearer ${token.sessionToken}` },
  })
  return NextResponse.json(await r.json(), { status: r.status })
}
