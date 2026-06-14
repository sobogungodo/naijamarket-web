// src/app/api/auth/verify-otp/route.ts
import { NextRequest, NextResponse } from "next/server";
const FUNC_BASE = process.env.FUNC_API_BASE_URL || "https://func-naijamarket-api.azurewebsites.net/api";
const FUNC_KEY  = process.env.FUNC_API_KEY || "";
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (FUNC_KEY) headers["x-functions-key"] = FUNC_KEY;
    const resp = await fetch(`${FUNC_BASE}/otp_verify`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const rawText = await resp.text();
    if (!rawText) return NextResponse.json({ error: "Verification service unavailable." }, { status: 503 });
    let data: unknown;
    try { data = JSON.parse(rawText); }
    catch { return NextResponse.json({ error: "Verification error. Please try again." }, { status: 502 }); }
    return NextResponse.json(data, { status: resp.status });
  } catch (error) {
    console.error("verify-otp proxy error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
