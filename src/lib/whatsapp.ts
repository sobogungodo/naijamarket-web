// src/lib/whatsapp.ts
// Shared Meta WhatsApp sender — replaces all Twilio sendWhatsApp() calls
// Models: naijamarket-trader/src/app/api/auth/send-otp/route.ts (proven live)

const META_API_URL = `https://graph.facebook.com/v22.0/${process.env.META_PHONE_NUMBER_ID}/messages`;

function normalizePhone(phone: string): string {
  // Capture an explicit '+' (E.164) BEFORE stripping symbols, then fall back to
  // STRUCTURAL Nigeria detection — the number often arrives naked (the live
  // webhook log showed "358465526959" with no '+'). Never blind-prepend 234 to
  // a number that already carries a country code (that mangled +358 -> 234358).
  const hadPlus = phone.trim().startsWith('+');
  const p = phone.replace(/\D/g, '');
  if (hadPlus) return p;                              // explicit E.164, any country → as-is
  if (p.startsWith('234')) return p;                 // NG full country code, no '+'
  if (p.startsWith('0')) return '234' + p.slice(1);  // NG local, 0-prefixed
  if (p.length === 10) return '234' + p;             // NG bare 10-digit local
  return p;                                          // already a non-234 country code → as-is
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

  // Bound the Graph call: a non-completing request must fail loudly (logged via
  // the catch) instead of hanging until the platform kills the function with no
  // logged outcome — the exact silence observed. 8s stays under Vercel's default
  // function limit so the abort fires and logs before any platform timeout.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
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
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.json();
      console.error(`[WA] Template send failed (${templateName}):`, err?.error?.message);
      return false;
    }

    console.log(`[WA] Template sent: ${templateName} → ${phone}`);
    return true;
  } catch (err: any) {
    console.error(`[WA] Template send error (${templateName}):`, err?.name === 'AbortError' ? 'timeout after 8s' : (err?.message || err));
    return false;
  } finally {
    clearTimeout(timeoutId);
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

export const sendAddOnActivated = (phone: string, name: string, amount: string) =>
  sendMetaTemplate(phone, 'add_on_activated', [name, amount]);

export const sendMorningBriefActivated = (phone: string, amount: string, validUntil: string) =>
  sendMetaTemplate(phone, 'morning_brief_activated', [amount, validUntil]);

export const sendPaymentFailed = (phone: string, amount: string, reason: string) =>
  sendMetaTemplate(phone, 'payment_failed', [amount, reason]);

// Uses a fresh UTILITY template name. The old `renewal_failed` was categorized
// MARKETING in Business Manager (suppressed for opted-out users); UTILITY is
// required for guaranteed transactional delivery. Body is identical.
export const sendRenewalFailed = (phone: string, graceDays: string) =>
  sendMetaTemplate(phone, 'subscription_renewal_failed', [graceDays]);

export const sendRefundProcessed = (phone: string, amount: string) =>
  sendMetaTemplate(phone, 'refund_processed', [amount]);

export const sendGracePeriodStarted = (phone: string, tier: string, graceEnd: string) =>
  sendMetaTemplate(phone, 'subscription_expired_grace', [tier, graceEnd]);

export const sendDowngradedToFree = (phone: string, tier: string) =>
  sendMetaTemplate(phone, 'subscription_downgraded', [tier]);

export const sendPriceAlertV2 = (phone: string, item: string, direction: string, market: string, target: string, current: string) =>
  sendMetaTemplate(phone, 'price_alert_v2', [item, direction, market, target, current]);

export const sendNfpiWeeklySummary = (phone: string, index: string, change: string, topMovers: string) =>
  sendMetaTemplate(phone, 'nfpi_weekly_summary', [index, change, topMovers]);

export const sendFmcgAlert = (phone: string, item: string, direction: string, market: string, newPrice: string, changePct: string) =>
  sendMetaTemplate(phone, 'fmcg_alert', [item, direction, market, newPrice, changePct]);
