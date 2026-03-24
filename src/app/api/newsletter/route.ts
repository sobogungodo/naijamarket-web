// src/app/api/newsletter/subscribe/route.ts
// NaijaMarket Intel — Newsletter Subscription API
// Version: 2.0 — 2026-03-24
//
// Confirmed Newsletter_Subscribers columns:
//   subscriber_id (PK), email, name, source, status,
//   subscribed_at, unsubscribed_at, resend_contact_id,
//   ip_address, resubscribed_at, updated_at
//
// Required Vercel env vars:
//   RESEND_API_KEY          re_L4Te74gv_...
//   RESEND_AUDIENCE_ID      8b9b161b-3f93-4fb2-93e0-48656ce1dce5
//   ADMIN_EMAIL             olawale.sobogungod@giggabytes.eu
//   NEXT_PUBLIC_SITE_URL    https://www.naijamarketintel.com   ← FIX THIS IN VERCEL

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

// ─── Config ───────────────────────────────────────────────────────────────────

const resend      = new Resend(process.env.RESEND_API_KEY);
const AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID ?? "";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "olawale.sobogungod@giggabytes.eu";
const SITE_URL    = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.naijamarketintel.com";
const SENDER      = "NaijaMarket Intel <noreply@naijamarketintel.com>";

const VALID_SOURCES = ["landing_page", "registration", "blog", "api_portal", "manual", "import"];

