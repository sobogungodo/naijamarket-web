// ============================================================================
// src/app/api/subscribe/verify/route.ts
// NaijaMarket Intel - Payment Verification API
// Version: 2.0.1 - Production Ready (TypeScript Strict) - FIXED
// Date: 2026-01-24
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";

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
  GOLD: { tierName: "Gold", queryLimit: 25, maxMarkets: 3, duration: 30, billingCycle: "monthly" },
  BUSINESS: { tierName: "Business", queryLimit: 100, maxMarkets: 5, duration: 30, billingCycle: "monthly" },
  CORPORATE: { tierName: "Corporate", queryLimit: null, maxMarkets: 6, duration: 30, billingCycle: "monthly" },
  ENTERPRISE: { tierName: "Enterprise", queryLimit: null, maxMarkets: 226, duration: 30, billingCycle: "monthly" },
};

// Tier ranking — higher number = higher tier. Used to block downgrades of an
// active, unexpired subscription.
const TIER_RANK: Record<string, number> = {
  FREE: 0, SILVER: 1, GOLD: 2, BUSINESS: 3, CORPORATE: 4, ENTERPRISE: 5,
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
 * Generate unique subscription ID
 * Format: SUB-TIMESTAMP-RANDOM
 */
function generateSubscriptionId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SUB-${timestamp}-${random}`;
}

/**
 * Calculate subscription end date based on tier
 */
function calculateEndDate(tier: string): Date {
  const config = getTierConfig(tier);
  const endDate = new Date();

  if (config.duration > 0) {
    endDate.setDate(endDate.getDate() + config.duration);
  } else {
    // For FREE tier, set far future date
    endDate.setFullYear(endDate.getFullYear() + 100);
  }

  return endDate;
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
 * Upgrade consumer subscription
 */
async function upgradeSubscription(
  phone: string,
  tier: string,
  amount: number,
  reference: string,
  provider: string
): Promise<boolean> {
  let pool: sql.ConnectionPool | null = null;

  try {
    pool = await sql.connect(dbConfig);
    const config = getTierConfig(tier);
    const subscriptionId = generateSubscriptionId();
    const startDate = new Date();
    const endDate = calculateEndDate(tier);

    // Check if consumer already has an active subscription
    const existingResult = await pool.request()
      .input("phone", sql.NVarChar(20), phone)
      .query(`
        SELECT subscription_id, tier_code, end_date
        FROM Consumer_Active_Subscriptions
        WHERE phone_number = @phone AND status = 'ACTIVE'
      `);

    // Downgrade protection: never reduce an active, unexpired higher tier.
    // (e.g. a SILVER payment must not clobber an active BUSINESS subscription.)
    if (existingResult.recordset.length > 0) {
      const cur = existingResult.recordset[0];
      const curRank = TIER_RANK[String(cur.tier_code || "").toUpperCase()] ?? 0;
      const newRank = TIER_RANK[String(tier || "").toUpperCase()] ?? 0;
      const curEnd = cur.end_date ? new Date(cur.end_date) : null;
      const stillValid = curEnd ? curEnd >= new Date() : true;
      if (newRank < curRank && stillValid) {
        console.warn(`[subscribe/verify] DOWNGRADE BLOCKED: active ${cur.tier_code} (rank ${curRank}, ends ${cur.end_date}) — refusing to apply lower tier ${tier} (rank ${newRank}) ref=${reference}`);
        return true; // payment acknowledged; keep the higher active tier
      }
    }

    // Phone variants for matching across channels (rows may be stored with or
    // without a '+' prefix). Resolve consumer_id so this row reconciles with the
    // webhook's consumer_id-keyed MERGE.
    const cleanPhone = String(phone).replace(/^\+/, "");
    const phonePlus = "+" + cleanPhone;
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

    // Idempotency: if this payment_reference is already recorded, don't write again.
    const refCheck = await pool.request()
      .input("payment_reference", sql.NVarChar(50), reference)
      .query(`SELECT COUNT(*) AS cnt FROM Consumer_Active_Subscriptions WHERE payment_reference = @payment_reference`);
    if ((refCheck.recordset?.[0]?.cnt ?? 0) > 0) {
      console.log(`[subscribe/verify] payment_reference ${reference} already recorded — skipping CAS write`);
    } else {
      // One ACTIVE row per consumer: supersede ALL existing ACTIVE rows for this
      // consumer (any channel — matched by phone in +/non-+ form OR consumer_id)
      // BEFORE inserting the new one. Guarantees a single ACTIVE row at all times.
      await pool.request()
        .input("phone", sql.NVarChar(20), phone)
        .input("phonePlus", sql.NVarChar(20), phonePlus)
        .input("phoneClean", sql.NVarChar(20), cleanPhone)
        .input("consumer_id", sql.NVarChar(50), consumerId)
        .query(`
          UPDATE Consumer_Active_Subscriptions
          SET status = 'SUPERSEDED', updated_at = GETUTCDATE()
          WHERE status = 'ACTIVE'
            AND ( phone_number IN (@phone, @phonePlus, @phoneClean)
               OR (@consumer_id IS NOT NULL AND consumer_id = @consumer_id) )
        `);

      await pool.request()
        .input("subscription_id", sql.NVarChar(50), subscriptionId)
        .input("consumer_id", sql.NVarChar(50), consumerId)
        .input("phone", sql.NVarChar(20), phone)
        .input("tier_code", sql.NVarChar(20), tier)
        .input("tier_name", sql.NVarChar(50), config.tierName)
        .input("start_date", sql.Date, startDate)
        .input("end_date", sql.Date, endDate)
        .input("payment_reference", sql.NVarChar(50), reference)
        .input("payment_provider", sql.NVarChar(20), provider)
        .input("payment_amount", sql.Decimal(18, 2), amount)
        .input("billing_cycle", sql.NVarChar(20), config.billingCycle)
        .query(`
          INSERT INTO Consumer_Active_Subscriptions (
            subscription_id, consumer_id, phone_number, tier_code, tier_name, status,
            start_date, end_date, payment_reference, payment_provider,
            payment_amount, billing_cycle, queries_used_today, queries_used_week,
            created_at, updated_at
          ) VALUES (
            @subscription_id, @consumer_id, @phone, @tier_code, @tier_name, 'ACTIVE',
            @start_date, @end_date, @payment_reference, @payment_provider,
            @payment_amount, @billing_cycle, 0, 0,
            GETDATE(), GETDATE()
          )
        `);
    }

    // Update the Consumers table — the source of truth for tier across web/WA/app.
    // (Column is subscription_tier, not tier; match phone in +/non-+ form on either
    // phone_number or phone. Do NOT swallow errors — log loudly if nothing updates.)
    try {
      const upd = await pool.request()
        .input("phone", sql.NVarChar(20), phone)
        .input("phonePlus", sql.NVarChar(20), "+" + cleanPhone)
        .input("phoneClean", sql.NVarChar(20), cleanPhone)
        .input("tier", sql.NVarChar(20), tier)
        .input("start_date", sql.Date, startDate)
        .input("end_date", sql.Date, endDate)
        .input("max_markets", sql.Int, config.maxMarkets)
        .query(`
          UPDATE Consumers
          SET subscription_tier = @tier,
              subscription_start_date = @start_date,
              subscription_end_date = @end_date,
              max_markets = @max_markets,
              updated_at = GETDATE()
          WHERE phone_number = @phone OR phone = @phone
             OR phone_number = @phonePlus OR phone = @phonePlus
             OR phone_number = @phoneClean OR phone = @phoneClean
        `);
      if (!upd.rowsAffected || upd.rowsAffected[0] === 0) {
        console.error(`[subscribe/verify] Consumers tier NOT updated — no row matched phone=${phone} ref=${reference}`);
      }
    } catch (e) {
      console.error(`[subscribe/verify] Consumers tier update FAILED ref=${reference}:`, e);
    }

    // Ledger entry in Subscription_Transactions — non-blocking; a failure here
    // must not undo the activation already applied above. Mirrors the columns
    // written by the Paystack webhook; payment_channel = 'WEB' for this path.
    // Idempotency: verify can run more than once per payment (deep-link return +
    // foreground refresh) — skip if this payment_reference already has a ledger row.
    const txCheck = await pool.request()
      .input("payment_reference", sql.NVarChar(50), reference)
      .query(`SELECT COUNT(*) AS cnt FROM Subscription_Transactions WHERE payment_reference = @payment_reference`);
    if ((txCheck.recordset?.[0]?.cnt ?? 0) > 0) {
      console.log(`[subscribe/verify] Subscription_Transactions ref ${reference} already recorded — skipping ledger write`);
    } else try {
      const transactionId = "TXN-" + Date.now().toString(36).toUpperCase() + "-" +
        Math.random().toString(36).substring(2, 8).toUpperCase();
      await pool.request()
        .input("transaction_id", sql.NVarChar(50), transactionId)
        .input("consumer_id", sql.NVarChar(50), consumerId)
        .input("phone", sql.NVarChar(20), phone)
        .input("product_code", sql.NVarChar(50), tier)
        .input("product_name", sql.NVarChar(255), config.tierName)
        .input("billing_cycle", sql.NVarChar(50), String(config.billingCycle).toUpperCase())
        .input("gross_amount", sql.Decimal(18, 2), amount)
        .input("net_amount", sql.Decimal(18, 2), amount)
        .input("payment_provider", sql.NVarChar(255), String(provider).toUpperCase())
        .input("payment_reference", sql.NVarChar(50), reference)
        .input("subscription_start", sql.NVarChar(50), startDate.toISOString())
        .input("subscription_end", sql.NVarChar(50), endDate.toISOString())
        .query(`
          INSERT INTO Subscription_Transactions (
            transaction_id, consumer_id, phone_number, transaction_type,
            product_code, product_name, billing_cycle,
            gross_amount, net_amount, currency,
            payment_provider, payment_reference, payment_channel,
            payment_status, subscription_start, subscription_end,
            created_at, completed_at, verified_at
          ) VALUES (
            @transaction_id, @consumer_id, @phone, 'NEW_SUBSCRIPTION',
            @product_code, @product_name, @billing_cycle,
            @gross_amount, @net_amount, 'NGN',
            @payment_provider, @payment_reference, 'WEB',
            'COMPLETED', @subscription_start, @subscription_end,
            GETUTCDATE(), GETUTCDATE(), GETUTCDATE()
          )
        `);
    } catch (ledgerErr) {
      console.error(`[subscribe/verify] Subscription_Transactions ledger write failed (non-blocking) ref=${reference}:`, ledgerErr);
    }

    return true;
  } catch (error) {
    console.error("Error upgrading subscription:", error);
    return false;
  } finally {
    if (pool) {
      await pool.close();
    }
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
    let upgraded = false;

    const providerStatus = verificationResult.status?.toLowerCase();

    if (providerStatus === "success" || providerStatus === "successful") {
      paymentStatus = "SUCCESS";
      statusMessage = "Payment successful! Your subscription has been upgraded.";

      // Update payment record
      await updatePaymentStatus(reference, "SUCCESS", JSON.stringify(verificationResult));

      // Upgrade subscription if we have phone and tier
      if (verificationResult.phone && verificationResult.tier) {
        upgraded = await upgradeSubscription(
          verificationResult.phone,
          verificationResult.tier,
          verificationResult.amount || 0,
          reference,
          provider
        );

        if (!upgraded) {
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

    // Get tier config for response
    const tierConfig = verificationResult.tier ? getTierConfig(verificationResult.tier) : null;

    return NextResponse.json({
      success: paymentStatus === "SUCCESS",
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
      } : undefined,
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
