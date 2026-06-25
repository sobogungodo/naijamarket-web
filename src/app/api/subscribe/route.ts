// ============================================================================
// src/app/api/subscribe/route.ts
// NaijaMarket Intel - Subscription Payment API
// Version: 2.0.0 - Production Ready (TypeScript Strict)
// Date: 2026-01-24
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface TierInfo {
  price: number;
  tierName: string;
  duration: number;
  durationUnit: string;
  billingCycle: string;
  queryLimit: number | null;
  maxMarkets: number;
}

interface PaymentInitResult {
  success: boolean;
  paymentUrl?: string;
  error?: string;
}

interface SubscriptionStatus {
  phone: string;
  tier: string;
  tierName: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  queriesUsedToday: number;
  maxMarkets: number;
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

// Base URL for callbacks
const BASE_URL = process.env.NEXTAUTH_URL || "https://naijamarket-web.vercel.app";

// Subscription tier prices and configurations
const TIER_PRICES: Record<string, TierInfo> = {
  FREE: {
    price: 0,
    tierName: "Free",
    duration: 0,
    durationUnit: "forever",
    billingCycle: "forever",
    queryLimit: 3,
    maxMarkets: 3,
  },
  SILVER: {
    price: 500,
    tierName: "Silver",
    duration: 7,
    durationUnit: "days",
    billingCycle: "weekly",
    queryLimit: 5,
    maxMarkets: 3,
  },
  GOLD: {
    price: 2000,
    tierName: "Gold",
    duration: 30,
    durationUnit: "days",
    billingCycle: "monthly",
    queryLimit: 15,
    maxMarkets: 3,
  },
  BUSINESS: {
    price: 15000,
    tierName: "Business",
    duration: 30,
    durationUnit: "days",
    billingCycle: "monthly",
    queryLimit: 30,
    maxMarkets: 5,
  },
  CORPORATE: {
    price: 50000,
    tierName: "Corporate",
    duration: 30,
    durationUnit: "days",
    billingCycle: "monthly",
    queryLimit: null, // Unlimited
    maxMarkets: 6,
  },
  ENTERPRISE: {
    price: 150000,
    tierName: "Enterprise",
    duration: 30,
    durationUnit: "days",
    billingCycle: "monthly",
    queryLimit: null, // Unlimited
    maxMarkets: 226,
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate unique payment reference
 * Format: PAY-YYYYMMDDHHMMSS-XXXXXX
 */
function generatePaymentReference(): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PAY-${timestamp}-${random}`;
}

/**
 * Generate unique payment ID
 * Format: PMNT-TIMESTAMP-RANDOM
 */
function generatePaymentId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PMNT-${timestamp}-${random}`;
}

/**
 * Initialize payment with Paystack
 */
async function initializePaystackPayment(
  email: string,
  amount: number,
  reference: string,
  metadata: Record<string, unknown>
): Promise<PaymentInitResult> {
  if (!PAYSTACK_SECRET_KEY) {
    return { success: false, error: "Paystack is not configured" };
  }

  try {
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amount * 100, // Paystack uses kobo (1 Naira = 100 kobo)
        reference,
        callback_url: `${BASE_URL}/subscribe/callback?provider=paystack&ref=${reference}`,
        metadata: {
          ...metadata,
          custom_fields: [
            { display_name: "Tier", variable_name: "tier", value: metadata.tier },
            { display_name: "Phone", variable_name: "phone", value: metadata.phone },
          ],
        },
        channels: ["card", "bank", "ussd", "bank_transfer"],
      }),
    });

    const data = await response.json();

    if (data.status && data.data?.authorization_url) {
      return { success: true, paymentUrl: data.data.authorization_url };
    }

    return { success: false, error: data.message || "Failed to initialize Paystack payment" };
  } catch (error) {
    console.error("Paystack initialization error:", error);
    return { success: false, error: "Paystack connection failed" };
  }
}

/**
 * Initialize payment with Flutterwave
 */
async function initializeFlutterwavePayment(
  email: string,
  amount: number,
  reference: string,
  phone: string,
  name: string,
  metadata: Record<string, unknown>
): Promise<PaymentInitResult> {
  if (!FLUTTERWAVE_SECRET_KEY) {
    return { success: false, error: "Flutterwave is not configured" };
  }

  try {
    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: reference,
        amount,
        currency: "NGN",
        redirect_url: `${BASE_URL}/subscribe/callback?provider=flutterwave&ref=${reference}`,
        customer: {
          email,
          name: name || "NaijaMarket Customer",
          phonenumber: phone,
        },
        meta: metadata,
        customizations: {
          title: "NaijaMarket Intel",
          description: `Subscription Upgrade to ${metadata.tierName || metadata.tier}`,
          logo: `${BASE_URL}/logo.png`,
        },
        payment_options: "card, banktransfer, ussd",
      }),
    });

    const data = await response.json();

    if (data.status === "success" && data.data?.link) {
      return { success: true, paymentUrl: data.data.link };
    }

    return { success: false, error: data.message || "Failed to initialize Flutterwave payment" };
  } catch (error) {
    console.error("Flutterwave initialization error:", error);
    return { success: false, error: "Flutterwave connection failed" };
  }
}