// ─── POST /api/newsletter/subscribe ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, firstName, source } = body;

    // Validate
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email address is required." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const cleanName   = (firstName || "").trim().slice(0, 100) || null;
    const cleanSource = VALID_SOURCES.includes(source) ? source : "landing_page";
    const ipAddress   = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const userAgent   = request.headers.get("user-agent")?.slice(0, 500) ?? null;

    console.log("[NEWSLETTER] New subscription request:", normalizedEmail);

    // ── Check existing ────────────────────────────────────────────────────────
    const existing = await prisma.$queryRaw<any[]>`
      SELECT subscriber_id, email, status
      FROM dbo.Newsletter_Subscribers
      WHERE email = ${normalizedEmail}
    `;

    if (existing.length > 0) {
      const sub = existing[0];

      if (sub.status === "ACTIVE") {
        return NextResponse.json({
          success: false,
          already_subscribed: true,
          message: "You're already subscribed! Check your inbox every Friday for market briefs.",
        });
      }

      // Reactivate unsubscribed
      await prisma.$executeRaw`
        UPDATE dbo.Newsletter_Subscribers
        SET status          = 'ACTIVE',
            resubscribed_at = GETDATE(),
            updated_at      = GETDATE()
        WHERE email = ${normalizedEmail}
      `;
      await addToResendAudience(normalizedEmail, cleanName);
      console.log("[NEWSLETTER] Resubscribed:", normalizedEmail);

      return NextResponse.json({
        success: true,
        message: "Welcome back! You've been resubscribed to NaijaMarket Intel weekly briefs.",
      });
    }

    // ── Step 1: Add to Resend Audience ────────────────────────────────────────
    const resendContactId = await addToResendAudience(normalizedEmail, cleanName);

    // ── Step 2: Insert into Azure SQL ─────────────────────────────────────────
    await prisma.$executeRaw`
      INSERT INTO dbo.Newsletter_Subscribers
        (email, name, source, status, resend_contact_id, ip_address, user_agent, subscribed_at, created_at, updated_at)
      VALUES
        (${normalizedEmail}, ${cleanName}, ${cleanSource}, 'ACTIVE',
         ${resendContactId}, ${ipAddress}, ${userAgent}, GETDATE(), GETDATE(), GETDATE())
    `;
    console.log("[NEWSLETTER] Saved to Azure SQL");

    // ── Step 3: Subscriber count for admin ────────────────────────────────────
    const countResult = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) AS total FROM dbo.Newsletter_Subscribers WHERE status = 'ACTIVE'
    `;
    const totalCount = Number(countResult[0]?.total ?? 1);

    // ── Step 4: Welcome email ─────────────────────────────────────────────────
    try {
      await resend.emails.send({
        from:    SENDER,
        to:      [normalizedEmail],
        subject: "Welcome to NaijaMarket Intel Weekly Briefs 🇳🇬",
        html:    getWelcomeEmailHtml(cleanName, normalizedEmail, SITE_URL),
      });
      console.log("[NEWSLETTER] Welcome email sent");
    } catch (err) {
      console.error("[NEWSLETTER] Welcome email failed (non-fatal):", err);
    }

    // ── Step 5: Admin notification ────────────────────────────────────────────
    try {
      await resend.emails.send({
        from:    SENDER,
        to:      [ADMIN_EMAIL],
        subject: `New Subscriber: ${normalizedEmail} (Total: ${totalCount})`,
        html:    getAdminNotificationHtml(normalizedEmail, cleanName, cleanSource, totalCount),
      });
    } catch (err) {
      console.error("[NEWSLETTER] Admin notification failed (non-fatal):", err);
    }

    console.log("[NEWSLETTER] ✅ Complete for:", normalizedEmail);

    return NextResponse.json({
      success: true,
      message: "You're subscribed! Check your inbox for a welcome email.",
    });

  } catch (error: any) {
    console.error("[NEWSLETTER] ❌ Unhandled error:", error);
    return NextResponse.json({ error: "Subscription failed. Please try again." }, { status: 500 });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function addToResendAudience(email: string, firstName: string | null): Promise<string | null> {
  if (!AUDIENCE_ID) return null;
  try {
    const { data, error } = await resend.contacts.create({
      audienceId:   AUDIENCE_ID,
      email,
      firstName:    firstName ?? undefined,
      unsubscribed: false,
    });
    if (error) { console.error("[NEWSLETTER] Resend contact error:", error); return null; }
    return data?.id ?? null;
  } catch (err) {
    console.error("[NEWSLETTER] Resend audience error (non-fatal):", err);
    return null;
  }
}

// ─── Email Templates ──────────────────────────────────────────────────────────

function getWelcomeEmailHtml(name: string | null, email: string, siteUrl: string): string {
  const greeting = name ? `Hi ${name},` : "Hi there,";
  const unsubUrl = `${siteUrl}/unsubscribe?email=${encodeURIComponent(email)}`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #222;border-radius:8px;overflow:hidden;max-width:600px;">

        <tr>
          <td style="background:#00a651;padding:28px 32px;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:1px;">NAIJAMARKET INTEL</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:12px;letter-spacing:2px;">THE BLOOMBERG OF NIGERIAN COMMODITIES</p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px;">
            <p style="color:#e0e0e0;font-size:16px;margin:0 0 16px;">${greeting}</p>
            <p style="color:#e0e0e0;font-size:15px;line-height:1.7;margin:0 0 20px;">
              You're now subscribed to <strong style="color:#00a651;">NaijaMarket Intel Weekly Briefs</strong> —
              real-time commodity price intelligence from markets across Nigeria.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr><td width="32" style="padding:6px 0;font-size:18px;vertical-align:top;">📊</td><td style="padding:6px 0;color:#ccc;font-size:14px;">Live price movements for staple commodities</td></tr>
              <tr><td width="32" style="padding:6px 0;font-size:18px;vertical-align:top;">🗺️</td><td style="padding:6px 0;color:#ccc;font-size:14px;">Market-by-market arbitrage opportunities</td></tr>
              <tr><td width="32" style="padding:6px 0;font-size:18px;vertical-align:top;">📈</td><td style="padding:6px 0;color:#ccc;font-size:14px;">Nigeria Food Price Index (NFPI) updates</td></tr>
              <tr><td width="32" style="padding:6px 0;font-size:18px;vertical-align:top;">⚡</td><td style="padding:6px 0;color:#ccc;font-size:14px;">Emergency price alerts on major market events</td></tr>
            </table>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#00a651;border-radius:6px;">
                  <a href="${siteUrl}" style="display:inline-block;padding:14px 28px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;">View Live Prices →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 32px;border-top:1px solid #1e1e1e;">
            <p style="color:#555;font-size:12px;margin:0;line-height:1.6;">
              You subscribed at naijamarketintel.com ·
              <a href="${unsubUrl}" style="color:#00a651;text-decoration:none;">Unsubscribe</a><br>
              Giggababytes Oy, Jyrkankatu 1C 24, 15500 Lahti, Finland
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function getAdminNotificationHtml(email: string, name: string | null, source: string, total: number): string {
  return `<div style="font-family:monospace;padding:20px;background:#0a0a0a;color:#e0e0e0;">
    <h2 style="color:#00a651;">📬 New Newsletter Subscriber</h2>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Name:</strong> ${name ?? "—"}</p>
    <p><strong>Source:</strong> ${source}</p>
    <p><strong>Total active:</strong> ${total}</p>
    <p style="color:#555;font-size:12px;">NaijaMarket Intel · ${new Date().toISOString()}</p>
  </div>`;
}
