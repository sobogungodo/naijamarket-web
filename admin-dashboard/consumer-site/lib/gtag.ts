// ============================================================
// lib/gtag.ts — NaijaMarket Intel GA4 Helper
// Consumer Site: naijamarketintel.ng
// ============================================================
// HOW TO GET YOUR MEASUREMENT ID:
//   1. Go to analytics.google.com
//   2. Admin → Data Streams → Your web stream
//   3. Copy the G-XXXXXXXXXX value
//   4. Add to .env.local: NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
// ============================================================

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';

// ---------------------------------------------------------
// TypeScript type for GA4 window object
// ---------------------------------------------------------
declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: Record<string, unknown>[];
  }
}

// ---------------------------------------------------------
// Track page views (call this on route change)
// ---------------------------------------------------------
export const pageview = (url: string): void => {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined') return;
  window.gtag('config', GA_MEASUREMENT_ID, {
    page_path: url,
  });
};

// ---------------------------------------------------------
// Track custom events — NaijaMarket specific
// ---------------------------------------------------------
type GTagEvent = {
  action: string;
  category: string;
  label?: string;
  value?: number;
};

export const event = ({ action, category, label, value }: GTagEvent): void => {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined') return;
  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
};

// ---------------------------------------------------------
// NaijaMarket Custom Events — Call these from your pages
// ---------------------------------------------------------

// Track when a user checks a commodity price
export const trackPriceCheck = (commodity: string, market: string): void => {
  event({ action: 'price_check', category: 'Engagement', label: `${commodity} - ${market}` });
};

// Track subscription CTA clicks
export const trackSubscriptionClick = (tier: string): void => {
  event({ action: 'subscription_click', category: 'Conversion', label: tier });
};

// Track WhatsApp bot link clicks
export const trackWhatsAppClick = (source: string): void => {
  event({ action: 'whatsapp_click', category: 'Engagement', label: source });
};

// Track search queries
export const trackSearch = (query: string): void => {
  event({ action: 'search', category: 'Engagement', label: query });
};

// Track market page views
export const trackMarketView = (marketName: string): void => {
  event({ action: 'market_view', category: 'Content', label: marketName });
};