/**
 * Record payment in database
 */
async function recordPayment(
  paymentId: string,
  reference: string,
  phone: string,
  consumerId: string,
  tier: string,
  amount: number,
  provider: string
): Promise<boolean> {
  let pool: sql.ConnectionPool | null = null;

  try {
    pool = await sql.connect(dbConfig);

    await pool.request()
      .input("payment_id", sql.NVarChar(50), paymentId)
      .input("reference", sql.NVarChar(50), reference)
      .input("phone", sql.NVarChar(20), phone)
      .input("consumer_id", sql.NVarChar(50), consumerId)
      .input("tier", sql.NVarChar(20), tier)
      .input("amount", sql.Decimal(18, 2), amount)
      .input("provider", sql.NVarChar(20), provider)
      .query(`
        INSERT INTO Consumer_Payments (
          payment_id, reference, phone, consumer_id, tier, 
          amount, currency, provider, status, created_at
        ) VALUES (
          @payment_id, @reference, @phone, @consumer_id, @tier,
          @amount, 'NGN', @provider, 'PENDING', GETDATE()
        )
      `);

    return true;
  } catch (error) {
    console.error("Error recording payment:", error);
    return false;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

/**
 * Get consumer subscription status
 */
async function getSubscriptionStatus(phone: string): Promise<SubscriptionStatus | null> {
  let pool: sql.ConnectionPool | null = null;

  // Phone numbers are stored inconsistently with/without a '+' prefix across
  // channels, so match all three forms.
  const clean = String(phone || "").replace(/\+/g, "");
  const withPlus = "+" + clean;
  const bind = (r: sql.Request) =>
    r.input("p", sql.NVarChar(20), phone)
     .input("pp", sql.NVarChar(20), withPlus)
     .input("pc", sql.NVarChar(20), clean);

  try {
    pool = await sql.connect(dbConfig);

    // Source of truth: Consumers.subscription_tier — updated by BOTH the webhook
    // and the verify path. Consumer_Active_Subscriptions can carry stale/superseded
    // rows, so it's used only as a secondary source for dates/usage.
    const consRes = await bind(pool.request()).query(`
      SELECT TOP 1
        subscription_tier,
        subscription_start_date,
        subscription_end_date,
        ISNULL(max_markets, 3) AS max_markets
      FROM Consumers
      WHERE phone IN (@p, @pp, @pc) OR phone_number IN (@p, @pp, @pc)
      ORDER BY updated_at DESC
    `);

    const subRes = await bind(pool.request()).query(`
      SELECT TOP 1
        tier_code, tier_name, status, start_date, end_date,
        ISNULL(CAST(queries_used_today AS INT), 0) AS queries_used_today,
        ISNULL(max_markets, 3) AS max_markets
      FROM Consumer_Active_Subscriptions
      WHERE phone_number IN (@p, @pp, @pc) AND status = 'ACTIVE'
      ORDER BY created_at DESC
    `);

    const cons = consRes.recordset[0];
    const sub = subRes.recordset[0];
    if (!cons && !sub) {
      return null;
    }

    const tier = cons?.subscription_tier || sub?.tier_code || "FREE";
    const startRaw = cons?.subscription_start_date || sub?.start_date || null;
    const endRaw = cons?.subscription_end_date || sub?.end_date || null;
    const maxMarkets = cons?.max_markets ?? sub?.max_markets ?? 3;

    return {
      phone: withPlus,
      tier,
      tierName: sub?.tier_name || tier || "Free",
      status: sub?.status || "ACTIVE",
      startDate: startRaw ? new Date(startRaw).toISOString().split("T")[0] : null,
      endDate: endRaw ? new Date(endRaw).toISOString().split("T")[0] : null,
      queriesUsedToday: sub?.queries_used_today || 0,
      maxMarkets: maxMarkets || 3,
    };
  } catch (error) {
    console.error("Error getting subscription status:", error);
    return null;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

// ============================================================================
// POST - Initialize Payment
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tier, provider, phone, email, name, consumerId, source } = body;

    // Validate required fields
    if (!tier || !provider) {
      return NextResponse.json(
        { error: "Missing required fields: tier and provider" },
        { status: 400 }
      );
    }

    // Validate tier
    const tierKey = tier.toUpperCase();
    const tierInfo = TIER_PRICES[tierKey];
    if (!tierInfo) {
      return NextResponse.json(
        { error: `Invalid subscription tier: ${tier}` },
        { status: 400 }
      );
    }

    // Cannot pay for FREE tier
    if (tierInfo.price === 0) {
      return NextResponse.json(
        { error: "Cannot process payment for FREE tier" },
        { status: 400 }
      );
    }

    // Validate provider
    const providerLower = provider.toLowerCase();
    if (!["paystack", "flutterwave"].includes(providerLower)) {
      return NextResponse.json(
        { error: `Invalid payment provider: ${provider}. Use 'paystack' or 'flutterwave'` },
        { status: 400 }
      );
    }

    // Generate payment reference
    const reference = generatePaymentReference();
    const paymentId = generatePaymentId();
    const amount = tierInfo.price;

    // Create customer email if not provided
    const customerEmail = email || (phone ? `${phone.replace(/\+/g, "")}@naijamarket.ng` : "customer@naijamarket.ng");
    const customerName = name || "NaijaMarket Customer";
    const customerPhone = phone || "";

    // Metadata for payment provider. `source: 'app'` rides through Paystack so the
    // callback can detect a mobile-app origin server-side (no browser storage).
    const metadata = {
      tier: tierKey,
      tierName: tierInfo.tierName,
      phone: customerPhone,
      consumerId: consumerId || "",
      billingCycle: tierInfo.billingCycle,
      duration: tierInfo.duration,
      durationUnit: tierInfo.durationUnit,
      ...(source === "app" ? { source: "app" } : {}),
    };

    // Initialize payment with selected provider
    let initResult: PaymentInitResult;

    if (providerLower === "paystack") {
      initResult = await initializePaystackPayment(customerEmail, amount, reference, metadata);
    } else {
      initResult = await initializeFlutterwavePayment(
        customerEmail,
        amount,
        reference,
        customerPhone,
        customerName,
        metadata
      );
    }

    if (!initResult.success) {
      return NextResponse.json(
        { error: initResult.error || "Payment initialization failed" },
        { status: 500 }
      );
    }

    // Record payment in database (non-blocking, don't fail if this fails)
    if (customerPhone && consumerId) {
      recordPayment(
        paymentId,
        reference,
        customerPhone,
        consumerId,
        tierKey,
        amount,
        providerLower
      ).catch((err) => console.error("Failed to record payment:", err));
    }

    // Return success with payment URL
    return NextResponse.json({
      success: true,
      paymentUrl: initResult.paymentUrl,
      reference,
      tier: tierKey,
      tierName: tierInfo.tierName,
      amount,
      provider: providerLower,
    });
  } catch (error) {
    console.error("Payment initialization error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Get Subscription Status or Tiers
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get("phone");
    const action = searchParams.get("action");

    // If action=tiers, return all available tiers
    if (action === "tiers") {
      const tiers = Object.entries(TIER_PRICES).map(([code, info]) => ({
        code,
        name: info.tierName,
        price: info.price,
        priceFormatted: info.price === 0 ? "Free" : `₦${info.price.toLocaleString()}`,
        billing: `${info.billingCycle === "forever" ? "Forever" : `Per ${info.billingCycle === "weekly" ? "week" : "month"}`}`,
        duration: info.duration,
        durationUnit: info.durationUnit,
        billingCycle: info.billingCycle,
        queryLimit: info.queryLimit,
        maxMarkets: info.maxMarkets,
      }));

      return NextResponse.json({
        success: true,
        tiers,
      });
    }

    // If phone provided, get subscription status
    if (phone) {
      const status = await getSubscriptionStatus(phone);

      if (!status) {
        // Return default FREE tier status
        return NextResponse.json({
          success: true,
          subscription: {
            phone,
            tier: "FREE",
            tierName: "Free",
            status: "ACTIVE",
            startDate: null,
            endDate: null,
            queriesUsedToday: 0,
            maxMarkets: 3,
          },
        });
      }

      return NextResponse.json({
        success: true,
        subscription: status,
      });
    }

    // No phone or action provided - return tiers by default
    const tiers = Object.entries(TIER_PRICES).map(([code, info]) => ({
      code,
      name: info.tierName,
      price: info.price,
      priceFormatted: info.price === 0 ? "Free" : `₦${info.price.toLocaleString()}`,
      billing: `${info.billingCycle === "forever" ? "Forever" : `Per ${info.billingCycle === "weekly" ? "week" : "month"}`}`,
      duration: info.duration,
      durationUnit: info.durationUnit,
      billingCycle: info.billingCycle,
    }));

    return NextResponse.json({
      success: true,
      tiers,
    });
  } catch (error) {
    console.error("Error in GET /api/subscribe:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Force dynamic rendering
export const dynamic = "force-dynamic";
