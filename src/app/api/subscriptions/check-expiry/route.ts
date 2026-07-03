// ============================================================================
// src/app/api/subscriptions/check-expiry/route.ts
// NaijaMarket Intel - Subscription Expiry Checker (Cron Job)
// Version: 1.0.0 | Date: 2026-02-20
//
// WHAT THIS DOES:
// 1. Finds subscriptions expiring in 3 days → sends renewal reminder
// 2. Finds subscriptions expiring in 1 day → sends urgent reminder
// 3. Finds subscriptions past end_date → marks as GRACE_PERIOD
// 4. Finds subscriptions past grace_period_end → downgrades to FREE
// 5. Sends WhatsApp notifications at each step
//
// VERCEL CRON SETUP (vercel.json):
//   {
//     "crons": [{
//       "path": "/api/subscriptions/check-expiry",
//       "schedule": "0 6 * * *"
//     }]
//   }
//   Runs daily at 6:00 AM UTC (7:00 AM WAT)
//
// MANUAL TRIGGER:
//   GET /api/subscriptions/check-expiry?test=1
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// PRISMA
// ============================================================================

import { PrismaClient } from "@prisma/client";
import { sendExpiryReminder } from "@/lib/whatsapp";
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ============================================================================
// CONFIG
// ============================================================================

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
const CRON_SECRET = process.env.CRON_SECRET || "";

// ============================================================================
// HELPERS
// ============================================================================

function phoneToWA(phone: string): string {
  let c = phone.replace(/\D/g, "");
  if (c.startsWith("0")) c = "234" + c.substring(1);
  if (!c.startsWith("234")) c = "234" + c;
  return `whatsapp:+${c}`;
}

