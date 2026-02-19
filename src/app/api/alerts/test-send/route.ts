// ============================================================================
// src/app/api/alerts/test-send/route.ts  
// NaijaFood Intel - Quick WhatsApp Test Sender
// Tests Twilio connection independently of the alert system
// Usage: GET /api/alerts/test-send?phone=08012345678
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone");

  // ---- Step 1: Check environment ----
  const envCheck = {
    TWILIO_ACCOUNT_SID: TWILIO_ACCOUNT_SID ? `✅ ${TWILIO_ACCOUNT_SID.substring(0, 10)}...` : "❌ NOT SET",
    TWILIO_AUTH_TOKEN: TWILIO_AUTH_TOKEN ? "✅ Set (hidden)" : "❌ NOT SET",
    TWILIO_WHATSAPP_FROM: TWILIO_WHATSAPP_FROM,
  };

  if (!phone) {
    return NextResponse.json({
      success: false,
      message: "Add ?phone=08012345678 to send a test WhatsApp message",
      env: envCheck,
      usage: {
        test: "/api/alerts/test-send?phone=08012345678",
        diagnose: "/api/alerts/process?diagnose=true",
        dryRun: "/api/alerts/process?test=true&dry=true",
        liveRun: "/api/alerts/process?test=true",
      },
    });
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return NextResponse.json({
      success: false,
      error: "Twilio credentials not configured in Vercel environment variables",
      env: envCheck,
      fix: "Go to Vercel Dashboard → Settings → Environment Variables → Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN",
    });
  }

  // ---- Step 2: Format phone ----
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = "234" + cleaned.substring(1);
  if (!cleaned.startsWith("234") && cleaned.length === 10) cleaned = "234" + cleaned;
  const toNumber = `whatsapp:+${cleaned}`;

  // ---- Step 3: Send test message ----
  const message = `🧪 *NaijaFood Alert Test*

This is a test message from NaijaFood Intel.

If you see this, your WhatsApp alert delivery is working! ✅

📊 Your price alerts will be delivered to this number.

⏰ ${new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}`;

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    
    const params = new URLSearchParams();
    params.append("From", TWILIO_WHATSAPP_FROM);
    params.append("To", toNumber);
    params.append("Body", message);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const result = await response.json();

    if (response.ok && result.sid) {
      return NextResponse.json({
        success: true,
        message: `✅ Test WhatsApp sent to ${toNumber}`,
        messageSid: result.sid,
        status: result.status,
        from: TWILIO_WHATSAPP_FROM,
        to: toNumber,
        note: "If using Twilio sandbox, recipient must first send 'join <sandbox-word>' to the sandbox number.",
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.message || result.error_message || "Unknown Twilio error",
        code: result.code,
        moreInfo: result.more_info,
        from: TWILIO_WHATSAPP_FROM,
        to: toNumber,
        troubleshooting: {
          "Error 21608": "Recipient hasn't opted in. They must send 'join <word>' to the sandbox number first.",
          "Error 21211": "Invalid phone number format. Must be E.164: +234XXXXXXXXXX",
          "Error 20003": "Invalid Twilio credentials. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.",
          "Error 63007": "Twilio WhatsApp sandbox not configured or expired.",
        },
      });
    }
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      to: toNumber,
    }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
