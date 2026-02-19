// src/app/api/push/subscribe/route.ts
// Store and manage web push notification subscriptions
// POST: Subscribe | DELETE: Unsubscribe

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

// ============================================================================
// POST — Save push subscription
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    const body = await request.json();
    const { subscription } = body;

    if (!subscription?.endpoint) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const userId = (session?.user as any)?.id || "anonymous";
    const email = session?.user?.email || "";
    const endpoint = subscription.endpoint;
    const p256dh = subscription.keys?.p256dh || "";
    const auth = subscription.keys?.auth || "";
    const now = new Date().toISOString();

    // Ensure table exists
    try {
      await prisma.$executeRawUnsafe(`
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Push_Subscriptions')
        CREATE TABLE Push_Subscriptions (
          id INT IDENTITY(1,1) PRIMARY KEY,
          user_id NVARCHAR(100),
          email NVARCHAR(255),
          endpoint NVARCHAR(MAX) NOT NULL,
          p256dh NVARCHAR(500),
          auth NVARCHAR(500),
          user_agent NVARCHAR(500),
          is_active BIT DEFAULT 1,
          created_at DATETIME2(3) DEFAULT GETDATE(),
          updated_at DATETIME2(3) DEFAULT GETDATE()
        )
      `);
    } catch {
      // Table already exists
    }

    // Upsert: check if endpoint already exists
    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM Push_Subscriptions WHERE endpoint = @p1`,
      endpoint
    );

    if (existing.length > 0) {
      // Update existing
      await prisma.$executeRawUnsafe(
        `UPDATE Push_Subscriptions 
         SET p256dh = @p1, auth = @p2, user_id = @p3, email = @p4, 
             is_active = 1, updated_at = @p5
         WHERE endpoint = @p6`,
        p256dh, auth, userId, email, now, endpoint
      );
    } else {
      // Insert new
      const userAgent = request.headers.get("user-agent") || "";
      await prisma.$executeRawUnsafe(
        `INSERT INTO Push_Subscriptions (user_id, email, endpoint, p256dh, auth, user_agent, is_active, created_at, updated_at)
         VALUES (@p1, @p2, @p3, @p4, @p5, @p6, 1, @p7, @p7)`,
        userId, email, endpoint, p256dh, auth, userAgent.substring(0, 500), now
      );
    }

    console.log(`[Push] Subscription saved for ${email || userId}`);

    return NextResponse.json({
      success: true,
      message: "Push subscription saved",
    });
  } catch (error: any) {
    console.error("[Push] Subscribe error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================================================
// DELETE — Remove push subscription
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint required" }, { status: 400 });
    }

    await prisma.$executeRawUnsafe(
      `UPDATE Push_Subscriptions SET is_active = 0, updated_at = @p1 WHERE endpoint = @p2`,
      new Date().toISOString(),
      endpoint
    );

    console.log("[Push] Subscription deactivated");

    return NextResponse.json({
      success: true,
      message: "Push subscription removed",
    });
  } catch (error: any) {
    console.error("[Push] Unsubscribe error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
