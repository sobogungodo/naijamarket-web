// ============================================================================
// src/app/api/internal/sync-consumer/route.ts
// NaijaMarket Intel - Consumer Sync API (WhatsApp â†’ Azure SQL)
// Version: 1.0.0
// Date: 2026-02-20
//
// PURPOSE: When a consumer registers via WhatsApp (Apps Script â†’ Google Sheets),
// Apps Script calls this endpoint to create the same record in Azure SQL.
// This ensures web dashboard login works immediately after WhatsApp registration.
//
// SECURITY: Protected by INTERNAL_API_KEY (shared secret between Apps Script and Vercel)
//
// DIRECTION: Google Sheets â†’ Azure SQL (WhatsApp registration)
// COUNTERPART: register/route.ts handles Azure SQL â†’ Google Sheets (Web registration)
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { isSupabase, getSupabaseConnection } from "@/lib/db-supabase";

// ============================================================================
// CONFIGURATION
// ============================================================================

const INTERNAL_API_KEY = process.env.INTERNAL_SYNC_API_KEY || "";

const dbConfig: sql.config = {
  server: process.env.DATABASE_SERVER || "naijafood.database.windows.net",
  database: process.env.DATABASE_NAME || "naijafoodmarket-live",
  user: process.env.DATABASE_USER || "",
  password: process.env.DATABASE_PASSWORD || "",
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool: sql.ConnectionPool | null = null;

async function getPool(): Promise<sql.ConnectionPool> {
  if (isSupabase()) return (await getSupabaseConnection()) as unknown as sql.ConnectionPool;
  if (!pool || !pool.connected) {
    pool = (isSupabase() ? ((await getSupabaseConnection()) as unknown as sql.ConnectionPool) : await sql.connect(dbConfig));
  }
  return pool;
}

// ============================================================================
// TIER DEFAULTS
// ============================================================================

interface TierDefaults {
  daily_query_limit: number;
  max_markets: number;
  max_alerts: number;
}

const TIER_DEFAULTS: Record<string, TierDefaults> = {
  FREE:       { daily_query_limit: 3,   max_markets: 2,  max_alerts: 1 },
  BASIC:      { daily_query_limit: 10,  max_markets: 5,  max_alerts: 3 },
  STANDARD:   { daily_query_limit: 25,  max_markets: 10, max_alerts: 5 },
  BUSINESS:   { daily_query_limit: 100, max_markets: 50, max_alerts: 10 },
  CORPORATE:  { daily_query_limit: 500, max_markets: 226, max_alerts: 50 },
  ENTERPRISE: { daily_query_limit: -1,  max_markets: 226, max_alerts: -1 },
};

// ============================================================================
// POST - Sync Consumer from WhatsApp (Google Sheets) to Azure SQL
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // ========================================================================
    // 1. AUTHENTICATE - Internal API key check
    // ========================================================================
    const authHeader = request.headers.get("x-internal-api-key");
    
    if (!INTERNAL_API_KEY || authHeader !== INTERNAL_API_KEY) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Invalid API key" },
        { status: 401 }
      );
    }

    // ========================================================================
    // 2. PARSE & VALIDATE BODY
    // ========================================================================
    const body = await request.json();
    
    const {
      consumer_id,
      phone_number,
      first_name,
      last_name,
      gender,
      age_range,
      subscription_tier,
      preferred_language,
      registration_source = "WHATSAPP",
    } = body;

    // Required fields
    if (!consumer_id || !phone_number) {
      return NextResponse.json(
        { success: false, error: "MISSING_FIELDS", message: "consumer_id and phone_number are required" },
        { status: 400 }
      );
    }

    // ========================================================================
    // 3. CHECK IF ALREADY EXISTS (prevent duplicates)
    // ========================================================================
    const db = await getPool();
    
    const existing = await db.request()
      .input("phone", sql.NVarChar(20), phone_number)
      .query("SELECT consumer_id FROM Consumers WHERE phone_number = @phone");
    
    if (existing.recordset.length > 0) {
      // Already exists â€” update instead of fail
      const existingId = existing.recordset[0].consumer_id;
      
      await db.request()
        .input("consumer_id", sql.NVarChar(50), existingId)
        .input("first_name", sql.NVarChar(50), first_name || null)
        .input("last_name", sql.NVarChar(50), last_name || null)
        .input("full_name", sql.NVarChar(50), 
          first_name && last_name ? `${first_name} ${last_name}` : first_name || null)
        .input("updated_at", sql.DateTime2, new Date())
        .query(`
          UPDATE Consumers SET
            first_name = COALESCE(@first_name, first_name),
            last_name = COALESCE(@last_name, last_name),
            full_name = COALESCE(@full_name, full_name),
            updated_at = @updated_at
          WHERE consumer_id = @consumer_id
        `);
      
      return NextResponse.json({
        success: true,
        action: "UPDATED",
        consumer_id: existingId,
        message: "Consumer already existed, updated with WhatsApp data",
      });
    }

    // ========================================================================
    // 4. INSERT NEW CONSUMER
    // ========================================================================
    const tier = (subscription_tier || "FREE").toUpperCase();
    const tierConfig = TIER_DEFAULTS[tier] || TIER_DEFAULTS.FREE;
    const now = new Date();
    const fullName = first_name && last_name ? `${first_name} ${last_name}` : first_name || null;

    await db.request()
      .input("consumer_id", sql.NVarChar(50), consumer_id)
      .input("phone_number", sql.NVarChar(20), phone_number)
      .input("phone", sql.NVarChar(20), phone_number.replace(/^\+/, ""))
      .input("preferred_language", sql.NVarChar(50), preferred_language || "EN")
      .input("first_name", sql.NVarChar(50), first_name || null)
      .input("last_name", sql.NVarChar(50), last_name || null)
      .input("full_name", sql.NVarChar(50), fullName)
      .input("gender", sql.NVarChar(50), gender || null)
      .input("age_range", sql.NVarChar(255), age_range || null)
      .input("registration_date", sql.Date, now)
      .input("registration_source", sql.NVarChar(50), registration_source)
      .input("subscription_tier", sql.NVarChar(50), tier)
      .input("daily_query_limit", sql.Int, tierConfig.daily_query_limit)
      .input("max_markets", sql.Int, tierConfig.max_markets)
      .input("max_alerts", sql.Bit, tierConfig.max_alerts > 0 ? 1 : 0)
      .input("account_status", sql.NVarChar(50), "ACTIVE")
      .input("phone_verified", sql.Bit, 1) // WhatsApp = phone verified by default
      .input("email_verified", sql.Bit, 0)
      .input("two_factor_enabled", sql.Bit, 0)
      .input("daily_queries_used", sql.Bit, 0)
      .input("weekly_queries_used", sql.Bit, 0)
      .input("queries_today", sql.Bit, 0)
      .input("queries_this_week", sql.Bit, 0)
      .input("total_queries", sql.Int, 0)
      .input("queries_remaining", sql.Int, tierConfig.daily_query_limit)
      .input("daily_abandon_count", sql.Int, 0)
      .input("failed_login_attempts", sql.Int, 0)
      .input("created_at", sql.DateTime2, now)
      .input("updated_at", sql.DateTime2, now)
      .query(`
        INSERT INTO Consumers (
          consumer_id, phone_number, phone, preferred_language,
          first_name, last_name, full_name,
          gender, age_range,
          registration_date, registration_source,
          subscription_tier, daily_query_limit, max_markets, max_alerts,
          account_status, phone_verified, email_verified, two_factor_enabled,
          daily_queries_used, weekly_queries_used, queries_today, queries_this_week,
          total_queries, queries_remaining, daily_abandon_count, failed_login_attempts,
          created_at, updated_at
        ) VALUES (
          @consumer_id, @phone_number, @phone, @preferred_language,
          @first_name, @last_name, @full_name,
          @gender, @age_range,
          @registration_date, @registration_source,
          @subscription_tier, @daily_query_limit, @max_markets, @max_alerts,
          @account_status, @phone_verified, @email_verified, @two_factor_enabled,
          @daily_queries_used, @weekly_queries_used, @queries_today, @queries_this_week,
          @total_queries, @queries_remaining, @daily_abandon_count, @failed_login_attempts,
          @created_at, @updated_at
        )
      `);

    // ========================================================================
    // 5. ALSO INSERT INTO User_Roles (role locking)
    // ========================================================================
    const existingRole = await db.request()
      .input("phone", sql.NVarChar(20), phone_number)
      .query("SELECT phone_number FROM User_Roles WHERE phone_number = @phone");
    
    if (existingRole.recordset.length === 0) {
      await db.request()
        .input("phone", sql.NVarChar(20), phone_number)
        .input("role", sql.NVarChar(50), "CONSUMER")
        .input("status", sql.NVarChar(50), "ACTIVE")
        .input("created_at", sql.NVarChar(50), now.toISOString())
        .input("locked", sql.Bit, 1)
        .input("lock_reason", sql.NVarChar(255), "Role locked at first selection")
        .query(`
          INSERT INTO User_Roles (phone_number, role, status, created_at, locked, lock_reason)
          VALUES (@phone, @role, @status, @created_at, @locked, @lock_reason)
        `);
    }

    // ========================================================================
    // 6. RETURN SUCCESS
    // ========================================================================
    return NextResponse.json({
      success: true,
      action: "CREATED",
      consumer_id,
      phone_number,
      tier,
      message: "Consumer synced from WhatsApp to Azure SQL",
    });

  } catch (error: any) {
    console.error("[SYNC-CONSUMER] Error:", error);
    return NextResponse.json(
      { success: false, error: "SERVER_ERROR", message: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Health check / info
// ============================================================================


export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
