// lib/cookies.ts
// NaijaMarket Intel - Cookie Consent Utilities
// GDPR (Finland/EU) + NDPR (Nigeria) compliant

export type CookieConsent = {
  necessary: true;          // always true — can't be disabled
  analytics: boolean;       // Google Analytics
  advertising: boolean;     // Google AdSense
  consentDate: string;      // ISO timestamp
  consentVersion: string;   // bump this when policy changes
};

const COOKIE_KEY = 'nmi_cookie_consent';
const CONSENT_VERSION = '1.0';
const COOKIE_MAX_AGE = 365; // days

// ── Read consent from localStorage ───────────────────────────────────────────
export function getConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(COOKIE_KEY);
    if (!raw) return null;
    const parsed: CookieConsent = JSON.parse(raw);
    // If policy version changed, force re-consent
    if (parsed.consentVersion !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ── Save consent ──────────────────────────────────────────────────────────────
export function saveConsent(prefs: Omit<CookieConsent, 'necessary' | 'consentDate' | 'consentVersion'>): CookieConsent {
  const consent: CookieConsent = {
    necessary: true,
    analytics: prefs.analytics,
    advertising: prefs.advertising,
    consentDate: new Date().toISOString(),
    consentVersion: CONSENT_VERSION,
  };
  localStorage.setItem(COOKIE_KEY, JSON.stringify(consent));

  // Apply consent to Google tag manager
  applyConsent(consent);

  return consent;
}

// ── Accept all ────────────────────────────────────────────────────────────────
export function acceptAll(): CookieConsent {
  return saveConsent({ analytics: true, advertising: true });
}

// ── Reject all (necessary only) ───────────────────────────────────────────────
export function rejectAll(): CookieConsent {
  return saveConsent({ analytics: false, advertising: false });
}

// ── Clear consent (for testing or "withdraw consent" in settings) ─────────────
export function clearConsent(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(COOKIE_KEY);
  // Remove GA cookies
  ['_ga', '_gid', '_gat', '_ga_XXXXXXXXXX'].forEach(name => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.naijamarketintel.com`;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
  });
}

// ── Apply consent to window.gtag ──────────────────────────────────────────────
// Google Consent Mode v2 — required for AdSense compliance from Jan 2024
export function applyConsent(consent: CookieConsent): void {
  if (typeof window === 'undefined') return;

  if (typeof (window as any).gtag === 'function') {
    (window as any).gtag('consent', 'update', {
      analytics_storage: consent.analytics ? 'granted' : 'denied',
      ad_storage: consent.advertising ? 'granted' : 'denied',
      ad_user_data: consent.advertising ? 'granted' : 'denied',
      ad_personalization: consent.advertising ? 'granted' : 'denied',
    });
  }

  // Load GA script only after analytics consent
  if (consent.analytics) {
    loadGoogleAnalytics();
  }
}

// ── Dynamically load Google Analytics ────────────────────────────────────────
// Replace G-XXXXXXXXXX with your real GA4 Measurement ID
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-XXXXXXXXXX';

let gaLoaded = false;
export function loadGoogleAnalytics(): void {
  if (typeof window === 'undefined' || gaLoaded) return;
  gaLoaded = true;

  const script = document.createElement('script');
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  script.async = true;
  document.head.appendChild(script);

  script.onload = () => {
    (window as any).dataLayer = (window as any).dataLayer || [];
    function gtag(...args: any[]) { (window as any).dataLayer.push(args); }
    (window as any).gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_ID, { anonymize_ip: true });
  };
}

// ── Default consent (before user decides) — required by Google ────────────────
// Call this in _app or layout BEFORE any gtag calls
export function setDefaultConsent(): void {
  if (typeof window === 'undefined') return;
  (window as any).dataLayer = (window as any).dataLayer || [];
  function gtag(...args: any[]) { (window as any).dataLayer.push(args); }
  (window as any).gtag = gtag;

  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500,
  });
}
