// src/app/api/auth/send-otp/route.ts
// Proxies to func-naijamarket-api/otp_send — no direct DB access from Vercel
// v1.1: resilient upstream handling — logs raw response body, never blindly calls .json()
import { NextRequest, NextResponse } from "next/server";

const FUNC_BASE = process.env.FUNC_API_BASE_URL || "https://func-naijamarket-api.azurewebsites.net/api";
const FUNC_KEY  = process.env.FUNC_API_KEY || "";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (FUNC_KEY) headers["x-functions-key"] = FUNC_KEY;

    const resp = await fetch(`${FUNC_BASE}/otp_send`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const rawText = await resp.text();
    console.log(`[send-otp] upstream status=${resp.status} body="${rawText.slice(0, 300)}"`);

    if (!rawText) {
      // Upstream returned empty body — common on function crash or cold-start
      console.error("[send-otp] upstream returned empty body, status:", resp.status);
      return NextResponse.json(
        { error: "OTP service unavailable. Please try again in a moment." },
        { status: 503 }
      );
    }

    let data: unknown;
    try {
      data = JSON.parse(rawText);
    } catch {
      // Upstream returned non-JSON (HTML error page, plain text)
      console.error("[send-otp] upstream returned non-JSON:", rawText.slice(0, 200));
      return NextResponse.json(
        { error: "OTP service error. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json(data, { status: resp.status });
  } catch (error) {
    console.error("send-otp proxy error:", error);
    return NextResponse.json({ error: "Failed to send verification code" }, { status: 500 });
  }
}
