// src/app/api/auth/verify-email-otp/route.ts
// Proxies to func-naijamarket-api/otp_verify_email — no direct DB access from Vercel
import { NextRequest, NextResponse } from "next/server";

const FUNC_KEY  = process.env.FUNC_API_KEY || "";
const FUNC_BASE = process.env.FUNC_API_BASE_URL || "https://func-naijamarket-api.azurewebsites.net/api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const resp = await fetch(`${FUNC_BASE}/otp_verify_email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(FUNC_KEY ? {"x-functions-key": FUNC_KEY} : {}) },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (error) {
    console.error("verify-email-otp proxy error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
