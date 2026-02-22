// ============================================================================
// /api/tokens/verify/route.ts
// Token Payment Verification - Verifies Paystack payment and credits tokens
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "";

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

export async function POST(request: NextRequest) {
  let pool: sql.ConnectionPool | null = null;

  try {
    const body = await request.json();
    const { reference } = body;

    if (!reference) {
      return NextResponse.json(
        { success: false, error: "Payment reference is required" },
        { status: 400 }
      );
    }

    // 1. Verify with Paystack API
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status || paystackData.data?.status !== "success") {
      const failReason = paystackData.data?.gateway_response || paystackData.message || "Payment not successful";
      console.log(`[TokenVerify] ❌ Payment not successful: ${reference} | ${failReason}`);

      return NextResponse.json({
        success: false,
        error: `Payment was not successful: ${failReason}`,
      });
    }

    // Payment verified ✅
    const txData = paystackData.data;
    const metadata = txData.metadata || {};
    const consumerId = metadata.consumer_id;
    const totalTokens = metadata.total_tokens || 0;
    const packName = metadata.pack_name || "Token Pack";

    console.log(`[TokenVerify] ✅ Paystack confirmed: ${reference} | ₦${txData.amount / 100} | ${totalTokens} tokens | Consumer: ${consumerId}`);

    if (!consumerId || !totalTokens) {
      return NextResponse.json({
        success: false,
        error: "Payment verified but missing token metadata. Contact support with ref: " + reference,
      });
    }

    // 2. Connect to database
    pool = await sql.connect(sqlConfig);

    // 3. Check if already processed (idempotency)
    const existingResult = await pool.request()
      .input("reference_id", sql.NVarChar(100), reference)
      .query(`
        SELECT payment_status FROM dbo.Token_Transactions
        WHERE reference_id = @reference_id
      `);

    if (existingResult.recordset.length > 0 && existingResult.recordset[0].payment_status === "COMPLETED") {
      console.log(`[TokenVerify] ⚠️ Already processed: ${reference}`);
      return NextResponse.json({
        success: true,
        message: "This payment has already been credited to your wallet.",
        tokensAdded: totalTokens,
        packName: packName,
        alreadyProcessed: true,
      });
    }

    // 4. Credit tokens to wallet (use transaction for atomicity)
    const transaction = pool.transaction();
    await transaction.begin();

    try {
      // Update or create wallet
      const walletCheck = await transaction.request()
        .input("consumer_id", sql.NVarChar(50), consumerId)
        .query(`SELECT wallet_id, token_balance FROM dbo.Token_Wallets WHERE consumer_id = @consumer_id`);

      if (walletCheck.recordset.length > 0) {
        // Update existing wallet
        await transaction.request()
          .input("consumer_id", sql.NVarChar(50), consumerId)
          .input("tokens", sql.Int, totalTokens)
          .query(`
            UPDATE dbo.Token_Wallets
            SET token_balance = token_balance + @tokens,
                total_purchased = total_purchased + @tokens,
                updated_at = GETUTCDATE()
            WHERE consumer_id = @consumer_id
          `);
      } else {
        // Create new wallet with tokens
        await transaction.request()
          .input("consumer_id", sql.NVarChar(50), consumerId)
          .input("tokens", sql.Int, totalTokens)
          .query(`
            INSERT INTO dbo.Token_Wallets (consumer_id, token_balance, total_purchased, total_used, total_expired, welcome_bonus_claimed)
            VALUES (@consumer_id, @tokens, @tokens, 0, 0, 0)
          `);
      }

      // Update transaction status to COMPLETED
      await transaction.request()
        .input("reference_id", sql.NVarChar(100), reference)
        .query(`
          UPDATE dbo.Token_Transactions
          SET payment_status = 'COMPLETED'
          WHERE reference_id = @reference_id
        `);

      await transaction.commit();

      const newBalance = (walletCheck.recordset[0]?.token_balance ?? 0) + totalTokens;

      console.log(`[TokenVerify] 💰 Tokens credited: ${reference} | +${totalTokens} tokens | New balance: ${newBalance} | Consumer: ${consumerId}`);

      return NextResponse.json({
        success: true,
        message: `${totalTokens} tokens have been added to your wallet!`,
        tokensAdded: totalTokens,
        packName: packName,
        newBalance: newBalance,
        reference: reference,
      });

    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Verification failed";
    console.error("[TokenVerify] Error:", message);
    return NextResponse.json(
      { success: false, error: "Payment verification failed. If you were charged, tokens will be credited within 15 minutes." },
      { status: 500 }
    );
  } finally {
    if (pool) {
      try { await pool.close(); } catch { /* ignore */ }
    }
  }
}
