// src/app/api/auth/register/route.ts
// NaijaMarket Intel - Registration API
// Requires BOTH Phone (WhatsApp) AND Email OTP verification
// Updated: 2026-02-20 — Added dual-write sync to Google Sheets

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { syncConsumerToSheets } from "@/lib/sync-to-sheets";

const prisma = new PrismaClient();

// Format phone number - MUST match send-otp formatting exactly
function formatPhoneNumber(phone: string, countryCode?: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");
  
  if (cleaned.startsWith("+")) {
    return cleaned.substring(1);
  }
  
  if (countryCode) {
    const cleanCountryCode = countryCode.replace("+", "");
    
    if (cleaned.startsWith("0")) {
      cleaned = cleaned.substring(1);
    }
    
    if (cleaned.startsWith(cleanCountryCode)) {
      return cleaned;
    }
    
    return cleanCountryCode + cleaned;
  }
  
  if (cleaned.startsWith("0")) {
    return "234" + cleaned.substring(1);
  }
  
  return cleaned;
}


async function sendBrevoWelcome(email: string, phone: string) {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) return
  try {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'NaijaMarketIntel', email: 'noreply@naijamarketintel.ng' },
        to: [{ email }],
        subject: 'Welcome to NaijaMarketIntel',
        htmlContent: '<div style="font-family:sans-serif;background:#0a0a0a;color:#f5f5f5;padding:40px;max-width:600px;margin:0 auto"><div style="border-bottom:2px solid #00a651;padding-bottom:16px;margin-bottom:32px"><span style="color:#00a651;font-weight:700;font-size:20px">NaijaMarketIntel</span></div><h1 style="color:#fff;font-size:24px">Welcome aboard!</h1><p style="color:#aaa;line-height:1.7">Your FREE account is ready. You now have access to real-time commodity prices from 282+ markets across Nigeria.</p><div style="background:#111;border:1px solid #222;border-radius:8px;padding:20px;margin:24px 0"><p style="color:#00a651;font-weight:600;margin:0 0 10px">Get started:</p><p style="color:#ccc;font-size:14px;margin:0;line-height:2">1. Search any commodity on your dashboard<br>2. Set a price alert<br>3. Explore arbitrage opportunities</p></div><a href="https://naijamarketintel.ng/dashboard" style="display:inline-block;background:#00a651;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Go to Dashboard</a><p style="color:#444;font-size:12px;margin-top:40px;border-top:1px solid #1a1a1a;padding-top:16px">NaijaMarketIntel · Giggababytes Oy · Lahti, Finland</p></div>',
      }),
    })
  } catch (err) {
    console.error('[register] Brevo failed:', err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phone, password, countryCode, tier, fullName } = body;

    console.log("📝 Registration request:", { email, phone, countryCode });

    // Validate required fields — only phone is mandatory; email/password optional
    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    // Validate email format only if an email was provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Format phone number
    const formattedPhone = formatPhoneNumber(phone, countryCode);
    const formattedEmail = email ? email.toLowerCase().trim() : null;
    console.log("📱 Formatted phone:", formattedPhone);
    console.log("📧 Formatted email:", formattedEmail);

    // Validate password only if one was provided
    if (password && password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // Check if user exists by phone
    const existingByPhone = await prisma.consumers.findFirst({
      where: { phone_number: formattedPhone },
    });
    if (existingByPhone) {
      console.log("❌ Phone already exists:", formattedPhone);
      return NextResponse.json(
        { error: "An account with this phone number already exists" },
        { status: 400 }
      );
    }

    // Check if user exists by email (only when an email was provided)
    if (formattedEmail) {
      const existingByEmail = await prisma.consumers.findFirst({
        where: { email: formattedEmail },
      });
      if (existingByEmail) {
        console.log("❌ Email already exists:", formattedEmail);
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 400 }
        );
      }
    }

    // ============================================================
    // VERIFY PHONE WAS VERIFIED
    // ============================================================
    const phoneOtpRecord = await prisma.oTP_Sessions.findFirst({
      where: {
        OR: [
          { phone_number: formattedPhone },
          { phone_number: "+" + formattedPhone },
        ],
        verified: true,
      },
      orderBy: { created_at: "desc" },
    });

    if (!phoneOtpRecord) {
      console.log("❌ Phone not verified:", formattedPhone);
      return NextResponse.json({ error: "Phone number not verified. Please verify your phone first." }, { status: 400 });
    }

    console.log("✅ Phone verified");

    // ============================================================
    // VERIFY EMAIL WAS VERIFIED (only when an email was provided)
    // ============================================================
    if (formattedEmail) {
      const emailOtpRecord = await prisma.oTP_Codes.findFirst({
        where: {
          identifier: formattedEmail,
          type: "email",
          verified: true
        },
        orderBy: { created_at: "desc" },
      });

      if (!emailOtpRecord) {
        console.log("❌ Email not verified:", formattedEmail);
        return NextResponse.json({ error: "Email not verified. Please verify your email first." }, { status: 400 });
      }

      console.log("✅ Email verified");
    }

    // ============================================================
    // CREATE ACCOUNT
    // ============================================================
    console.log("🔐 Creating account...");

    // Hash password (only when one was provided)
    const hashedPassword = password ? await bcrypt.hash(password, 12) : null;

    // Generate consumer ID
    const consumerId = `CON${Date.now()}`;

    // Persist the name the user entered during registration (step 1).
    // full_name is the source of truth for the sidebar; derive first/last too.
    const cleanFullName = String(fullName || "").trim().slice(0, 50);
    const nameParts = cleanFullName.split(/\s+/).filter(Boolean);
    const firstName = (nameParts[0] || "").slice(0, 50);
    const lastName = nameParts.slice(1).join(" ").slice(0, 50);

    // Create consumer account
    const consumer = await prisma.consumers.create({
      data: {
        consumer_id: consumerId,
        phone_number: formattedPhone,
        email: formattedEmail,
        full_name: cleanFullName || null,
        first_name: firstName || null,
        last_name: lastName || null,
        password_hash: hashedPassword,
        phone_verified: true,                 // Phone is verified ✅
        email_verified: !!formattedEmail,     // Only true when email provided & verified
        subscription_tier: tier || "FREE",
        account_status: "ACTIVE",
        registration_source: "WEB",
        daily_query_limit: 3,
        max_markets: 3,
        queries_remaining: 3,
      },
    });

    console.log("✅ Consumer created:", consumer.consumer_id);

    // ============================================================
    // Insert CONSUMER role so the WA engine recognises this user.
    // User_Roles is keyless / @@ignored by Prisma, so use raw SQL and mirror
    // the WA welcome flow: idempotent check + insert with '+' phone format.
    // Non-blocking — a failure here must not fail an otherwise-successful signup.
    // ============================================================
    try {
      const phonePlus = `+${formattedPhone}`;
      const existing = await prisma.$queryRaw<Array<{ cnt: number }>>`
        SELECT CAST(COUNT(*) AS INT) AS cnt FROM dbo.User_Roles
        WHERE phone_number = ${formattedPhone} OR phone_number = ${phonePlus}
      `;
      if (!existing?.[0] || Number(existing[0].cnt) === 0) {
        await prisma.$executeRaw`
          INSERT INTO dbo.User_Roles (phone_number, role, status, created_at)
          VALUES (${phonePlus}, 'CONSUMER', 'ACTIVE', GETUTCDATE())
        `;
        console.log("✅ User_Roles CONSUMER role inserted");
      } else {
        console.log("ℹ️ User_Roles role already exists — skipped");
      }
    } catch (roleErr) {
      console.error("User_Roles insert failed (non-blocking):", roleErr);
    }

    // ============================================================
    // DUAL-WRITE: Sync to Google Sheets for WhatsApp recognition
    // Runs async — won't block registration if it fails
    // ============================================================
    try {
      const syncResult = await syncConsumerToSheets({
        consumer_id: consumerId,
        phone_number: formattedPhone,
        registration_date: new Date().toISOString().split("T")[0],
        registration_source: "WEB",
        subscription_tier: "FREE",
        daily_query_limit: 3,
        max_markets: 3,
        account_status: "ACTIVE",
      });
      console.log("📋 Google Sheets sync:", syncResult.success ? "✅" : "❌", syncResult.method);
    } catch (syncError) {
      console.error("📋 Google Sheets sync failed (non-blocking):", syncError);
    }

    // Clean up OTP records
    await prisma.oTP_Codes.deleteMany({
      where: {
        OR: [
          { identifier: formattedPhone },
          ...(formattedEmail ? [{ identifier: formattedEmail }] : []),
        ],
      },
    });

    console.log("✅ OTP records cleaned up");

    // Brevo welcome — non-blocking (only when an email was provided)
    if (formattedEmail) sendBrevoWelcome(formattedEmail, formattedPhone).catch(() => {})

    return NextResponse.json({
      success: true,
      message: "Account created successfully",
      consumer: {
        id: consumer.consumer_id,
        email: consumer.email,
        phone: consumer.phone_number,
        tier: consumer.subscription_tier,
      },
    });

  } catch (error: any) {
    console.error("❌ Registration error:", error);
    
    // Handle unique constraint violations
    if (error.code === "P2002") {
      const field = error.meta?.target?.[0];
      if (field === "phone_number") {
        return NextResponse.json(
          { error: "An account with this phone number already exists" },
          { status: 400 }
        );
      }
      if (field === "email") {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
