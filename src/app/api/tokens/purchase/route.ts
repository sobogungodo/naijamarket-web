// ============================================================================
// /api/tokens/purchase/route.ts
// Token Purchase - creates a PENDING Token_Transactions row, then initiates
// the Paystack payment. The PENDING row is the idempotency key that
// /api/tokens/verify flips to COMPLETED exactly once (no double-credit).
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";

// Paystack config
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "";
const BASE_URL = process.env.NEXTAUTH_URL || "https://www.naijamarketintel.com";

// Azure SQL config (connects as AZURE_SQL_USER = naijaapp)
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

// Payment reference: TKN-YYYYMMDDHHMMSS-XXXXXX
function generateReference(): string {
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TKN-${stamp}-${random}`;
}

// wallet_id: TWL-YYYYMMDDHHMMSS-<last4 of phone>  (matches existing rows)
function generateWalletId(digits: string): string {
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  return `TWL-${stamp}-${digits.slice(-4)}`;
}

// transaction_id: TXN-YYYYMMDDHHMMSSfff  (ms precision, matches existing rows)
function generateTransactionId(): string {
  return `TXN-${new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 17)}`;
}

// Normalise a Nigerian phone to E.164 digits (2348…) — Token_* tables key on
// consumer_phone stored as +234…, so we match on both and store the + form.
function normalizeDigits(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "234" + d.substring(1);
  if (!d.startsWith("234") && d.length <= 11) d = "234" + d;
  return d;
}

function formatNaira(amount: number): string {
  return "₦" + amount.toLocaleString("en-NG");
}

export async function POST(request: NextRequest) {
  let pool: sql.ConnectionPool | null = null;

  try {
    const body = await request.json();
    const { consumerId, packId, source } = body;

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

    pool = await sql.connect(sqlConfig);

    // 1. Pack
    const packResult = await pool.request()
      .input("pack_id", sql.VarChar(50), packId)
      .query(`
        SELECT pack_id, pack_name, tokens, price_naira, bonus_tokens, is_active
        FROM dbo.Token_Packs
        WHERE pack_id = @pack_id AND is_active = 1
      `);

    if (packResult.recordset.length === 0) {
      return NextResponse.json(
        { success: false, error: `Token pack ${packId} not found or inactive.` },
        { status: 404 }
      );
    }
    const pack = packResult.recordset[0];

    // 2. Consumer (email/phone/name for Paystack + wallet key)
    const consumerResult = await pool.request()
      .input("consumer_id", sql.NVarChar(50), consumerId)
      .query(`
        SELECT consumer_id, phone_number, phone, email, full_name
        FROM dbo.Consumers
        WHERE consumer_id = @consumer_id
      `);
    const consumer = consumerResult.recordset[0];
    const email = consumer?.email || `${consumerId}@naijamarketintel.com`;
    const name = consumer?.full_name || "Customer";
    const rawPhone = consumer?.phone_number || consumer?.phone || "";
    const digits = normalizeDigits(rawPhone);
    const phonePlus = digits ? "+" + digits : "";

    if (!phonePlus) {
      return NextResponse.json(
        { success: false, error: "Consumer has no phone number on file; cannot open a token wallet." },
        { status: 400 }
      );
    }

    // 3. Amounts + reference
    const reference = generateReference();
    const amountNgn = Number(pack.price_naira);
    const totalTokens = (pack.tokens || 0) + (pack.bonus_tokens || 0);

    // 4. Get-or-create the wallet (wallet_id is a required NOT-NULL PK, so it
    //    must exist before we can log a Token_Transactions row against it).
    const walletResult = await pool.request()
      .input("p1", sql.VarChar(30), digits)
      .input("p2", sql.VarChar(30), phonePlus)
      .query(`
        SELECT TOP 1 wallet_id, token_balance
        FROM dbo.Token_Wallets
        WHERE consumer_phone IN (@p1, @p2)
      `);

    let walletId: string;
    let balance: number;
    if (walletResult.recordset.length > 0) {
      walletId = walletResult.recordset[0].wallet_id;
      balance = walletResult.recordset[0].token_balance ?? 0;
    } else {
      walletId = generateWalletId(digits);
      balance = 0;
      await pool.request()
        .input("wallet_id", sql.VarChar(50), walletId)
        .input("consumer_phone", sql.VarChar(30), phonePlus)
        .input("consumer_name", sql.NVarChar(200), name)
        .query(`
          INSERT INTO dbo.Token_Wallets (
            wallet_id, consumer_phone, consumer_name,
            token_balance, total_purchased, total_spent, total_expired,
            total_refunded, total_amount_paid, total_queries_made,
            wallet_status, created_at, updated_at
          ) VALUES (
            @wallet_id, @consumer_phone, @consumer_name,
            0, 0, 0, 0,
            0, 0, 0,
            'ACTIVE', GETUTCDATE(), GETUTCDATE()
          )
        `);
    }

    // 5. Log the PENDING purchase transaction (idempotency key = payment_reference).
    const transactionId = generateTransactionId();
    await pool.request()
      .input("transaction_id", sql.VarChar(50), transactionId)
      .input("wallet_id", sql.VarChar(50), walletId)
      .input("consumer_phone", sql.VarChar(30), phonePlus)
      .input("tokens_amount", sql.Int, totalTokens)
      .input("balance", sql.Int, balance)
      .input("pack_id", sql.VarChar(50), pack.pack_id)
      .input("payment_reference", sql.VarChar(100), reference)
      .input("payment_amount", sql.Decimal(18, 2), amountNgn)
      .input("description", sql.NVarChar(400), `Token purchase: ${pack.pack_name} (${totalTokens} tokens)`)
      .query(`
        INSERT INTO dbo.Token_Transactions (
          transaction_id, wallet_id, consumer_phone, transaction_type,
          tokens_amount, token_balance_before, token_balance_after,
          pack_id, payment_reference, payment_provider, payment_amount,
          payment_status, description, channel, created_at
        ) VALUES (
          @transaction_id, @wallet_id, @consumer_phone, 'PURCHASE',
          @tokens_amount, @balance, @balance,
          @pack_id, @payment_reference, 'PAYSTACK', @payment_amount,
          'PENDING', @description, 'WEB', GETUTCDATE()
        )
      `);

    // 6. Initialise Paystack
    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amountNgn * 100), // kobo
        reference,
        callback_url: source === 'app'
          ? `${BASE_URL}/api/tokens/app-callback?ref=${reference}`
          : `${BASE_URL}/dashboard/tokens/callback?ref=${reference}`,
        channels: ["card", "bank", "ussd", "bank_transfer"],
        metadata: {
          consumer_id: consumerId,
          pack_id: packId,
          pack_name: pack.pack_name,
          token_count: pack.tokens,
          bonus_tokens: pack.bonus_tokens || 0,
          total_tokens: totalTokens,
          purchase_type: "TOKEN_PACK",
          custom_fields: [
            { display_name: "Customer", variable_name: "customer_name", value: name },
            { display_name: "Token Pack", variable_name: "pack_name", value: `${pack.pack_name} (${totalTokens} tokens)` },
            { display_name: "Phone", variable_name: "phone", value: phonePlus },
          ],
        },
      }),
    });

    const paystackData = await paystackResponse.json();

    if (paystackData.status && paystackData.data?.authorization_url) {
      console.log(`[TokenPurchase] ✅ ${reference} | ${pack.pack_name} | ${formatNaira(amountNgn)} | wallet ${walletId}`);
      return NextResponse.json({
        success: true,
        paymentUrl: paystackData.data.authorization_url,
        reference,
        accessCode: paystackData.data.access_code,
        pack: { name: pack.pack_name, tokens: totalTokens, price: amountNgn },
      });
    }

    // Paystack rejected — mark the PENDING row FAILED so it can't be redeemed.
    console.error(`[TokenPurchase] ❌ Paystack rejected: ${paystackData.message}`);
    try {
      await pool.request()
        .input("payment_reference", sql.VarChar(100), reference)
        .query(`
          UPDATE dbo.Token_Transactions
          SET payment_status = 'FAILED'
          WHERE payment_reference = @payment_reference AND payment_status = 'PENDING'
        `);
    } catch { /* non-blocking */ }

    return NextResponse.json(
      { success: false, error: paystackData.message || "Payment initialization failed" },
      { status: 400 }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Purchase failed";
    console.error("[TokenPurchase] Error:", message);
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
