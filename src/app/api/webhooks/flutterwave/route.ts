// ============================================================================
// src/app/api/webhooks/flutterwave/route.ts
// NaijaMarket Intel - Flutterwave Payment Webhook
// Version: 1.0.0 | Date: 2026-02-20
//
// Same logic as Paystack webhook but with Flutterwave-specific:
// - Hash verification uses FLUTTERWAVE_SECRET_HASH header
// - Amount is in naira (not kobo)
// - Different payload structure
//
// FLUTTERWAVE DASHBOARD SETUP:
//   Webhook URL: https://naijamarket-web.vercel.app/api/webhooks/flutterwave
//   Secret Hash: Set in Vercel as FLUTTERWAVE_SECRET_HASH
//
// VERCEL ENV VARS:
//   FLUTTERWAVE_SECRET_HASH
//   FLUTTERWAVE_SECRET_KEY (for verification API calls)
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// PRISMA
// ============================================================================

import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ============================================================================
// CONFIG
// ============================================================================

const FLW_SECRET_HASH = process.env.FLUTTERWAVE_SECRET_HASH || "";
const FLW_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY || "";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

const DURATION_DAYS: Record<string, number> = {
  WEEKLY: 7, MONTHLY: 30, QUARTERLY: 90, ANNUAL: 365,
};
const GRACE_PERIOD_DAYS = 3;

// ============================================================================
// HELPERS (same as Paystack)
// ============================================================================

function phoneToWA(phone: string): string {
  let c = phone.replace(/\D/g, "");
  if (c.startsWith("0")) c = "234" + c.substring(1);
  if (!c.startsWith("234")) c = "234" + c;
  return `whatsapp:+${c}`;
}

function naira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG")}`;
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
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
// VERIFY FLUTTERWAVE WEBHOOK
// ============================================================================

function verifyFlutterwaveHash(secretHash: string): boolean {
  if (!FLW_SECRET_HASH) return true; // dev mode
  return secretHash === FLW_SECRET_HASH;
}

// Optional: verify transaction with Flutterwave API
async function verifyTransaction(transactionId: string): Promise<any> {
  if (!FLW_SECRET_KEY) return null;
  try {
    const res = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      {
        headers: { Authorization: `Bearer ${FLW_SECRET_KEY}` },
      }
    );
    if (res.ok) return (await res.json()).data;
    return null;
  } catch { return null; }
}

// ============================================================================
// EXTRACT METADATA FROM FLUTTERWAVE
// ============================================================================

interface Meta {
  phone_number: string;
  consumer_id: string;
  tier_code: string;
  tier_name: string;
  billing_cycle: string;
  addon_code: string;
  product_type: string;
}

function extractMeta(data: any): Meta {
  const m = data.meta || {};
  return {
    phone_number: m.phone_number || data.customer?.phone_number || data.customer?.phone || "",
    consumer_id:  m.consumer_id  || "",
    tier_code:    m.tier_code    || "",
    tier_name:    m.tier_name    || "",
    billing_cycle:m.billing_cycle|| "MONTHLY",
    addon_code:   m.addon_code   || "",
    product_type: m.product_type || "SUBSCRIPTION",
  };
}

// ============================================================================
// ACTIVATE SUBSCRIPTION (shared logic)
// ============================================================================

