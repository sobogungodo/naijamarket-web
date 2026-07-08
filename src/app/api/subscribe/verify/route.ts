// ============================================================================
// src/app/api/subscribe/verify/route.ts
// NaijaMarket Intel - Payment Verification API
// Version: 2.0.1 - Production Ready (TypeScript Strict) - FIXED
// Date: 2026-01-24
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { sendPaymentConfirmed } from "@/lib/whatsapp";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface TierConfig {
  tierName: string;
  queryLimit: number | null;
  maxMarkets: number;
  duration: number;
  billingCycle: string;
}

interface VerificationResult {
  success: boolean;
  status?: string;
  amount?: number;
  tier?: string;
  phone?: string;
  consumerId?: string;
  source?: string;
  error?: string;
}

interface CustomField {
  variable_name: string;
  value: string;
}

// Result of routing an activation through usp_Set_Consumer_Tier.
interface UpgradeResult {
  ok: boolean;
  action?: "ACTIVATED" | "SCHEDULED" | "IDEMPOTENT";
  endDate?: Date | null;        // SP-returned end_date (ACTIVATED only)
  effectiveDate?: Date | null;  // SP-returned effective_date (SCHEDULED only)
  degraded?: boolean;           // stamp anomaly — entitlement granted but unattributed/collided
  error?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

// Database connection config
const dbConfig: sql.config = {
  server: process.env.DATABASE_SERVER || "naijafood.database.windows.net",
  database: process.env.DATABASE_NAME || "naijafoodmarket",
  user: process.env.DATABASE_USER || "",
  password: process.env.DATABASE_PASSWORD || "",
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

// Payment provider API keys
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "";
const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY || "";

// Default tier config (fallback)
const DEFAULT_TIER_CONFIG: TierConfig = {
  tierName: "Free",
  queryLimit: 3,
  maxMarkets: 3,
  duration: 0,
  billingCycle: "forever",
};

// Subscription tier configurations
const TIER_CONFIG: Record<string, TierConfig> = {
  FREE: { tierName: "Free", queryLimit: 3, maxMarkets: 3, duration: 0, billingCycle: "forever" },
  SILVER: { tierName: "Silver", queryLimit: 10, maxMarkets: 3, duration: 7, billingCycle: "weekly" },
  GOLD: { tierName: "Gold", queryLimit: 30, maxMarkets: 3, duration: 7, billingCycle: "weekly" },
  BUSINESS: { tierName: "Business", queryLimit: 100, maxMarkets: 5, duration: 30, billingCycle: "monthly" },
  CORPORATE: { tierName: "Corporate", queryLimit: null, maxMarkets: 6, duration: 30, billingCycle: "monthly" },
  ENTERPRISE: { tierName: "Enterprise", queryLimit: null, maxMarkets: 226, duration: 30, billingCycle: "monthly" },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get tier configuration with fallback
 */
function getTierConfig(tier: string): TierConfig {
  return TIER_CONFIG[tier] || TIER_CONFIG.FREE || DEFAULT_TIER_CONFIG;
}

/**
 * Verify payment with Paystack
 */
async function verifyPaystackPayment(reference: string): Promise<VerificationResult> {
  if (!PAYSTACK_SECRET_KEY) {
    return { success: false, error: "Paystack not configured" };
  }

  try {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = await response.json();

    if (data.status && data.data) {
      const metadata = data.data.metadata || {};
      const customFields: CustomField[] = metadata.custom_fields || [];

      // Extract tier and phone from metadata or custom_fields
      const tier = metadata.tier || customFields.find((f) => f.variable_name === "tier")?.value;
      const phone = metadata.phone || customFields.find((f) => f.variable_name === "phone")?.value;

      return {
        success: true,
        status: data.data.status, // "success", "abandoned", "failed"
        amount: data.data.amount / 100, // Convert from kobo to naira
        tier,
        phone,
        consumerId: metadata.consumerId,
        source: metadata.source,
      };
    }

    return { success: false, error: data.message || "Verification failed" };
  } catch (error) {
    console.error("Paystack verification error:", error);
    return { success: false, error: "Paystack verification failed" };
  }
}

/**
 * Verify payment with Flutterwave
 */
async function verifyFlutterwavePayment(reference: string): Promise<VerificationResult> {
  if (!FLUTTERWAVE_SECRET_KEY) {
    return { success: false, error: "Flutterwave not configured" };
  }

  try {
    // First, get the transaction ID using the reference
    const searchResponse = await fetch(
      `https://api.flutterwave.com/v3/transactions?tx_ref=${encodeURIComponent(reference)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        },
      }
    );

    const searchData = await searchResponse.json();

    if (searchData.status !== "success" || !searchData.data || searchData.data.length === 0) {
      return { success: false, error: "Transaction not found" };
    }

    const transaction = searchData.data[0];
    const meta = transaction.meta || {};

    return {
      success: true,
      status: transaction.status, // "successful", "failed", "pending"
      amount: transaction.amount,
      tier: meta.tier,
      phone: meta.phone || transaction.customer?.phone_number,
      consumerId: meta.consumerId,
      source: meta.source,
    };
  } catch (error) {
    console.error("Flutterwave verification error:", error);
    return { success: false, error: "Flutterwave verification failed" };
  }
}

/**
 * Update payment status in database
 */
async function updatePaymentStatus(
  reference: string,
  status: string,
  providerResponse: string
): Promise<boolean> {
  let pool: sql.ConnectionPool | null = null;

  try {
    pool = await sql.connect(dbConfig);

    await pool.request()
      .input("reference", sql.NVarChar(50), reference)
      .input("status", sql.NVarChar(20), status)
      .input("provider_response", sql.NVarChar(sql.MAX), providerResponse)
      .query(`
        UPDATE Consumer_Payments
        SET status = @status,
            provider_response = @provider_response,
            updated_at = GETDATE(),
            completed_at = CASE WHEN @status IN ('SUCCESS', 'FAILED') THEN GETDATE() ELSE NULL END
        WHERE reference = @reference
      `);

    return true;
  } catch (error) {
    console.error("Error updating payment status:", error);
    return false;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

/**
 * Upgrade consumer subscription — routed through dbo.usp_Set_Consumer_Tier,
 * the canonical atomic tier mutation (supersede + CAS insert with grace_end_date
 * + Consumers update + audit row, all in ONE transaction inside the SP).
 * This route no longer writes CAS/Consumers inline.
 */
async function upgradeSubscription(
  phone: string,
  tier: string,
  amount: number,
  reference: string,
  provider: string
): Promise<UpgradeResult> {
  let pool: sql.ConnectionPool | null = null;

  try {
    pool = await sql.connect(dbConfig);

    // ---- Tier normalization — BEFORE the EXEC ------------------------------
    // `tier` originates from payment-provider metadata (Paystack metadata.tier /
    // custom_fields, Flutterwave meta.tier): free-form checkout strings, case
    // not guaranteed. Normalize to the canonical uppercase Subscription_Tiers
    // tier_id and refuse anything unmapped HERE — never let the SP's 50001/50005
    // throw on an already-charged payment. FREE is refused too: a *paid* verify
    // for FREE is an anomaly and must not strip entitlement.
    const tierCode = String(tier || "").trim().toUpperCase();
    if (!TIER_CONFIG[tierCode] || tierCode === "FREE") {
      console.error(`[subscribe/verify] UNMAPPED TIER '${tier}' ref=${reference} — refusing activation pre-EXEC`);
      return { ok: false, error: `Unrecognized subscription tier '${tier}'.` };
    }
    const tierRow = await pool.request()
      .input("tier_id", sql.NVarChar(50), tierCode)
      .query(`SELECT COUNT(*) AS cnt FROM Subscription_Tiers WHERE tier_id = @tier_id`);
    if ((tierRow.recordset?.[0]?.cnt ?? 0) === 0) {
      console.error(`[subscribe/verify] TIER '${tierCode}' not in Subscription_Tiers ref=${reference} — refusing activation pre-EXEC`);
      return { ok: false, error: `Subscription tier '${tierCode}' is not available.` };
    }

    // Phone variants for matching across channels (rows may be stored with or
    // without a '+' prefix). The SP always inserts the new ACTIVE row in
    // plus-form, so the stamp below anchors on @phonePlus.
    const cleanPhone = String(phone).replace(/^\+/, "");
    const phonePlus = "+" + cleanPhone;

    // ---- Idempotency gate — BEFORE the EXEC --------------------------------
    // verify can run more than once per payment (deep-link return + foreground
    // refresh). If this payment_reference already stamped a CAS row, this is a
    // replay: succeed idempotently with ZERO writes.
    const refCheck = await pool.request()
      .input("payment_reference", sql.NVarChar(50), reference)
      .query(`SELECT COUNT(*) AS cnt FROM Consumer_Active_Subscriptions WHERE payment_reference = @payment_reference`);
    if ((refCheck.recordset?.[0]?.cnt ?? 0) > 0) {
      console.log(`[subscribe/verify] payment_reference ${reference} already recorded — idempotent success, no writes`);
      return { ok: true, action: "IDEMPOTENT" };
    }

    // Resolve consumer_id — the SP does not write it; needed for the stamp +
    // ledger row so this record reconciles with consumer_id-keyed readers.
    let consumerId: string | null = null;
    try {
      const cres = await pool.request()
        .input("phone", sql.NVarChar(20), phone)
        .input("phonePlus", sql.NVarChar(20), phonePlus)
        .input("phoneClean", sql.NVarChar(20), cleanPhone)
        .query(`
          SELECT TOP 1 consumer_id FROM Consumers
          WHERE phone_number IN (@phone, @phonePlus, @phoneClean)
             OR phone IN (@phone, @phonePlus, @phoneClean)
        `);
      consumerId = cres.recordset?.[0]?.consumer_id ?? null;
    } catch (e) {
      console.error(`[subscribe/verify] consumer_id lookup failed ref=${reference}:`, e);
    }

    // ---- Canonical activation: EXEC the SP ---------------------------------
    // Atomic inside the SP (XACT_ABORT + single TRAN): supersedes ACTIVE+GRACE
    // rows (both phone forms), inserts ONE fresh ACTIVE CAS row (plus-form,
    // grace_end_date = end+3 — the leak fix), updates Consumers (tier, dates,
    // clears pending_downgrade_*), writes Consumer_Subscription_Audit.
    // A genuine downgrade of a still-valid higher tier is SCHEDULED, not applied
    // (pending_downgrade_tier + downgrade_effective_date), and returns
    // cas_action='SCHEDULED' — replacing the old inline downgrade guard.
    const spResult = await pool.request()
      .input("phone", sql.NVarChar(20), phone)
      .input("new_tier", sql.VarChar(20), tierCode)
      .input("reason", sql.NVarChar(200), `verify:${provider}:${reference}`.slice(0, 200))
      .input("allow_downgrade", sql.Bit, 0)
      .execute("dbo.usp_Set_Consumer_Tier");

    const sp = spResult.recordset?.[0];
    if (!sp || !sp.cas_action) {
      console.error(`[subscribe/verify] SP returned no/unexpected result set ref=${reference}`);
      return { ok: false, error: "Activation produced no confirmation." };
    }

    // ---- SCHEDULED path: money received, higher tier stays active ----------
    // The SP wrote pending_downgrade_* only — no CAS row exists to stamp, and
    // no WhatsApp "payment confirmed until <end>" (wrong semantics). Ledger row
    // is still written as COMPLETED: the charge is real.
    if (sp.cas_action === "SCHEDULED") {
      const effectiveDate = sp.effective_date ? new Date(sp.effective_date) : null;
      await insertLedger(pool, {
        consumerId, phone, tierCode, reference, provider, amount,
        // Deferred tier change — NOT an activation; no reader filters on
        // transaction_type (audited 2026-07-08), no CHECK constraint; keeps
        // NEW_SUBSCRIPTION counts = actual activations.
        transactionType: "SCHEDULED_DOWNGRADE",
        subscriptionStartISO: effectiveDate ? effectiveDate.toISOString() : null,
        subscriptionEndISO: null,
      });
      return { ok: true, action: "SCHEDULED", effectiveDate };
    }

    // ---- ACTIVATED path -----------------------------------------------------
    // Single source of dates = the SP's returned end_date. Never recomputed here.
    const endDate = sp.end_date ? new Date(sp.end_date) : null;

    // Stamp payment metadata onto the row the SP just inserted. The SP writes
    // exactly ONE ACTIVE row, always plus-form, always payment_reference=NULL —
    // so this predicate must match exactly 1 row. rowsAffected 0 = unattributed
    // entitlement; >1 = concurrent-purchase collision. Both are hard failures
    // surfaced to the client — never a clean success.
    const stamp = await pool.request()
      .input("payment_reference", sql.NVarChar(50), reference)
      .input("payment_provider", sql.NVarChar(20), provider)
      .input("payment_amount", sql.Decimal(18, 2), amount)
      .input("consumer_id", sql.NVarChar(50), consumerId)
      .input("phonePlus", sql.NVarChar(20), phonePlus)
      .query(`
        UPDATE Consumer_Active_Subscriptions
        SET payment_reference = @payment_reference,
            payment_provider  = @payment_provider,
            payment_amount    = @payment_amount,
            consumer_id       = COALESCE(consumer_id, @consumer_id),
            updated_at        = GETUTCDATE()
        WHERE phone_number = @phonePlus AND status = 'ACTIVE' AND payment_reference IS NULL
      `);
    const stamped = stamp.rowsAffected?.[0] ?? 0;
    if (stamped !== 1) {
      console.error(`[subscribe/verify] STAMP ANOMALY rowsAffected=${stamped} phone=${phonePlus} ref=${reference} — ${stamped === 0 ? "unattributed entitlement" : "concurrent-purchase collision"}`);
      return {
        ok: false, degraded: true,
        error: `Subscription record could not be attributed to this payment (rows=${stamped}).`,
      };
    }

    // Ledger (non-blocking, ref-deduped inside) — dates from the SP result.
    await insertLedger(pool, {
      consumerId, phone, tierCode, reference, provider, amount,
      transactionType: "NEW_SUBSCRIPTION",
      subscriptionStartISO: new Date().toISOString(),
      subscriptionEndISO: endDate ? endDate.toISOString() : null,
    });

    // Payment-confirmation WhatsApp — SP-returned end date, non-blocking.
    // The Paystack webhook also sends this, but it is not currently firing
    // (0 'WEBHOOK' rows), so the verify path is the reliable channel.
    try {
      const config = getTierConfig(tierCode);
      await sendPaymentConfirmed(
        phone,
        `${config.tierName} (${String(config.billingCycle).toUpperCase()})`,
        endDate
          ? endDate.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
          : ""
      );
    } catch (waErr) {
      console.error(`[subscribe/verify] payment-confirm WhatsApp failed (non-blocking) ref=${reference}:`, waErr);
    }

    return { ok: true, action: "ACTIVATED", endDate };
  } catch (error) {
    // SP THROWs (50001-50006) surface here as mssql RequestError with .number.
    const num = (error as { number?: number })?.number;
    console.error(`[subscribe/verify] activation failed ref=${reference}${num ? ` sqlError=${num}` : ""}:`, error);
    return { ok: false, error: num ? `Activation error ${num}.` : "Activation failed." };
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

/**
 * Subscription_Transactions ledger row — COMPLETED, payment_channel='WEB'.
 * Non-blocking (a failure must not undo the SP's committed activation) and
 * idempotent on payment_reference. Column set mirrors the pre-existing insert.
 */
async function insertLedger(
  pool: sql.ConnectionPool,
  p: {
    consumerId: string | null; phone: string; tierCode: string;
    reference: string; provider: string; amount: number;
    transactionType: "NEW_SUBSCRIPTION" | "SCHEDULED_DOWNGRADE";
    subscriptionStartISO: string | null; subscriptionEndISO: string | null;
  }
): Promise<void> {
  try {
    const txCheck = await pool.request()
      .input("payment_reference", sql.NVarChar(50), p.reference)
      .query(`SELECT COUNT(*) AS cnt FROM Subscription_Transactions WHERE payment_reference = @payment_reference`);
    if ((txCheck.recordset?.[0]?.cnt ?? 0) > 0) {
      console.log(`[subscribe/verify] Subscription_Transactions ref ${p.reference} already recorded — skipping ledger write`);
      return;
    }
    const config = getTierConfig(p.tierCode);
    const transactionId = "TXN-" + Date.now().toString(36).toUpperCase() + "-" +
      Math.random().toString(36).substring(2, 8).toUpperCase();
    await pool.request()
      .input("transaction_id", sql.NVarChar(50), transactionId)
      .input("consumer_id", sql.NVarChar(50), p.consumerId)
      .input("phone", sql.NVarChar(20), p.phone)
      .input("transaction_type", sql.NVarChar(50), p.transactionType)
      .input("product_code", sql.NVarChar(50), p.tierCode)
      .input("product_name", sql.NVarChar(255), config.tierName)
      .input("billing_cycle", sql.NVarChar(50), String(config.billingCycle).toUpperCase())
      .input("gross_amount", sql.Decimal(18, 2), p.amount)
      .input("net_amount", sql.Decimal(18, 2), p.amount)
      .input("payment_provider", sql.NVarChar(255), String(p.provider).toUpperCase())
      .input("payment_reference", sql.NVarChar(50), p.reference)
      .input("subscription_start", sql.NVarChar(50), p.subscriptionStartISO)
      .input("subscription_end", sql.NVarChar(50), p.subscriptionEndISO)
      .query(`
        INSERT INTO Subscription_Transactions (
          transaction_id, consumer_id, phone_number, transaction_type,
          product_code, product_name, billing_cycle,
          gross_amount, net_amount, currency,
          payment_provider, payment_reference, payment_channel,
          payment_status, subscription_start, subscription_end,
          created_at, completed_at, verified_at
        ) VALUES (
          @transaction_id, @consumer_id, @phone, @transaction_type,
          @product_code, @product_name, @billing_cycle,
          @gross_amount, @net_amount, 'NGN',
          @payment_provider, @payment_reference, 'WEB',
          'COMPLETED', @subscription_start, @subscription_end,
          GETUTCDATE(), GETUTCDATE(), GETUTCDATE()
        )
      `);
  } catch (ledgerErr) {
    console.error(`[subscribe/verify] Subscription_Transactions ledger write failed (non-blocking) ref=${p.reference}:`, ledgerErr);
  }
}

// ============================================================================
// GET - Verify Payment
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get("reference") || searchParams.get("ref");
    const provider = searchParams.get("provider")?.toLowerCase();
    const transactionId = searchParams.get("transaction_id"); // Flutterwave sends this

    // Validate required parameters
    if (!reference) {
      return NextResponse.json(
        { error: "Missing payment reference" },
        { status: 400 }
      );
    }

    if (!provider || !["paystack", "flutterwave"].includes(provider)) {
      return NextResponse.json(
        { error: "Invalid or missing payment provider" },
        { status: 400 }
      );
    }

    // Verify payment with provider
    let verificationResult: VerificationResult;

    if (provider === "paystack") {
      verificationResult = await verifyPaystackPayment(reference);
    } else {
      verificationResult = await verifyFlutterwavePayment(reference);
    }

    if (!verificationResult.success) {
      return NextResponse.json(
        { error: verificationResult.error || "Payment verification failed" },
        { status: 400 }
      );
    }

    // Determine payment status
    let paymentStatus = "PENDING";
    let statusMessage = "Payment status unknown";
    let upgradeResult: UpgradeResult | null = null;

    const providerStatus = verificationResult.status?.toLowerCase();

    if (providerStatus === "success" || providerStatus === "successful") {
      paymentStatus = "SUCCESS";
      statusMessage = "Payment successful! Your subscription has been upgraded.";

      // Update payment record
      await updatePaymentStatus(reference, "SUCCESS", JSON.stringify(verificationResult));

      // Upgrade subscription if we have phone and tier
      if (verificationResult.phone && verificationResult.tier) {
        upgradeResult = await upgradeSubscription(
          verificationResult.phone,
          verificationResult.tier,
          verificationResult.amount || 0,
          reference,
          provider
        );

        if (upgradeResult.ok && upgradeResult.action === "SCHEDULED") {
          const eff = upgradeResult.effectiveDate
            ? upgradeResult.effectiveDate.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
            : "the end of your current billing period";
          statusMessage = `Payment successful. Your current subscription stays active until ${eff}; your new plan takes effect on that date.`;
        } else if (!upgradeResult.ok && upgradeResult.degraded) {
          statusMessage = "Payment received, but we could not confirm your subscription record. Please contact support.";
        } else if (!upgradeResult.ok) {
          statusMessage = "Payment successful, but subscription upgrade failed. Please contact support.";
        }
      } else {
        statusMessage = "Payment successful, but missing phone or tier information. Please contact support.";
      }
    } else if (providerStatus === "pending") {
      paymentStatus = "PENDING";
      statusMessage = "Payment is being processed. Please wait...";
      await updatePaymentStatus(reference, "PENDING", JSON.stringify(verificationResult));
    } else if (providerStatus === "failed" || providerStatus === "abandoned") {
      paymentStatus = "FAILED";
      statusMessage = "Payment was not completed. Please try again.";
      await updatePaymentStatus(reference, "FAILED", JSON.stringify(verificationResult));
    }

    // Get tier config for response (normalize the raw provider-metadata tier)
    const tierConfig = verificationResult.tier
      ? getTierConfig(String(verificationResult.tier).trim().toUpperCase())
      : null;

    const upgraded = upgradeResult?.ok === true && upgradeResult.action !== "SCHEDULED";
    const scheduled = upgradeResult?.ok === true && upgradeResult.action === "SCHEDULED";
    const degraded = upgradeResult?.degraded === true;

    return NextResponse.json({
      success: paymentStatus === "SUCCESS" && upgradeResult?.ok !== false,
      payment: {
        reference,
        status: paymentStatus,
        providerStatus: verificationResult.status,
        amount: verificationResult.amount,
        tier: verificationResult.tier,
        tierName: tierConfig?.tierName || verificationResult.tier,
        phone: verificationResult.phone,
        provider,
        source: verificationResult.source,
        transactionId: transactionId || undefined,
      },
      subscription: upgraded ? {
        tier: verificationResult.tier,
        tierName: tierConfig?.tierName,
        maxMarkets: tierConfig?.maxMarkets,
        queryLimit: tierConfig?.queryLimit,
        billingCycle: tierConfig?.billingCycle,
        endDate: upgradeResult?.endDate ? upgradeResult.endDate.toISOString() : undefined,
      } : undefined,
      scheduled: scheduled ? {
        tier: verificationResult.tier,
        effectiveDate: upgradeResult?.effectiveDate ? upgradeResult.effectiveDate.toISOString() : null,
      } : undefined,
      degraded: degraded || undefined,
      message: statusMessage,
      upgraded,
    });
  } catch (error) {
    console.error("Payment verification API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Force dynamic rendering
export const dynamic = "force-dynamic";
