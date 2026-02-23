// src/app/layout.tsx
// NaijaMarket Intel - Root Layout with Conditional Session Management
// Version: 2.2.0 - Fixed: public pages no longer trigger session checks
// Date: 2026-02-23
//
// CHANGES FROM v2.1.0:
// - Moved SingleSessionProvider, SessionTimeoutProvider, SessionExpiredModal,
//   and ChatBot into AuthShell component
// - AuthShell only activates on protected routes (dashboard, settings, etc.)
// - Landing page, about, privacy, blog, etc. render WITHOUT session providers
// - FIXES: visiting landing page → redirected to /login?sessionExpired=true

import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";

import "@/styles/globals.css";
import { cn } from "@/lib/utils";
import Providers from "@/components/Providers";
import AuthShell from "@/components/AuthShell";
import { ThemeProvider } from "@/components/ThemeProvider";

// ============================================================================
// FONTS
// ============================================================================

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

// ============================================================================
// METADATA
// ============================================================================

export const metadata: Metadata = {
  title: {
    default: "NaijaMarket Intel | The Bloomberg of African Commodities",
    template: "%s | NaijaMarket Intel",
  },
  description:
    "Real-time commodity price intelligence for Nigerian markets. Track prices, analyze trends, and make smarter procurement decisions.",
  keywords: [
    "Nigerian commodity prices",
    "food prices Nigeria",
    "market intelligence",
    "commodity trading",
    "price analytics",
    "agricultural commodities",
    "NaijaMarket",
    "food price index",
    "NFPI",
    "market data",
    "Nigerian markets",
    "bulk buying",
    "procurement",
  ],
  authors: [{ name: "NaijaMarket Intel", url: "https://naijamarket.intel" }],
  creator: "Giggababytes Oy",
  publisher: "NaijaMarket Intel",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: "https://naijamarket.intel",
    title: "NaijaMarket Intel | The Bloomberg of African Commodities",
    description:
      "Real-time commodity price intelligence for Nigerian markets. Track prices, analyze trends, and make smarter procurement decisions.",
    siteName: "NaijaMarket Intel",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "NaijaMarket Intel - Commodity Price Intelligence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NaijaMarket Intel | The Bloomberg of African Commodities",
    description:
      "Real-time commodity price intelligence for Nigerian markets.",
    images: ["/images/og-image.png"],
    creator: "@naijamarketintel",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "mask-icon",
        url: "/icons/safari-pinned-tab.svg",
        color: "#00A36C",
      },
    ],
  },
  manifest: "/manifest.json",
  alternates: {
    canonical: "https://naijamarket.intel",
    languages: {
      "en-NG": "https://naijamarket.intel",
      "pcm-NG": "https://naijamarket.intel/pidgin",
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#00A36C" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

// ============================================================================
// ROOT LAYOUT
// ============================================================================

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        GeistSans.variable,
        GeistMono.variable,
        spaceGrotesk.variable,
      )}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="application-name" content="NaijaMarket Intel" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="NaijaMarket" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#0a0a0a" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body
        className={cn(
          "min-h-screen bg-terminal-bg font-sans antialiased",
          "selection:bg-naija-green/30 selection:text-naija-green"
        )}
      >
        {/* ═══════════════════════════════════════════════════════════════════
            PROVIDER HIERARCHY (order matters!)
            1. Providers (NextAuth SessionProvider) — handles JWT tokens
            2. ThemeProvider — enables light/dark mode toggle
            3. AuthShell — CONDITIONALLY wraps with session management:
               • Public pages (/, /about, /blog, etc.): children only
               • Protected pages (/dashboard, /settings): full session stack
                 → SingleSessionProvider + SessionTimeout + ChatBot
            ═══════════════════════════════════════════════════════════════════ */}
        <Providers>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange={false}
          >
            {/* AuthShell: session providers ONLY on protected routes */}
            <AuthShell>
              {children}
            </AuthShell>

            {/* Toast Notifications — available on ALL pages */}
            <Toaster
              position="top-right"
              toastOptions={{
                classNames: {
                  toast: "!bg-[var(--terminal-surface)] !border-[var(--terminal-border)] !text-[var(--text-primary)]",
                  success: "!border-[var(--price-up)]/50",
                  error: "!border-[var(--price-down)]/50",
                  warning: "!border-naija-gold/50",
                  info: "!border-naija-blue/50",
                },
              }}
              closeButton
            />
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
