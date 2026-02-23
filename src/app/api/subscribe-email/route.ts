// src/app/api/subscribe-email/route.ts
// NaijaMarket Intel - Email Subscription API
// Version: 1.0.0
// Date: 2026-02-23
//
// Handles: Email signup from landing page, Brevo contact creation, welcome email
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ============================================================================
// BREVO API CONFIGURATION
// ============================================================================

const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const BREVO_API_URL = "https://api.brevo.com/v3";
const SENDER_EMAIL = "noreply@naijamarketintel.ng";
const SENDER_NAME = "NaijaMarket Intel";

// Brevo list IDs (create these in Brevo → Contacts → Lists)
const BREVO_LISTS = {
  prospects: 2, // Default list for landing page signups
  weekly_brief: 3,
  monthly_report: 4,
};

// ============================================================================
// WELCOME EMAIL TEMPLATE
// ============================================================================

function getWelcomeEmailHtml(firstName: string): string {
  const name = firstName || "there";
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to NaijaMarket Intel</title>
</head>
<body style="margin:0;padding:0;background:#0A0F14;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0F14;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          
          <!-- Logo -->
          <tr>
            <td style="padding-bottom:32px;text-align:center;">
              <div style="display:inline-block;background:linear-gradient(135deg,#00C853,#006428);border-radius:12px;width:48px;height:48px;line-height:48px;text-align:center;font-weight:800;font-size:16px;color:#fff;font-family:monospace;">NM</div>
              <div style="margin-top:8px;font-size:18px;font-weight:700;color:#fff;">NaijaMarket<span style="color:#00C853;">Intel</span></div>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td style="background:#111820;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:40px 32px;">
              
              <!-- Greeting -->
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#fff;">Welcome, ${name}! 🎉</h1>
              
              <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#94A3B8;">
                You're now subscribed to NaijaMarket Intel — Nigeria's real-time commodity price intelligence platform. Here's what you'll receive:
              </p>

              <!-- What You Get -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding:12px 16px;background:rgba(0,200,83,0.06);border-radius:10px;margin-bottom:8px;">
                    <div style="font-size:14px;color:#00C853;font-weight:600;">📊 Weekly Market Brief (Mondays)</div>
                    <div style="font-size:13px;color:#64748B;margin-top:4px;">Top commodity price movers, regional comparisons, and arbitrage opportunities</div>
                  </td>
                </tr>
                <tr><td style="height:8px;"></td></tr>
                <tr>
                  <td style="padding:12px 16px;background:rgba(0,200,83,0.06);border-radius:10px;">
                    <div style="font-size:14px;color:#00C853;font-weight:600;">📈 Monthly Inflation Report (1st of month)</div>
                    <div style="font-size:13px;color:#64748B;margin-top:4px;">NaijaMarket Food Price Index vs NBS official rates, commodity-level breakdown</div>
                  </td>
                </tr>
                <tr><td style="height:8px;"></td></tr>
                <tr>
                  <td style="padding:12px 16px;background:rgba(0,200,83,0.06);border-radius:10px;">
                    <div style="font-size:14px;color:#00C853;font-weight:600;">🚀 Product Updates (occasional)</div>
                    <div style="font-size:13px;color:#64748B;margin-top:4px;">New features, markets, and commodities as we expand across Nigeria</div>
                  </td>
                </tr>
              </table>

              <!-- Stats -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td width="33%" style="text-align:center;padding:16px 8px;background:#0A0F14;border-radius:10px 0 0 10px;">
                    <div style="font-size:20px;font-weight:800;color:#00C853;">610+</div>
                    <div style="font-size:11px;color:#64748B;margin-top:2px;">Commodities</div>
                  </td>
                  <td width="34%" style="text-align:center;padding:16px 8px;background:#0A0F14;">
                    <div style="font-size:20px;font-weight:800;color:#00C853;">224</div>
                    <div style="font-size:11px;color:#64748B;margin-top:2px;">Markets</div>
                  </td>
                  <td width="33%" style="text-align:center;padding:16px 8px;background:#0A0F14;border-radius:0 10px 10px 0;">
                    <div style="font-size:20px;font-weight:800;color:#00C853;">37</div>
                    <div style="font-size:11px;color:#64748B;margin-top:2px;">States</div>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://www.naijamarketintel.ng/register" 
                       style="display:inline-block;background:linear-gradient(135deg,#00C853,#00E676);color:#0A0F14;font-size:15px;font-weight:700;padding:14px 32px;border-radius:12px;text-decoration:none;">
                      Create Your Free Account →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;font-size:13px;color:#475569;text-align:center;">
                Or try it now on WhatsApp — text <strong style="color:#00C853;">RICE LAGOS</strong> to see live prices
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;color:#475569;">
                🇳🇬 Built for Nigeria · 🇫🇮 Powered from Finland
              </p>
              <p style="margin:0 0 8px;font-size:11px;color:#334155;">
                NaijaMarket Intel by Giggababytes Oy · Helsinki, Finland
              </p>
              <p style="margin:0;font-size:11px;color:#334155;">
                <a href="https://www.naijamarketintel.ng/privacy" style="color:#64748B;">Privacy</a> · 
                <a href="https://www.naijamarketintel.ng/ndpr" style="color:#64748B;">NDPR</a> · 
                <a href="{{{ pm_unsubscribe_url }}}" style="color:#64748B;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ============================================================================
// BREVO API HELPERS
// ============================================================================

async function createBrevoContact(
  email: string,
  firstName: string,
  segment: string
): Promise<{ success: boolean; contactId?: string; error?: string }> {
  try {
    const response = await fetch(`${BREVO_API_URL}/contacts`, {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email,
        attributes: {
          FIRSTNAME: firstName || "",
          SEGMENT: segment,
          SOURCE: "landing_page",
        },
        listIds: [BREVO_LISTS.prospects],
        updateEnabled: true, // Update if contact already exists
      }),
    });

    if (response.ok || response.status === 201) {
      const data = await response.json();
      return { success: true, contactId: data.id?.toString() };
    }

    // 204 = contact already exists and was updated
    if (response.status === 204) {
      return { success: true };
    }

    const errorData = await response.json().catch(() => null);
    console.error("[BREVO] Contact creation error:", response.status, errorData);
    
    // Don't fail the subscription if Brevo is down
    return { success: false, error: errorData?.message || "Brevo API error" };
  } catch (error) {
    console.error("[BREVO] Network error:", error);
    return { success: false, error: "Brevo network error" };
  }
}

