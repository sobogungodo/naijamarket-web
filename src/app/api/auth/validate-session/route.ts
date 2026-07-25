// src/app/api/auth/validate-session/route.ts
// NaijaMarket Intel - Session Validation API
// Version: 1.0.0
// Date: 2026-01-31
//
// PURPOSE: Validates that the user's session token matches the database
// Returns error if user logged in from another device

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

// ============================================================================
// GET - Validate current session (called by middleware)
// ============================================================================

export async function GET(request: NextRequest) {
  console.log("[VALIDATE-SESSION] Checking session validity...");

  try {
    // Get JWT token from NextAuth
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    });

    if (!token) {
      console.log("[VALIDATE-SESSION] No JWT token found");
      return NextResponse.json({
        valid: false,
        error_code: "NO_TOKEN",
        message: "Not logged in",
      }, { status: 401 });
    }

    const consumerId = token.id as string;
    const sessionToken = token.sessionToken as string;

    if (!consumerId || !sessionToken) {
      console.log("[VALIDATE-SESSION] Missing consumer_id or session_token in JWT");
      return NextResponse.json({
        valid: false,
        error_code: "INVALID_TOKEN",
        message: "Invalid session data",
      }, { status: 401 });
    }

    // Query database to validate session
    const consumers = await prisma.$queryRaw`
      SELECT 
        consumer_id,
        session_token,
        session_created_at,
        account_status,
        deleted_at,
        DATEDIFF(MINUTE, session_created_at, GETDATE()) AS session_age_minutes
      FROM Consumers
      WHERE consumer_id = ${consumerId}
    ` as any[];

    if (!consumers || consumers.length === 0) {
      console.log("[VALIDATE-SESSION] ❌ Consumer not found:", consumerId);
      return NextResponse.json({
        valid: false,
        error_code: "CONSUMER_NOT_FOUND",
        message: "User not found",
      }, { status: 401 });
    }

    const consumer = consumers[0];

    // Check account status
    if (consumer.account_status === "BLOCKED" || 
        consumer.account_status === "SUSPENDED" || 
        consumer.account_status === "BANNED") {
      console.log("[VALIDATE-SESSION] ❌ Account blocked:", consumerId);
      return NextResponse.json({
        valid: false,
        error_code: "ACCOUNT_BLOCKED",
        message: "Your account has been suspended",
      }, { status: 401 });
    }

    // Deletion arc: a soft-deleted account evicts the active session (401).
    if (consumer.deleted_at) {
      console.log("[VALIDATE-SESSION] ❌ Account deleted:", consumerId);
      return NextResponse.json({
        valid: false,
        error_code: "ACCOUNT_DELETED",
        message: "Your account has been deleted. You can restore it by signing in again within 90 days.",
      }, { status: 401 });
    }

    // Check if session token matches
    if (!consumer.session_token || consumer.session_token !== sessionToken) {
      console.log("[VALIDATE-SESSION] ❌ Session token mismatch for:", consumerId);
      console.log("[VALIDATE-SESSION] Expected:", consumer.session_token?.substring(0, 8) + "...");
      console.log("[VALIDATE-SESSION] Got:", sessionToken.substring(0, 8) + "...");
      
      return NextResponse.json({
        valid: false,
        error_code: "SESSION_INVALID",
        message: "You have been logged out because you logged in from another device. For security, only one active session is allowed at a time.",
      }, { status: 401 });
    }

    // Check session age (24-hour max)
    const sessionAgeMinutes = consumer.session_age_minutes || 0;
    if (sessionAgeMinutes > 1440) { // 24 hours
      console.log("[VALIDATE-SESSION] ❌ Session expired for:", consumerId, "Age:", sessionAgeMinutes, "minutes");
      
      // Clear expired session
      await prisma.$executeRaw`
        UPDATE Consumers
        SET session_token = NULL,
            session_created_at = NULL,
            session_ip_address = NULL,
            session_user_agent = NULL
        WHERE consumer_id = ${consumerId}
      `;
      
      return NextResponse.json({
        valid: false,
        error_code: "SESSION_EXPIRED",
        message: "Your session has expired. Please log in again.",
      }, { status: 401 });
    }

    // Update last activity timestamp
    await prisma.$executeRaw`
      UPDATE Consumers
      SET last_active_at = GETDATE()
      WHERE consumer_id = ${consumerId}
    `;

    console.log("[VALIDATE-SESSION] ✅ Session valid | Age:", sessionAgeMinutes, "min");

    return NextResponse.json({
      valid: true,
      session_age_minutes: sessionAgeMinutes,
    });

  } catch (error) {
    console.error("[VALIDATE-SESSION] ❌ Error:", error);
    return NextResponse.json({
      valid: false,
      error_code: "VALIDATION_ERROR",
      message: "Could not validate session",
    }, { status: 500 });
  }
}

// ============================================================================
// POST - Validate session with provided credentials (fallback method)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { consumer_id, session_token } = body;

    if (!consumer_id || !session_token) {
      return NextResponse.json({
        valid: false,
        error_code: "MISSING_CREDENTIALS",
        message: "Consumer ID and session token are required",
      }, { status: 400 });
    }

    const consumers = await prisma.$queryRaw`
      SELECT 
        consumer_id,
        session_token,
        session_created_at,
        account_status,
        deleted_at,
        DATEDIFF(MINUTE, session_created_at, GETDATE()) AS session_age_minutes
      FROM Consumers
      WHERE consumer_id = ${consumer_id}
    ` as any[];

    if (!consumers || consumers.length === 0) {
      return NextResponse.json({
        valid: false,
        error_code: "CONSUMER_NOT_FOUND",
        message: "User not found",
      }, { status: 401 });
    }

    const consumer = consumers[0];

    // Deletion arc: a soft-deleted account evicts the active session (401).
    if (consumer.deleted_at) {
      return NextResponse.json({
        valid: false,
        error_code: "ACCOUNT_DELETED",
        message: "Your account has been deleted. You can restore it by signing in again within 90 days.",
      }, { status: 401 });
    }

    if (!consumer.session_token || consumer.session_token !== session_token) {
      return NextResponse.json({
        valid: false,
        error_code: "SESSION_INVALID",
        message: "Session does not match",
      }, { status: 401 });
    }

    return NextResponse.json({
      valid: true,
      session_age_minutes: consumer.session_age_minutes || 0,
    });

  } catch (error) {
    console.error("[VALIDATE-SESSION] POST Error:", error);
    return NextResponse.json({
      valid: false,
      error_code: "VALIDATION_ERROR",
      message: "Could not validate session",
    }, { status: 500 });
  }
}
