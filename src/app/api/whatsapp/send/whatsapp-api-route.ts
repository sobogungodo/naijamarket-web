// src/app/api/whatsapp/send/route.ts
// NaijaMarket Intel - WhatsApp Message API (via Twilio)

import { NextRequest, NextResponse } from "next/server";

// Twilio Configuration (set these in Vercel Environment Variables)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";

// Message Templates
const MESSAGE_TEMPLATES = {
  // ==================== PRICE ALERTS ====================
  PRICE_ALERT_BELOW: (data: {
    itemName: string;
    marketName: string;
    categoryName: string;
    targetPrice: number;
    currentPrice: number;
    percentChange: number;
  }) => `🔔 *PRICE ALERT TRIGGERED!*

📦 *Item:* ${data.itemName}
🏪 *Market:* ${data.marketName}
📁 *Category:* ${data.categoryName}

The price has *dropped below* your target!

━━━━━━━━━━━━━━━━━━━━━━
🎯 *Target:* ₦${formatPrice(data.targetPrice)}
💰 *Current:* ₦${formatPrice(data.currentPrice)}
📉 *Change:* ${data.percentChange.toFixed(1)}% ↓
━━━━━━━━━━━━━━━━━━━━━━

Type *price* to check more prices.`,

  PRICE_ALERT_ABOVE: (data: {
    itemName: string;
    marketName: string;
    categoryName: string;
    targetPrice: number;
    currentPrice: number;
    percentChange: number;
  }) => `🔔 *PRICE ALERT TRIGGERED!*

📦 *Item:* ${data.itemName}
🏪 *Market:* ${data.marketName}
📁 *Category:* ${data.categoryName}

The price has *risen above* your target!

━━━━━━━━━━━━━━━━━━━━━━
🎯 *Target:* ₦${formatPrice(data.targetPrice)}
💰 *Current:* ₦${formatPrice(data.currentPrice)}
📈 *Change:* +${data.percentChange.toFixed(1)}% ↑
━━━━━━━━━━━━━━━━━━━━━━

Type *price* to check more prices.`,

  // ==================== SUBSCRIPTION REMINDERS ====================
  SUB_EXPIRING_7_DAYS: (data: { name: string; tierName: string; expiryDate: string }) =>
    `⏰ *SUBSCRIPTION EXPIRING SOON*

Hi ${data.name}, your *${data.tierName}* plan expires in 7 days.

📅 Expiry Date: ${data.expiryDate}

Renew now to avoid interruption!
Type *upgrade* to renew.`,

  SUB_EXPIRING_3_DAYS: (data: { name: string; tierName: string; expiryDate: string }) =>
    `⚠️ *SUBSCRIPTION EXPIRING IN 3 DAYS*

Hi ${data.name}, your *${data.tierName}* plan expires soon!

📅 Expiry Date: ${data.expiryDate}

Type *upgrade* to renew now.`,

  SUB_EXPIRING_1_DAY: (data: { name: string; tierName: string; expiryDate: string }) =>
    `🚨 *SUBSCRIPTION EXPIRES TOMORROW*

Hi ${data.name}, your *${data.tierName}* plan expires tomorrow!

📅 Expiry Date: ${data.expiryDate}

Type *upgrade* to renew NOW.`,

  SUB_EXPIRED: (data: { name: string; tierName: string }) =>
    `📉 *SUBSCRIPTION EXPIRED*

Hi ${data.name}, your *${data.tierName}* plan has expired.

Your account has been downgraded to FREE:
📊 Daily queries: 3/week
🏪 Markets: 1

Type *upgrade* anytime to restore premium benefits.`,

  // ==================== PAYMENT NOTIFICATIONS ====================
  PAYMENT_SUCCESS: (data: {
    name: string;
    tierName: string;
    amount: number;
    reference: string;
    validUntil: string;
  }) => `✅ *PAYMENT SUCCESSFUL!*

Hi ${data.name}, your payment has been confirmed.

━━━━━━━━━━━━━━━━━━━━━━
📦 Plan: *${data.tierName}*
💰 Amount: ₦${formatPrice(data.amount)}
🔖 Reference: ${data.reference}
📅 Valid until: ${data.validUntil}
━━━━━━━━━━━━━━━━━━━━━━

Thank you for subscribing!
Type *menu* to continue.`,

  PAYMENT_FAILED: (data: { name: string; reason: string }) =>
    `❌ *PAYMENT FAILED*

Hi ${data.name}, your payment could not be processed.

Reason: ${data.reason}

Please try again:
• Type *UPGRADE* to retry
• Use a different card or payment method

Need help? Type *help*`,

  PAYMENT_PENDING: (data: { name: string; amount: number; reference: string }) =>
    `⏳ *PAYMENT PENDING*

Hi ${data.name}, your bank transfer of ₦${formatPrice(data.amount)} has been initiated.

Reference: ${data.reference}

Your account will be upgraded automatically once payment is confirmed (usually within 1-24 hours).

Type *verify* to check payment status.`,

  // ==================== DAILY UPDATES ====================
  DAILY_UPDATE: (data: {
    greeting: string;
    name: string;
    marketName: string;
    prices: Array<{ itemName: string; price: number; trend: string; change: number }>;
  }) => {
    let priceList = data.prices
      .map((p) => {
        const trend = p.trend === "UP" ? "↑" : p.trend === "DOWN" ? "↓" : "→";
        const changeStr = p.change !== 0 ? ` (${p.change > 0 ? "+" : ""}${p.change.toFixed(1)}%)` : "";
        return `• ${p.itemName}: ₦${formatPrice(p.price)} ${trend}${changeStr}`;
      })
      .join("\n");

    return `📊 *DAILY PRICE UPDATE*

Good ${data.greeting} ${data.name}!

🏪 *${data.marketName}*
━━━━━━━━━━━━━━━━━━━━━━
${priceList}
━━━━━━━━━━━━━━━━━━━━━━

Type *price* to check specific items.
Type *menu* for more options.`;
  },

  // ==================== REGISTRATION ====================
  REGISTRATION_WELCOME: (data: { name: string; tierName: string; queriesPerWeek: number; markets: number }) =>
    `🎉 *REGISTRATION COMPLETE!*

Welcome, *${data.name}*!

🆓 *Your ${data.tierName} Account:*
• ${data.queriesPerWeek} price queries/week
• ${data.markets} market access

💡 Type *upgrade* for more queries!
Type *menu* to get started.`,

  // ==================== WEEKLY REPORT ====================
  WEEKLY_REPORT: (data: {
    name: string;
    weekStart: string;
    weekEnd: string;
    topGainers: Array<{ item: string; change: number }>;
    topLosers: Array<{ item: string; change: number }>;
  }) => {
    const gainers = data.topGainers.map((g) => `• ${g.item}: +${g.change.toFixed(1)}%`).join("\n");
    const losers = data.topLosers.map((l) => `• ${l.item}: ${l.change.toFixed(1)}%`).join("\n");

    return `📈 *WEEKLY MARKET REPORT*

Hi ${data.name}!
Week: ${data.weekStart} - ${data.weekEnd}

*🔺 TOP GAINERS:*
${gainers}

*🔻 TOP LOSERS:*
${losers}

Type *price* for current prices.`;
  },

  // ==================== GENERIC NOTIFICATION ====================
  GENERIC: (data: { message: string }) => data.message,
};

