// ============================================================================
// src/lib/api-middleware.ts
// NaijaMarket Intel - API Key Validation + Rate Limiting + Usage Logging
// Version: 1.0.0 | Date: 2026-02-20
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ============================================================================
// TYPES
// ============================================================================

export interface APIKeyInfo {
  key_id: string;
  phone_number: string;
  key_name: string;
  tier: string;
  status: string;
  daily_limit: number;
  rate_limit_per_minute: number;
  request_count: number;
}

export interface APIContext {
  keyInfo: APIKeyInfo;
  startTime: number;
}

// ============================================================================
// EXTRACT API KEY FROM REQUEST
// ============================================================================

function extractAPIKey(request: NextRequest): string | null {
  // Bearer token
  const auth = request.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);

  // X-API-Key header
  const xKey = request.headers.get("X-API-Key");
  if (xKey) return xKey;

  // Query param (for testing)
  const qKey = request.nextUrl.searchParams.get("api_key");
  if (qKey) return qKey;

  return null;
}

// ============================================================================
// VALIDATE API KEY + CHECK RATE LIMITS
// ============================================================================

export async function validateRequest(
  request: NextRequest,
  endpoint: string
): Promise<{ ok: true; ctx: APIContext } | { ok: false; response: NextResponse }> {
  const startTime = Date.now();
  const apiKey = extractAPIKey(request);

  if (!apiKey) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "authentication_required",
          message: "API key required. Pass via Authorization: Bearer <key> or X-API-Key header.",
          docs: "https://www.naijamarketintel.com/dashboard/api-docs",
        },
        { status: 401, headers: corsHeaders() }
      ),
    };
  }

  // Hash key and look up
  const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

  try {
    const results = await prisma.$queryRaw`
      SELECT k.key_id, k.phone_number, k.key_name, k.status,
             ISNULL(k.tier, 'FREE') AS tier,
             k.request_count, k.daily_limit, k.rate_limit_per_minute,
             r.daily_limit AS tier_daily_limit,
             r.rate_per_minute AS tier_rate_per_minute,
             r.endpoints AS tier_endpoints
      FROM API_Keys k
      LEFT JOIN API_Rate_Limits r ON ISNULL(k.tier, 'FREE') = r.tier
      WHERE k.key_hash = ${keyHash}
    ` as any[];

    if (results.length === 0) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "invalid_api_key", message: "API key not found or invalid." },
          { status: 401, headers: corsHeaders() }
        ),
      };
    }

    const key = results[0];

    // Check status
    if (key.status !== "active") {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "key_revoked", message: `API key is ${key.status}. Generate a new key.` },
          { status: 403, headers: corsHeaders() }
        ),
      };
    }

    // Check endpoint access
    const allowedEndpoints = (key.tier_endpoints || "prices,markets,items").split(",");
    const endpointName = endpoint.replace("/api/v1/", "").split("/")[0];
    if (!allowedEndpoints.includes(endpointName)) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: "endpoint_not_available",
            message: `The /${endpointName} endpoint requires ${getMinTier(endpointName)} tier or higher.`,
            upgrade: "https://www.naijamarketintel.com/dashboard/api",
          },
          { status: 403, headers: corsHeaders() }
        ),
      };
    }

    // Rate limit: calls in last minute
    const minuteCount = await prisma.$queryRaw`
      SELECT COUNT(*) as cnt
      FROM API_Usage_Logs
      WHERE key_id = ${key.key_id}
        AND called_at >= DATEADD(minute, -1, SYSUTCDATETIME())
    ` as any[];

    const callsLastMinute = parseInt(minuteCount[0]?.cnt || "0");
    const rateLimit = key.tier_rate_per_minute || key.rate_limit_per_minute || 10;

    if (callsLastMinute >= rateLimit) {
      // Log the 429
      await logUsage(key.key_id, endpoint, "GET", 429, 0, request);
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: "rate_limit_exceeded",
            message: `Rate limit: ${rateLimit} requests/minute. Try again in 60 seconds.`,
            limit: rateLimit,
            remaining: 0,
            reset: 60,
          },
          {
            status: 429,
            headers: {
              ...corsHeaders(),
              "X-RateLimit-Limit": String(rateLimit),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": "60",
              "Retry-After": "60",
            },
          }
        ),
      };
    }

    // Daily limit check
    const dailyLimit = key.tier_daily_limit || key.daily_limit || 100;
    const dailyCount = await prisma.$queryRaw`
      SELECT COUNT(*) as cnt
      FROM API_Usage_Logs
      WHERE key_id = ${key.key_id}
        AND CAST(called_at AS DATE) = CAST(SYSUTCDATETIME() AS DATE)
    ` as any[];

    const callsToday = parseInt(dailyCount[0]?.cnt || "0");

    if (callsToday >= dailyLimit) {
      await logUsage(key.key_id, endpoint, "GET", 429, 0, request);
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: "daily_limit_exceeded",
            message: `Daily limit of ${dailyLimit} requests reached. Resets at midnight UTC.`,
            limit: dailyLimit,
            used: callsToday,
            upgrade: "https://www.naijamarketintel.com/dashboard/api",
          },
          { status: 429, headers: corsHeaders() }
        ),
      };
    }

    // Update last_used and request_count
    await prisma.$executeRaw`
      UPDATE API_Keys
      SET last_used_at = GETDATE(),
          request_count = request_count + 1,
          updated_at = GETDATE()
      WHERE key_id = ${key.key_id}
    `;

    return {
      ok: true,
      ctx: {
        keyInfo: {
          key_id: key.key_id,
          phone_number: key.phone_number,
          key_name: key.key_name,
          tier: key.tier || "FREE",
          status: key.status,
          daily_limit: dailyLimit,
          rate_limit_per_minute: rateLimit,
          request_count: callsToday + 1,
        },
        startTime,
      },
    };
  } catch (err: any) {
    console.error("[API Middleware] Error:", err.message);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "internal_error", message: "Authentication service unavailable." },
        { status: 500, headers: corsHeaders() }
      ),
    };
  }
}