async function activateSubscription(
  phone: string, tierCode: string, tierName: string,
  billingCycle: string, amount: number, ref: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const days = DURATION_DAYS[billingCycle] || 30;
    const endDate = new Date(Date.now() + days * 86400000);
    const graceEnd = new Date(endDate.getTime() + GRACE_PERIOD_DAYS * 86400000);
    const subId = genId("SUB");
    const txnId = genId("TXN");
    const endISO = endDate.toISOString();
    const graceISO = graceEnd.toISOString();

    // Deactivate existing
    await prisma.$executeRaw`
      UPDATE Consumer_Active_Subscriptions
      SET status = 'SUPERSEDED', updated_at = GETDATE()
      WHERE phone_number = ${phone} AND status = 'ACTIVE'
    `;

    // Create subscription
    await prisma.$executeRaw`
      INSERT INTO Consumer_Active_Subscriptions (
        subscription_id, phone_number, tier_code, tier_name,
        status, start_date, end_date, grace_end_date,
        payment_reference, payment_provider, payment_amount,
        auto_renew, created_at, updated_at, notes
      ) VALUES (
        ${subId}, ${phone}, ${tierCode}, ${tierName},
        'ACTIVE', GETDATE(), ${endISO}, ${graceISO},
        ${ref}, 'FLUTTERWAVE', ${amount},
        0, GETDATE(), GETDATE(), 'Activated via Flutterwave webhook'
      )
    `;

    // Update consumer
    await prisma.$executeRaw`
      UPDATE Consumers
      SET subscription_tier = ${tierCode},
          subscription_start = GETDATE(),
          subscription_end = ${endISO},
          grace_period_end = ${graceISO},
          updated_at = GETDATE()
      WHERE phone_number = ${phone}
    `;

    // Log transaction
    await prisma.$executeRaw`
      INSERT INTO Subscription_Transactions (
        transaction_id, phone_number, transaction_type,
        product_code, product_name, billing_cycle,
        amount, currency, payment_provider, payment_reference,
        status, verified_at, created_at
      ) VALUES (
        ${txnId}, ${phone}, 'NEW_SUBSCRIPTION',
        ${tierCode}, ${tierName}, ${billingCycle},
        ${amount}, 'NGN', 'FLUTTERWAVE', ${ref},
        'SUCCESS', GETDATE(), GETDATE()
      )
    `;

    return { success: true };
  } catch (e: any) {
    console.error("[FLW] Activation error:", e);
    return { success: false, error: e.message };
  }
}

