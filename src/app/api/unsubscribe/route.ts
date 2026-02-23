// src/app/api/unsubscribe/route.ts
// NaijaMarket Intel - Email Unsubscribe Handler
// Version: 1.0.0
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");

  if (!email) {
    return new NextResponse(unsubscribePage("", false, "No email provided"), {
      headers: { "Content-Type": "text/html" },
    });
  }

  try {
    const result = await prisma.$executeRaw`
      UPDATE Email_Subscribers 
      SET is_active = 0, unsubscribed_at = SYSUTCDATETIME()
      WHERE email = ${email.toLowerCase().trim()} AND is_active = 1
    `;

    const success = result > 0;

    return new NextResponse(
      unsubscribePage(email, success, success ? "unsubscribed" : "not_found"),
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (error) {
    console.error("[UNSUBSCRIBE] Error:", error);
    return new NextResponse(unsubscribePage(email, false, "error"), {
      headers: { "Content-Type": "text/html" },
    });
  }
}

function unsubscribePage(email: string, success: boolean, status: string): string {
  const title = success ? "Unsubscribed" : "Oops";
  const message = success
    ? `<strong>${email}</strong> has been removed from our mailing list. You won't receive any more emails from us.`
    : status === "not_found"
    ? "This email address wasn't found in our subscriber list."
    : "Something went wrong. Please contact support@naijamarketintel.ng.";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | NaijaMarket Intel</title></head>
<body style="margin:0;padding:40px 20px;background:#0A0F14;font-family:sans-serif;color:#E2E8F0;text-align:center;">
  <div style="max-width:480px;margin:0 auto;padding:40px;background:#111820;border-radius:16px;border:1px solid rgba(255,255,255,0.06);">
    <div style="font-size:40px;margin-bottom:16px;">${success ? "👋" : "⚠️"}</div>
    <h1 style="font-size:22px;margin:0 0 12px;color:#fff;">${title}</h1>
    <p style="font-size:15px;color:#94A3B8;line-height:1.6;margin:0 0 24px;">${message}</p>
    ${success ? '<p style="font-size:13px;color:#475569;">Changed your mind? <a href="https://www.naijamarketintel.ng" style="color:#00C853;">Resubscribe</a></p>' : ""}
    <a href="https://www.naijamarketintel.ng" style="display:inline-block;margin-top:16px;padding:10px 24px;background:#00C853;color:#0A0F14;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Back to NaijaMarket Intel</a>
  </div>
</body></html>`;
}
