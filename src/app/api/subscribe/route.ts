import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
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

// Subscription tier prices (in Naira)
const TIER_PRICES: Record<string, { price: number; duration: number; durationUnit: string }> = {
  SILVER: { price: 500, duration: 7, durationUnit: "days" },
  GOLD: { price: 2000, duration: 30, durationUnit: "days" },
  BUSINESS: { price: 15000, duration: 30, durationUnit: "days" },
  CORPORATE: { price: 50000, duration: 30, durationUnit: "days" },
  ENTERPRISE: { price: 150000, duration: 30, durationUnit: "days" },
};

// Payment provider configurations
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "sk_test_placeholder";
const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY || "FLWSECK_TEST-placeholder";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate unique payment reference
 */
function generatePaymentReference(): string {
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PAY-${timestamp}-${random}`;
}

/**
 * Initialize Paystack payment
 */
async function initializePaystackPayment(
  email: string,
  amount: number,
  reference: string,
  metadata: any
): Promise<{ success: boolean; paymentUrl?: string; error?: string }> {
  try {
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email || "customer@naijamarket.ng",
        amount: amount * 100, // Paystack uses kobo
        reference,
        callback_url: `${process.env.NEXTAUTH_URL || "https://naijamarket-web.vercel.app"}/subscribe/callback?provider=paystack`,
        metadata: {
          ...metadata,
          custom_fields: [
            {
              display_name: "Subscription Tier",
              variable_name: "tier",
              value: metadata.tier,
            },
            {
              display_name: "Phone Number",
              variable_name: "phone",
              value: metadata.phone,
            },
          ],
        },
      }),
    });

    const data = await response.json();

    if (data.status && data.data?.authorization_url) {
      return { success: true, paymentUrl: data.data.authorization_url };
    }

    return { success: false, error: data.message || "Failed to initialize Paystack payment" };
  } catch (error: any) {
    console.error("Paystack initialization error:", error);
    return { success: false, error: error.message || "Paystack connection failed" };
  }
}

/**
 * Initialize Flutterwave payment
 */
async function initializeFlutterwavePayment(
  email: string,
  amount: number,
  reference: string,
  metadata: any,
  name: string,
  phone: string
): Promise<{ success: boolean; paymentUrl?: string; error?: string }> {
  try {
    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: reference,
        amount: amount,
        currency: "NGN",
        redirect_url: `${process.env.NEXTAUTH_URL || "https://naijamarket-web.vercel.app"}/subscribe/callback?provider=flutterwave`,
        customer: {
          email: email || "customer@naijamarket.ng",
          name: name || "NaijaMarket Customer",
          phonenumber: phone,
        },
        meta: metadata,
        customizations: {
          title: "NaijaMarket Intel",
          description: `Subscription Upgrade to ${metadata.tier}`,
          logo: "https://naijamarket-web.vercel.app/logo.png",
        },
      }),
    });

    const data = await response.json();

    if (data.status === "success" && data.data?.link) {
      return { success: true, paymentUrl: data.data.link };
    }

    return { success: false, error: data.message || "Failed to initialize Flutterwave payment" };
  } catch (error: any) {
    console.error("Flutterwave initialization error:", error);
    return { success: false, error: error.message || "Flutterwave connection failed" };
  }
}

/**
 * Save payment record to database
 */
async function savePaymentRecord(
  phone: string,
  reference: string,
  tier: string,
  amount: number,
  provider: string,
  consumerId?: string
): Promise<boolean> {
  let pool: sql.ConnectionPool | null = null;
  
  try {
    pool = await sql.connect(dbConfig);
    
    await pool.request()
      .input("phone", sql.NVarChar(20), phone)
      .input("reference", sql.NVarChar(50), reference)
      .input("tier", sql.NVarChar(20), tier)
      .input("amount", sql.Decimal(18, 2), amount)
      .input("provider", sql.NVarChar(20), provider.toUpperCase())
      .input("status", sql.NVarChar(20), "PENDING")
      .input("consumer_id", sql.NVarChar(50), consumerId || null)
      .input("created_at", sql.DateTime2, new Date())
      .query(`
        INSERT INTO Consumer_Payments 
        (phone, reference, tier, amount, provider, status, consumer_id, created_at, updated_at)
        VALUES 
        (@phone, @reference, @tier, @amount, @provider, @status, @consumer_id, @created_at, @created_at)
      `);
    
    return true;
  } catch (error: any) {
    console.error("Database error saving payment:", error);
    return false;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

// ============================================================================
// API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { tier, provider, phone, email, name } = body;

    // Validate required fields
    if (!tier || !provider) {
      return NextResponse.json(
        { error: "Missing required fields: tier and provider" },
        { status: 400 }
      );
    }

    // Validate tier
    if (!TIER_PRICES[tier]) {
      return NextResponse.json(
        { error: `Invalid subscription tier: ${tier}` },
        { status: 400 }
      );
    }

    // Validate provider
    if (!["paystack", "flutterwave"].includes(provider.toLowerCase())) {
      return NextResponse.json(
        { error: `Invalid payment provider: ${provider}` },
        { status: 400 }
      );
    }

    // Get tier price
    const tierInfo = TIER_PRICES[tier];
    const amount = tierInfo.price;

    // Generate payment reference
    const reference = generatePaymentReference();

    // Prepare metadata
    const metadata = {
      tier,
      phone: phone || "",
      duration: tierInfo.duration,
      durationUnit: tierInfo.durationUnit,
    };

    // Initialize payment with selected provider
    let paymentResult;
    
    if (provider.toLowerCase() === "paystack") {
      paymentResult = await initializePaystackPayment(
        email || `${phone}@naijamarket.ng`,
        amount,
        reference,
        metadata
      );
    } else {
      paymentResult = await initializeFlutterwavePayment(
        email || `${phone}@naijamarket.ng`,
        amount,
        reference,
        metadata,
        name || "NaijaMarket Customer",
        phone || ""
      );
    }

    if (!paymentResult.success) {
      return NextResponse.json(
        { error: paymentResult.error || "Failed to initialize payment" },
        { status: 500 }
      );
    }

    // Save payment record to database
    const saved = await savePaymentRecord(
      phone || "",
      reference,
      tier,
      amount,
      provider
    );

    if (!saved) {
      console.warn("Failed to save payment record, but continuing with payment");
    }

    // Return payment URL
    return NextResponse.json({
      success: true,
      reference,
      paymentUrl: paymentResult.paymentUrl,
      tier,
      amount,
      provider: provider.toUpperCase(),
    });

  } catch (error: any) {
    console.error("Subscription API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Check subscription status
// ============================================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const phone = searchParams.get("phone");
  const reference = searchParams.get("reference");

  if (!phone && !reference) {
    return NextResponse.json(
      { error: "Missing required parameter: phone or reference" },
      { status: 400 }
    );
  }

  let pool: sql.ConnectionPool | null = null;

  try {
    pool = await sql.connect(dbConfig);

    let query = "";
    let params: any = {};

    if (reference) {
      query = `
        SELECT TOP 1 
          cp.reference, cp.tier, cp.amount, cp.provider, cp.status, 
          cp.created_at, cp.updated_at,
          c.full_name, c.subscription_tier as current_tier
        FROM Consumer_Payments cp
        LEFT JOIN Consumers c ON cp.phone = c.phone
        WHERE cp.reference = @reference
      `;
      params = { reference };
    } else {
      query = `
        SELECT TOP 5 
          cp.reference, cp.tier, cp.amount, cp.provider, cp.status, 
          cp.created_at, cp.updated_at,
          c.full_name, c.subscription_tier as current_tier
        FROM Consumer_Payments cp
        LEFT JOIN Consumers c ON cp.phone = c.phone
        WHERE cp.phone = @phone
        ORDER BY cp.created_at DESC
      `;
      params = { phone };
    }

    const result = await pool.request()
      .input(reference ? "reference" : "phone", sql.NVarChar(50), reference || phone)
      .query(query);

    if (result.recordset.length === 0) {
      return NextResponse.json({
        success: true,
        payments: [],
        message: "No payment records found",
      });
    }

    return NextResponse.json({
      success: true,
      payments: result.recordset,
    });

  } catch (error: any) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment status" },
      { status: 500 }
    );
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

// Force dynamic rendering
export const dynamic = "force-dynamic";
