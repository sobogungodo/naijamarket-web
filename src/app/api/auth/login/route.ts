// src/app/api/auth/login/route.ts
// Proxies to func-naijamarket-api/login — no direct DB access from Vercel
import { NextRequest, NextResponse } from "next/server";

const FUNC_BASE = process.env.FUNC_API_BASE_URL || "https://func-naijamarket-api.azurewebsites.net/api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Normalise phone to full international format (same as send-otp proxy).
    // Login form sends phone="9131095009" + countryCode="+234" separately.
    const rawPhone   = String(body.phone   || "").replace(/\D/g, "");
    const rawCountry = String(body.countryCode || "234").replace(/\D/g, "");
    const fullPhone  = rawPhone.startsWith(rawCountry)
      ? rawPhone
      : rawCountry + rawPhone;
    const forwardBody = { ...body, phone: fullPhone };

    const resp = await fetch(`${FUNC_BASE}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": request.headers.get("x-forwarded-for") || "",
        "user-agent": request.headers.get("user-agent") || "",
      },
      body: JSON.stringify(forwardBody),
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (error) {
    console.error("login proxy error:", error);
    return NextResponse.json({ error: "Login failed. Please try again." }, { status: 500 });
  }
}
