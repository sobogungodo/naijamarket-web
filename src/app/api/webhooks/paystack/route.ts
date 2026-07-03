// ============================================================================
// src/app/api/webhooks/paystack/route.ts
// NaijaMarket Intel - Paystack Payment Webhook
// Version: 1.0.0 | Date: 2026-02-20
//
// WHAT THIS DOES:
// 1. Receives payment events from Paystack
// 2. Verifies webhook signature (HMAC-SHA512)
// 3. Auto-activates subscription on charge.success
// 4. Updates Consumers table tier + Consumer_Active_Subscriptions
// 5. Logs to Subscription_Transactions
// 6. Sends WhatsApp confirmation via Twilio
// 7. Handles failures, renewals, refunds
//
// PAYSTACK DASHBOARD SETUP:
//   Webhook URL: https://naijamarket-web.vercel.app/api/webhooks/paystack
//   Events: charge.success, charge.failed, subscription.create,
//           invoice.payment_failed, refund.processed
//
// VERCEL ENV VARS NEEDED:
//   PAYSTACK_SECRET_KEY (from Paystack dashboard â†’ Settings â†’ API Keys)
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
//
// PAYMENT INITIALIZATION MUST INCLUDE metadata:
//   {
//     phone_number: "2348031234567",
//     consumer_id: "CON_xxx",
//     tier_code: "SABI",
//     tier_name: "Sabi",
//     billing_cycle: "WEEKLY",         // WEEKLY | MONTHLY | QUARTERLY | ANNUAL
//     product_type: "SUBSCRIPTION"     // SUBSCRIPTION | ADDON | MORNING_BRIEF
//   }
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { sendPaymentConfirmed, sendReferralCreditApplied } from "@/lib/whatsapp";

// ============================================================================
// PRISMA (singleton)
// ============================================================================

import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ============================================================================
// CONFIG
// ============================================================================

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

const DURATION_DAYS: Record<string, number> = {
  WEEKLY: 7, MONTHLY: 30, QUARTERLY: 90, ANNUAL: 365,
};

const GRACE_PERIOD_DAYS = 3;

// ============================================================================
// HELPERS
// ============================================================================

function phoneToWhatsApp(phone: string): string {
  let c = phone.replace(/\D/g, "");
  if (c.startsWith("0")) c = "234" + c.substring(1);
  if (!c.startsWith("234")) c = "234" + c;
  return `whatsapp:+${c}`;
}

function naira(amount: number): string {
  return `â‚¦${amount.toLocaleString("en-NG")}`;
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
          From: TWILIO_FROM,
          To: phoneToWhatsApp(phone),
          Body: message,
        }).toString(),
      }
    );
    const data = await res.json();
    if (res.ok) { console.log(`[WA] âœ… ${phone}: ${data.sid}`); return true; }
    console.error(`[WA] âŒ ${phone}: ${data.message}`);
    return false;
  } catch (e) { console.error("[WA] error:", e); return false; }
}

function verifySignature(body: string, sig: string): boolean {
  if (!PAYSTACK_SECRET_KEY) {
    console.error("[PS] PAYSTACK_SECRET_KEY not set — rejecting all webhooks");
    return false;
  }
  return crypto.createHmac("sha512", PAYSTACK_SECRET_KEY).update(body).digest("hex") === sig;
}

// Extract phone, tier, billing from Paystack metadata
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
  const m = data.metadata || {};
  const cf: Record<string, string> = {};
  for (const f of m.custom_fields || []) cf[f.variable_name] = f.value;
  // Accept BOTH key styles: snake_case (NMI-* / WA-engine inits) AND the
  // /api/subscribe + /api/mobile/consumer/subscribe camelCase keys
  // (phone/tier/tierName/billingCycle/consumerId). A mismatch here made the
  // webhook bail ("No phone in metadata") on app/web /plans payments, so the
  // subscription_payment_confirmed WhatsApp never sent.
  return {
    phone_number: m.phone_number || m.phone || cf.phone_number || cf.phone || data.customer?.phone || "",
    consumer_id:  m.consumer_id  || m.consumerId  || cf.consumer_id  || cf.consumerId || "",
    tier_code:    m.tier_code    || m.tier        || cf.tier_code    || cf.tier       || "",
    tier_name:    m.tier_name    || m.tierName    || cf.tier_name    || cf.tierName   || "",
    billing_cycle:m.billing_cycle|| m.billingCycle|| cf.billing_cycle|| cf.billingCycle|| "MONTHLY",
    addon_code:   m.addon_code   || cf.addon_code   || "",
    product_type: m.product_type || cf.product_type || "SUBSCRIPTION",
  };
}

