import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";

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
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "sk_test_placeholder";
const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY || "FLWSECK_TEST-placeholder";

// Subscription tier configurations (matching your Subscription_Tiers table)
const TIER_CONFIG: Record<string, { 
  tierName: string;
  queryLimit: number | null; 
  maxMarkets: number; 
  duration: number;
  billingCycle: string;
}> = {
  FREE: { tierName: "Free", queryLimit: 3, maxMarkets: 3, duration: 0, billingCycle: "forever" },
  SILVER: { tierName: "Silver", queryLimit: 5, maxMarkets: 3, duration: 7, billingCycle: "weekly" },
  GOLD: { tierName: "Gold", queryLimit: 15, maxMarkets: 3, duration: 30, billingCycle: "monthly" },
  BUSINESS: { tierName: "Business", queryLimit: 30, maxMarkets: 5, duration: 30, billingCycle: "monthly" },
  CORPORATE: { tierName: "Corporate", queryLimit: null, maxMarkets: 6, duration: 30, billingCycle: "monthly" },
  ENTERPRISE: { tierName: "Enterprise", queryLimit: null, maxMarkets: 226, duration: 30, billingCycle: "monthly" },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate unique subscription ID
 */
function generateSubscriptionId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SUB-${timestamp}-${random}`;
}

/**
 * Verify payment with Paystack
 */
async function verifyPaystackPayment(reference: string): Promise<{
  success: boolean;
  status?: string;
  amount?: number;
  metadata?: any;
  error?: string;
}> {
  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });

    const data = await response.json();

    if (data.status && data.data) {
      return {
        success: true,
        status: data.data.status, // "success", "abandoned", "failed"
        amount: data.data.amount / 100, // Convert from kobo to naira
        metadata: data.data.metadata,
      };
    }

    return { success: false, error: data.message || "Verification failed" };
  } catch (error: any) {
    console.error("Paystack verification error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Verify payment with Flutterwave
 */
async function verifyFlutterwavePayment(reference: string): Promise<{
  success: boolean;
  status?: string;
  amount?: number;
  metadata?: any;
  error?: string;
}> {
  try {
    const response = await fetch(
      `https://api.flutterwave.com/v3/transactions?tx_ref=${reference}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        },
      }
    );

    const data = await response.json();

    if (data.status === "success" && data.data && data.data.length > 0) {
      const transaction = data.data[0];
      return {
        success: true,
        status: transaction.status, // "successful", "failed", "pending"
        amount: transaction.amount,
        metadata: transaction.meta,
      };
    }

    return { success: false, error: data.message || "Transaction not found" };
  } catch (error: any) {
    console.error("Flutterwave verification error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Update payment status in database
 */
async function updatePaymentStatus(
  reference: string,
  status: string,
  providerResponse?: any
): Promise<boolean> {
  let pool: sql.ConnectionPool | null = null;

  try {
    pool = await sql.connect(dbConfig);

    await pool.request()
      .input("reference", sql.NVarChar(50), reference)
      .input("status", sql.NVarChar(20), status)
      .input("provider_response", sql.NVarChar(sql.MAX), JSON.stringify(providerResponse || {}))
      .input("updated_at", sql.DateTime2, new Date())
      .query(`
        UPDATE Consumer_Payments 
        SET status = @status, 
            provider_response = @provider_response,
            updated_at = @updated_at
        WHERE reference = @reference
      `);

    return true;
  } catch (error: any) {
    console.error("Database update error:", error);
    return false;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

/**
 * Upgrade consumer subscription
 * Uses exact column names from Consumer_Active_Subscriptions table
 */
async function upgradeConsumerSubscription(
  phone: string,
  tier: string,
  amount: number,
  provider: string,
  reference: string
): Promise<boolean> {
  let pool: sql.ConnectionPool | null = null;

  try {
    pool = await sql.connect(dbConfig);

    const tierConfig = TIER_CONFIG[tier];
    if (!tierConfig) {
      console.error("Invalid tier:", tier);
      return false;
    }

    // Calculate subscription dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + tierConfig.duration);
    
    // Grace period = 3 days after end date
    const graceEndDate = new Date(endDate);
    graceEndDate.setDate(graceEndDate.getDate() + 3);

    // Get consumer_id from Consumers table
    const consumerResult = await pool.request()
      .input("phone", sql.NVarChar(20), phone)
      .query(`SELECT consumer_id, subscription_tier FROM Consumers WHERE phone = @phone`);
    
    const consumerId = consumerResult.recordset[0]?.consumer_id || null;
    const previousTier = consumerResult.recordset[0]?.subscription_tier || "FREE";

    // 1. Update Consumers table
    await pool.request()
      .input("phone", sql.NVarChar(20), phone)
      .input("tier", sql.NVarChar(20), tier)
      .input("query_limit", sql.Int, tierConfig.queryLimit || -1) // -1 for unlimited
      .input("max_markets", sql.Int, tierConfig.maxMarkets)
      .input("start_date", sql.DateTime2, startDate)
      .input("end_date", sql.DateTime2, endDate)
      .input("updated_at", sql.DateTime2, new Date())
      .query(`
        UPDATE Consumers 
        SET subscription_tier = @tier,
            daily_query_limit = @query_limit,
            max_markets = @max_markets,
            subscription_start_date = @start_date,
            subscription_end_date = @end_date,
            updated_at = @updated_at
        WHERE phone = @phone
      `);

    // 2. Mark any existing active subscriptions as UPGRADED
    await pool.request()
      .input("phone", sql.NVarChar(50), phone)
      .input("updated_at", sql.DateTime2, new Date())
      .query(`
        UPDATE Consumer_Active_Subscriptions 
        SET status = 'UPGRADED', 
            updated_at = @updated_at
        WHERE phone_number = @phone AND status = 'ACTIVE'
      `);

    // 3. Insert new subscription record into Consumer_Active_Subscriptions
    // Using exact column names from your schema
    const subscriptionId = generateSubscriptionId();
    
    await pool.request()
      .input("subscription_id", sql.NVarChar(50), subscriptionId)
      .input("consumer_id", sql.NVarChar(50), consumerId)
      .input("phone_number", sql.NVarChar(20), phone)
      .input("tier_code", sql.NVarChar(20), tier)
      .input("tier_name", sql.NVarChar(50), tierConfig.tierName)
      .input("status", sql.NVarChar(20), "ACTIVE")
      .input("start_date", sql.Date, startDate)
      .input("end_date", sql.Date, endDate)
      .input("grace_end_date", sql.Date, graceEndDate)
      .input("payment_reference", sql.NVarChar(50), reference)
      .input("payment_provider", sql.NVarChar(20), provider.toUpperCase())
      .input("payment_amount", sql.Decimal(18, 2), amount)
      .input("billing_cycle", sql.NVarChar(20), tierConfig.billingCycle)
      .input("amount_paid", sql.Decimal(18, 2), amount)
      .input("upgraded_from", sql.NVarChar(20), previousTier !== tier ? previousTier : null)
      .input("upgraded_at", sql.DateTime2, previousTier !== tier ? new Date() : null)
      .input("auto_renew", sql.Bit, false)
      .input("created_at", sql.DateTime2, new Date())
      .input("updated_at", sql.DateTime2, new Date())
      .query(`
        INSERT INTO Consumer_Active_Subscriptions (
          subscription_id, consumer_id, phone_number, tier_code, tier_name,
          status, start_date, end_date, grace_end_date,
          payment_reference, payment_provider, payment_amount,
          billing_cycle, amount_paid, upgraded_from, upgraded_at,
          auto_renew, created_at, updated_at
        )
        VALUES (
          @subscription_id, @consumer_id, @phone_number, @tier_code, @tier_name,
          @status, @start_date, @end_date, @grace_end_date,
          @payment_reference, @payment_provider, @payment_amount,
          @billing_cycle, @amount_paid, @upgraded_from, @upgraded_at,
          @auto_renew, @created_at, @updated_at
        )
      `);

    console.log(`Successfully upgraded ${phone} to ${tier}`);
    return true;
  } catch (error: any) {
    console.error("Subscription upgrade error:", error);
    return false;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

/**
 * Get payment record from database
 */
async function getPaymentRecord(reference: string): Promise<any | null> {
  let pool: sql.ConnectionPool | null = null;

  try {
    pool = await sql.connect(dbConfig);

    const result = await pool.request()
      .input("reference", sql.NVarChar(50), reference)
      .query(`
        SELECT * FROM Consumer_Payments WHERE reference = @reference
      `);

    return result.recordset.length > 0 ? result.recordset[0] : null;
  } catch (error: any) {
    console.error("Database read error:", error);
    return null;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

// ============================================================================
// API HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const reference = searchParams.get("reference");
  const provider = searchParams.get("provider")?.toLowerCase();

  if (!reference) {
    return NextResponse.json(
      { error: "Missing required parameter: reference" },
      { status: 400 }
    );
  }

  try {
    // First, check our database for existing payment record
    const existingPayment = await getPaymentRecord(reference);

    // If payment is already completed, return it
    if (existingPayment?.status === "COMPLETED") {
      return NextResponse.json({
        success: true,
        payment: existingPayment,
        message: "Payment already processed",
      });
    }

    // Verify with payment provider
    let verificationResult;

    if (provider === "flutterwave") {
      verificationResult = await verifyFlutterwavePayment(reference);
    } else {
      // Default to Paystack
      verificationResult = await verifyPaystackPayment(reference);
    }

    if (!verificationResult.success) {
      return NextResponse.json({
        success: false,
        error: verificationResult.error,
        payment: existingPayment,
      });
    }

    // Map provider status to our status
    let paymentStatus = "PENDING";
    if (verificationResult.status === "success" || verificationResult.status === "successful") {
      paymentStatus = "COMPLETED";
    } else if (verificationResult.status === "failed" || verificationResult.status === "abandoned") {
      paymentStatus = "FAILED";
    }

    // Update payment status in database
    await updatePaymentStatus(reference, paymentStatus, verificationResult);

    // If payment successful, upgrade subscription
    if (paymentStatus === "COMPLETED" && existingPayment) {
      const upgraded = await upgradeConsumerSubscription(
        existingPayment.phone,
        existingPayment.tier,
        existingPayment.amount,
        existingPayment.provider,
        reference
      );

      if (!upgraded) {
        console.error("Failed to upgrade subscription for:", existingPayment.phone);
      }
    }

    // Fetch updated payment record
    const updatedPayment = await getPaymentRecord(reference);

    return NextResponse.json({
      success: true,
      payment: {
        ...updatedPayment,
        provider_status: verificationResult.status,
      },
      verification: {
        status: verificationResult.status,
        amount: verificationResult.amount,
      },
    });

  } catch (error: any) {
    console.error("Payment verification API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// Force dynamic rendering
export const dynamic = "force-dynamic";
