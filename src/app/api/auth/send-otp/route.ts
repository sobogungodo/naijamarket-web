// src/app/api/auth/send-otp/route.ts
// Proxies to func-naijamarket-api/otp_send — no direct DB access from Vercel
import { NextRequest, NextResponse } from "next/server";

const FUNC_BASE = process.env.FUNC_API_BASE_URL || "https://func-naijamarket-api.azurewebsites.net/api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const resp = await fetch(`${FUNC_BASE}/otp_send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (error) {
    console.error("send-otp proxy error:", error);
    return NextResponse.json({ error: "Failed to send verification code" }, { status: 500 });
  }
}