async function sendWelcomeEmail(
  email: string,
  firstName: string
): Promise<boolean> {
  try {
    const response = await fetch(`${BREVO_API_URL}/smtp/email`, {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email, name: firstName || email.split("@")[0] }],
        subject: "Welcome to NaijaMarket Intel 🇳🇬 — Your Market Brief Starts Monday",
        htmlContent: getWelcomeEmailHtml(firstName),
        tags: ["welcome", "onboarding"],
      }),
    });

    if (response.ok || response.status === 201) {
      console.log("[BREVO] Welcome email sent to:", email);
      return true;
    }

    const errorData = await response.json().catch(() => null);
    console.error("[BREVO] Welcome email error:", response.status, errorData);
    return false;
  } catch (error) {
    console.error("[BREVO] Welcome email network error:", error);
    return false;
  }
}

// ============================================================================
// EMAIL VALIDATION
// ============================================================================

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return false;
  if (email.length > 255) return false;

  // Block disposable email providers
  const blockedDomains = [
    "mailinator.com", "guerrillamail.com", "tempmail.com",
    "throwaway.email", "10minutemail.com", "yopmail.com",
    "trashmail.com", "fakeinbox.com", "sharklasers.com",
  ];
  const domain = email.split("@")[1]?.toLowerCase();
  if (blockedDomains.includes(domain)) return false;

  return true;
}

