// src/lib/flags.ts
// Central monetization kill-switch. Free consumer tier only for now — the in-app
// upgrade (subscribe checkout) and token-pack purchases are disabled everywhere they
// are gated on these flags. Flip to `true` to re-enable; the payment UI is preserved.
export const PAYMENTS_ENABLED = true;
export const TOKENS_ENABLED = true;