// ============================================================================
// ACTIVATE SUBSCRIPTION
// ============================================================================

async function activateSubscription(
  phone: string, tierCode: string, tierName: string,
  billingCycle: string, amount: number, ref: string, provider: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const days = DURATION_DAYS[billingCycle] || 30;

    // --- Referral credit redemption (wa-v139) ---
    // Referrer earns 7 bonus days per pending credit when they subscribe.
    let bonusDays = 0;
    let pendingCreditIds: string[] = [];
    try {
      const creditRows = await prisma.$queryRaw<Array<{ credit_id: string }>>`
        SELECT credit_id FROM dbo.Referral_Credits
        WHERE phone_number = ${phone} AND status = 'PENDING'
      `;
      pendingCreditIds = creditRows.map((r) => r.credit_id);
      bonusDays = pendingCreditIds.length * 7;
    } catch (rcLookupErr: any) {
      console.error("[PS] Referral credit lookup failed (non-blocking):", rcLookupErr?.message || rcLookupErr);
    }
    const totalDays = days + bonusDays;
    const endDate = new Date(Date.now() + totalDays * 86400000);
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
        ${ref}, ${provider}, ${amount},
        0, GETDATE(), GETDATE(), ${"Activated via " + provider + " webhook"}
      )
    `;

    // Update consumer tier
    await prisma.$executeRaw`
      UPDATE Consumers
      SET subscription_tier = ${tierCode},
          subscription_start = GETDATE(),
          subscription_end = ${endISO},
          grace_period_end = ${graceISO},
          updated_at = GETDATE()
      WHERE phone_number = ${phone}
    `;

    // Log transaction — ledger write is non-blocking: a failure here must NOT
    // fail an activation that has already been applied above.
    try {
      const crows = await prisma.$queryRaw<Array<{ consumer_id: string | null }>>`
        SELECT TOP 1 consumer_id FROM Consumers WHERE phone_number = ${phone}
      `;
      const consumerId = crows[0]?.consumer_id ?? null;
      await prisma.$executeRaw`
        INSERT INTO Subscription_Transactions (
          transaction_id, consumer_id, phone_number, transaction_type,
          product_code, product_name, billing_cycle,
          gross_amount, net_amount, currency,
          payment_provider, payment_reference, payment_channel,
          payment_status, subscription_start, subscription_end,
          created_at, completed_at, verified_at
        ) VALUES (
          ${txnId}, ${consumerId}, ${phone}, 'NEW_SUBSCRIPTION',
          ${tierCode}, ${tierName}, ${billingCycle.toUpperCase()},
          ${amount}, ${amount}, 'NGN',
          ${provider}, ${ref}, 'WEBHOOK',
          'COMPLETED', ${new Date().toISOString()}, ${endISO},
          GETUTCDATE(), GETUTCDATE(), GETUTCDATE()
        )
      `;
    } catch (ledgerErr: any) {
      console.error(`[PS] Ledger write failed (non-blocking) ref=${ref}:`, ledgerErr?.message || ledgerErr);
    }

    // Mark referral credits APPLIED (non-blocking, after activation succeeds)
    if (pendingCreditIds.length > 0) {
      try {
        for (const cid of pendingCreditIds) {
          await prisma.$executeRaw`
            UPDATE dbo.Referral_Credits
            SET status = 'APPLIED',
                applied_at = GETUTCDATE(),
                applied_to_ref = ${ref}
            WHERE credit_id = ${cid}
              AND status = 'PENDING'
          `;
        }
        console.log(`[PS] ${pendingCreditIds.length} referral credit(s) applied (+${bonusDays} days) for ${phone}`);

        // WA notification to the referrer via the approved Meta UTILITY template
        // `referral_credit_notice` (free-form text only delivers inside the 24h
        // window; an approved template reaches referrers regardless).
        try {
          await sendReferralCreditApplied(
            phone,
            `₦${pendingCreditIds.length * 150}`,
            bonusDays,
            endDate.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
          );
        } catch (waMsgErr: any) {
          console.error("[PS] Referral WA notification failed (non-blocking):", waMsgErr?.message || waMsgErr);
        }
      } catch (rcUpdateErr: any) {
        console.error("[PS] Referral credit update failed (non-blocking):", rcUpdateErr?.message || rcUpdateErr);
      }
    }

    console.log(`[PS] âœ… ${tierCode} activated for ${phone} until ${endISO}`);
    return { success: true };
  } catch (e: any) {
    console.error("[PS] Activation error:", e);
    return { success: false, error: e.message };
  }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

async function onChargeSuccess(data: any): Promise<string> {
  const meta = extractMeta(data);
  const phone = meta.phone_number;
  const amount = (data.amount || 0) / 100; // kobo â†’ naira
  const ref = data.reference || "";

  if (!phone) return "No phone in metadata";

  // Idempotency: skip if reference already processed
  const existing = await prisma.$queryRaw`
    SELECT transaction_id FROM Subscription_Transactions
    WHERE payment_reference = ${ref} AND payment_status = 'COMPLETED'
  ` as any[];
  if (existing.length > 0) {
    console.log(`[PS] Duplicate ref ${ref} — skipping`);
    return `Duplicate ignored: ${ref}`;
  }

  console.log(`[PS] charge.success: ${phone} ${naira(amount)} ref=${ref}`);

  // Route by product type
  if (meta.product_type === "ADDON" || meta.addon_code) {
    const txnId = genId("TXN");
    try {
      await prisma.$executeRaw`
        INSERT INTO Subscription_Transactions (
          transaction_id, consumer_id, phone_number, transaction_type,
          product_code, product_name,
          gross_amount, net_amount, currency,
          payment_provider, payment_reference, payment_channel,
          payment_status, created_at, completed_at, verified_at
        ) VALUES (
          ${txnId}, ${meta.consumer_id || null}, ${phone}, 'ADDON_PURCHASE',
          ${meta.addon_code || "ADDON"}, ${meta.tier_name || "Add-on"},
          ${amount}, ${amount}, 'NGN',
          'PAYSTACK', ${ref}, 'WEBHOOK',
          'COMPLETED', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()
        )
      `;
    } catch (ledgerErr: any) {
      console.error(`[PS] Addon ledger write failed (non-blocking) ref=${ref}:`, ledgerErr?.message || ledgerErr);
    }
    await sendWhatsApp(phone,
      `âœ… *Add-On Activated!*\n\n${meta.tier_name || "Your add-on"} is now active.\nPayment: ${naira(amount)}\n\nType *mystatus* to see details.`
    );
    return `Addon for ${phone}`;
  }

  if (meta.product_type === "MORNING_BRIEF") {
    const txnId = genId("TXN");
    const days = DURATION_DAYS[meta.billing_cycle] || 7;
    const endDate = new Date(Date.now() + days * 86400000);
    try {
      await prisma.$executeRaw`
        INSERT INTO Subscription_Transactions (
          transaction_id, consumer_id, phone_number, transaction_type,
          product_code, product_name, billing_cycle,
          gross_amount, net_amount, currency,
          payment_provider, payment_reference, payment_channel,
          payment_status, created_at, completed_at, verified_at
        ) VALUES (
          ${txnId}, ${meta.consumer_id || null}, ${phone}, 'MORNING_BRIEF',
          'MORNING_BRIEF', 'Market Opener Morning Brief', ${(meta.billing_cycle || "WEEKLY").toUpperCase()},
          ${amount}, ${amount}, 'NGN',
          'PAYSTACK', ${ref}, 'WEBHOOK',
          'COMPLETED', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()
        )
      `;
    } catch (ledgerErr: any) {
      console.error(`[PS] Morning Brief ledger write failed (non-blocking) ref=${ref}:`, ledgerErr?.message || ledgerErr);
    }
    await sendWhatsApp(phone,
      `âœ… *Morning Brief Activated!*\n\nYou'll receive daily prices at 5:30 AM.\nPayment: ${naira(amount)}\nValid until: ${endDate.toLocaleDateString("en-NG")}\n\nðŸŒ… See you tomorrow morning!`
    );
    return `Morning Brief for ${phone}`;
  }

  // Default: subscription
  const tierCode = meta.tier_code || "SABI";
  const tierName = meta.tier_name || tierCode;
  const billing = meta.billing_cycle || "MONTHLY";

  const result = await activateSubscription(phone, tierCode, tierName, billing, amount, ref, "PAYSTACK");

  if (result.success) {
    const days = DURATION_DAYS[billing] || 30;
    const endDate = new Date(Date.now() + days * 86400000);
    await sendPaymentConfirmed(
      phone,
      `${tierName} (${billing})`,
      endDate.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
    );
  }

  return result.success ? `Activated ${tierCode} for ${phone}` : `Failed: ${result.error}`;
}

