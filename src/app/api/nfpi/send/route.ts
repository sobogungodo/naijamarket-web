// src/app/api/nfpi/send/route.ts
// NaijaMarket Intel - NFPI WhatsApp Delivery System
// Sends weekly NFPI summaries via WhatsApp (Twilio)
// Created: 2026-01-18

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Twilio credentials from environment
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

// =============================================================================
// POST - Send NFPI Report via WhatsApp
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, tier, action } = body;

    // Validate required fields
    if (!phone) {
      return NextResponse.json({
        success: false,
        error: "Phone number is required"
      }, { status: 400 });
    }

    // Format phone for WhatsApp
    const formattedPhone = formatPhoneForWhatsApp(phone);

    // Get latest NFPI data
    const latest = await prisma.$queryRaw`
      SELECT TOP 1 
        FORMAT(week_id, 'yyyy-MM') as period,
        national_index,
        national_change_pct,
        national_change_direction,
        grains_index,
        proteins_index,
        vegetables_index,
        oils_index,
        top_gainers,
        top_losers,
        insight
      FROM NFPI_Weekly
      ORDER BY week_id DESC
    ` as any[];

    if (!latest || latest.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No NFPI data available"
      }, { status: 404 });
    }

    const nfpi = latest[0];

    // Generate message based on tier
    const message = generateNFPIMessage(nfpi, tier || "FREE");

    // Send via Twilio
    const sendResult = await sendWhatsAppMessage(formattedPhone, message);

    if (!sendResult.success) {
      return NextResponse.json({
        success: false,
        error: sendResult.error || "Failed to send WhatsApp message"
      }, { status: 500 });
    }

    // Log the delivery
    await logDelivery(phone, tier, "whatsapp", "success");

    return NextResponse.json({
      success: true,
      message: "NFPI report sent via WhatsApp",
      sid: sendResult.sid,
      to: formattedPhone
    });

  } catch (error) {
    console.error("NFPI Send Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error"
    }, { status: 500 });
  }
}

