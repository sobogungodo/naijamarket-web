// src/app/api/keys/route.ts
// NaijaMarket Intel - API Key Management

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

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

// ============================================================================
// GET: List API Keys for a user
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get("phone");

    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Phone number required" },
        { status: 400 }
      );
    }

    // Fetch user's API keys (don't return the full key, just prefix + last 4)
    const keys = await prisma.$queryRaw`
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
    ` as any[];

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
// POST: Create new API Key
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, name, tier } = body;

    if (!phone || !name) {
      return NextResponse.json(
        { success: false, error: "Phone and name required" },
        { status: 400 }
      );
    }

    // Check tier access (BUSINESS+ required)
    const tierHierarchy = ["FREE", "SILVER", "GOLD", "BUSINESS", "CORPORATE", "ENTERPRISE", "OGA_BOSS", "GOVERNMENT"];
    const userTierIndex = tierHierarchy.indexOf((tier || "FREE").toUpperCase());
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

    const existingKeys = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM API_Keys 
      WHERE phone_number = ${phone} AND status = 'active'
    ` as any[];

    const currentCount = parseInt(existingKeys[0]?.count || "0");
    const maxKeys = keyLimits[(tier || "BUSINESS").toUpperCase()] || 3;

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
// DELETE: Revoke API Key
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get("keyId");
    const phone = searchParams.get("phone");

    if (!keyId || !phone) {
      return NextResponse.json(
        { success: false, error: "Key ID and phone required" },
        { status: 400 }
      );
    }

    // Verify ownership and revoke
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
