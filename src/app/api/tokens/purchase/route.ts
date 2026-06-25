// ============================================================================
// /api/tokens/purchase/route.ts
// Token Purchase - Initiates Paystack payment for token packs
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";

// Paystack config
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "";
const BASE_URL = process.env.NEXTAUTH_URL || "https://www.naijamarketintel.ng";

// Azure SQL config
const sqlConfig: sql.config = {
  user: process.env.AZURE_SQL_USER!,
  password: process.env.AZURE_SQL_PASSWORD!,
  database: process.env.AZURE_SQL_DATABASE!,
  server: process.env.AZURE_SQL_SERVER!,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

/**
 * Generate unique payment reference
 * Format: TKN-YYYYMMDDHHMMSS-XXXXXX
 */
function generateReference(): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TKN-${timestamp}-${random}`;
}

export async function POST(request: NextRequest) {
  let pool: sql.ConnectionPool | null = null;

  try {
    const body = await request.json();
    const { consumerId, packId } = body;

    if (!consumerId || !packId) {
      return NextResponse.json(
        { success: false, error: "Consumer ID and pack ID are required" },
        { status: 400 }
      );
    }

    if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY === "sk_test_placeholder") {
      return NextResponse.json(
        { success: false, error: "PAYSTACK_SECRET_KEY is not configured in Vercel environment variables." },
        { status: 500 }
      );
    }

    console.log("[TokenPurchase] Step 1: Connecting to SQL...");

    // 1. Get pack details from database
    pool = await sql.connect(sqlConfig);

    console.log("[TokenPurchase] Step 2: Querying Token_Packs for packId:", packId);

    const packResult = await pool.request()
      .input("pack_id", sql.NVarChar(50), packId)
      .query(`
        SELECT pack_id, pack_name, tokens, price_naira, bonus_tokens, is_active
        FROM dbo.Token_Packs
        WHERE pack_id = @pack_id AND is_active = 1
      `);

    if (packResult.recordset.length === 0) {
      return NextResponse.json(
        { success: false, error: `Token pack ${packId} not found or inactive. Check Token_Packs table.` },
        { status: 404 }
      );
    }

    const pack = packResult.recordset[0];
    console.log("[TokenPurchase] Step 3: Pack found:", pack.pack_name, "Price:", pack.price_naira);

    // 2. Get consumer details (need email/phone for Paystack)
    const consumerResult = await pool.request()
      .input("consumer_id", sql.NVarChar(50), consumerId)
      .query(`
        SELECT consumer_id, phone_number, email, full_name
        FROM dbo.Consumers
        WHERE consumer_id = @consumer_id
      `);

    const consumer = consumerResult.recordset[0];
    console.log("[TokenPurchase] Step 4: Consumer found:", consumer ? "yes" : "no", "Email:", consumer?.email || "none");
    const email = consumer?.email || `${consumerId}@naijamarketintel.ng`;
    const phone = consumer?.phone_number || "";
    const name = consumer?.full_name || "Customer";

    // 3. Generate payment reference
    const reference = generateReference();
    const amountNgn = Number(pack.price_naira);
    const totalTokens = (pack.tokens || 0) + (pack.bonus_tokens || 0);

    console.log("[TokenPurchase] Step 5: Ref:", reference, "Amount:", amountNgn, "Tokens:", totalTokens);

    // 4. Pending-transaction logging is DISABLED pending a write-path rework.
    // The real dbo.Token_Transactions requires transaction_id (varchar PK),
    // wallet_id (NOT NULL → wallet must exist), consumer_phone, and
    // token_balance_before/after — this needs to be designed alongside the
    // Paystack verify/credit flow before payments are re-enabled. Payments are
    // currently OFF (UI shows "Coming Soon"), so this path is unreachable.
    // TODO(payments): re-implement pending log + crediting against real schema.

    console.log("[TokenPurchase] Step 6: Calling Paystack initialize...");

    // 5. Initialize Paystack payment
    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email,
        amount: Math.round(amountNgn * 100), // Paystack uses kobo (₦1 = 100 kobo)
        reference: reference,
        callback_url: `${BASE_URL}/dashboard/tokens/callback?ref=${reference}`,
        channels: ["card", "bank", "ussd", "bank_transfer"],
        metadata: {
          consumer_id: consumerId,
          pack_id: packId,
          pack_name: pack.pack_name,
          token_count: pack.token_count,
          bonus_tokens: pack.bonus_tokens || 0,
          total_tokens: totalTokens,
          purchase_type: "TOKEN_PACK",
          custom_fields: [
            {
              display_name: "Customer",
              variable_name: "customer_name",
              value: name,
            },
            {
              display_name: "Token Pack",
              variable_name: "pack_name",
              value: `${pack.pack_name} (${totalTokens} tokens)`,
            },
            {
              display_name: "Phone",
              variable_name: "phone",
              value: phone,
            },
          ],
        },
      }),
    });

    const paystackData = await paystackResponse.json();

    if (paystackData.status && paystackData.data?.authorization_url) {
      console.log(`[TokenPurchase] ✅ Paystack initialized: ${reference} | ${pack.pack_name} | ${formatNaira(amountNgn)} | Consumer: ${consumerId}`);

      return NextResponse.json({
        success: true,
        paymentUrl: paystackData.data.authorization_url,
        reference: reference,
        accessCode: paystackData.data.access_code,
        pack: {
          name: pack.pack_name,
          tokens: totalTokens,
          price: amountNgn,
        },
      });
    }

    // Paystack rejected
    console.error(`[TokenPurchase] ❌ Paystack rejected: ${paystackData.message}`);
    // (No Token_Transactions row to mark FAILED — pending logging is disabled
    //  pending the write-path rework noted above.)

    return NextResponse.json(
      { success: false, error: paystackData.message || "Payment initialization failed" },
      { status: 400 }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Purchase failed";
    console.error("[TokenPurchase] Error:", message, error);
    return NextResponse.json(
      { success: false, error: `Purchase error: ${message}` },
      { status: 500 }
    );
  } finally {
    if (pool) {
      try { await pool.close(); } catch { /* ignore */ }
    }
  }
}

function formatNaira(amount: number): string {
  return "₦" + amount.toLocaleString("en-NG");
}
