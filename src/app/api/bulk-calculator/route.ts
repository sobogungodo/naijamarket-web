// src/app/api/bulk-calculator/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
export const dynamic = 'force-dynamic'
const F = 'https://func-naijamarket-api.azurewebsites.net/api'
const K = process.env.NAIJAMARKET_API_KEY ?? ''
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const tier = (session.user as any).tier || 'FREE'
  const r = await fetch(`${F}/bulk_calculator?type=items&tier=${encodeURIComponent(tier)}&code=${K}`)
  return NextResponse.json(await r.json(), { status: r.status })
}
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const tier = (session.user as any).tier || 'FREE'
  const body = await req.json()
  const r = await fetch(`${F}/bulk_calculator?type=calculate&code=${K}&tier=${encodeURIComponent(tier)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, tier }),
  })
  return NextResponse.json(await r.json(), { status: r.status })
}
