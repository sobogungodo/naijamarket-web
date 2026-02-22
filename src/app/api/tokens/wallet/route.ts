// ============================================================================
// /api/tokens/wallet/route.ts
// Token Wallet API - Fetches wallet balance, packs, and transaction history
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const consumerId = searchParams.get("consumerId");

    if (!consumerId) {
      return NextResponse.json(
        { success: false, error: "Consumer ID is required" },
        { status: 400 }
      );
    }

    let pool: sql.ConnectionPool | null = null;

    try {
      pool = await sql.connect(sqlConfig);

      // 1. Get wallet balance
      const walletResult = await pool.request()
        .input("consumer_id", sql.NVarChar(50), consumerId)
        .query(`
          SELECT 
            wallet_id,
            consumer_id,
            token_balance,
            total_purchased,
            total_used,
            total_expired,
            welcome_bonus_claimed,
            created_at,
            updated_at
          FROM dbo.Token_Wallets
          WHERE consumer_id = @consumer_id
        `);

      // 2. Get available token packs
      const packsResult = await pool.request()
        .query(`
          SELECT 
            pack_id,
            pack_name,
            token_count,
            price_ngn,
            bonus_tokens,
            savings_percent,
            is_popular,
            is_active,
            description
          FROM dbo.Token_Packs
          WHERE is_active = 1
          ORDER BY price_ngn ASC
        `);

      // 3. Get recent transactions (last 50)
      const txResult = await pool.request()
        .input("consumer_id", sql.NVarChar(50), consumerId)
        .query(`
          SELECT TOP 50
            transaction_id,
            consumer_id,
            transaction_type,
            token_amount,
            description,
            reference_id,
            payment_amount,
            payment_currency,
            payment_provider,
            payment_status,
            created_at
          FROM dbo.Token_Transactions
          WHERE consumer_id = @consumer_id
          ORDER BY created_at DESC
        `);

      // Build wallet data (create default if not exists)
      let wallet = walletResult.recordset[0] || null;

      if (!wallet) {
        // Auto-create wallet with welcome bonus
        await pool.request()
          .input("consumer_id", sql.NVarChar(50), consumerId)
          .query(`
            INSERT INTO dbo.Token_Wallets (consumer_id, token_balance, total_purchased, total_used, total_expired, welcome_bonus_claimed)
            VALUES (@consumer_id, 3, 3, 0, 0, 1)
          `);

        // Log the welcome bonus transaction
        await pool.request()
          .input("consumer_id", sql.NVarChar(50), consumerId)
          .query(`
            INSERT INTO dbo.Token_Transactions (consumer_id, transaction_type, token_amount, description, payment_status)
            VALUES (@consumer_id, 'WELCOME_BONUS', 3, 'Welcome bonus - 3 free tokens!', 'COMPLETED')
          `);

        wallet = {
          consumer_id: consumerId,
          token_balance: 3,
          total_purchased: 3,
          total_used: 0,
          total_expired: 0,
          welcome_bonus_claimed: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      return NextResponse.json({
        success: true,
        wallet: {
          balance: wallet.token_balance ?? 0,
          totalPurchased: wallet.total_purchased ?? 0,
          totalUsed: wallet.total_used ?? 0,
          totalExpired: wallet.total_expired ?? 0,
          welcomeBonusClaimed: wallet.welcome_bonus_claimed ?? false,
          createdAt: wallet.created_at,
          updatedAt: wallet.updated_at,
        },
        packs: packsResult.recordset.map((p: Record<string, unknown>) => ({
          id: p.pack_id,
          name: p.pack_name,
          tokens: p.token_count,
          price: p.price_ngn,
          bonus: p.bonus_tokens ?? 0,
          savings: p.savings_percent ?? 0,
          isPopular: p.is_popular ?? false,
          description: p.description ?? "",
        })),
        transactions: txResult.recordset.map((t: Record<string, unknown>) => ({
          id: t.transaction_id,
          type: t.transaction_type,
          amount: t.token_amount,
          description: t.description,
          reference: t.reference_id,
          paymentAmount: t.payment_amount,
          paymentStatus: t.payment_status,
          createdAt: t.created_at,
        })),
        source: "database",
      });
    } finally {
      if (pool) {
        try { await pool.close(); } catch { /* ignore */ }
      }
    }
  } catch (error: unknown) {
    console.error("Token Wallet API Error:", error);

    // Return demo data on error so page doesn't hang
    return NextResponse.json({
      success: true,
      wallet: {
        balance: 3,
        totalPurchased: 3,
        totalUsed: 0,
        totalExpired: 0,
        welcomeBonusClaimed: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      packs: [
        { id: 1, name: "Starter", tokens: 5, price: 250, bonus: 0, savings: 0, isPopular: false, description: "5 queries" },
        { id: 2, name: "Basic", tokens: 15, price: 600, bonus: 2, savings: 20, isPopular: true, description: "15 + 2 bonus queries" },
        { id: 3, name: "Value", tokens: 30, price: 1000, bonus: 5, savings: 30, isPopular: false, description: "30 + 5 bonus queries" },
        { id: 4, name: "Pro", tokens: 75, price: 2000, bonus: 15, savings: 40, isPopular: false, description: "75 + 15 bonus queries" },
      ],
      transactions: [
        { id: 1, type: "WELCOME_BONUS", amount: 3, description: "Welcome bonus - 3 free tokens!", reference: null, paymentAmount: null, paymentStatus: "COMPLETED", createdAt: new Date().toISOString() },
      ],
      source: "demo",
    });
  }
}
