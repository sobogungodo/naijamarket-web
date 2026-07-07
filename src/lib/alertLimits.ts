// src/lib/alertLimits.ts
// Single source of truth for price-alert tier caps + phone canonicalization.
// Imported by both /api/alerts (web) and /api/mobile/consumer/alerts (mobile)
// so the paywall and cross-door count can never drift between the two routes.

// Alert limits by subscription tier. -1 = unlimited, 0 = feature not available.
export const ALERT_LIMITS: Record<string, number> = {
  FREE: 0,
  SILVER: 0,
  GOLD: 5,
  BUSINESS: 10,
  CORPORATE: 20,
  ENTERPRISE: -1, // Unlimited
  OGA_BOSS: -1,
  GOVERNMENT: -1,
};

// Canonical E.164 (+<digits>) — matches Consumers.phone_number (+prefixed);
// strips a naked Consumers.phone to the same shape.
export function toE164(p: string): string {
  const d = (p || "").replace(/\D/g, "");
  return d ? "+" + d : "";
}
