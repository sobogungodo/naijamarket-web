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
        { success: false, error: "Payment system is not configured. Please contact support." },
        { status: 500 }
      );
    }

    // 1. Get pack details from database
    pool = await sql.connect(sqlConfig);

    const packResult = await pool.request()
      .input("pack_id", sql.Int, packId)
      .query(`
        SELECT pack_id, pack_name, token_count, price_ngn, bonus_tokens, is_active
        FROM dbo.Token_Packs
        WHERE pack_id = @pack_id AND is_active = 1
      `);

    if (packResult.recordset.length === 0) {
      return NextResponse.json(
        { success: false, error: "Token pack not found or inactive" },
        { status: 404 }
      );
    }

    const pack = packResult.recordset[0];

    // 2. Get consumer details (need email/phone for Paystack)
    const consumerResult = await pool.request()
      .input("consumer_id", sql.NVarChar(50), consumerId)
      .query(`
        SELECT consumer_id, phone_number, email, full_name
        FROM dbo.Consumers
        WHERE consumer_id = @consumer_id
      `);

    const consumer = consumerResult.recordset[0];
    const email = consumer?.email || `${consumerId}@naijamarketintel.ng`;
    const phone = consumer?.phone_number || "";
    const name = consumer?.full_name || "Customer";

    // 3. Generate payment reference
    const reference = generateReference();
    const amountNgn = pack.price_ngn;
    const totalTokens = (pack.token_count || 0) + (pack.bonus_tokens || 0);

    // 4. Log pending transaction in database
    await pool.request()
      .input("consumer_id", sql.NVarChar(50), consumerId)
      .input("transaction_type", sql.NVarChar(20), "PURCHASE")
      .input("token_amount", sql.Int, totalTokens)
      .input("description", sql.NVarChar(200), `Purchase: ${pack.pack_name} (${pack.token_count}+${pack.bonus_tokens || 0} tokens)`)
      .input("reference_id", sql.NVarChar(100), reference)
      .input("payment_amount", sql.Decimal(18, 2), amountNgn)
      .input("payment_currency", sql.NVarChar(3), "NGN")
      .input("payment_provider", sql.NVarChar(20), "PAYSTACK")
      .input("payment_status", sql.NVarChar(20), "PENDING")
      .query(`
        INSERT INTO dbo.Token_Transactions 
          (consumer_id, transaction_type, token_amount, description, reference_id, 
           payment_amount, payment_currency, payment_provider, payment_status)
        VALUES 
          (@consumer_id, @transaction_type, @token_amount, @description, @reference_id,
           @payment_amount, @payment_currency, @payment_provider, @payment_status)
      `);

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

    // Update transaction as failed
    await pool.request()
      .input("reference_id", sql.NVarChar(100), reference)
      .query(`
        UPDATE dbo.Token_Transactions
        SET payment_status = 'FAILED', description = description + ' [Paystack: ' + '${(paystackData.message || "unknown error").replace(/'/g, "''")}' + ']'
        WHERE reference_id = @reference_id
      `);

    return NextResponse.json(
      { success: false, error: paystackData.message || "Payment initialization failed" },
      { status: 400 }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Purchase failed";
    console.error("[TokenPurchase] Error:", message);
    return NextResponse.json(
      { success: false, error: "Unable to process purchase. Please try again." },
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