// ============================================================================
// MAIN POST HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  const t0 = Date.now();

  try {
    // 1. Verify secret hash
    const secretHash = request.headers.get("verif-hash") || "";
    if (!verifyFlutterwaveHash(secretHash)) {
      console.error("[FLW] ❌ Invalid hash");
      return NextResponse.json({ error: "Invalid hash" }, { status: 401 });
    }

    // 2. Parse payload
    const payload = await request.json();
    const event = payload.event;
    const data = payload.data;

    console.log(`[FLW] ═══ ${event} | id=${data?.id} | amt=${data?.amount} ═══`);

    // 3. Only process successful charges
    if (event !== "charge.completed" || data?.status !== "successful") {
      // Log non-success events
      if (event === "charge.completed" && data?.status === "failed") {
        const meta = extractMeta(data);
        if (meta.phone_number) {
          const txnId = genId("TXN");
          await prisma.$executeRaw`
            INSERT INTO Subscription_Transactions (
              transaction_id, phone_number, transaction_type,
              amount, currency, payment_provider, payment_reference,
              status, notes, created_at
            ) VALUES (
              ${txnId}, ${meta.phone_number}, 'PAYMENT_FAILED',
              ${data.amount || 0}, 'NGN', 'FLUTTERWAVE', ${String(data.flw_ref || data.id || "")},
              'FAILED', ${data.processor_response || "Payment failed"}, GETDATE()
            )
          `;

          await sendWhatsApp(meta.phone_number,
            `❌ *Payment Failed*\n\nWe couldn't process your payment of ${naira(data.amount || 0)}.\n\nType *upgrade* to retry.`
          );
        }
      }

      return NextResponse.json({ status: "ok", event, action: "ignored" });
    }

    // 4. Optional: verify with Flutterwave API
    if (FLW_SECRET_KEY && data.id) {
      const verified = await verifyTransaction(data.id);
      if (verified && verified.status !== "successful") {
        console.error(`[FLW] Verification failed for txn ${data.id}`);
        return NextResponse.json({ error: "Verification failed" }, { status: 400 });
      }
    }

    // 5. Extract metadata
    const meta = extractMeta(data);
    const phone = meta.phone_number;
    const amount = data.amount || 0; // Flutterwave sends in naira (NOT kobo)
    const ref = String(data.flw_ref || data.tx_ref || data.id || "");

    if (!phone) {
      console.error("[FLW] No phone in metadata");
      return NextResponse.json({ success: false, error: "No phone" }, { status: 200 });
    }

    // 6. Handle by product type
    let result: string;

    if (meta.product_type === "ADDON" || meta.addon_code) {
      const txnId = genId("TXN");
      await prisma.$executeRaw`
        INSERT INTO Subscription_Transactions (
          transaction_id, phone_number, transaction_type,
          product_code, product_name, amount, currency,
          payment_provider, payment_reference, status, verified_at, created_at
        ) VALUES (
          ${txnId}, ${phone}, 'ADDON_PURCHASE',
          ${meta.addon_code || "ADDON"}, ${meta.tier_name || "Add-on"},
          ${amount}, 'NGN', 'FLUTTERWAVE', ${ref}, 'SUCCESS', GETDATE(), GETDATE()
        )
      `;
      await sendWhatsApp(phone,
        `✅ *Add-On Activated!*\n\n${meta.tier_name || "Your add-on"} is now active.\nPayment: ${naira(amount)}\n\nType *mystatus* to see details.`
      );
      result = `Addon for ${phone}`;

    } else if (meta.product_type === "MORNING_BRIEF") {
      const txnId = genId("TXN");
      const days = DURATION_DAYS[meta.billing_cycle] || 7;
      const endDate = new Date(Date.now() + days * 86400000);
      await prisma.$executeRaw`
        INSERT INTO Subscription_Transactions (
          transaction_id, phone_number, transaction_type,
          product_code, product_name, billing_cycle,
          amount, currency, payment_provider, payment_reference,
          status, verified_at, created_at
        ) VALUES (
          ${txnId}, ${phone}, 'MORNING_BRIEF',
          'MORNING_BRIEF', 'Market Opener Morning Brief', ${meta.billing_cycle || "WEEKLY"},
          ${amount}, 'NGN', 'FLUTTERWAVE', ${ref}, 'SUCCESS', GETDATE(), GETDATE()
        )
      `;
      await sendWhatsApp(phone,
        `✅ *Morning Brief Activated!*\n\nDaily prices at 5:30 AM.\nPayment: ${naira(amount)}\nValid until: ${endDate.toLocaleDateString("en-NG")}\n\n🌅 See you tomorrow morning!`
      );
      result = `Morning Brief for ${phone}`;

    } else {
      // Subscription tier
      const tierCode = meta.tier_code || "SABI";
      const tierName = meta.tier_name || tierCode;
      const billing = meta.billing_cycle || "MONTHLY";

      const r = await activateSubscription(phone, tierCode, tierName, billing, amount, ref);

      if (r.success) {
        const days = DURATION_DAYS[billing] || 30;
        const endDate = new Date(Date.now() + days * 86400000);
        await sendWhatsApp(phone,
          `✅ *Payment Confirmed!*\n\n` +
          `Payment of ${naira(amount)} received.\n\n` +
          `📦 *Plan:* ${tierName} (${billing})\n` +
          `📅 *Valid Until:* ${endDate.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}\n` +
          `🔓 *Status:* ACTIVE\n\n` +
          `Type *mystatus* for details.\nType *price* to check prices.`
        );
      }

      result = r.success ? `Activated ${tierCode} for ${phone}` : `Failed: ${r.error}`;
    }

    console.log(`[FLW] ✅ ${Date.now() - t0}ms: ${result}`);
    return NextResponse.json({ success: true, result });

  } catch (e: any) {
    console.error("[FLW] Fatal:", e);
    return NextResponse.json({ success: false, error: e.message }, { status: 200 });
  }
}
