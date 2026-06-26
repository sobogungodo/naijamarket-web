// ============================================================
// components/GoogleAnalytics.tsx — Drop into Consumer Site Layout
// NaijaMarket Intel - naijamarketintel.ng
// ============================================================
// USAGE: Add <GoogleAnalytics /> inside your app/layout.tsx <head>
//
// Example:
//   import GoogleAnalytics from '@/components/GoogleAnalytics'
//   ...
//   <html>
//     <head>
//       <GoogleAnalytics />           ← Add this line
//     </head>
//     <body>{children}</body>
//   </html>
// ============================================================

'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { GA_MEASUREMENT_ID, pageview } from '../lib/gtag';

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track page views on route changes (SPA navigation)
  useEffect(() => {
    if (!GA_MEASUREMENT_ID) return;
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    pageview(url);
  }, [pathname, searchParams]);

  // Don't render anything if no measurement ID configured
  if (!GA_MEASUREMENT_ID) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[GA4] NEXT_PUBLIC_GA_MEASUREMENT_ID not set. Analytics disabled.');
    }
    return null;
  }

  return (
    <>
      {/* Google Analytics 4 — Load asynchronously, non-blocking */}
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <Script
        id="google-analytics-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}', {
              page_path: window.location.pathname,
              cookie_flags: 'SameSite=None;Secure',
              anonymize_ip: true,
              send_page_view: false
            });
          `,
        }}
      />
    </>
  );
}
