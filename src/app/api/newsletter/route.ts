// src/app/api/newsletter/route.ts
// NaijaMarket Intel — Newsletter subscription (email-only, Brevo-backed)
// Replaces broken Resend implementation
import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

const BREVO_API = 'https://api.brevo.com/v3'

function getWelcomeHtml(firstName: string): string {
  const name = firstName || 'there'
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
          <h2 style="margin:0 0 16px;color:#fff;font-size:20px;">Welcome, ${name}! 📊</h2>
          <p style="color:#aaa;font-size:15px;line-height:1.7;margin:0 0 24px;">
            You're now subscribed to <strong style="color:#00a651;">NaijaMarket Intel Weekly Briefs</strong> —
            real-time commodity price intelligence from Nigeria's biggest markets, delivered every Monday.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border-radius:8px;padding:20px;margin-bottom:24px;">
            <tr><td style="padding:8px 0;color:#ccc;font-size:14px;">📊 &nbsp;Live prices for 610+ commodities</td></tr>
            <tr><td style="padding:8px 0;color:#ccc;font-size:14px;">🗺️ &nbsp;282 markets across Nigeria</td></tr>
            <tr><td style="padding:8px 0;color:#ccc;font-size:14px;">📈 &nbsp;Nigeria Food Price Index vs NBS</td></tr>
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
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px;border-top:1px solid #1e1e1e;">
          <p style="color:#444;font-size:11px;margin:0;line-height:1.6;">
            You subscribed at naijamarketintel.com · No spam, ever.<br>
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
  try {
    const body = await req.json()
    const { email, firstName, source } = body as {
      email?: string; firstName?: string; source?: string
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ success: false, error: 'Valid email address is required.' }, { status: 400 })
    }

    const apiKey = process.env.BREVO_API_KEY
    if (!apiKey) {
      console.error('[NEWSLETTER] BREVO_API_KEY not set')
      return NextResponse.json({ success: false, error: 'Service unavailable.' }, { status: 503 })
    }

    const cleanEmail    = email.trim().toLowerCase()
    const cleanName     = (firstName || '').trim()
    const cleanFirst    = cleanName.split(' ')[0] || ''
    const cleanLast     = cleanName.includes(' ') ? cleanName.split(' ').slice(1).join(' ') : ''
    const VALID_SOURCES = ['landing_page', 'registration', 'blog', 'api_portal', 'manual', 'import']
    const cleanSource   = VALID_SOURCES.includes(source || '') ? source! : 'landing_page'

    // 1. Upsert contact into Brevo list 2 with NEWSLETTER attribute
    const contactRes = await fetch(`${BREVO_API}/contacts`, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        attributes: {
          FIRSTNAME:  cleanFirst,
          LASTNAME:   cleanLast,
          NEWSLETTER: true,
          SOURCE:     cleanSource,
        },
        listIds:       [2],
        updateEnabled: true,
      }),
    })

    // 409 = already exists (still success)
    const isDuplicate = contactRes.status === 409 || contactRes.status === 204
    console.log('[NEWSLETTER] Brevo contact status:', contactRes.status)

    if (isDuplicate) {
      return NextResponse.json({
        success:          true,
        alreadySubscribed: true,
        message:          "You're already subscribed! Check your inbox every Monday.",
      })
    }

    if (!contactRes.ok && contactRes.status !== 201) {
      const err = await contactRes.json().catch(() => ({}))
      console.error('[NEWSLETTER] Brevo contact error:', contactRes.status, err)
      // Non-fatal — continue to send email
    }

    // 2. Send welcome email
    const emailRes = await fetch(`${BREVO_API}/smtp/email`, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender:      { name: 'NaijaMarket Intel', email: 'noreply@naijamarketintel.ng' },
        to:          [{ email: cleanEmail, name: cleanName || undefined }],
        subject:     'Your NaijaMarket Intel Weekly Briefs start Monday 📊',
        htmlContent: getWelcomeHtml(cleanFirst),
        tags:        ['newsletter', 'welcome'],
      }),
    })
    console.log('[NEWSLETTER] Welcome email status:', emailRes.status)

    return NextResponse.json({
      success: true,
      message: "You're subscribed! First brief arrives Monday.",
    })

  } catch (err) {
    console.error('[NEWSLETTER] Unhandled error:', err)
    return NextResponse.json({ success: false, error: 'Subscription failed. Please try again.' }, { status: 500 })
  }
}
