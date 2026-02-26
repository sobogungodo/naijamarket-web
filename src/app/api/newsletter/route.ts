// src/app/api/newsletter/route.ts
// NaijaMarket Intel — Newsletter Subscription API
// Version: 2.0 — 2026-02-26
// Updated: Added Resend audience sync + welcome email + admin notification
//
// ENV VARS REQUIRED:
//   RESEND_API_KEY        → from resend.com/api-keys
//   RESEND_AUDIENCE_ID    → 8b9b161b-3f93-4fb2-93e0-48656ce1dce5
//   ADMIN_EMAIL           → olawale.sobogungod@giggabytes.eu
//   NEXT_PUBLIC_SITE_URL  → https://www.naijamarketintel.ng

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ============================================================================
// CONFIG
// ============================================================================

const resend      = new Resend(process.env.RESEND_API_KEY);
const AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID!;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "olawale.sobogungod@giggabytes.eu";
const SENDER      = "NaijaMarket Intel <noreply@naijamarketintel.ng>";
const SITE_URL    = process.env.NEXT_PUBLIC_SITE_URL || "https://www.naijamarketintel.ng";

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

function getWelcomeEmailTemplate(email: string, firstName?: string): string {
  const greeting = firstName ? `Hi ${firstName},` : "Hello,";
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
    style="max-width:600px;margin:0 auto;padding:40px 20px;">

    <!-- LOGO -->
    <tr>
      <td style="text-align:center;padding-bottom:30px;">
        <h1 style="margin:0;font-size:28px;">
          <span style="color:#ffffff;">Naija</span>
          <span style="color:#00A36C;">Market</span>
          <span style="color:#FFD700;"> Intel</span>
        </h1>
        <p style="color:#666;font-size:12px;margin-top:8px;font-family:monospace;">
          The Bloomberg of African Commodities
        </p>
      </td>
    </tr>

    <!-- CARD -->
    <tr>
      <td style="background-color:#141414;border:1px solid #2a2a2a;
                 border-radius:12px;padding:40px;">

        <h2 style="color:#00A36C;margin:0 0 8px 0;font-size:22px;">
          Welcome to Weekly Market Briefs! 🎉
        </h2>

        <p style="color:#ccc;margin:0 0 20px 0;line-height:1.7;font-size:15px;">
          ${greeting} You're now subscribed to Nigeria's most accurate commodity
          price intelligence. Every week, you'll receive:
        </p>

        <table role="presentation" width="100%" cellspacing="0"
          cellpadding="0" style="margin-bottom:28px;">
          <tr>
            <td style="padding:8px 0;vertical-align:top;width:32px;font-size:18px;">📊</td>
            <td style="padding:8px 0;color:#bbb;font-size:14px;line-height:1.5;">
              Price movements across 226+ Nigerian markets</td>
          </tr>
          <tr>
            <td style="padding:8px 0;vertical-align:top;width:32px;font-size:18px;">📈</td>
            <td style="padding:8px 0;color:#bbb;font-size:14px;line-height:1.5;">
              Weekly inflation trends vs NBS benchmarks</td>
          </tr>
          <tr>
            <td style="padding:8px 0;vertical-align:top;width:32px;font-size:18px;">🔔</td>
            <td style="padding:8px 0;color:#bbb;font-size:14px;line-height:1.5;">
              Top commodity alerts and arbitrage opportunities</td>
          </tr>
          <tr>
            <td style="padding:8px 0;vertical-align:top;width:32px;font-size:18px;">🌾</td>
            <td style="padding:8px 0;color:#bbb;font-size:14px;line-height:1.5;">
              Seasonal forecasts for key food items</td>
          </tr>
          <tr>
            <td style="padding:8px 0;vertical-align:top;width:32px;font-size:18px;">💡</td>
            <td style="padding:8px 0;color:#bbb;font-size:14px;line-height:1.5;">
              Procurement tips to save up to 40% on purchases</td>
          </tr>
        </table>

        <p style="color:#999;margin:0 0 28px 0;line-height:1.6;font-size:14px;">
          Your first brief arrives this Friday. Explore live prices now:
        </p>

        <div style="text-align:center;margin-bottom:28px;">
          <a href="${SITE_URL}"
            style="display:inline-block;background-color:#00A36C;color:#000000;
                   font-weight:700;font-size:15px;padding:14px 32px;
                   border-radius:8px;text-decoration:none;">
            View Live Prices →
          </a>
        </div>

        <hr style="border:none;border-top:1px solid #2a2a2a;margin:24px 0;">

        <p style="color:#555;font-size:12px;margin:0;text-align:center;">
          Don't want these emails?
          <a href="${SITE_URL}/unsubscribe?email=${encodeURIComponent(email)}"
            style="color:#00A36C;text-decoration:none;">Unsubscribe here</a>
        </p>
      </td>
    </tr>

    <!-- FOOTER -->
    <tr>
      <td style="text-align:center;padding-top:28px;">
        <p style="color:#444;font-size:12px;margin:0;">
          © 2026 NaijaMarket Intel • Giggababytes Oy
        </p>
        <p style="color:#333;font-size:11px;margin-top:6px;">
          Real-time commodity price intelligence for Nigerian markets
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function getAdminNotificationTemplate(
  email: string,
  firstName: string,
  totalCount: number,
  isResubscribe: boolean
): string {
  const timeWAT = new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos" });
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;background:#0a0a0a;font-family:monospace;">
  <div style="max-width:500px;margin:0 auto;background:#141414;
              border:1px solid #2a2a2a;border-radius:8px;padding:24px;">
    <h2 style="color:#00A36C;margin:0 0 16px 0;">
      ${isResubscribe ? "🔄 Re-Subscriber" : "📬 New Newsletter Subscriber"}
    </h2>
    <table width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td style="color:#666;padding:6px 0;width:130px;">Email:</td>
        <td style="color:#fff;padding:6px 0;">${email}</td>
      </tr>
      <tr>
        <td style="color:#666;padding:6px 0;">Name:</td>
        <td style="color:#fff;padding:6px 0;">${firstName || "—"}</td>
      </tr>
      <tr>
        <td style="color:#666;padding:6px 0;">Time (WAT):</td>
        <td style="color:#fff;padding:6px 0;">${timeWAT}</td>
      </tr>
      <tr>
        <td style="color:#666;padding:6px 0;">Source:</td>
        <td style="color:#FFD700;padding:6px 0;">Website Landing Page</td>
      </tr>
      <tr>
        <td style="color:#666;padding:6px 0;">Total active:</td>
        <td style="color:#00A36C;padding:6px 0;font-weight:bold;">${totalCount}</td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

// ============================================================================
// POST — Subscribe
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, firstName, name } = body;

    // Support both firstName (from EmailSignup) and name fields
    const displayName = (firstName || name || "").trim().slice(0, 100);

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Valid email required" },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    console.log("[NEWSLETTER] ══════════════════════════════════════════════");
    console.log("[NEWSLETTER] Subscribe:", cleanEmail);

    let isResubscribe = false;

    // ── Azure SQL: Insert or reactivate ──────────────────────────────────────
    try {
      await prisma.$executeRaw`
        INSERT INTO dbo.Newsletter_Subscribers
          (email, name, source, status, subscribed_at, updated_at)
        VALUES
          (${cleanEmail}, ${displayName || null}, 'WEBSITE', 'ACTIVE', GETDATE(), GETDATE())
      `;
      console.log("[NEWSLETTER] ✅ New subscriber saved to Azure SQL");

      // Log as revenue event (lead capture)
      try {
        await prisma.$executeRaw`
          INSERT INTO Revenue_Events
            (event_type, channel, amount_ngn, item_detail, attribution_source)
          VALUES
            ('SUBSCRIPTION', 'WEB', 0, 'Newsletter signup', 'ORGANIC')
        `;
      } catch { /* Revenue_Events may not exist yet — non-fatal */ }

    } catch (err: any) {
      // Duplicate — reactivate
      if (
        err?.message?.includes("UQ_Newsletter_Email") ||
        err?.message?.includes("UX_Newsletter_Email") ||
        err?.message?.includes("duplicate") ||
        err?.code === "23505"
      ) {
        // Check if already active
        const existing = await prisma.$queryRaw`
          SELECT status FROM dbo.Newsletter_Subscribers
          WHERE email = ${cleanEmail}
        ` as any[];

        if (existing?.[0]?.status === "ACTIVE") {
          console.log("[NEWSLETTER] Already active:", cleanEmail);
          return NextResponse.json({
            success:           true,
            alreadySubscribed: true,
            message:           "You're already on our list! 🎉 Check your inbox every Friday.",
          });
        }

        // Reactivate unsubscribed user
        await prisma.$executeRaw`
          UPDATE dbo.Newsletter_Subscribers
          SET status          = 'ACTIVE',
              unsubscribed_at = NULL,
              resubscribed_at = GETDATE(),
              updated_at      = GETDATE()
          WHERE email = ${cleanEmail}
        `;
        isResubscribe = true;
        console.log("[NEWSLETTER] ✅ Reactivated:", cleanEmail);
      } else {
        throw err;
      }
    }

    // ── Resend Audience: Add contact ─────────────────────────────────────────
    if (AUDIENCE_ID) {
      try {
        const { error: contactError } = await resend.contacts.create({
          audienceId:   AUDIENCE_ID,
          email:        cleanEmail,
          firstName:    displayName || undefined,
          unsubscribed: false,
        });
        if (contactError) {
          console.error("[NEWSLETTER] Resend audience (non-fatal):", contactError);
        } else {
          console.log("[NEWSLETTER] ✅ Added to Resend audience");
        }
      } catch (e) {
        console.error("[NEWSLETTER] Resend audience failed (non-fatal):", e);
      }
    }

    // ── Get total active count ────────────────────────────────────────────────
    const countResult = await prisma.$queryRaw`
      SELECT COUNT(*) as total FROM dbo.Newsletter_Subscribers
      WHERE status = 'ACTIVE'
    ` as any[];
    const totalCount = Number(countResult?.[0]?.total ?? 0);

    // ── Send welcome email ────────────────────────────────────────────────────
    try {
      const { error } = await resend.emails.send({
        from:    SENDER,
        to:      [cleanEmail],
        subject: isResubscribe
          ? "Welcome back to NaijaMarket Intel! 🇳🇬"
          : "🇳🇬 Welcome to NaijaMarket Intel Weekly Briefs!",
        html: getWelcomeEmailTemplate(cleanEmail, displayName),
      });
      if (error) console.error("[NEWSLETTER] Welcome email (non-fatal):", error);
      else console.log("[NEWSLETTER] ✅ Welcome email sent");
    } catch (e) {
      console.error("[NEWSLETTER] Welcome email failed (non-fatal):", e);
    }

    // ── Notify admin ──────────────────────────────────────────────────────────
    try {
      const { error } = await resend.emails.send({
        from:    SENDER,
        to:      [ADMIN_EMAIL],
        subject: isResubscribe
          ? `🔄 Re-subscriber: ${cleanEmail} (Total: ${totalCount})`
          : `📬 New Subscriber #${totalCount}: ${cleanEmail}`,
        html: getAdminNotificationTemplate(cleanEmail, displayName, totalCount, isResubscribe),
      });
      if (error) console.error("[NEWSLETTER] Admin notify (non-fatal):", error);
      else console.log("[NEWSLETTER] ✅ Admin notified | Total:", totalCount);
    } catch (e) {
      console.error("[NEWSLETTER] Admin notify failed (non-fatal):", e);
    }

    console.log("[NEWSLETTER] ✅ Complete for:", cleanEmail);

    return NextResponse.json({
      success: true,
      message: isResubscribe
        ? "Welcome back! You've been re-subscribed. 🎉"
        : "Successfully subscribed! Check your inbox for a welcome email. 🇳🇬",
    });

  } catch (error) {
    console.error("[NEWSLETTER] ❌ Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to subscribe. Please try again." },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET — Admin: list subscribers
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "ACTIVE";

    const subscribers: any[] = await prisma.$queryRaw`
      SELECT email, name, source, status, subscribed_at
      FROM dbo.Newsletter_Subscribers
      WHERE status = ${status}
      ORDER BY subscribed_at DESC
    `;

    return NextResponse.json({
      success: true,
      count:   subscribers.length,
      subscribers,
    });
  } catch (error) {
    console.error("[NEWSLETTER] GET Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch subscribers" },
      { status: 500 }
    );
  }
}