// Helper function to format price with commas
function formatPrice(price: number): string {
  return price.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Normalize phone number to WhatsApp format
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");

  // Handle Nigerian numbers
  if (cleaned.startsWith("0")) {
    cleaned = "234" + cleaned.substring(1);
  }

  // Ensure it starts with country code
  if (!cleaned.startsWith("234") && !cleaned.startsWith("358") && cleaned.length === 10) {
    cleaned = "234" + cleaned;
  }

  return `whatsapp:+${cleaned}`;
}

// Send WhatsApp message via Twilio
async function sendWhatsAppMessage(to: string, body: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return { success: false, error: "Twilio credentials not configured" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

  const formData = new URLSearchParams();
  formData.append("From", TWILIO_WHATSAPP_NUMBER);
  formData.append("To", normalizePhone(to));
  formData.append("Body", body);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const result = await response.json();

    if (response.ok) {
      return { success: true, sid: result.sid };
    } else {
      return { success: false, error: result.message || "Failed to send message" };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// API Route Handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, templateType, templateData, customMessage } = body;

    // Validate required fields
    if (!phone) {
      return NextResponse.json({ success: false, error: "Phone number is required" }, { status: 400 });
    }

    let messageBody: string;

    // Use custom message or template
    if (customMessage) {
      messageBody = customMessage;
    } else if (templateType && MESSAGE_TEMPLATES[templateType as keyof typeof MESSAGE_TEMPLATES]) {
      const template = MESSAGE_TEMPLATES[templateType as keyof typeof MESSAGE_TEMPLATES];
      messageBody = typeof template === "function" ? template(templateData || {}) : template;
    } else {
      return NextResponse.json({ success: false, error: "Invalid template type or missing custom message" }, { status: 400 });
    }

    // Send message
    const result = await sendWhatsAppMessage(phone, messageBody);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "WhatsApp message sent successfully",
        sid: result.sid,
        recipient: normalizePhone(phone),
      });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error("WhatsApp API Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint for testing/documentation
export async function GET() {
  return NextResponse.json({
    success: true,
    message: "NaijaMarket WhatsApp API",
    availableTemplates: Object.keys(MESSAGE_TEMPLATES),
    usage: {
      method: "POST",
      body: {
        phone: "08012345678 (required)",
        templateType: "PRICE_ALERT_BELOW | SUB_EXPIRING_7_DAYS | PAYMENT_SUCCESS | etc.",
        templateData: "{ object with template-specific data }",
        customMessage: "Optional: Send any custom message instead of template",
      },
    },
    example: {
      phone: "08012345678",
      templateType: "PRICE_ALERT_BELOW",
      templateData: {
        itemName: "Rice (50kg)",
        marketName: "Mile 12 Market",
        categoryName: "Grains",
        targetPrice: 45000,
        currentPrice: 43000,
        percentChange: -4.4,
      },
    },
  });
}
