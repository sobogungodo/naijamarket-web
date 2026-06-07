// src/app/api/waitlist/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

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
      sender: { name: 'NaijaMarketIntel', email: 'noreply@naijamarketintel.ng' },
      to: [{ email, name: name || undefined }],
      subject: "You're on the NaijaMarketIntel waitlist 🎉",
      htmlContent: `<div style="font-family:sans-serif;background:#0a0a0a;color:#f5f5f5;padding:40px;max-width:600px;margin:0 auto"><div style="border-bottom:2px solid #00a651;padding-bottom:16px;margin-bottom:32px"><span style="color:#00a651;font-weight:700;font-size:18px">NaijaMarketIntel</span><span style="color:#666;font-size:12px;margin-left:8px">The Bloomberg of Nigerian Commodities</span></div><h1 style="color:#fff;font-size:24px;margin-bottom:8px">You're in, ${firstName}! 🎉</h1><p style="color:#aaa;font-size:16px;line-height:1.6">Thanks for joining. You're among the first to get access to real-time food commodity prices from Nigeria's biggest markets.</p><div style="background:#111;border:1px solid #222;border-radius:8px;padding:24px;margin:32px 0"><p style="color:#00a651;font-weight:600;margin:0 0 8px">🚀 Launching June 2026</p><p style="color:#ccc;margin:0;font-size:14px">Mile 12 Market (Lagos) &amp; Onitsha Main Market (Anambra)<br/>610 commodities · 282 markets · GPS-verified prices</p></div><p style="color:#aaa;font-size:14px">We'll send your personal access link to ${phone} on WhatsApp when we go live.</p><p style="color:#555;font-size:12px;margin-top:40px;border-top:1px solid #222;padding-top:16px">NaijaMarketIntel · Giggababytes Oy · Lahti, Finland</p></div>`,
    }),
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { phone, name, email, interest, market_area } = body as {
      phone: string; name?: string; email?: string
      interest?: 'CONSUMER' | 'TRADER'; market_area?: string
    }
    if (!phone) return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    const normalized = normalizeNigerianPhone(phone.trim())
    if (!normalized) return NextResponse.json({ error: 'Enter a valid Nigerian phone number (e.g. 08012345678)' }, { status: 400 })

    const existing = await prisma.$queryRaw<{ waitlist_id: string }[]>(
      Prisma.sql`SELECT waitlist_id FROM dbo.Waitlist WHERE phone_number = ${normalized}`
    )
    if (existing.length > 0) {
      return NextResponse.json({ success: true, duplicate: true, message: "You're already on the waitlist! We'll reach out on WhatsApp at launch." })
    }

    const id = `WL-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || null

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO dbo.Waitlist (waitlist_id, phone_number, name, email, interest, market_area, source, ip_address, created_at)
      VALUES (${id}, ${normalized}, ${name || null}, ${email || null}, ${interest || 'CONSUMER'}, ${market_area || null}, 'landing_page', ${ip}, GETUTCDATE())
    `)

    if (email?.includes('@')) {
      sendBrevoConfirmation(email, name || null, normalized).catch(console.error)
      prisma.$executeRaw(Prisma.sql`UPDATE dbo.Waitlist SET email_sent=1, email_sent_at=GETUTCDATE() WHERE waitlist_id=${id}`).catch(() => {})
    }

    return NextResponse.json({ success: true, message: "You're on the list! We'll text you on WhatsApp when we launch." })
  } catch (err) {
    console.error('[waitlist] POST error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const rows = await prisma.$queryRaw<{ total: number; traders: number; consumers: number; lagos: number; anambra: number }[]>(
      Prisma.sql`SELECT COUNT(*) AS total, SUM(CASE WHEN interest='TRADER' THEN 1 ELSE 0 END) AS traders, SUM(CASE WHEN interest='CONSUMER' THEN 1 ELSE 0 END) AS consumers, SUM(CASE WHEN market_area='Lagos' THEN 1 ELSE 0 END) AS lagos, SUM(CASE WHEN market_area='Anambra (Onitsha)' THEN 1 ELSE 0 END) AS anambra FROM dbo.Waitlist`
    )
    return NextResponse.json(rows[0] || {})
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
