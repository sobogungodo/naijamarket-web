// Token purchase deep-link bridge for mobile app.
// Paystack redirects here after payment (source:'app').
// This route redirects into the consumer app via deep link.
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get("ref") || "";
  const deepLink = `naijamarketconsumer://account?token=success&ref=${encodeURIComponent(ref)}`;
  return NextResponse.redirect(deepLink, { status: 302 });
}
