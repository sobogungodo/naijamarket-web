// src/app/api/account/history/route.ts
import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
const F = 'https://func-naijamarket-api.azurewebsites.net/api'
const K = process.env.NAIJAMARKET_API_KEY ?? ''
export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get('phone') ?? ''
  const page = req.nextUrl.searchParams.get('page') ?? '1'
  const r = await fetch(`${F}/account_data?type=history&phone=${encodeURIComponent(phone)}&page=${page}&code=${K}`)
  return NextResponse.json(await r.json(), { status: r.status })
}
