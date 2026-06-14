// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
const FUNC_BASE = process.env.FUNC_API_BASE_URL || "https://func-naijamarket-api.azurewebsites.net/api";
const FUNC_KEY  = process.env.FUNC_API_KEY || "";
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawPhone   = String(body.phone   || "").replace(/\D/g, "");
    const rawCountry = String(body.countryCode || "234").replace(/\D/g, "");
    const fullPhone  = rawPhone.startsWith(rawCountry) ? rawPhone : rawCountry + rawPhone;
    const forwardBody = { ...body, phone: fullPhone };
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-forwarded-for": request.headers.get("x-forwarded-for") || "",
      "user-agent": request.headers.get("user-agent") || "",
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
    let data: unknown;
    try { data = JSON.parse(rawText); }
    catch { return NextResponse.json({ error: "Login error. Please try again." }, { status: 502 }); }
    return NextResponse.json(data, { status: resp.status });
  } catch (error) {
    console.error("login proxy error:", error);
    return NextResponse.json({ error: "Login failed. Please try again." }, { status: 500 });
  }
}
