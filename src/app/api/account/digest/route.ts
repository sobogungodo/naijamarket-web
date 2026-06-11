// src/app/api/account/digest/route.ts
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
  const r = await fetch(`${F}/account_data?type=digest&code=${K}`, {
    headers: { Authorization: `Bearer ${token.sessionToken}` },
  })
  return NextResponse.json(await r.json(), { status: r.status })
}

export async function PATCH(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.sessionToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()
  const r = await fetch(`${F}/account_data?type=digest_patch&code=${K}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.sessionToken}` },
    body: JSON.stringify(body),
  })
  return NextResponse.json(await r.json(), { status: r.status })
}