// ============================================================================
// POST - Subscribe to mailing list
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, firstName, source } = body;

    // ── Validate ──────────────────────────────────────────────────────────
    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = (firstName || "").trim().slice(0, 100);
    
    // Sanitize source to match DB CHECK constraint
    const VALID_SOURCES = ["landing_page", "registration", "blog", "api_portal", "manual", "import"];
    const cleanSource = VALID_SOURCES.includes(source) ? source : "landing_page";

    if (!isValidEmail(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    // ── Check for existing subscriber ─────────────────────────────────────
    const existing = await prisma.$queryRaw`
      SELECT subscriber_id, is_active, unsubscribed_at 
      FROM Email_Subscribers 
      WHERE email = ${cleanEmail}
    ` as any[];

    if (existing && existing.length > 0) {
      const sub = existing[0];

      if (sub.is_active) {
        // Already subscribed and active
        return NextResponse.json({
          success: true,
          message: "You're already subscribed! Check your inbox for our next market brief.",
          alreadySubscribed: true,
        });
      }

      // Reactivate previously unsubscribed
      await prisma.$executeRaw`
        UPDATE Email_Subscribers 
        SET is_active = 1, 
            unsubscribed_at = NULL,
            first_name = COALESCE(NULLIF(${cleanName}, ''), first_name),
            brevo_synced_at = NULL
        WHERE subscriber_id = ${sub.subscriber_id}
      `;

      // Re-sync to Brevo
      await createBrevoContact(cleanEmail, cleanName, "prospect");
      await sendWelcomeEmail(cleanEmail, cleanName);

      return NextResponse.json({
        success: true,
        message: "Welcome back! You've been resubscribed.",
        resubscribed: true,
      });
    }

    // ── Get request metadata ──────────────────────────────────────────────
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = (request.headers.get("user-agent") || "").slice(0, 500);

    // ── Insert new subscriber ─────────────────────────────────────────────
    await prisma.$executeRaw`
      INSERT INTO Email_Subscribers (
        email, first_name, source, segment,
        weekly_brief, monthly_report, product_updates,
        is_verified, is_active, ip_address, user_agent
      ) VALUES (
        ${cleanEmail}, ${cleanName || null}, ${cleanSource}, 'prospect',
        1, 1, 1,
        1, 1, ${ip}, ${userAgent}
      )
    `;

    // ── Sync to Brevo ─────────────────────────────────────────────────────
    const brevoResult = await createBrevoContact(cleanEmail, cleanName, "prospect");

    if (brevoResult.success && brevoResult.contactId) {
      await prisma.$executeRaw`
        UPDATE Email_Subscribers 
        SET brevo_contact_id = ${brevoResult.contactId},
            brevo_synced_at = SYSUTCDATETIME()
        WHERE email = ${cleanEmail}
      `;
    }

    // ── Send welcome email ────────────────────────────────────────────────
    const emailSent = await sendWelcomeEmail(cleanEmail, cleanName);

    if (emailSent) {
      await prisma.$executeRaw`
        UPDATE Email_Subscribers 
        SET last_email_sent_at = SYSUTCDATETIME()
        WHERE email = ${cleanEmail}
      `;
    }

    // ── Return success ────────────────────────────────────────────────────
    console.log(
      `[SUBSCRIBE] ✅ New subscriber: ${cleanEmail} | Source: ${cleanSource} | Brevo: ${brevoResult.success}`
    );

    return NextResponse.json({
      success: true,
      message: "You're in! Check your inbox for a welcome email.",
      emailSent,
    });
  } catch (error: any) {
    console.error("[SUBSCRIBE] ❌ Error:", error);

    // Handle unique constraint violation (race condition)
    if (error?.message?.includes("UQ_Email_Subscribers_Email")) {
      return NextResponse.json({
        success: true,
        message: "You're already subscribed!",
        alreadySubscribed: true,
      });
    }

    return NextResponse.json(
      { success: false, error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Subscriber count (public, for landing page social proof)
// ============================================================================

export async function GET() {
  try {
    const result = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM Email_Subscribers 
      WHERE is_active = 1
    ` as any[];

    const count = result?.[0]?.count || 0;

    return NextResponse.json({
      success: true,
      subscribers: count,
    });
  } catch (error) {
    console.error("[SUBSCRIBE] Count error:", error);
    return NextResponse.json({ success: true, subscribers: 0 });
  }
}
