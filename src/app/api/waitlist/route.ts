// src/app/api/waitlist/route.ts
import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
const F = 'https://func-naijamarket-api.azurewebsites.net/api'
const K = process.env.NAIJAMARKET_API_KEY ?? ''

function normalizeNigerianPhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, '')
  if (/^0[789]\d{9}$/.test(cleaned)) return '+234' + cleaned.slice(1)
  if (/^234[789]\d{9}$/.test(cleaned)) return '+' + cleaned
  if (/^\+234[789]\d{9}$/.test(cleaned)) return cleaned
  return null
}

async function sendBrevoConfirmation(email: string, name: string | null, phone: string) {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) return
  const firstName = name ? name.split(' ')[0] : 'there'
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'NaijaMarket Intel', email: 'noreply@naijamarketintel.ng' },
      to: [{ email, name: name || undefined }],
      subject: "You're on the NaijaMarket Intel waitlist",
      htmlContent: `<div style="font-family:sans-serif;background:#0a0a0a;color:#f5f5f5;padding:40px;max-width:600px;margin:0 auto"><div style="border-bottom:2px solid #00a651;padding-bottom:16px;margin-bottom:32px"><span style="color:#00a651;font-weight:700;font-size:18px">NaijaMarket Intel</span><span style="color:#666;font-size:12px;margin-left:8px">The Bloomberg of Nigerian Commodities</span></div><h1 style="color:#fff;font-size:24px;margin-bottom:8px">You're in, ${firstName}!</h1><p style="color:#aaa;font-size:16px;line-height:1.6">Thanks for joining. You're among the first to get access to real-time food commodity prices from Nigeria's biggest markets.</p><div style="background:#111;border:1px solid #222;border-radius:8px;padding:24px;margin:32px 0"><p style="color:#00a651;font-weight:600;margin:0 0 8px">&#128640; Launching June 2026</p><p style="color:#ccc;margin:0;font-size:14px">Mile 12 Market (Lagos) &amp; Onitsha Main Market (Anambra)<br/>610 commodities &middot; 282 markets &middot; GPS-verified prices</p></div><p style="color:#aaa;font-size:14px">We'll send your personal access link to ${phone} on WhatsApp when we go live.</p><p style="color:#555;font-size:12px;margin-top:40px;border-top:1px solid #222;padding-top:16px">NaijaMarket Intel &middot; Giggababytes Oy &middot; Lahti, Finland</p></div>`,
    }),
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { phone, name, email, interest, market_area } = body as {
    phone: string; name?: string; email?: string
    interest?: 'CONSUMER' | 'TRADER'; market_area?: string
  }
  if (!phone) return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
  const normalized = normalizeNigerianPhone(phone.trim())
  if (!normalized) return NextResponse.json({ error: 'Enter a valid Nigerian phone number (e.g. 08012345678)' }, { status: 400 })

  const id = `WL-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || null

  const r = await fetch(`${F}/waitlist_handler?code=${K}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: normalized, name: name || null, email: email || null, interest: interest || 'CONSUMER', market_area: market_area || null, ip, id }),
  })
  const data = await r.json()

  if (data.success && !data.duplicate && email?.includes('@')) {
    sendBrevoConfirmation(email, name || null, normalized).catch(console.error)
  }

  return NextResponse.json(data, { status: r.status })
}

export async function GET() {
  const r = await fetch(`${F}/waitlist_handler?code=${K}`)
  return NextResponse.json(await r.json(), { status: r.status })
}
