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

async function syncToBrevo(email: string, name: string | null, phone: string): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) { console.error('[BREVO] BREVO_API_KEY not set'); return }

  const firstName = name ? name.split(' ')[0] : ''
  const lastName  = name && name.includes(' ') ? name.split(' ').slice(1).join(' ') : ''

  // 1. Upsert contact into list 2 (prospects/waitlist) with newsletter attribute
  const contactRes = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      attributes: {
        FIRSTNAME: firstName,
        LASTNAME:  lastName,
        SMS:       phone,
        NEWSLETTER: true,
        SOURCE:    'waitlist',
      },
      listIds:       [2],
      updateEnabled: true,
    }),
  })
  const contactStatus = contactRes.status
  console.log('[BREVO] Contact upsert status:', contactStatus)

  // 2. Send welcome/confirmation email
  const emailBody = {
    sender:      { name: 'NaijaMarket Intel', email: 'noreply@naijamarketintel.ng' },
    to:          [{ email, name: name || undefined }],
    subject:     "You're on the NaijaMarket Intel waitlist 🇳🇬",
    htmlContent: getWelcomeHtml(firstName || 'there', phone),
  }
  const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(emailBody),
  })
  console.log('[BREVO] Welcome email status:', emailRes.status)
}

function getWelcomeHtml(firstName: string, phone: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #222;border-radius:12px;overflow:hidden;max-width:600px;">

      <tr>
        <td style="background:linear-gradient(135deg,#00a651,#006428);padding:28px 32px;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:1px;">NAIJAMARKET INTEL</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:12px;letter-spacing:2px;">THE BLOOMBERG OF NIGERIAN COMMODITIES</p>
        </td>
      </tr>

      <tr>
        <td style="padding:32px;">
          <h2 style="margin:0 0 16px;color:#fff;font-size:20px;">You're in, ${firstName}! 🎉</h2>
          <p style="color:#aaa;font-size:15px;line-height:1.7;margin:0 0 24px;">
            You're among the first to get access to real-time food commodity prices from Nigeria's biggest markets.
            We'll send your personal invite to <strong style="color:#00a651;">${phone}</strong> on WhatsApp when we go live.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border-radius:8px;padding:20px;margin-bottom:24px;">
            <tr><td style="padding:8px 0;color:#ccc;font-size:14px;">📊 &nbsp;Live prices for 610+ commodities</td></tr>
            <tr><td style="padding:8px 0;color:#ccc;font-size:14px;">🗺️ &nbsp;282 markets across Nigeria</td></tr>
            <tr><td style="padding:8px 0;color:#ccc;font-size:14px;">📈 &nbsp;Weekly market brief every Monday</td></tr>
            <tr><td style="padding:8px 0;color:#ccc;font-size:14px;">⚡ &nbsp;Emergency price alerts on major events</td></tr>
          </table>

          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#00a651;border-radius:6px;">
                <a href="https://www.naijamarketintel.com" style="display:inline-block;padding:14px 28px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;">
                  View Live Prices →
                </a>
              </td>
            </tr>
          </table>

          <p style="color:#555;font-size:13px;margin:24px 0 0;">
            Launching June 2026 · Mile 12, Lagos &amp; Onitsha, Anambra
          </p>
        </td>
      </tr>

      <tr>
        <td style="padding:20px 32px;border-top:1px solid #1e1e1e;">
          <p style="color:#444;font-size:11px;margin:0;line-height:1.6;">
            You signed up at naijamarketintel.com · No spam, ever.<br>
            Giggababytes Oy · Jyrkankatu 1C 24, 15500 Lahti, Finland
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { phone, name, email, interest, market_area } = body as {
    phone: string; name?: string; email?: string
    interest?: 'CONSUMER' | 'TRADER'; market_area?: string
  }

  if (!phone) return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
  if (!email) return NextResponse.json({ error: 'Email address is required' }, { status: 400 })

  const normalized = normalizeNigerianPhone(phone.trim())
  if (!normalized) return NextResponse.json({ error: 'Enter a valid Nigerian phone number (e.g. 08012345678)' }, { status: 400 })

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
  }

  const id = `WL-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || null

  // Save to DB via API func
  const r = await fetch(`${F}/waitlist_handler?code=${K}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: normalized, name: name || null, email: email.trim() || null,
      interest: interest || 'CONSUMER', market_area: market_area || null, ip, id,
    }),
  })
  const data = await r.json()

  // Sync to Brevo (fire-and-forget, non-blocking) — always, even on duplicate
  // Duplicate users may have changed email; always keep Brevo in sync
  if (email?.includes('@')) {
    syncToBrevo(email.trim(), name || null, normalized).catch(console.error)
  }

  return NextResponse.json(data, { status: r.status })
}

export async function GET() {
  const r = await fetch(`${F}/waitlist_handler?code=${K}`)
  return NextResponse.json(await r.json(), { status: r.status })
}
