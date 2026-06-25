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
    const phoneParam = searchParams.get("phone"); // optional direct phone

    if (!consumerId && !phoneParam) {
      return NextResponse.json(
        { success: false, error: "consumerId or phone is required" },
        { status: 400 }
      );
    }

    let pool: sql.ConnectionPool | null = null;

    try {
      pool = await sql.connect(sqlConfig);

      // Resolve the wallet key — Token_* tables are keyed by consumer_phone.
      let phone = (phoneParam || "").replace(/\D/g, "");
      if (!phone && consumerId) {
        const cr = await pool.request()
          .input("cid", sql.NVarChar(50), consumerId)
          .query(`SELECT TOP 1 phone_number, phone FROM dbo.Consumers WHERE consumer_id = @cid`);
        const raw = cr.recordset[0]?.phone_number || cr.recordset[0]?.phone || "";
        phone = String(raw).replace(/\D/g, "");
      }
      const p1 = phone;
      const p2 = "+" + phone;

      // 1. Wallet (keyed by consumer_phone)
      const walletResult = await pool.request()
        .input("p1", sql.NVarChar(30), p1)
        .input("p2", sql.NVarChar(30), p2)
        .query(`
          SELECT TOP 1
            wallet_id, consumer_phone, token_balance, total_purchased,
            total_spent, total_expired, total_amount_paid, total_queries_made,
            wallet_status, created_at, updated_at
          FROM dbo.Token_Wallets
          WHERE consumer_phone IN (@p1, @p2)
        `);

      // 2. Active token packs (real columns; hide the PROMO_FREE welcome bonus)
      const packsResult = await pool.request()
        .query(`
          SELECT
            pack_id, pack_name, display_name, tokens, price_naira, bonus_tokens,
            savings_percent, is_popular, description_en
          FROM dbo.Token_Packs
          WHERE is_active = 1 AND pack_id <> 'PROMO_FREE'
          ORDER BY sort_order ASC, price_naira ASC
        `);

      // 3. Recent transactions (keyed by consumer_phone)
      const txResult = await pool.request()
        .input("p1", sql.NVarChar(30), p1)
        .input("p2", sql.NVarChar(30), p2)
        .query(`
          SELECT TOP 50
            transaction_id, transaction_type, tokens_amount, description,
            payment_reference, payment_amount, payment_status, created_at
          FROM dbo.Token_Transactions
          WHERE consumer_phone IN (@p1, @p2)
          ORDER BY created_at DESC
        `);

      // No auto-create against the real schema (wallet_id is a required varchar PK).
      // A missing wallet simply means a zero balance.
      const wallet = walletResult.recordset[0] || null;

      return NextResponse.json({
        success: true,
        wallet: {
          balance: wallet?.token_balance ?? 0,
          totalPurchased: wallet?.total_purchased ?? 0,
          totalUsed: wallet?.total_spent ?? 0,
          totalExpired: wallet?.total_expired ?? 0,
          welcomeBonusClaimed: true,
          createdAt: wallet?.created_at ?? null,
          updatedAt: wallet?.updated_at ?? null,
        },
        packs: packsResult.recordset.map((p: Record<string, unknown>) => ({
          id: p.pack_id,
          name: p.pack_name,
          tokens: p.tokens,
          price: Number(p.price_naira),
          bonus: p.bonus_tokens ?? 0,
          savings: p.savings_percent ?? 0,
          isPopular: !!p.is_popular,
          description: p.description_en ?? "",
        })),
        transactions: txResult.recordset.map((t: Record<string, unknown>) => ({
          id: t.transaction_id,
          type: t.transaction_type,
          amount: t.tokens_amount,
          description: t.description,
          reference: t.payment_reference,
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
