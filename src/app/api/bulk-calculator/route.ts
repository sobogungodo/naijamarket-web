// src/app/api/bulk-calculator/route.ts
import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
const F = 'https://func-naijamarket-api.azurewebsites.net/api'
const K = process.env.NAIJAMARKET_API_KEY ?? ''
export async function GET(req: NextRequest) {
  const tier = req.nextUrl.searchParams.get('tier') ?? 'FREE'
  const r = await fetch(`${F}/bulk_calculator?type=items&tier=${encodeURIComponent(tier)}&code=${K}`)
  return NextResponse.json(await r.json(), { status: r.status })
}
export async function POST(req: NextRequest) {
  const body = await req.json()
  const r = await fetch(`${F}/bulk_calculator?type=calculate&code=${K}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  return NextResponse.json(await r.json(), { status: r.status })
}
