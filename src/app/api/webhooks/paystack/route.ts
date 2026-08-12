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
// 6. Sends WhatsApp confirmation via Meta (src/lib/whatsapp.ts)
// 7. Handles failures, renewals, refunds
//
// PAYSTACK DASHBOARD SETUP:
//   Webhook URL: https://naijamarket-web.vercel.app/api/webhooks/paystack
//   Events: charge.success, charge.failed, subscription.create,
//           invoice.payment_failed, refund.processed
//
// VERCEL ENV VARS NEEDED:
//   PAYSTACK_SECRET_KEY (from Paystack dashboard â†’ Settings â†’ API Keys)
//   META_ACCESS_TOKEN, META_PHONE_NUMBER_ID (Meta WhatsApp Cloud API)
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
import { prisma as sharedPrisma } from "@/lib/db";
import crypto from "crypto";
import { sendPaymentConfirmed, sendReferralCreditApplied, sendAddOnActivated, sendMorningBriefActivated, sendPaymentFailed, sendRenewalFailed, sendRefundProcessed } from "@/lib/whatsapp";

// ============================================================================
// PRISMA (singleton)
// ============================================================================

import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = sharedPrisma;
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ============================================================================
// CONFIG
// ============================================================================

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "";

const DURATION_DAYS: Record<string, number> = {
  WEEKLY: 7, MONTHLY: 30, QUARTERLY: 90, ANNUAL: 365,
};

const GRACE_PERIOD_DAYS = 3;

// ============================================================================
// HELPERS
// ============================================================================

function naira(amount: number): string {
  return `â‚¦${amount.toLocaleString("en-NG")}`;
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
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
  purchase_type: string;
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
    purchase_type: m.purchase_type || cf.purchase_type || "",
  };
}

// ============================================================================
// ACTIVATE SUBSCRIPTION
// ============================================================================

// Higher number = higher tier (matches /api/subscribe/verify + the init guards).
const TIER_RANK: Record<string, number> = {
  FREE: 0, SILVER: 1, GOLD: 2, BUSINESS: 3, CORPORATE: 4, ENTERPRISE: 5,
};

