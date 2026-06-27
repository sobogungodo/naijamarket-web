// ============================================================================
// src/app/api/account/language/route.ts
// Read / update the signed-in consumer's preferred_language.
//
// This is the SAME column WA (func-naijamarket-wa) and the mobile app use, so a
// language choice on the web follows the user to WhatsApp and back.
//
//   GET  -> { language: "en" | "pcm" }   (defaults to "en")
//   POST { language } -> { success, language }
//
// The language value is whitelisted to exactly "en"/"pcm" before it ever
// touches SQL, and consumer_id is resolved from the DB (not the request body),
// so there is no injection surface despite the raw-SQL style used elsewhere in
// this codebase.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Lang = "en" | "pcm";

function normLang(v: unknown): Lang {
  return typeof v === "string" && v.trim().toLowerCase() === "pcm" ? "pcm" : "en";
}

// Resolve the consumer from the NextAuth session — mirrors the strategy used by
// /api/settings (email → phone → "User NNNN" suffix → full_name).
async function findUserFromSession(session: any) {
  if (!session?.user) return null;
  const { email, name, phone } = session.user as any;
  try {
    if (email) {
      const user = await prisma.consumers.findFirst({ where: { email } });
      if (user) return user;
    }
    if (phone) {
      const user = await prisma.consumers.findFirst({ where: { phone_number: phone } });
      if (user) return user;
    }
    if (name && name.startsWith("User ")) {
      const suffix = name.replace("User ", "");
      if (suffix && /^\d{4,}$/.test(suffix)) {
        const users = await prisma.$queryRawUnsafe<any[]>(
          `SELECT TOP 1 * FROM Consumers WHERE phone_number LIKE '%${suffix}' ORDER BY created_at DESC`
        );
        if (users && users.length > 0) return users[0];
      }
    }
    if (name && !name.startsWith("User ")) {
      const user = await prisma.consumers.findFirst({ where: { full_name: name } });
      if (user) return user;
      const users = await prisma.$queryRawUnsafe<any[]>(
        `SELECT TOP 1 * FROM Consumers WHERE LOWER(full_name) = LOWER('${name.replace(/'/g, "''")}') ORDER BY created_at DESC`
      );
      if (users && users.length > 0) return users[0];
    }
    return null;
  } catch (error: any) {
    console.error("[account/language] user resolve error:", error?.message);
    return null;
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    const user = await findUserFromSession(session);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT preferred_language FROM Consumers WHERE consumer_id = '${user.consumer_id}'`
    );
    const raw = rows?.[0]?.preferred_language;
    return NextResponse.json({ language: normLang(raw) });
  } catch (error: any) {
    console.error("[account/language] GET error:", error?.message);
    // Fail soft — the client falls back to localStorage.
    return NextResponse.json({ language: "en" });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    const user = await findUserFromSession(session);
    if (!user) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const lang = normLang(body?.language); // whitelisted to 'en' | 'pcm'

    // lang is a literal 'en'/'pcm'; consumer_id is DB-resolved — safe to inline.
    await prisma.$executeRawUnsafe(
      `UPDATE Consumers SET preferred_language = '${lang}' WHERE consumer_id = '${user.consumer_id}'`
    );

    return NextResponse.json({ success: true, language: lang });
  } catch (error: any) {
    console.error("[account/language] POST error:", error?.message);
    return NextResponse.json({ success: false, error: "Failed to save language" }, { status: 500 });
  }
}
