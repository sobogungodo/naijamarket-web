# Meta WhatsApp Templates — TODO for Twilio→Meta migration (batch 2)

Batch 1 (shipped, commit `cae5849`) migrated the sends that already had approved templates:
flutterwave payment-confirmed → `sendPaymentConfirmed`, expiry reminders → `sendExpiryReminder`.

The sends below are **still on the dead Twilio path** (no-op in Vercel — no `TWILIO_AUTH_TOKEN`).
Each needs a Meta template **created + approved in Business Manager** before its code can be migrated.

## How to use this
1. In Meta Business Manager → WhatsApp Manager → Message Templates → Create template.
2. Name = the `name` below (lowercase_snake_case). Category = **UTILITY** (all are transactional).
3. Language = English. Paste the **Body** exactly (with `{{n}}` placeholders). Add the sample values.
4. After approval, add a wrapper to `src/lib/whatsapp.ts` (signature given) and swap the call site.

Existing wrappers already in `src/lib/whatsapp.ts`: `sendPaymentConfirmed`, `sendReferralCreditApplied`,
`sendPriceAlert`, `sendExpiryReminder`, `sendMorningBrief`.

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

## 9. `nfpi_weekly_summary`  (UTILITY/MARKETING?)  — nfpi/send
Weekly NFPI index summary. Body/params TBD — needs the exact message content confirmed (rich summary;
likely index value + WoW change + top movers). Draft once content is finalized.

## 10. `fmcg_alert`  (UTILITY)  — fmcg-alerts/send
FMCG price-change alert. Body/params TBD — confirm the exact fields (item, threshold %, new price).

---

## Also (no template / deferred)
- `whatsapp/send/route.ts` — generic arbitrary-body passthrough. Can't be a single template; either retire it
  or convert each caller to a specific template. Audit callers first.
- `functions/tokens.ts` — token purchase confirmation. Token wallet is OFF (double-credit bug); migrate when
  tokens are re-enabled.
- `health/route.ts`, `alerts/test-send/route.ts` — internal diagnostics; repoint to a Meta config/health check
  or remove. No user impact.
