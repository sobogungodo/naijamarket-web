// src/app/api/push/send/route.ts
// Send push notifications to subscribed users
// POST: { userId?, title, body, url?, tag? }
// Called by alert processor when price alerts trigger

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import webpush from "web-push";

// ============================================================================
// VAPID Configuration
// ============================================================================

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:olawale.sobogungod@giggabytes.eu";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

// ============================================================================
// POST — Send push notification
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Optional auth check
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      const { searchParams } = new URL(request.url);
      if (!searchParams.get("test")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return NextResponse.json({ 
        error: "VAPID keys not configured",
        hint: "Run: npx web-push generate-vapid-keys and set NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY in Vercel"
      }, { status: 500 });
    }

    const body = await request.json();
    const { userId, email, title, body: msgBody, url, tag, icon } = body;

    // Build query to find subscriptions
    let subscriptions: any[] = [];

    if (email) {
      subscriptions = await prisma.$queryRawUnsafe<any[]>(
        `SELECT endpoint, p256dh, auth FROM Push_Subscriptions WHERE email = @p1 AND is_active = 1`,
        email
      );
    } else if (userId) {
      subscriptions = await prisma.$queryRawUnsafe<any[]>(
        `SELECT endpoint, p256dh, auth FROM Push_Subscriptions WHERE user_id = @p1 AND is_active = 1`,
        userId
      );
    } else {
      // Send to all active subscriptions (broadcast)
      subscriptions = await prisma.$queryRawUnsafe<any[]>(
        `SELECT endpoint, p256dh, auth FROM Push_Subscriptions WHERE is_active = 1`
      );
    }

    if (subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active push subscriptions found",
        sent: 0,
      });
    }

    // Build notification payload
    const payload = JSON.stringify({
      title: title || "NaijaMarket Intel",
      body: msgBody || "You have a new notification",
      icon: icon || "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
      url: url || "/dashboard/price-alerts",
      tag: tag || "general",
    });

    // Send to all matching subscriptions
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    await Promise.allSettled(
      subscriptions.map(async (sub: any) => {
        try {
          const pushSub = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          };

          await webpush.sendNotification(pushSub, payload);
          sent++;
        } catch (err: any) {
          failed++;
          // If subscription expired or invalid, deactivate it
          if (err.statusCode === 404 || err.statusCode === 410) {
            await prisma.$executeRawUnsafe(
              `UPDATE Push_Subscriptions SET is_active = 0, updated_at = @p1 WHERE endpoint = @p2`,
              new Date().toISOString(),
              sub.endpoint
            ).catch(() => {});
            errors.push(`Expired subscription deactivated`);
          } else {
            errors.push(`Send failed: ${err.message?.substring(0, 80)}`);
          }
        }
      })
    );

    console.log(`[Push] Sent: ${sent}, Failed: ${failed}, Total: ${subscriptions.length}`);

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: subscriptions.length,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
    });
  } catch (error: any) {
    console.error("[Push] Send error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
