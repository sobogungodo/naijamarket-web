// src/app/api/auth/login/route.ts
// Proxies to func-naijamarket-api/login, then rotates session_token in DB
// to enforce single-session across web, mobile, and WA.
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import sql from "mssql";

const FUNC_BASE = process.env.FUNC_API_BASE_URL || "https://func-naijamarket-api.azurewebsites.net/api";
const FUNC_KEY  = process.env.FUNC_API_KEY || "";

const sqlConfig: sql.config = {
  user: process.env.AZURE_SQL_USER!,
  password: process.env.AZURE_SQL_PASSWORD!,
  database: process.env.AZURE_SQL_DATABASE!,
  server: process.env.AZURE_SQL_SERVER!,
  options: { encrypt: true, trustServerCertificate: false },
};

// CSPRNG token (two UUIDs, dashes stripped → 64 hex chars, same shape as the
// func-api tokens). Replaces the old Date.now/Math.random generator.
function generateSessionToken(): string {
  return `${randomUUID()}${randomUUID()}`.replace(/-/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawPhone   = String(body.phone   || "").replace(/\D/g, "");
    const rawCountry = String(body.countryCode || "234").replace(/\D/g, "");
    const fullPhone  = rawPhone.startsWith(rawCountry) ? rawPhone : rawCountry + rawPhone;
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "";
    const userAgent = request.headers.get("user-agent") || "";
    const forwardBody = { ...body, phone: fullPhone, client_ip: clientIp, user_agent: userAgent };
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-forwarded-for": clientIp,
      "user-agent": userAgent,
      "x-client-ip": clientIp,
      "x-client-ua": userAgent,
    };
    if (FUNC_KEY) headers["x-functions-key"] = FUNC_KEY;

    const resp = await fetch(`${FUNC_BASE}/login`, {
      method: "POST",
      headers,
      body: JSON.stringify(forwardBody),
    });

    const rawText = await resp.text();
    if (!rawText) {
      return NextResponse.json({ error: "Login service unavailable." }, { status: 503 });
    }

    let data: Record<string, unknown>;
    try { data = JSON.parse(rawText); }
    catch { return NextResponse.json({ error: "Login error. Please try again." }, { status: 502 }); }

    // Only rotate session on successful login
    if (resp.ok && data.consumer && (data.consumer as any).id) {
      const consumerId = (data.consumer as any).id as string;
      // Tier-exempt session reuse: CORPORATE/ENTERPRISE keep the token the
      // func-api login returned (it reuses the row's active token), so a
      // re-login doesn't kick their other devices. Everyone else rotates.
      const tier = String((data.consumer as any).subscription_tier || "").toUpperCase();
      const funcToken = typeof data.session_token === "string" ? (data.session_token as string) : "";
      const exempt = (tier === "CORPORATE" || tier === "ENTERPRISE") && !!funcToken;
      const newToken = exempt ? funcToken : generateSessionToken();

      let pool2: sql.ConnectionPool | null = null;
      try {
        pool2 = await sql.connect(sqlConfig);
        if (exempt) {
          await pool2.request()
            .input("consumer_id", sql.NVarChar(50), consumerId)
            .input("session_ip", sql.NVarChar(100), clientIp || null)
            .input("session_ua", sql.NVarChar(500), userAgent || null)
            .query(`
              UPDATE dbo.Consumers
              SET session_created_at = GETUTCDATE(),
                  session_ip_address = @session_ip,
                  session_user_agent = @session_ua
              WHERE consumer_id = @consumer_id
            `);
        } else {
          await pool2.request()
            .input("consumer_id", sql.NVarChar(50), consumerId)
            .input("session_token", sql.NVarChar(200), newToken)
            .input("session_ip", sql.NVarChar(100), clientIp || null)
            .input("session_ua", sql.NVarChar(500), userAgent || null)
            .query(`
              UPDATE dbo.Consumers
              SET session_token      = @session_token,
                  session_created_at = GETUTCDATE(),
                  session_ip_address = @session_ip,
                  session_user_agent = @session_ua
              WHERE consumer_id = @consumer_id
            `);
        }
        // Return the effective token so NextAuth can store it in the JWT
        data = { ...data, session_token: newToken };
        console.log(`[login] session ${exempt ? "reused (tier-exempt)" : "rotated"} for ${consumerId} from ${clientIp}`);
      } catch (dbErr: any) {
        // Non-fatal — log but don't block login
        console.error("[login] session rotation FAILED — consumer:", consumerId, "error:", dbErr?.message || dbErr, "code:", (dbErr as any)?.code, "server:", process.env.AZURE_SQL_SERVER ? "SET" : "MISSING", "user:", process.env.AZURE_SQL_USER ? "SET" : "MISSING");
      } finally {
        try { await pool2?.close(); } catch { /* ignore */ }
      }
    }

    return NextResponse.json(data, { status: resp.status });
  } catch (error) {
    console.error("login proxy error:", error);
    return NextResponse.json({ error: "Login failed. Please try again." }, { status: 500 });
  }
}
