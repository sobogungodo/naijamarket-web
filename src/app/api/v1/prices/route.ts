// src/app/api/v1/prices/route.ts
// NaijaMarket Intel - Public API v1 - Price Data
// Requires API Key Authentication

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// ============================================================================
// API KEY VALIDATION
// ============================================================================

async function validateAPIKey(request: NextRequest): Promise<{ valid: boolean; error?: string; keyId?: string }> {
  const authHeader = request.headers.get("Authorization");
  const apiKeyHeader = request.headers.get("X-API-Key");

  let apiKey = "";

  // Check Authorization header (Bearer token)
  if (authHeader && authHeader.startsWith("Bearer ")) {
    apiKey = authHeader.slice(7);
  }
  // Or X-API-Key header
  else if (apiKeyHeader) {
    apiKey = apiKeyHeader;
  }

  if (!apiKey) {
    return { valid: false, error: "API key required. Use 'Authorization: Bearer <key>' or 'X-API-Key: <key>'" };
  }

  // Validate key format
  if (!apiKey.startsWith("nm_live_")) {
    return { valid: false, error: "Invalid API key format" };
  }

  // Hash and lookup
  const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

  try {
    const keys = await prisma.$queryRaw`
      SELECT key_id, phone_number, status, request_count, daily_limit
      FROM API_Keys
      WHERE key_hash = ${keyHash}
    ` as any[];

    if (!keys || keys.length === 0) {
      return { valid: false, error: "Invalid API key" };
    }

    const key = keys[0];

    if (key.status !== "active") {
      return { valid: false, error: "API key has been revoked" };
    }

    // Check rate limit
    if (parseInt(key.request_count) >= parseInt(key.daily_limit)) {
      return { valid: false, error: "Daily rate limit exceeded" };
    }

    // Increment request count
    await prisma.$executeRaw`
      UPDATE API_Keys 
      SET request_count = request_count + 1, last_used_at = GETDATE()
      WHERE key_id = ${key.key_id}
    `;

    return { valid: true, keyId: key.key_id };

  } catch (error) {
    console.error("API Key validation error:", error);
    return { valid: false, error: "Authentication failed" };
  }
}

// ============================================================================
// GET: Fetch Price Data
// ============================================================================

export async function GET(request: NextRequest) {
  // Validate API Key
  const auth = await validateAPIKey(request);
  if (!auth.valid) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const item = searchParams.get("item");
    const market = searchParams.get("market");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 1000);

    let prices: any[] = [];

    // Simple queries based on filters
    if (item && market) {
      prices = await prisma.$queryRaw`
        SELECT TOP ${limit}
          p.price_id, p.item_name, p.market_name, p.price, p.unit,
          p.price_trend, p.price_change_percent, p.validated_at, p.created_at,
          m.state, m.region
        FROM Approved_Prices p
        LEFT JOIN Markets m ON p.market_name = m.market_name
        WHERE p.item_name LIKE ${'%' + item + '%'} 
          AND p.market_name LIKE ${'%' + market + '%'}
        ORDER BY p.created_at DESC
      ` as any[];
    } else if (item) {
      prices = await prisma.$queryRaw`
        SELECT TOP ${limit}
          p.price_id, p.item_name, p.market_name, p.price, p.unit,
          p.price_trend, p.price_change_percent, p.validated_at, p.created_at,
          m.state, m.region
        FROM Approved_Prices p
        LEFT JOIN Markets m ON p.market_name = m.market_name
        WHERE p.item_name LIKE ${'%' + item + '%'}
        ORDER BY p.created_at DESC
      ` as any[];
    } else if (market) {
      prices = await prisma.$queryRaw`
        SELECT TOP ${limit}
          p.price_id, p.item_name, p.market_name, p.price, p.unit,
          p.price_trend, p.price_change_percent, p.validated_at, p.created_at,
          m.state, m.region
        FROM Approved_Prices p
        LEFT JOIN Markets m ON p.market_name = m.market_name
        WHERE p.market_name LIKE ${'%' + market + '%'}
        ORDER BY p.created_at DESC
      ` as any[];
    } else {
      prices = await prisma.$queryRaw`
        SELECT TOP ${limit}
          p.price_id, p.item_name, p.market_name, p.price, p.unit,
          p.price_trend, p.price_change_percent, p.validated_at, p.created_at,
          m.state, m.region
        FROM Approved_Prices p
        LEFT JOIN Markets m ON p.market_name = m.market_name
        ORDER BY p.created_at DESC
      ` as any[];
    }

    return NextResponse.json({
      success: true,
      data: prices.map((p: any) => ({
        id: p.price_id,
        item: p.item_name,
        market: p.market_name,
        state: p.state,
        region: p.region,
        price: parseFloat(p.price) || 0,
        unit: p.unit,
        trend: p.price_trend,
        changePercent: parseFloat(p.price_change_percent) || 0,
        validatedAt: p.validated_at,
        timestamp: p.created_at,
      })),
      count: prices.length,
      meta: {
        apiVersion: "v1",
        endpoint: "/api/v1/prices",
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error("API v1 Prices Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch prices" },
      { status: 500 }
    );
  }
}
