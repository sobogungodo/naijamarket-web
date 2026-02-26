// src/app/api/newsletter/route.ts
// NaijaMarket Intel — Newsletter Subscription API

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Valid email required" },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Try to insert (will fail on duplicate due to unique constraint)
    try {
      await prisma.$executeRaw`
        INSERT INTO Newsletter_Subscribers (email, name, source, status, subscribed_at)
        VALUES (${cleanEmail}, ${name || null}, 'WEBSITE', 'ACTIVE', GETDATE())
      `;

      // Also log as revenue event (lead capture)
      try {
        await prisma.$executeRaw`
          INSERT INTO Revenue_Events (event_type, channel, amount_ngn, item_detail, attribution_source)
          VALUES ('SUBSCRIPTION', 'WEB', 0, 'Newsletter signup', 'ORGANIC')
        `;
      } catch { /* Revenue_Events may not exist yet */ }

      return NextResponse.json({
        success: true,
        message: "Successfully subscribed!",
      });
    } catch (err: any) {
      // Duplicate email — reactivate if previously unsubscribed
      if (err?.message?.includes("UQ_Newsletter_Email") || err?.message?.includes("duplicate")) {
        await prisma.$executeRaw`
          UPDATE Newsletter_Subscribers 
          SET status = 'ACTIVE', unsubscribed_at = NULL 
          WHERE email = ${cleanEmail}
        `;
        return NextResponse.json({
          success: true,
          message: "Welcome back! You've been re-subscribed.",
        });
      }
      throw err;
    }
  } catch (error) {
    console.error("Newsletter API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to subscribe. Please try again." },
      { status: 500 }
    );
  }
}

// GET: Admin endpoint to list subscribers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "ACTIVE";

    const subscribers: any[] = await prisma.$queryRaw`
      SELECT email, name, source, status, subscribed_at
      FROM Newsletter_Subscribers
      WHERE status = ${status}
      ORDER BY subscribed_at DESC
    `;

    return NextResponse.json({
      success: true,
      count: subscribers.length,
      subscribers,
    });
  } catch (error) {
    console.error("Newsletter GET Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch subscribers" },
      { status: 500 }
    );
  }
}