async function activateSubscription(
  phone: string, tierCode: string, tierName: string,
  billingCycle: string, amount: number, ref: string, provider: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const days = DURATION_DAYS[String(billingCycle).toUpperCase()] || 30;

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

    // Downgrade guard (mirrors /api/subscribe/verify): the webhook is now the
    // primary activation path, so without this a lower-tier payment would clobber
    // an active higher tier. If the caller has an active, unexpired higher tier,
    // acknowledge the payment but DON'T supersede/insert — keep the higher tier.
    try {
      const activeRows = await prisma.$queryRaw<Array<{ tier_code: string; end_date: any }>>`
        SELECT tier_code, end_date FROM Consumer_Active_Subscriptions
        WHERE phone_number = ${phone} AND status = 'ACTIVE'
      `;
      const cur = activeRows[0];
      if (cur) {
        const curRank = TIER_RANK[String(cur.tier_code || "").toUpperCase()] ?? 0;
        const newRank = TIER_RANK[String(tierCode || "").toUpperCase()] ?? 0;
        const curEnd = cur.end_date ? new Date(cur.end_date) : null;
        const stillValid = curEnd ? curEnd >= new Date() : true;
        if (newRank < curRank && stillValid) {
          console.warn(`[PS] DOWNGRADE BLOCKED: active ${cur.tier_code} (rank ${curRank}) — refusing lower ${tierCode} (rank ${newRank}) ref=${ref}`);
          return { success: true }; // payment acknowledged; keep the higher active tier
        }
      }
    } catch (dgErr: any) {
      console.error("[PS] downgrade check failed (proceeding with activation):", dgErr?.message || dgErr);
    }

    // Atomic activation: demote existing → insert new ACTIVE → update Consumers tier,
    // all-or-nothing in ONE transaction. Without this, a crash between the demote and
    // the insert would strand the consumer with ZERO ACTIVE rows (locked out of paid
    // entitlement) — a window the phone-form-agnostic demote below newly makes reachable.
    // Values (subId/endISO/graceISO/…) are all computed above, BEFORE the transaction.
    // Both phone predicates are +/naked-agnostic (mirrors func-api): WA sends naked,
    // web/app may send plus; normalizing prevents a demote-miss (duplicate ACTIVE) AND
    // a Consumers-miss (paid tier not written → gate throttles a paid user).
    // Census 2026-07-09: every Consumers row has phone_number populated, so the
    // phone_number-normalized match is sufficient (no OR phone clause needed).
    await prisma.$transaction([
      // Deactivate existing (phone-form-agnostic)
      prisma.$executeRaw`
        UPDATE Consumer_Active_Subscriptions
        SET status = 'SUPERSEDED', updated_at = GETDATE()
        WHERE REPLACE(phone_number, '+', '') = REPLACE(${phone}, '+', '') AND status = 'ACTIVE'
      `,
      // Create subscription
      prisma.$executeRaw`
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
      `,
      // Update consumer tier (phone-form-agnostic — mirrors the CAS demote)
      prisma.$executeRaw`
        UPDATE Consumers
        SET subscription_tier = ${tierCode},
            subscription_start = GETDATE(),
            subscription_end = ${endISO},
            subscription_end_date = ${endDate},
            grace_period_end = ${graceISO},
            pending_downgrade_tier = NULL,
            downgrade_effective_date = NULL,
            updated_at = GETDATE()
        WHERE REPLACE(phone_number, '+', '') = REPLACE(${phone}, '+', '')
      `,
    ]);

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
    await sendAddOnActivated(phone, meta.tier_name || "Your add-on", naira(amount));
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
    await sendMorningBriefActivated(phone, naira(amount), endDate.toLocaleDateString("en-NG"));
    return `Morning Brief for ${phone}`;
  }

  // TOKEN_PACK purchase
  if (meta.purchase_type === "TOKEN_PACK") {
    // Idempotency: check Token_Transactions instead of Subscription_Transactions
    const tokenExisting = await prisma.$queryRaw`
      SELECT TOP 1 payment_status FROM dbo.Token_Transactions
      WHERE payment_reference = ${ref}
    ` as any[];
    if (tokenExisting.length > 0 && tokenExisting[0].payment_status === "COMPLETED") {
      console.log(`[PS] TOKEN_PACK duplicate ref ${ref} — skipping`);
      return `Token duplicate ignored: ${ref}`;
    }
    // Credit via verify route logic — atomic PENDING→COMPLETED flip
    const verifyRes = await fetch(`${process.env.NEXTAUTH_URL}/api/tokens/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference: ref }),
    });
    const verifyData = await verifyRes.json();
    if (verifyData.success) {
      const totalTokens = verifyData.tokensAdded || 0;
      const packName = verifyData.packName || "Token Pack";
      await sendAddOnActivated(phone, packName, naira(amount));
      console.log(`[PS] TOKEN_PACK credited: ${phone} +${totalTokens} tokens ref=${ref}`);
    } else {
      console.error(`[PS] TOKEN_PACK verify failed ref=${ref}:`, verifyData.error);
    }
    return `TOKEN_PACK for ${phone}`;
  }

  // Default: subscription
  const tierCode = meta.tier_code || "SABI";
  const tierName = meta.tier_name || tierCode;
  const billing = meta.billing_cycle || "MONTHLY";

  const result = await activateSubscription(phone, tierCode, tierName, billing, amount, ref, "PAYSTACK");

  if (result.success) {
    // Confirmation WhatsApp — non-blocking. Activation is already durably
    // committed (activateSubscription's $transaction, lines 220-254). A Meta
    // send failure must NEVER bubble to the POST catch (500 -> Paystack retry)
    // or undo the activation. Mirrors subscribe/verify, which already wraps+logs.
    // Template subscription_payment_confirmed has EXACTLY 2 body vars:
    //   {{1}} = plan display, {{2}} = end date.  (No amount slot — 2 args only.)
    try {
      const days = DURATION_DAYS[billing] || 30;
      const endDate = new Date(Date.now() + days * 86400000);
      await sendPaymentConfirmed(
        phone,
        `${tierName} (${billing})`, // {{1}} display tier (in-scope; NOT raw tierCode)
        endDate.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) // {{2}} end date
      );
    } catch (err) {
      console.error('[onChargeSuccess] post-activation/confirmation error:', err);
    }
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

  await sendPaymentFailed(phone, naira(amount), reason);

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

  // Migrated Twilio → Meta: renewal_failed template. CAVEAT: renewal_failed is
  // categorized MARKETING in Business Manager, so it's suppressed for opted-out
  // users; recreate it as UTILITY under a new name (the category is locked ~4wk)
  // and repoint sendRenewalFailed there for guaranteed transactional delivery.
  await sendRenewalFailed(phone, String(GRACE_PERIOD_DAYS));

  return `Grace period for ${phone}`;
}

async function onRefundProcessed(data: any): Promise<string> {
  const meta = extractMeta(data);
  const phone = meta.phone_number;
  const amount = (data.amount || 0) / 100;
  if (phone) {
    await sendRefundProcessed(phone, naira(amount));
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