async function onChargeFailed(data: any): Promise<string> {
  const meta = extractMeta(data);
  const phone = meta.phone_number;
  if (!phone) return "No phone";
  const amount = (data.amount || 0) / 100;
  const ref = data.reference || "";
  const reason = data.gateway_response || "Payment failed";

  const txnId = genId("TXN");
  try {
    await prisma.$executeRaw`
      INSERT INTO Subscription_Transactions (
        transaction_id, consumer_id, phone_number, transaction_type,
        gross_amount, net_amount, currency,
        payment_provider, payment_reference, payment_channel,
        payment_status, failure_reason, created_at
      ) VALUES (
        ${txnId}, ${meta.consumer_id || null}, ${phone}, 'PAYMENT_FAILED',
        ${amount}, ${amount}, 'NGN',
        'PAYSTACK', ${ref}, 'WEBHOOK',
        'FAILED', ${reason}, GETUTCDATE()
      )
    `;
  } catch (ledgerErr: any) {
    console.error(`[PS] Failed-payment ledger write failed (non-blocking) ref=${ref}:`, ledgerErr?.message || ledgerErr);
  }

  await sendWhatsApp(phone,
    `âŒ *Payment Failed*\n\nWe couldn't process your payment of ${naira(amount)}.\n\nðŸ“‹ *Reason:* ${reason}\nðŸ“Ž *Ref:* ${ref}\n\nType *upgrade* to retry.`
  );

  return `Failed ${phone}: ${reason}`;
}

