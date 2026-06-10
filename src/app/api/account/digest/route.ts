// src/app/api/account/digest/route.ts
import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
const F = 'https://func-naijamarket-api.azurewebsites.net/api'
const K = process.env.NAIJAMARKET_API_KEY ?? ''
export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get('phone') ?? ''
  const r = await fetch(`${F}/account_data?type=digest&phone=${encodeURIComponent(phone)}&code=${K}`)
  return NextResponse.json(await r.json(), { status: r.status })
}
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const r = await fetch(`${F}/account_data?type=digest_patch&code=${K}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  return NextResponse.json(await r.json(), { status: r.status })
}
