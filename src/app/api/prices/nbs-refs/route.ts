// src/app/api/prices/nbs-refs/route.ts
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
const F = 'https://func-naijamarket-api.azurewebsites.net/api'
const K = process.env.NAIJAMARKET_API_KEY ?? ''
export async function GET() {
  const r = await fetch(`${F}/bulk_calculator?type=nbs_refs&code=${K}`)
  return NextResponse.json(await r.json(), { status: r.status })
}
