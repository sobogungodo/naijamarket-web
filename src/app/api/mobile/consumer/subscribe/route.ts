// src/app/api/mobile/consumer/subscribe/route.ts
// Mobile subscription payment init for the consumer app's native /plans picker.
// Under /api/mobile → middleware-exempt; we verify the consumer Bearer JWT and
// take phone/consumer_id FROM THE TOKEN (not the body) so a caller can only pay
// for their own account. Tier price is read from dbo.Subscription_Tiers
// (canonical). Mirrors /api/subscribe's Paystack init incl. metadata.source='app'
// and the /subscribe/callback callback_url (which deep-links back to the app).

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "";
const BASE_URL = process.env.NEXTAUTH_URL || "https://naijamarket-web.vercel.app";

// Higher number = higher tier (matches /api/subscribe/verify). A requested tier
// with a LOWER rank than the caller's active tier is a downgrade.
const TIER_RANK: Record<string, number> = {
  FREE: 0, SILVER: 1, GOLD: 2, BUSINESS: 3, CORPORATE: 4, ENTERPRISE: 5,
};

interface ConsumerClaims { consumer_id?: string; phone_number?: string; session_token?: string }

async function verifyConsumer(req: NextRequest): Promise<ConsumerClaims | null> {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const secret = process.env.CONSUMER_JWT_SECRET;
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(auth.slice(7), new TextEncoder().encode(secret));
    return payload as ConsumerClaims;
  } catch {
    return null;
  }
}

// PAY-YYYYMMDDHHMMSS-XXXXXX
function generateReference(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PAY-${ts}-${rand}`;
}

export async function POST(req: NextRequest) {
  const consumer = await verifyConsumer(req);
  if (!consumer?.consumer_id) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Single-session check: a payment init must come from the CURRENT session.
  // The 30-day mobile JWT stays signature-valid after a login elsewhere rotates
  // Consumers.session_token — compare the claim against the row and reject
  // stale/absent tokens (closes the mobile-lane hole for subscribe).
  try {
    const sessRows = (await prisma.$queryRaw`
      SELECT session_token FROM dbo.Consumers WHERE consumer_id = ${consumer.consumer_id}
    `) as Array<{ session_token: string | null }>;
    const dbToken = sessRows?.[0]?.session_token ?? null;
    if (!consumer.session_token || !dbToken || consumer.session_token !== dbToken) {
      return NextResponse.json(
        { success: false, error: "SESSION_INVALIDATED", message: "Please log in again to continue." },
        { status: 401 }
      );
    }
  } catch (error: any) {
    console.error("[mobile/consumer/subscribe] session check failed", error?.message);
    return NextResponse.json({ success: false, error: "Payment init failed" }, { status: 500 });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const tierKey = String(body.tier || "").toUpperCase();
  if (!tierKey) {
    return NextResponse.json({ success: false, error: "Missing tier" }, { status: 400 });
  }
  if (!PAYSTACK_SECRET_KEY) {
    return NextResponse.json({ success: false, error: "Payments not configured" }, { status: 500 });
  }

  try {
    // Canonical price/name from Subscription_Tiers.
    const rows = (await prisma.$queryRaw`
      SELECT tier_id, tier_name, price_ngn, billing_cycle
      FROM dbo.Subscription_Tiers
      WHERE tier_id = ${tierKey}
    `) as Array<{ tier_id: string; tier_name: string; price_ngn: number | string; billing_cycle: string | null }>;

    const tier = rows?.[0];
    if (!tier) {
      return NextResponse.json({ success: false, error: `Invalid tier: ${tierKey}` }, { status: 400 });
    }
    const amount = Number(tier.price_ngn) || 0;
    if (amount <= 0) {
      return NextResponse.json({ success: false, error: "Cannot pay for the FREE tier" }, { status: 400 });
    }

    // Downgrade guard: don't charge for a tier LOWER than the caller's active
    // one — verify would refuse to apply it, leaving the user charged with no
    // refund. Downgrades happen automatically (a plan lapses at its end date).
    const curRows = (await prisma.$queryRaw`
      SELECT subscription_tier, subscription_end_date
      FROM dbo.Consumers WHERE consumer_id = ${consumer.consumer_id}
    `) as Array<{ subscription_tier: string | null; subscription_end_date: Date | string | null }>;
    const curTier = String(curRows?.[0]?.subscription_tier || "FREE").toUpperCase();
    const curEnd = curRows?.[0]?.subscription_end_date;
    const stillValid = !curEnd || new Date(curEnd as any) >= new Date();
    if (curTier !== "FREE" && stillValid && (TIER_RANK[tierKey] ?? 0) < (TIER_RANK[curTier] ?? 0)) {
      return NextResponse.json(
        { success: false, error: `You're already on the ${curTier} plan — a lower plan can't be applied while it's active, so you won't be charged.` },
        { status: 409 }
      );
    }

    // Identity comes from the verified token, not the client body.
    const phone = String(consumer.phone_number || "");
    const consumerId = String(consumer.consumer_id);
    const email = body.email || (phone ? `${phone.replace(/\+/g, "")}@naijamarket.ng` : "customer@naijamarket.ng");
    const reference = generateReference();

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        amount: amount * 100, // kobo
        reference,
        callback_url: `${BASE_URL}/subscribe/callback?provider=paystack&ref=${reference}`,
        metadata: {
          tier: tierKey,
          tierName: tier.tier_name,
          phone,
          consumerId,
          billingCycle: tier.billing_cycle,
          source: "app", // deep-links back via naijamarketconsumer://account?upgrade=success
          custom_fields: [
            { display_name: "Tier", variable_name: "tier", value: tierKey },
            { display_name: "Phone", variable_name: "phone", value: phone },
          ],
        },
        channels: ["card", "bank", "ussd", "bank_transfer"],
      }),
    });

    const data = await res.json();
    if (data.status && data.data?.authorization_url) {
      return NextResponse.json({
        success: true,
        paymentUrl: data.data.authorization_url,
        reference,
        tier: tierKey,
        amount,
      });
    }
    return NextResponse.json(
      { success: false, error: data.message || "Failed to initialize payment" },
      { status: 502 }
    );
  } catch (error: any) {
    console.error("[mobile/consumer/subscribe]", error?.message);
    return NextResponse.json({ success: false, error: "Payment init failed" }, { status: 500 });
  }
}
