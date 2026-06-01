// src/app/api/auth/login/route.ts
// Proxies to func-naijamarket-api/login — no direct DB access from Vercel
import { NextRequest, NextResponse } from "next/server";

const FUNC_BASE = process.env.FUNC_API_BASE_URL || "https://func-naijamarket-api.azurewebsites.net/api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const resp = await fetch(`${FUNC_BASE}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": request.headers.get("x-forwarded-for") || "",
        "user-agent": request.headers.get("user-agent") || "",
      },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (error) {
    console.error("login proxy error:", error);
    return NextResponse.json({ error: "Login failed. Please try again." }, { status: 500 });
  }
}
