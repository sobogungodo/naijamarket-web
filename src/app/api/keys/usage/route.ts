// ============================================================================
// src/app/api/keys/usage/route.ts
// NaijaMarket Intel - API Usage Analytics (for dashboard)
// GET /api/keys/usage?key_id=xxx&days=30
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma as sharedPrisma } from "@/lib/db";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = sharedPrisma;
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

async function findUserFromSession(session: any) {
  if (!session?.user) return null;
  const { email, name, phone } = session.user as any;
  try {
    if (email) {
      const u = await prisma.consumers.findFirst({ where: { email } });
      if (u) return u;
    }
    if (phone) {
      const u = await prisma.consumers.findFirst({ where: { phone_number: phone } });
      if (u) return u;
    }
    if (name && name.startsWith("User ")) {
      const suffix = name.replace("User ", "");
      if (/^\d{4,}$/.test(suffix)) {
        const us = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM Consumers WHERE phone_number LIKE '%${suffix}' ORDER BY created_at DESC`);
        if (us.length > 0) return us[0];
      }
    }
    if (name && !name.startsWith("User ")) {
      const u = await prisma.consumers.findFirst({ where: { full_name: name } });
      if (u) return u;
    }
    return null;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await findUserFromSession(session);
    const phone = (user as any)?.phone_number || "";
    if (!phone) return NextResponse.json({ error: "Phone required" }, { status: 400 });

    const sp = request.nextUrl.searchParams;
    const keyId = sp.get("key_id") || "";
    const days = Math.min(parseInt(sp.get("days") || "30"), 90);

    // Verify key ownership
    if (keyId) {
      const owns = await prisma.$queryRaw`
        SELECT key_id FROM API_Keys WHERE key_id = ${keyId} AND phone_number = ${phone}
      ` as any[];
      if (owns.length === 0) return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    // Get user's keys
    const keys = await prisma.$queryRaw`
      SELECT key_id, key_name, key_prefix, status, tier,
             request_count, daily_limit, rate_limit_per_minute,
             last_used_at, created_at
      FROM API_Keys
      WHERE phone_number = ${phone}
      ORDER BY created_at DESC
    ` as any[];

    // Daily usage for chart (all keys or specific key)
    let dailyUsage: any[];
    if (keyId) {
      dailyUsage = await prisma.$queryRaw`
        SELECT CAST(called_at AS DATE) AS date,
               COUNT(*) AS calls,
               COUNT(CASE WHEN status_code = 200 THEN 1 END) AS success,
               COUNT(CASE WHEN status_code = 429 THEN 1 END) AS rate_limited,
               COUNT(CASE WHEN status_code >= 400 AND status_code != 429 THEN 1 END) AS errors,
               AVG(response_ms) AS avg_ms
        FROM API_Usage_Logs
        WHERE key_id = ${keyId}
          AND called_at >= DATEADD(day, ${-days}, GETDATE())
        GROUP BY CAST(called_at AS DATE)
        ORDER BY date ASC
      ` as any[];
    } else {
      // All keys
      const keyIds = keys.map((k: any) => k.key_id);
      if (keyIds.length === 0) {
        dailyUsage = [];
      } else {
        dailyUsage = await prisma.$queryRawUnsafe(`
          SELECT CAST(called_at AS DATE) AS date,
                 COUNT(*) AS calls,
                 COUNT(CASE WHEN status_code = 200 THEN 1 END) AS success,
                 COUNT(CASE WHEN status_code = 429 THEN 1 END) AS rate_limited,
                 AVG(response_ms) AS avg_ms
          FROM API_Usage_Logs
          WHERE key_id IN (${keyIds.map((id: string) => `'${id}'`).join(",")})
            AND called_at >= DATEADD(day, -${days}, GETDATE())
          GROUP BY CAST(called_at AS DATE)
          ORDER BY date ASC
        `) as any[];
      }
    }

    // Endpoint breakdown
    let endpointBreakdown: any[] = [];
    if (keys.length > 0) {
      const keyIds = keys.map((k: any) => k.key_id);
      endpointBreakdown = await prisma.$queryRawUnsafe(`
        SELECT endpoint, COUNT(*) AS calls,
               AVG(response_ms) AS avg_ms
        FROM API_Usage_Logs
        WHERE key_id IN (${keyIds.map((id: string) => `'${id}'`).join(",")})
          AND called_at >= DATEADD(day, -${days}, GETDATE())
        GROUP BY endpoint
        ORDER BY calls DESC
      `) as any[];
    }

    // Summary
    const totalCalls = dailyUsage.reduce((sum: number, d: any) => sum + parseInt(d.calls || "0"), 0);
    const totalSuccess = dailyUsage.reduce((sum: number, d: any) => sum + parseInt(d.success || "0"), 0);
    const avgMs = dailyUsage.length > 0
      ? Math.round(dailyUsage.reduce((sum: number, d: any) => sum + parseFloat(d.avg_ms || "0"), 0) / dailyUsage.length)
      : 0;

    return NextResponse.json({
      success: true,
      keys: keys.map((k: any) => ({
        key_id: k.key_id,
        name: k.key_name,
        prefix: k.key_prefix,
        status: k.status,
        tier: k.tier || "FREE",
        total_requests: parseInt(k.request_count || "0"),
        daily_limit: k.daily_limit,
        rate_limit: k.rate_limit_per_minute,
        last_used: k.last_used_at,
        created: k.created_at,
      })),
      usage: {
        period_days: days,
        total_calls: totalCalls,
        success_rate: totalCalls > 0 ? parseFloat(((totalSuccess / totalCalls) * 100).toFixed(1)) : 100,
        avg_response_ms: avgMs,
        daily: dailyUsage.map((d: any) => ({
          date: d.date,
          calls: parseInt(d.calls || "0"),
          success: parseInt(d.success || "0"),
          rate_limited: parseInt(d.rate_limited || "0"),
          avg_ms: Math.round(parseFloat(d.avg_ms || "0")),
        })),
        by_endpoint: endpointBreakdown.map((e: any) => ({
          endpoint: e.endpoint,
          calls: parseInt(e.calls || "0"),
          avg_ms: Math.round(parseFloat(e.avg_ms || "0")),
        })),
      },
    });
  } catch (e: any) {
    console.error("[API Usage]", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
