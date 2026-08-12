// ============================================================================
// /api/tokens/verify/route.ts
// Verifies a Paystack token payment and credits the wallet EXACTLY ONCE.
// Idempotency key = payment_reference: purchase logs it PENDING, verify flips
// it to COMPLETED inside a transaction. A second call sees COMPLETED and skips.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { isSupabase, getSupabaseConnection } from "@/lib/db-supabase";

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

function generateTransactionId(): string {
  return `TXN-${new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 17)}`;
}

function normalizeDigits(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "234" + d.substring(1);
  if (!d.startsWith("234") && d.length <= 11) d = "234" + d;
  return d;
}

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

    // 1. Verify with Paystack
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const paystackData = await paystackRes.json();

    if (!paystackData.status || paystackData.data?.status !== "success") {
      const failReason = paystackData.data?.gateway_response || paystackData.message || "Payment not successful";
      return NextResponse.json({ success: false, error: `Payment was not successful: ${failReason}` });
    }

    const txData = paystackData.data;
    const metadata = txData.metadata || {};
    const consumerId: string | undefined = metadata.consumer_id;
    const totalTokens: number = Number(metadata.total_tokens || 0);
    const packName: string = metadata.pack_name || "Token Pack";
    const packId: string | null = metadata.pack_id || null;
    const paidAmount = Number(txData.amount || 0) / 100; // kobo -> naira

    if (!consumerId || !totalTokens) {
      return NextResponse.json({
        success: false,
        error: "Payment verified but missing token metadata. Contact support with ref: " + reference,
      });
    }

    pool = (isSupabase() ? ((await getSupabaseConnection()) as unknown as sql.ConnectionPool) : await sql.connect(sqlConfig));

    // 2. Idempotency — already credited?
    const existing = await pool.request()
      .input("payment_reference", sql.VarChar(100), reference)
      .query(`
        SELECT TOP 1 wallet_id, consumer_phone, payment_status, token_balance_before
        FROM dbo.Token_Transactions
        WHERE payment_reference = @payment_reference
        ORDER BY created_at DESC
      `);

    const pending = existing.recordset[0] || null;
    if (pending && pending.payment_status === "COMPLETED") {
      return NextResponse.json({
        success: true,
        message: "This payment has already been credited to your wallet.",
        tokensAdded: totalTokens,
        packName,
        alreadyProcessed: true,
      });
    }

    // 3. Credit path. The status-flip is the atomic gate: only the ONE call
    //    that flips PENDING->COMPLETED credits the wallet (concurrent-safe).
    if (pending && pending.wallet_id) {
      const transaction = pool.transaction();
      await transaction.begin();
      try {
        // (1) Atomic claim — row-locked; exactly one concurrent call wins.
        //     Snapshots before/after from the current wallet balance.
        const claim = await transaction.request()
          .input("payment_reference", sql.VarChar(100), reference)
          .input("amount", sql.Decimal(18, 2), paidAmount)
          .query(`
            UPDATE tt
              SET payment_status       = 'COMPLETED',
                  payment_amount       = @amount,
                  token_balance_before = w.token_balance,
                  token_balance_after  = w.token_balance + tt.tokens_amount
              OUTPUT inserted.wallet_id, inserted.token_balance_after
              FROM dbo.Token_Transactions tt
              JOIN dbo.Token_Wallets     w ON w.wallet_id = tt.wallet_id
              WHERE tt.payment_reference = @payment_reference
                AND tt.payment_status    = 'PENDING'
          `);

        if (claim.rowsAffected[0] === 1) {
          const wid = claim.recordset[0].wallet_id as string;
          const after = claim.recordset[0].token_balance_after as number;
          // (2) We won the claim — credit the wallet.
          await transaction.request()
            .input("wallet_id", sql.VarChar(50), wid)
            .input("tokens", sql.Int, totalTokens)
            .input("amount", sql.Decimal(18, 2), paidAmount)
            .query(`
              UPDATE dbo.Token_Wallets
              SET token_balance     = token_balance + @tokens,
                  total_purchased   = total_purchased + @tokens,
                  total_amount_paid = total_amount_paid + @amount,
                  last_purchase_at  = GETUTCDATE(),
                  updated_at        = GETUTCDATE()
              WHERE wallet_id = @wallet_id
            `);
          await transaction.commit();
          console.log(`[TokenVerify] 💰 ${reference} | +${totalTokens} | -> ${after} | wallet ${wid}`);
          return NextResponse.json({
            success: true,
            message: `${totalTokens} tokens have been added to your wallet!`,
            tokensAdded: totalTokens,
            packName,
            newBalance: after,
            reference,
          });
        }

        // rowsAffected === 0 → another call already claimed it (or it's a repeat).
        await transaction.commit();
        return NextResponse.json({
          success: true,
          message: "This payment has already been credited to your wallet.",
          tokensAdded: totalTokens,
          packName,
          alreadyProcessed: true,
        });
      } catch (txError) {
        await transaction.rollback();
        throw txError;
      }
    }

    // 4. Defensive fallback: no PENDING row exists (purchase never logged).
    //    Rare; the airtight closure is a filtered UNIQUE index on
    //    Token_Transactions.payment_reference. Resolve/create the wallet,
    //    then insert a COMPLETED row + credit in one transaction.
    const cr = await pool.request()
      .input("consumer_id", sql.NVarChar(50), consumerId)
      .query(`SELECT TOP 1 phone_number, phone FROM dbo.Consumers WHERE consumer_id = @consumer_id`);
    const digits = normalizeDigits(cr.recordset[0]?.phone_number || cr.recordset[0]?.phone || "");
    const consumerPhone = digits ? "+" + digits : null;
    if (!consumerPhone) {
      return NextResponse.json({ success: false, error: "Cannot resolve consumer phone for ref: " + reference }, { status: 400 });
    }
    const wr = await pool.request()
      .input("p1", sql.VarChar(30), digits)
      .input("p2", sql.VarChar(30), consumerPhone)
      .query(`SELECT TOP 1 wallet_id FROM dbo.Token_Wallets WHERE consumer_phone IN (@p1, @p2)`);
    const walletId = wr.recordset[0]?.wallet_id
      ?? `TWL-${new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14)}-${digits.slice(-4)}`;

    const transaction = pool.transaction();
    await transaction.begin();
    try {
      await transaction.request()
        .input("wallet_id", sql.VarChar(50), walletId)
        .input("consumer_phone", sql.VarChar(30), consumerPhone)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM dbo.Token_Wallets WHERE wallet_id = @wallet_id)
          INSERT INTO dbo.Token_Wallets (
            wallet_id, consumer_phone, token_balance, total_purchased, total_spent,
            total_expired, total_refunded, total_amount_paid, total_queries_made,
            wallet_status, created_at, updated_at
          ) VALUES (
            @wallet_id, @consumer_phone, 0, 0, 0, 0, 0, 0, 0, 'ACTIVE', GETUTCDATE(), GETUTCDATE()
          )
        `);

      const balRow = await transaction.request()
        .input("wallet_id", sql.VarChar(50), walletId)
        .query(`SELECT token_balance FROM dbo.Token_Wallets WHERE wallet_id = @wallet_id`);
      const before = balRow.recordset[0]?.token_balance ?? 0;
      const after = before + totalTokens;

      await transaction.request()
        .input("wallet_id", sql.VarChar(50), walletId)
        .input("tokens", sql.Int, totalTokens)
        .input("amount", sql.Decimal(18, 2), paidAmount)
        .query(`
          UPDATE dbo.Token_Wallets
          SET token_balance = token_balance + @tokens,
              total_purchased = total_purchased + @tokens,
              total_amount_paid = total_amount_paid + @amount,
              last_purchase_at = GETUTCDATE(),
              updated_at = GETUTCDATE()
          WHERE wallet_id = @wallet_id
        `);

      await transaction.request()
        .input("transaction_id", sql.VarChar(50), generateTransactionId())
        .input("wallet_id", sql.VarChar(50), walletId)
        .input("consumer_phone", sql.VarChar(30), consumerPhone)
        .input("tokens", sql.Int, totalTokens)
        .input("before", sql.Int, before)
        .input("after", sql.Int, after)
        .input("pack_id", sql.VarChar(50), packId)
        .input("payment_reference", sql.VarChar(100), reference)
        .input("amount", sql.Decimal(18, 2), paidAmount)
        .input("description", sql.NVarChar(400), `Token purchase: ${packName} (${totalTokens} tokens)`)
        .query(`
          INSERT INTO dbo.Token_Transactions (
            transaction_id, wallet_id, consumer_phone, transaction_type,
            tokens_amount, token_balance_before, token_balance_after,
            pack_id, payment_reference, payment_provider, payment_amount,
            payment_status, description, channel, created_at
          ) VALUES (
            @transaction_id, @wallet_id, @consumer_phone, 'PURCHASE',
            @tokens, @before, @after,
            @pack_id, @payment_reference, 'PAYSTACK', @amount,
            'COMPLETED', @description, 'WEB', GETUTCDATE()
          )
        `);

      await transaction.commit();
      console.log(`[TokenVerify] 💰 (fallback) ${reference} | +${totalTokens} | ${before}->${after} | wallet ${walletId}`);
      return NextResponse.json({
        success: true,
        message: `${totalTokens} tokens have been added to your wallet!`,
        tokensAdded: totalTokens,
        packName,
        newBalance: after,
        reference,
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
