// ============================================================================
// src/app/layout.tsx
// NaijaMarket Intel — Root Layout
// FIX: Removed forcedTheme="dark" + enableSystem={false} that was blocking
//      theme propagation. Added anti-flash script to prevent FOUC on navigation.
// ============================================================================

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { Providers } from "@/components/Providers";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthShell } from "@/components/AuthShell";
import { SingleSessionProvider } from "@/components/SingleSessionProvider";
import { SessionExpiredModal } from "@/components/SessionExpiredModal";
import { Toaster } from "sonner";
import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NaijaMarket Intel - The Bloomberg of Nigerian Commodities",
  description: "Real-time commodity price intelligence for Nigerian markets",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/icon-192x192.png",
  },
};

export const viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
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
      </body>
    </html>
  );
}
