// ============================================================================
// src/app/layout.tsx
// NaijaMarket Intel — Root Layout
// Version: 2.1.0 - Added complete PWA meta tags for install and offline support
// FIX: Removed forcedTheme="dark" + enableSystem={false} that was blocking
//      theme propagation. Added anti-flash script to prevent FOUC on navigation.
// ============================================================================

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import Providers from "@/components/Providers";
import { ThemeProvider } from "@/components/ThemeProvider";
import AuthShell from "@/components/AuthShell";
import { SingleSessionProvider } from "@/components/SingleSessionProvider";
import SessionExpiredModal from "@/components/SessionExpiredModal";
import { Toaster } from "sonner";
import WhatsAppCTA from "@/components/WhatsAppCTA";
import CookieBanner from "@/components/CookieBanner";
import AnalyticsProvider from "@/components/AnalyticsProvider";
import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NaijaMarket Intel - The Bloomberg of Nigerian Commodities",
  description: "Real-time commodity price intelligence for Nigerian markets. Track food prices across 282 markets in 36 states + FCT. Updated 3× daily by GPS-verified traders.",
  manifest: "/manifest.json",
  applicationName: "NaijaMarket Intel",
  keywords: ["Nigeria food prices", "commodity prices Nigeria", "market prices Nigeria", "food price tracker", "Nigerian market intelligence", "NaijaMarket Intel", "Bloomberg Nigeria", "commodity intelligence"],
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NaijaMarket",
  },
  formatDetection: {
    telephone: true,
    date: true,
    address: true,
    email: true,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: "https://www.naijamarketintel.com",
    siteName: "NaijaMarket Intel",
    title: "NaijaMarket Intel — The Bloomberg of Nigerian Commodities",
    description: "Real-time commodity prices from 282 Nigerian markets across 36 states + FCT",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "NaijaMarket Intel - Track Nigerian commodity prices",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NaijaMarket Intel",
    description: "Real-time Nigerian commodity prices from 226 markets",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#22c55e" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  minimumScale: 1,
  userScalable: true,
  viewportFit: "cover",
};

// ─── Anti-Flash Script ───────────────────────────────────────────────────────
// Runs BEFORE React hydrates. Reads localStorage and applies the correct
// theme class to <html> immediately, preventing flash of wrong theme on
// page navigation and hard refresh.
const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('naijamarket-theme');
    var theme = stored || 'dark';
    var resolved;
    if (theme === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      resolved = theme;
    }
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(resolved);
    document.documentElement.style.colorScheme = resolved;
    document.documentElement.setAttribute('data-theme', resolved);
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
`;

// ─── Service Worker Registration Script ──────────────────────────────────────
// Registers the service worker for PWA functionality (offline, caching, push)
const swScript = `
(function() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(function(reg) {
          console.log('[PWA] Service Worker registered');
        })
        .catch(function(err) {
          console.log('[PWA] Service Worker failed:', err);
        });
    });
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Anti-flash: apply saved theme BEFORE hydration to prevent FOUC */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        
        {/* PWA: Register service worker */}
        <script dangerouslySetInnerHTML={{ __html: swScript }} />
        
        {/* PWA Meta Tags */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="NaijaMarket" />
        <meta name="mobile-web-app-capable" content="yes" />
        
        {/* Microsoft Tiles */}
        <meta name="msapplication-TileColor" content="#0a0a0a" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />
      </head>
      <body className={inter.className}>
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* PROVIDER HIERARCHY (order matters!)                                */}
        {/* ═══════════════════════════════════════════════════════════════════ */}

        {/* 1. NextAuth SessionProvider */}
        <Providers>
          {/* 2. ThemeProvider — next-themes, dark default, NO forcedTheme */}
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={true}
            disableTransitionOnChange={false}
            storageKey="naijamarket-theme"
          >
            {/* 3. Single Session Enforcement */}
            <SingleSessionProvider>
              {/* 4. Auth Shell (tier gating, redirect logic) */}
              <AuthShell>
                {children}
              </AuthShell>

              {/* 5. Session Expired Modal */}
              <Suspense fallback={null}>
                <SessionExpiredModal />
              </Suspense>
            </SingleSessionProvider>

            {/* 6. Toast notifications */}
            <Toaster
              position="top-right"
              toastOptions={{
                classNames: {
                  toast:    "!bg-[var(--terminal-surface)] !border-[var(--terminal-border)] !text-[var(--text-primary)]",
                  success:  "!border-[var(--price-up)]/50",
                  error:    "!border-[var(--price-down)]/50",
                  warning:  "!border-naija-gold/50",
                  info:     "!border-naija-blue/50",
                },
              }}
              closeButton
            />
          </ThemeProvider>
        </Providers>
        <WhatsAppCTA />
      <WhatsAppCTA variant="reporter" message="reporter" label="Register as Price Reporter" />
      <CookieBanner />
      <AnalyticsProvider />
      </body>
    </html>
  );
}
