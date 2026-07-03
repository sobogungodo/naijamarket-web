// src/lib/whatsapp.ts
// Shared Meta WhatsApp sender — replaces all Twilio sendWhatsApp() calls
// Models: naijamarket-trader/src/app/api/auth/send-otp/route.ts (proven live)

const META_API_URL = `https://graph.facebook.com/v18.0/${process.env.META_PHONE_NUMBER_ID}/messages`;

function normalizePhone(phone: string): string {
  let p = phone.replace(/\D/g, '');
  if (p.startsWith('0')) p = '234' + p.substring(1);
  if (!p.startsWith('234')) p = '234' + p;
  return p;
}

export async function sendMetaTemplate(
  phone: string,
  templateName: string,
  parameters: string[]  // ordered list matching {{1}}, {{2}}... in template body
): Promise<boolean> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token || !process.env.META_PHONE_NUMBER_ID) {
    console.error('[WA] META_ACCESS_TOKEN or META_PHONE_NUMBER_ID not set');
    return false;
  }

  const components = parameters.length > 0 ? [{
    type: 'body',
    parameters: parameters.map(value => ({ type: 'text', text: String(value) }))
  }] : [];

  try {
    const res = await fetch(META_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizePhone(phone),
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en' },
          components,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error(`[WA] Template send failed (${templateName}):`, err?.error?.message);
      return false;
    }

    console.log(`[WA] Template sent: ${templateName} → ${phone}`);
    return true;
  } catch (err: any) {
    console.error(`[WA] Template send error (${templateName}):`, err?.message || err);
    return false;
  }
}

// Convenience wrappers — one per approved template
export const sendReferralCreditApplied = (phone: string, creditNaira: string, bonusDays: number, newEndDate: string) =>
  sendMetaTemplate(phone, 'referral_credit_notice', [creditNaira, String(bonusDays), newEndDate]);

export const sendPaymentConfirmed = (phone: string, tier: string, expiryDate: string) =>
  sendMetaTemplate(phone, 'subscription_payment_confirmed', [tier, expiryDate]);

export const sendPriceAlert = (phone: string, item: string, market: string, price: string, unit: string) =>
  sendMetaTemplate(phone, 'price_alert_triggered', [item, market, price, unit]);

export const sendExpiryReminder = (phone: string, tier: string, daysLeft: string, expiryDate: string) =>
  sendMetaTemplate(phone, 'subscription_expiry_reminder', [tier, daysLeft, expiryDate]);

export const sendMorningBrief = (phone: string, marketCount: string, topItem: string, changePct: string) =>
  sendMetaTemplate(phone, 'morning_brief_ready', [marketCount, topItem, changePct]);