async function onInvoicePaymentFailed(data: any): Promise<string> {
  const meta = extractMeta(data);
  const phone = meta.phone_number || data.customer?.phone || "";
  if (!phone) return "No phone";

  await prisma.$executeRaw`
    UPDATE Consumer_Active_Subscriptions
    SET status = 'GRACE_PERIOD', updated_at = GETDATE()
    WHERE phone_number = ${phone} AND status = 'ACTIVE'
  `;

  await sendWhatsApp(phone,
    `âš ï¸ *Subscription Renewal Failed*\n\nWe couldn't renew your subscription.\n\nYou have *${GRACE_PERIOD_DAYS} days* before downgrade to FREE.\n\nType *upgrade* to renew now.`
  );

  return `Grace period for ${phone}`;
}

async function onRefundProcessed(data: any): Promise<string> {
  const meta = extractMeta(data);
  const phone = meta.phone_number;
  const amount = (data.amount || 0) / 100;
  if (phone) {
    await sendWhatsApp(phone,
      `ðŸ’° *Refund Processed*\n\nYour refund of ${naira(amount)} has been processed.\nPlease allow 3-5 business days to see it in your account.`
    );
  }
  return `Refund ${naira(amount)} for ${phone}`;
}

// ============================================================================
// MAIN POST HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  const t0 = Date.now();

  try {
    const rawBody = await request.text();
    const sig = request.headers.get("x-paystack-signature") || "";

    if (!verifySignature(rawBody, sig)) {
      console.error("[PS] âŒ Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const { event, data } = JSON.parse(rawBody);
    console.log(`[PS] â•â•â• ${event} | ref=${data?.reference} | amt=${(data?.amount || 0) / 100} â•â•â•`);

    let result: string;
    switch (event) {
      case "charge.success":            result = await onChargeSuccess(data); break;
      case "charge.failed":             result = await onChargeFailed(data); break;
      case "subscription.create":       result = `Subscription created`; break;
      case "invoice.payment_failed":    result = await onInvoicePaymentFailed(data); break;
      case "refund.processed":          result = await onRefundProcessed(data); break;
      default:                          result = `Ignored: ${event}`;
    }

    console.log(`[PS] âœ… ${Date.now() - t0}ms: ${result}`);
    return NextResponse.json({ success: true, event, result });

  } catch (e: any) {
    console.error("[PS] Fatal:", e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