// =============================================================================
// GET - Bulk send to subscribers (for cron jobs)
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");
    
    // Verify cron secret to prevent unauthorized bulk sends
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({
        success: false,
        error: "Unauthorized"
      }, { status: 401 });
    }

    // Get all users with NFPI WhatsApp addon
    const subscribers = await prisma.$queryRaw`
      SELECT DISTINCT 
        c.phone,
        c.subscription_tier,
        c.first_name
      FROM Consumers c
      INNER JOIN Consumer_Addons ca ON c.consumer_id = ca.consumer_id
      WHERE ca.addon_code = 'NFPI_WHATSAPP'
        AND ca.status = 'ACTIVE'
        AND ca.expires_at > GETDATE()
    ` as any[];

    if (!subscribers || subscribers.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active NFPI WhatsApp subscribers",
        sent: 0
      });
    }

    // Get latest NFPI
    const latest = await prisma.$queryRaw`
      SELECT TOP 1 * FROM NFPI_Weekly ORDER BY week_id DESC
    ` as any[];

    if (!latest || latest.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No NFPI data available"
      }, { status: 404 });
    }

    const nfpi = latest[0];
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    // Send to each subscriber
    for (const sub of subscribers) {
      try {
        const message = generateNFPIMessage(nfpi, sub.subscription_tier, sub.first_name);
        const formattedPhone = formatPhoneForWhatsApp(sub.phone);
        
        const result = await sendWhatsAppMessage(formattedPhone, message);
        
        if (result.success) {
          sent++;
          await logDelivery(sub.phone, sub.subscription_tier, "whatsapp", "success");
        } else {
          failed++;
          errors.push(`${sub.phone}: ${result.error}`);
          await logDelivery(sub.phone, sub.subscription_tier, "whatsapp", "failed", result.error);
        }

        // Rate limit: 1 message per 100ms
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (err) {
        failed++;
        errors.push(`${sub.phone}: ${err}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `NFPI WhatsApp delivery complete`,
      total: subscribers.length,
      sent,
      failed,
      errors: errors.slice(0, 10) // Only return first 10 errors
    });

  } catch (error) {
    console.error("NFPI Bulk Send Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error"
    }, { status: 500 });
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatPhoneForWhatsApp(phone: string): string {
  // Remove all non-digits except leading +
  let cleaned = phone.replace(/[^\d+]/g, "");
  
  // If starts with 0, assume Nigerian and add +234
  if (cleaned.startsWith("0")) {
    cleaned = "+234" + cleaned.substring(1);
  }
  
  // Ensure it has + prefix
  if (!cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }
  
  return `whatsapp:${cleaned}`;
}

function generateNFPIMessage(nfpi: any, tier: string, firstName?: string): string {
  const index = parseFloat(nfpi.national_index);
  const change = parseFloat(nfpi.national_change_pct || 0);
  const direction = change > 0 ? "📈" : change < 0 ? "📉" : "➡️";
  
  // Inflation status
  let status = "🟢 LOW";
  if (index >= 140) status = "🔴 VERY HIGH";
  else if (index >= 125) status = "🟠 HIGH";
  else if (index >= 110) status = "🟡 MODERATE";

  // Basic message (FREE tier)
  let message = `📊 *NFPI Weekly Report*\n`;
  message += `━━━━━━━━━━━━━━━━━\n`;
  if (firstName) {
    message += `Hi ${firstName}! 👋\n\n`;
  }
  message += `*National Index:* ${index.toFixed(1)} ${direction}\n`;
  message += `*Change:* ${change > 0 ? "+" : ""}${change.toFixed(1)}% MoM\n`;
  message += `*Status:* ${status}\n\n`;

  // Add top movers
  if (nfpi.top_gainers) {
    message += `*Top Gainers:* ${nfpi.top_gainers}\n`;
  }
  if (nfpi.top_losers) {
    message += `*Top Losers:* ${nfpi.top_losers}\n`;
  }

  // Add category breakdown for SILVER+
  const premiumTiers = ["SILVER", "GOLD", "BUSINESS", "CORPORATE", "ENTERPRISE"];
  if (premiumTiers.includes(tier.toUpperCase())) {
    message += `\n*Category Breakdown:*\n`;
    message += `🌾 Grains: ${parseFloat(nfpi.grains_index || 100).toFixed(1)}\n`;
    message += `🥩 Proteins: ${parseFloat(nfpi.proteins_index || 100).toFixed(1)}\n`;
    message += `🥬 Vegetables: ${parseFloat(nfpi.vegetables_index || 100).toFixed(1)}\n`;
    message += `🛢️ Oils: ${parseFloat(nfpi.oils_index || 100).toFixed(1)}\n`;
  }

  // Add insight for GOLD+
  const goldTiers = ["GOLD", "BUSINESS", "CORPORATE", "ENTERPRISE"];
  if (goldTiers.includes(tier.toUpperCase()) && nfpi.insight) {
    message += `\n💡 *Insight:* ${nfpi.insight}\n`;
  }

  message += `\n━━━━━━━━━━━━━━━━━\n`;
  message += `📱 View full report: naijamarket.com/nfpi\n`;
  message += `Period: ${nfpi.period}`;

  return message;
}

async function sendWhatsAppMessage(to: string, body: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error("Twilio credentials not configured");
    return { success: false, error: "Twilio not configured" };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    
    const params = new URLSearchParams();
    params.append("To", to);
    params.append("From", TWILIO_WHATSAPP_FROM);
    params.append("Body", body);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });

    const result = await response.json();

    if (response.ok) {
      return { success: true, sid: result.sid };
    } else {
      console.error("Twilio error:", result);
      return { success: false, error: result.message || "Twilio API error" };
    }

  } catch (error) {
    console.error("WhatsApp send error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Network error" };
  }
}

async function logDelivery(
  phone: string, 
  tier: string, 
  channel: string, 
  status: string, 
  error?: string
): Promise<void> {
  try {
    // Log to database (create table if needed)
    await prisma.$executeRaw`
      INSERT INTO NFPI_Delivery_Log (phone, tier, channel, status, error_message, sent_at)
      VALUES (${phone}, ${tier}, ${channel}, ${status}, ${error || null}, GETDATE())
    `;
  } catch (err) {
    // Table might not exist, just log to console
    console.log(`NFPI Delivery: ${phone} | ${tier} | ${channel} | ${status}`);
  }
}
