// src/app/api/mobile/consumer/push-token/route.ts
// Expo push-token registration for the consumer app (vc27 push feature).
// Under /api/mobile → middleware-exempt; we verify the consumer Bearer JWT
// (fail-closed) AND the single-session token, same as subscribe. Identity
// comes from the token, never the body.
//
// POST   { expo_push_token, device_id?, platform? } → upsert by token
// DELETE { expo_push_token }                        → remove row (logout hygiene)

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Expo token shape, e.g. ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
const EXPO_TOKEN_RE = /^ExponentPushToken\[[A-Za-z0-9_-]+\]$/;

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

// Auth + single-session gate shared by POST and DELETE. Returns the verified
// claims, or a NextResponse to return immediately.
async function requireConsumerSession(
  req: NextRequest
): Promise<{ consumer: ConsumerClaims } | { response: NextResponse }> {
  const consumer = await verifyConsumer(req);
  if (!consumer?.consumer_id) {
    return { response: NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 }) };
  }

  // Single-session check: a token registration must come from the CURRENT session.
  // The 30-day mobile JWT stays signature-valid after a login elsewhere rotates
  // Consumers.session_token — compare the claim against the row and reject
  // stale/absent tokens (same block as /api/mobile/consumer/subscribe).
  try {
    const sessRows = (await prisma.$queryRaw`
      SELECT session_token FROM dbo.Consumers WHERE consumer_id = ${consumer.consumer_id}
    `) as Array<{ session_token: string | null }>;
    const dbToken = sessRows?.[0]?.session_token ?? null;
    if (!consumer.session_token || !dbToken || consumer.session_token !== dbToken) {
      return {
        response: NextResponse.json(
          { success: false, error: "SESSION_INVALIDATED", message: "Please log in again to continue." },
          { status: 401 }
        ),
      };
    }
  } catch (error: any) {
    console.error("[mobile/consumer/push-token] session check failed", error?.message);
    return { response: NextResponse.json({ success: false, error: "Registration failed" }, { status: 500 }) };
  }

  return { consumer };
}

export async function POST(req: NextRequest) {
  const gate = await requireConsumerSession(req);
  if ("response" in gate) return gate.response;
  const consumer = gate.consumer;

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const token = String(body.expo_push_token || "").trim();
  if (!EXPO_TOKEN_RE.test(token)) {
    return NextResponse.json({ success: false, error: "Invalid expo_push_token" }, { status: 400 });
  }
  const deviceId = body.device_id ? String(body.device_id).slice(0, 100) : null;
  const platform = body.platform ? String(body.platform).slice(0, 20) : null;
  const phone = String(consumer.phone_number || "");

  try {
    await prisma.$executeRaw`
      MERGE dbo.Consumer_Push_Tokens AS t
      USING (SELECT ${token} AS expo_push_token) AS s
        ON t.expo_push_token = s.expo_push_token
      WHEN MATCHED THEN UPDATE SET
        phone_number = ${phone},
        consumer_id  = ${consumer.consumer_id},
        device_id    = ${deviceId},
        platform     = ${platform},
        updated_at   = GETUTCDATE()
      WHEN NOT MATCHED THEN INSERT
        (phone_number, consumer_id, expo_push_token, device_id, platform)
      VALUES
        (${phone}, ${consumer.consumer_id}, ${token}, ${deviceId}, ${platform});
    `;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[mobile/consumer/push-token POST]", error?.message);
    return NextResponse.json({ success: false, error: "Registration failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const gate = await requireConsumerSession(req);
  if ("response" in gate) return gate.response;
  const consumer = gate.consumer;

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const token = String(body.expo_push_token || "").trim();
  if (!EXPO_TOKEN_RE.test(token)) {
    return NextResponse.json({ success: false, error: "Invalid expo_push_token" }, { status: 400 });
  }

  try {
    // Scope the delete to the caller's own registration.
    await prisma.$executeRaw`
      DELETE FROM dbo.Consumer_Push_Tokens
      WHERE expo_push_token = ${token} AND consumer_id = ${consumer.consumer_id}`;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[mobile/consumer/push-token DELETE]", error?.message);
    return NextResponse.json({ success: false, error: "Removal failed" }, { status: 500 });
  }
}