async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  if (!TWILIO_SID || !TWILIO_TOKEN) return false;
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: TWILIO_FROM, To: phoneToWA(phone), Body: message,
        }).toString(),
      }
    );
    return res.ok;
  } catch { return false; }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  // Auth check
  const auth = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const isTest = searchParams.get("test") === "1";

  if (!isTest && CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const t0 = Date.now();
  const stats = {
    reminders3day: 0,
    reminders1day: 0,
    movedToGrace: 0,
    downgradedToFree: 0,
    whatsappSent: 0,
    whatsappFailed: 0,
    errors: [] as string[],
  };

  try {
    // ========================================================================
    // STEP 1: Send 3-day expiry reminders
    // ========================================================================

    const expiring3days = await prisma.$queryRaw`
      SELECT 
        s.subscription_id, s.phone_number, s.tier_code, s.tier_name,
        s.end_date, s.payment_amount, s.payment_provider
      FROM Consumer_Active_Subscriptions s
      WHERE s.status = 'ACTIVE'
        AND s.end_date IS NOT NULL
        AND DATEDIFF(day, GETDATE(), s.end_date) = 3
    ` as any[];

    for (const sub of expiring3days) {
      try {
        const endStr = new Date(sub.end_date).toLocaleDateString("en-NG", {
          day: "numeric", month: "short", year: "numeric",
        });
        // Migrated Twilio → Meta: subscription_expiry_reminder template.
        const sent = await sendExpiryReminder(sub.phone_number, sub.tier_name || sub.tier_code, "3", endStr);
        if (sent) stats.whatsappSent++; else stats.whatsappFailed++;
        stats.reminders3day++;
      } catch (e: any) {
        stats.errors.push(`3day ${sub.phone_number}: ${e.message}`);
      }
    }

    // ========================================================================
    // STEP 2: Send 1-day expiry reminders (urgent)
    // ========================================================================

    const expiring1day = await prisma.$queryRaw`
      SELECT 
        s.subscription_id, s.phone_number, s.tier_code, s.tier_name,
        s.end_date, s.payment_amount
      FROM Consumer_Active_Subscriptions s
      WHERE s.status = 'ACTIVE'
        AND s.end_date IS NOT NULL
        AND DATEDIFF(day, GETDATE(), s.end_date) = 1
    ` as any[];

    for (const sub of expiring1day) {
      try {
        // Migrated Twilio → Meta: subscription_expiry_reminder template (1 day left).
        const endStr = new Date(sub.end_date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
        const sent = await sendExpiryReminder(sub.phone_number, sub.tier_name || sub.tier_code, "1", endStr);
        if (sent) stats.whatsappSent++; else stats.whatsappFailed++;
        stats.reminders1day++;
      } catch (e: any) {
        stats.errors.push(`1day ${sub.phone_number}: ${e.message}`);
      }
    }

    // ========================================================================
    // STEP 3: Move expired ACTIVE → GRACE_PERIOD
    // ========================================================================

    const expired = await prisma.$queryRaw`
      SELECT 
        s.subscription_id, s.phone_number, s.tier_code, s.tier_name,
        s.end_date, s.grace_end_date
      FROM Consumer_Active_Subscriptions s
      WHERE s.status = 'ACTIVE'
        AND s.end_date IS NOT NULL
        AND s.end_date < GETDATE()
    ` as any[];

    for (const sub of expired) {
      try {
        await prisma.$executeRaw`
          UPDATE Consumer_Active_Subscriptions
          SET status = 'GRACE_PERIOD', updated_at = GETDATE()
          WHERE subscription_id = ${sub.subscription_id}
        `;

        const graceEnd = sub.grace_end_date
          ? new Date(sub.grace_end_date).toLocaleDateString("en-NG")
          : "3 days";

        const sent = await sendWhatsApp(sub.phone_number,
          `🔶 *Subscription Expired*\n\n` +
          `Your *${sub.tier_name || sub.tier_code}* plan has expired.\n\n` +
          `You still have access until *${graceEnd}* (grace period).\n\n` +
          `After that, your account will be downgraded to FREE.\n\n` +
          `Type *upgrade* to renew and keep your access.`
        );
        if (sent) stats.whatsappSent++; else stats.whatsappFailed++;
        stats.movedToGrace++;
      } catch (e: any) {
        stats.errors.push(`grace ${sub.phone_number}: ${e.message}`);
      }
    }

    // ========================================================================
    // STEP 4: Downgrade GRACE_PERIOD → FREE (past grace_end_date)
    // ========================================================================

    const pastGrace = await prisma.$queryRaw`
      SELECT 
        s.subscription_id, s.phone_number, s.tier_code, s.tier_name
      FROM Consumer_Active_Subscriptions s
      WHERE s.status = 'GRACE_PERIOD'
        AND s.grace_end_date IS NOT NULL
        AND s.grace_end_date < GETDATE()
    ` as any[];

    for (const sub of pastGrace) {
      try {
        // Mark subscription as expired
        await prisma.$executeRaw`
          UPDATE Consumer_Active_Subscriptions
          SET status = 'EXPIRED', updated_at = GETDATE()
          WHERE subscription_id = ${sub.subscription_id}
        `;

        // Downgrade consumer to FREE
        await prisma.$executeRaw`
          UPDATE Consumers
          SET subscription_tier = 'FREE',
              subscription_end = NULL,
              grace_period_end = NULL,
              updated_at = GETDATE()
          WHERE phone_number = ${sub.phone_number}
        `;

        const sent = await sendWhatsApp(sub.phone_number,
          `🔴 *Subscription Downgraded*\n\n` +
          `Your *${sub.tier_name || sub.tier_code}* plan has been downgraded to *FREE* due to non-renewal.\n\n` +
          `FREE tier includes:\n` +
          `• 3 price queries per day\n` +
          `• Yesterday's prices only\n\n` +
          `Type *upgrade* anytime to reactivate your plan.`
        );
        if (sent) stats.whatsappSent++; else stats.whatsappFailed++;
        stats.downgradedToFree++;
      } catch (e: any) {
        stats.errors.push(`downgrade ${sub.phone_number}: ${e.message}`);
      }
    }

    // ========================================================================
    // DONE
    // ========================================================================

    const duration = Date.now() - t0;
    console.log(`[Expiry] ✅ ${duration}ms | 3day=${stats.reminders3day} 1day=${stats.reminders1day} grace=${stats.movedToGrace} downgraded=${stats.downgradedToFree} WA=${stats.whatsappSent}/${stats.whatsappSent + stats.whatsappFailed}`);

    return NextResponse.json({
      success: true,
      duration_ms: duration,
      stats,
      timestamp: new Date().toISOString(),
    });

  } catch (e: any) {
    console.error("[Expiry] Fatal:", e);
    return NextResponse.json({
      success: false,
      error: e.message,
      stats,
    }, { status: 500 });
  }
}