// ============================================================================
// LOG API USAGE
// ============================================================================

export async function logUsage(
  keyId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  responseMs: number,
  request: NextRequest
) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ua = (request.headers.get("user-agent") || "").substring(0, 255);
    const params = request.nextUrl.search.substring(0, 500);

    await prisma.$executeRaw`
      INSERT INTO API_Usage_Logs (key_id, endpoint, method, status_code, response_ms, query_params, ip_address, user_agent)
      VALUES (${keyId}, ${endpoint}, ${method}, ${statusCode}, ${responseMs}, ${params}, ${ip}, ${ua})
    `;
  } catch {
    // Don't fail the request if logging fails
  }
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, X-API-Key, Content-Type",
    "X-API-Version": "v1",
    "X-Powered-By": "NaijaMarket Intel",
  };
}

export function apiResponse(data: any, ctx: APIContext, extra?: Record<string, any>) {
  const responseMs = Date.now() - ctx.startTime;
  const remaining = ctx.keyInfo.daily_limit - ctx.keyInfo.request_count;

  // Log the successful call
  logUsage(ctx.keyInfo.key_id, "", "GET", 200, responseMs, {} as any).catch(() => {});

  return NextResponse.json(
    {
      success: true,
      ...data,
      meta: {
        api_version: "v1",
        timestamp: new Date().toISOString(),
        response_ms: responseMs,
        ...extra,
      },
    },
    {
      headers: {
        ...corsHeaders(),
        "X-RateLimit-Limit": String(ctx.keyInfo.rate_limit_per_minute),
        "X-RateLimit-Daily-Limit": String(ctx.keyInfo.daily_limit),
        "X-RateLimit-Daily-Remaining": String(Math.max(0, remaining)),
      },
    }
  );
}

function getMinTier(endpoint: string): string {
  switch (endpoint) {
    case "trends":
      return "STARTER";
    case "historical":
    case "stats":
      return "BUSINESS";
    default:
      return "FREE";
  }
}
