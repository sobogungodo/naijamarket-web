// src/app/api/auth/logout/route.ts
// NaijaMarket Intel - Logout API
// Version: 1.0.0
// Date: 2026-01-31
//
// PURPOSE: Clears session from database and logs the logout event

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

// ============================================================================
// POST - Logout user and clear session
// ============================================================================

export async function POST(request: NextRequest) {
  console.log("[LOGOUT] Processing logout request...");

  try {
    // Get JWT token to identify user
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    });

    if (token && token.id && token.sessionToken) {
      const consumerId = token.id as string;
      const sessionToken = token.sessionToken as string;

      // Log to session history (if table exists)
      try {
        await prisma.$executeRaw`
          INSERT INTO Consumer_Session_History 
            (consumer_id, phone_number, session_token, login_at, logout_at, logout_reason)
          SELECT 
            consumer_id, 
            phone_number,
            session_token, 
            session_created_at, 
            GETDATE(),
            'MANUAL'
          FROM Consumers 
          WHERE consumer_id = ${consumerId}
            AND session_token = ${sessionToken}
        `;
      } catch (historyError) {
        // History table might not exist yet, that's okay
        console.log("[LOGOUT] Session history logging skipped");
      }

      // Clear session from Consumers table
      await prisma.$executeRaw`
        UPDATE Consumers
        SET session_token = NULL,
            session_created_at = NULL,
            session_ip_address = NULL,
            session_user_agent = NULL
        WHERE consumer_id = ${consumerId}
      `;

      console.log("[LOGOUT] ✅ Session cleared for consumer:", consumerId);
    } else {
      console.log("[LOGOUT] No active session to clear");
    }

    // Return success response
    // Note: The actual NextAuth session is cleared by calling signOut() on the client
    return NextResponse.json({ 
      success: true, 
      message: "Logged out successfully" 
    });

  } catch (error) {
    console.error("[LOGOUT] ❌ Error:", error);
    
    // Still return success - we don't want to block logout due to DB issues
    return NextResponse.json({ 
      success: true, 
      message: "Logged out" 
    });
  }
}
