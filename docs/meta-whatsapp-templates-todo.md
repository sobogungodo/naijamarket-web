# Meta WhatsApp Templates — Twilio→Meta migration (batch 2)

Batch 1 (shipped, commit `cae5849`) migrated the sends that already had approved templates:
flutterwave payment-confirmed → `sendPaymentConfirmed`, expiry reminders → `sendExpiryReminder`.

**Batch 2 code migration is now done** (branch `chore/twilio-meta-cleanup`): every call site below has
been repointed off `api.twilio.com` onto its Meta wrapper in `src/lib/whatsapp.ts`, and the Twilio
route/helpers/env constants were removed. All wrappers already exist. The **only remaining gate is
approving each template in Business Manager** — until a template is approved the wrapper's Graph call
returns a soft failure (`false`), the same "delivers nothing" state as the old dead Twilio path, but
now with no Twilio coupling. Delivery resumes automatically once the template clears review.

## How to finish each item
1. In Meta Business Manager → WhatsApp Manager → Message Templates → Create template.
2. Name = the `name` below (lowercase_snake_case). Category = **UTILITY** (all are transactional).
3. Language = English. Paste the **Body** exactly (with `{{n}}` placeholders). Add the sample values.
4. On approval, no code change is needed — the wrapper name below already matches the template name.

Wrappers in `src/lib/whatsapp.ts` (all present): `sendPaymentConfirmed`, `sendReferralCreditApplied`,
`sendPriceAlert`, `sendExpiryReminder`, `sendMorningBrief`, `sendAddOnActivated`,
`sendMorningBriefActivated`, `sendPaymentFailed`, `sendRenewalFailed`, `sendRefundProcessed`,
`sendGracePeriodStarted`, `sendDowngradedToFree`, `sendPriceAlertV2`, `sendNfpiWeeklySummary`,
`sendFmcgAlert`.

---

## 1. `add_on_activated`  (UTILITY)  — paystack L322, flutterwave L294
**Body:**
```
✅ Add-On Activated!

{{1}} is now active.
Payment: {{2}}

Type *mystatus* to see details.
```
Params: `{{1}}`=add-on/tier name, `{{2}}`=amount (e.g. "₦2,000")
Wrapper: `sendAddOnActivated(phone, name: string, amount: string)`

## 2. `morning_brief_activated`  (UTILITY)  — paystack L351, flutterwave L315
**Body:**
```
✅ Morning Brief Activated!

You'll receive daily market prices at 5:30 AM.
Payment: {{1}}
Valid until: {{2}}

🌅 See you tomorrow morning!
```
Params: `{{1}}`=amount, `{{2}}`=valid-until date
Wrapper: `sendMorningBriefActivated(phone, amount: string, validUntil: string)`
NOTE: distinct from the daily brief itself (that maps to the existing `morning_brief_ready`).

## 3. `payment_failed`  (UTILITY)  — paystack L404, flutterwave L249
**Body:**
```
❌ Payment Failed

We couldn't process your payment of {{1}}.

📋 Reason: {{2}}

Type *upgrade* to retry.
```
Params: `{{1}}`=amount, `{{2}}`=reason
Wrapper: `sendPaymentFailed(phone, amount: string, reason: string)`
NOTE: flutterwave's variant omits reason — pass a generic reason string, or make `{{2}}` = "Payment not completed".

## 4. `renewal_failed`  (UTILITY)  — paystack L422
**Body:**
```
⚠️ Subscription Renewal Failed

We couldn't renew your subscription.

You have {{1}} days before downgrade to FREE.

Type *upgrade* to renew now.
```
Params: `{{1}}`=grace days (e.g. "3")
Wrapper: `sendRenewalFailed(phone, graceDays: string)`

## 5. `refund_processed`  (UTILITY)  — paystack L434
**Body:**
```
💰 Refund Processed

Your refund of {{1}} has been processed.
Please allow 3–5 business days to see it in your account.
```
Params: `{{1}}`=amount
Wrapper: `sendRefundProcessed(phone, amount: string)`

## 6. `subscription_expired_grace`  (UTILITY)  — check-expiry L184
**Body:**
```
🔶 Subscription Expired

Your {{1}} plan has expired.

You still have access until {{2}} (grace period).
After that, your account will be downgraded to FREE.

Type *upgrade* to renew and keep your access.
```
Params: `{{1}}`=tier name, `{{2}}`=grace-end date
Wrapper: `sendGracePeriodStarted(phone, tier: string, graceEnd: string)`

## 7. `subscription_downgraded`  (UTILITY)  — check-expiry L230
**Body:**
```
🔴 Subscription Downgraded

Your {{1}} plan has been downgraded to FREE due to non-renewal.

FREE tier includes:
• 3 price queries per week
• Yesterday's prices only

Type *upgrade* anytime to reactivate your plan.
```
Params: `{{1}}`=previous tier name
Wrapper: `sendDowngradedToFree(phone, tier: string)`
⚠️ COPY FIX vs current dead Twilio text: says "3 price queries per **day**" — corrected here to "per **week**" (FREE = 3/week as of wa-v140).

## 8. `price_alert_triggered` — REDESIGN NEEDED  — alerts/check L301, alerts/process
The existing `price_alert_triggered` template (wrapper `sendPriceAlert(item, market, price, unit)`) does **not**
fit the real alert data: an alert has an item, market, a **target** price, a **current** price, and a direction —
there is no "unit". Either redesign this template or add a new one:
**Proposed `price_alert_v2` Body:**
```
📊 Price Alert

{{1}} has {{2}} your target at {{3}}.

🎯 Your target: {{4}}
💰 Current price: {{5}}

👉 View prices: https://naijamarketintel.com/dashboard/prices
```
Params: `{{1}}`=item, `{{2}}`="risen above"/"fallen below", `{{3}}`=market, `{{4}}`=target price, `{{5}}`=current price
Wrapper: `sendPriceAlertV2(phone, item, direction, market, target, current)`

## 9. `nfpi_weekly_summary`  (UTILITY/MARKETING?)  — NO CALL SITE
The `nfpi/send` route (GET cron + POST) was **removed** — it had no in-app caller, was not in
`vercel.json`, and existed only to send via Twilio. Its registry entry (`nfpi-send`) was dropped too.
The `sendNfpiWeeklySummary` wrapper remains for a future NFPI-over-WhatsApp feature; wire a new call
site if/when that ships. Body/params still TBD.

## 10. `fmcg_alert`  (UTILITY)  — CALL SITE STRIPPED
`fmcg-alerts/send` kept its Email (Brevo) + webhook delivery; the **Twilio WhatsApp path was removed**
(the rich multi-item WA content had no matching template). WHATSAPP-only subscribers get nothing until
a template + call site are added. The `sendFmcgAlert` wrapper exists; design the template body first.

---

## Also (retired / deferred)
- `whatsapp/send/route.ts` — generic arbitrary-body Twilio passthrough. **Removed** (no in-app caller).
- `functions/tokens.ts` — token purchase confirmation. Twilio block **stripped**; token wallet is OFF
  (double-credit bug), so wire a Meta template here when tokens are re-enabled.
- `health/route.ts` — the diagnostic probe was **repointed** from Twilio to a Meta env check
  (`META_ACCESS_TOKEN` / `META_PHONE_NUMBER_ID`).
- `alerts/test-send/route.ts` — internal diagnostic; repoint to a Meta config/health check or remove. No user impact.
