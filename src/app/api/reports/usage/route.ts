// ============================================================================
// src/app/api/reports/usage/route.ts
// NaijaFood Intel - Report Usage Counter
// Returns: { used, limit, remaining, tier, resetsAt }
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma, isSupabase } from "@/lib/db";


const TIER_HIERARCHY = [
  "FREE", "STARTER", "SILVER", "GOLD", "BUSINESS", "BUSINESS_PLUS",
  "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT",
];

const TIER_MONTHLY_LIMITS: Record<string, number> = {
  BUSINESS: 20,
  BUSINESS_PLUS: 30,
  CORPORATE: 50,
  ENTERPRISE: 9999,
  OGA_BOSS: 9999,
  GOVERNMENT: 9999,
};

async function getUserTier(session: any): Promise<string> {
  if (!session?.user) return "FREE";
  const { email, name, phone } = session.user as any;

  try {
    if (email) {
      const u = await prisma.consumers.findFirst({
        where: { email },
        select: { subscription_tier: true },
      });
      if (u?.subscription_tier) return u.subscription_tier.toUpperCase();
    }
    if (phone) {
      const u = await prisma.consumers.findFirst({
        where: { phone_number: phone },
        select: { subscription_tier: true },
      });
      if (u?.subscription_tier) return u.subscription_tier.toUpperCase();
    }
    if (name && name.startsWith("User ")) {
      const suffix = name.replace("User ", "");
      if (/^\d{4,}$/.test(suffix)) {
        const rows = await prisma.$queryRawUnsafe<any[]>(
          `SELECT TOP 1 subscription_tier FROM Consumers WHERE phone_number LIKE '%${suffix}' ORDER BY created_at DESC`
        );
        if (rows?.[0]?.subscription_tier) return rows[0].subscription_tier.toUpperCase();
      }
    }
    if (name && !name.startsWith("User ")) {
      const u = await prisma.consumers.findFirst({
        where: { full_name: name },
        select: { subscription_tier: true },
      });
      if (u?.subscription_tier) return u.subscription_tier.toUpperCase();
    }
    return "FREE";
  } catch {
    return "FREE";
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    const userTier = await getUserTier(session);
    const userEmail = (session?.user as any)?.email || "anonymous";

    const monthlyLimit = TIER_MONTHLY_LIMITS[userTier] || 0;

    // Ensure table exists (Supabase Dev: report_usage already exists; skip the T-SQL DDL).
    try {
      if (isSupabase()) throw new Error('skip-ddl-on-supabase');
      await prisma.$executeRawUnsafe(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Report_Usage')
        BEGIN
          CREATE TABLE Report_Usage (
            id INT IDENTITY(1,1) PRIMARY KEY,
            user_email NVARCHAR(255) NOT NULL DEFAULT 'anonymous',
            user_tier NVARCHAR(50) NOT NULL DEFAULT 'FREE',
            report_type NVARCHAR(100) NOT NULL,
            output_format NVARCHAR(20) NOT NULL DEFAULT 'pdf',
            file_size_bytes INT NOT NULL DEFAULT 0,
            generated_at DATETIME2 NOT NULL DEFAULT GETDATE()
          );
          CREATE INDEX IX_ReportUsage_Email_Date ON Report_Usage(user_email, generated_at);
        END
      `);
    } catch { /* already exists */ }

    // Count this month's usage
    let used = 0;
    try {
      const result = await prisma.$queryRawUnsafe<{ cnt: number }[]>(`
        SELECT COUNT(*) AS cnt FROM Report_Usage
        WHERE user_email = '${userEmail.replace(/'/g, "''")}'
          AND generated_at >= DATEADD(month, DATEDIFF(month, 0, GETDATE()), 0)
      `);
      used = result?.[0]?.cnt || 0;
    } catch {
      used = 0;
    }

    // Calculate reset date (first of next month)
    const now = new Date();
    const resetsAt = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    const remaining = Math.max(0, monthlyLimit - used);

    return NextResponse.json({
      success: true,
      used,
      limit: monthlyLimit,
      remaining,
      tier: userTier,
      resetsAt,
    });
  } catch (error: any) {
    console.error("[Reports Usage] Error:", error.message);
    return NextResponse.json(
      { success: false, error: "Failed to load usage", used: 0, limit: 20, remaining: 20, tier: "FREE", resetsAt: "" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
