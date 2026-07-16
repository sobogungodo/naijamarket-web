// src/app/api/keys/route.ts
// NaijaMarket Intel - API Key Management
//
// SECURITY: every handler derives BOTH identity (phone) and entitlement (tier)
// from the authenticated NextAuth session — NEVER from client-supplied `phone`
// or `tier`. `/api/keys` is not covered by the route-protection middleware, so
// this route-level auth is the only gate. Trusting the client here previously
// allowed (a) listing/creating/revoking any user's API keys by passing another
// phone (IDOR on issued credentials), and (b) any user forging `tier:"ENTERPRISE"`
// to bypass the BUSINESS+ paywall and mint high-limit keys (privilege escalation).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// ============================================================================
// HELPERS
// ============================================================================

function generateAPIKey(): string {
  const prefix = "nm_live_";
  const randomBytes = crypto.randomBytes(24).toString("base64url");
  return prefix + randomBytes;
}

function hashAPIKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

// Resolve the caller's own phone + tier from the authenticated session.
// Returns a 401 response object if unauthenticated.
async function requireSession(): Promise<
  { phone: string; tier: string } | { response: NextResponse }
> {
  const session = await getServerSession(authOptions);
  const user = session?.user as { phone?: string; tier?: string } | undefined;
  const phone = user?.phone || "";
  if (!phone) {
    return {
      response: NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      ),
    };
  }
  return { phone, tier: (user?.tier || "FREE").toUpperCase() };
}

// ============================================================================
// GET: List API Keys for the authenticated user
// ============================================================================

export async function GET() {
  try {
    const auth = await requireSession();
    if ("response" in auth) return auth.response;
    const phone = auth.phone;

    // Fetch the caller's own API keys (prefix only — never the full key).
    const keys = (await prisma.$queryRaw`
      SELECT
        key_id,
        key_name,
        key_prefix,
        created_at,
        last_used_at,
        request_count,
        status
      FROM API_Keys
      WHERE phone_number = ${phone}
      ORDER BY created_at DESC
    `) as any[];

    return NextResponse.json({
      success: true,
      data: {
        keys: keys.map((k: any) => ({
          id: k.key_id,
          name: k.key_name,
          keyPreview: k.key_prefix + "..." + "xxxx",
          created: k.created_at,
          lastUsed: k.last_used_at,
          requests: parseInt(k.request_count) || 0,
          status: k.status,
        })),
        count: keys.length,
      },
    });
  } catch (error) {
    console.error("List Keys Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list API keys" },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST: Create new API Key for the authenticated user
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSession();
    if ("response" in auth) return auth.response;
    const phone = auth.phone;
    const tier = auth.tier;

    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Key name required" },
        { status: 400 }
      );
    }

    // Check tier access (BUSINESS+ required) — tier is from the session, not the client.
    const tierHierarchy = ["FREE", "SILVER", "GOLD", "BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"];
    const userTierIndex = tierHierarchy.indexOf(tier);
    if (userTierIndex < tierHierarchy.indexOf("BUSINESS")) {
      return NextResponse.json(
        { success: false, error: "BUSINESS tier or higher required for API access" },
        { status: 403 }
      );
    }

    // Check existing key count (limit based on tier)
    const keyLimits: Record<string, number> = {
      BUSINESS: 3,
      CORPORATE: 5,
      ENTERPRISE: 10,
      OGA_BOSS: 50,
      GOVERNMENT: 50,
    };

    const existingKeys = (await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM API_Keys
      WHERE phone_number = ${phone} AND status = 'active'
    `) as any[];

    const currentCount = parseInt(existingKeys[0]?.count || "0");
    const maxKeys = keyLimits[tier] || 3;

    if (currentCount >= maxKeys) {
      return NextResponse.json(
        { success: false, error: `Maximum ${maxKeys} active keys allowed for your tier` },
        { status: 400 }
      );
    }

    // Generate new key
    const apiKey = generateAPIKey();
    const keyHash = hashAPIKey(apiKey);
    const keyId = `KEY_${Date.now()}`;
    const keyPrefix = apiKey.slice(0, 12);

    // Store key (hash only, never store plain key)
    await prisma.$executeRaw`
      INSERT INTO API_Keys (
        key_id,
        phone_number,
        key_name,
        key_hash,
        key_prefix,
        status,
        request_count,
        daily_limit,
        created_at,
        updated_at
      ) VALUES (
        ${keyId},
        ${phone},
        ${name},
        ${keyHash},
        ${keyPrefix},
        'active',
        0,
        ${maxKeys * 1000},
        GETDATE(),
        GETDATE()
      )
    `;

    return NextResponse.json({
      success: true,
      data: {
        keyId,
        name,
        key: apiKey, // Only returned once at creation!
        message: "Save this key now - it won't be shown again!",
      },
    });
  } catch (error) {
    console.error("Create Key Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create API key" },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE: Revoke an API Key owned by the authenticated user
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireSession();
    if ("response" in auth) return auth.response;
    const phone = auth.phone;

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get("keyId");

    if (!keyId) {
      return NextResponse.json(
        { success: false, error: "Key ID required" },
        { status: 400 }
      );
    }

    // Revoke only if the key belongs to the caller (ownership scoped to session phone).
    await prisma.$executeRaw`
      UPDATE API_Keys
      SET status = 'revoked', updated_at = GETDATE()
      WHERE key_id = ${keyId} AND phone_number = ${phone}
    `;

    return NextResponse.json({
      success: true,
      message: "API key revoked successfully",
    });
  } catch (error) {
    console.error("Revoke Key Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to revoke API key" },
      { status: 500 }
    );
  }
}
