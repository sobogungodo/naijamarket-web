"use client";

// ============================================================================
// src/components/PublicPageShell.tsx
// NaijaMarket Intel — Shared layout shell for public content pages
// FIXED: Replaced hardcoded inline nav (no theme toggle) with PublicNavbar
//        Now theme propagates correctly across ALL public pages.
// Pages using this: /about, /privacy, /terms, /ndpr, /contact
// ============================================================================

import Link from "next/link";
import PublicNavbar from "@/components/PublicNavbar";

interface PublicPageShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export default function PublicPageShell({ title, subtitle, children }: PublicPageShellProps) {
  return (
    <>
      <style>{SHELL_STYLES}</style>
      <div className="pp-shell">

        {/* ── Navbar (theme-aware, shared with all public pages) ── */}
        <PublicNavbar />

        {/* ── Page Header ─────────────────────────────────────── */}
        <header className="pp-header">
          <div className="pp-header-bg" />
          <div className="pp-header-inner">
            <h1 className="pp-title">{title}</h1>
            {subtitle && <p className="pp-subtitle">{subtitle}</p>}
          </div>
        </header>

        {/* ── Page Content ─────────────────────────────────────── */}
        <main className="pp-content">
          <div className="pp-content-inner">{children}</div>
        </main>

        {/* ── Footer ───────────────────────────────────────────── */}
        <footer className="pp-footer">
          <div className="pp-footer-inner">
            <div className="pp-footer-links">
              <Link href="/about">About</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/ndpr">NDPR</Link>
              <Link href="/blog">Blog</Link>
              <Link href="/food-news">Food News</Link>
              <Link href="/contact">Contact</Link>
            </div>
            <div className="pp-footer-copy">
              <span>© 2026 NaijaMarket Intel by Giggababytes Oy</span>
              <span>🇳🇬 Built for Nigeria · 🇫🇮 Powered from Finland</span>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}

// ============================================================================
// STYLES — respects dark/light theme via CSS variables + Tailwind dark: classes
// ============================================================================
const SHELL_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

.pp-shell {
  min-height: 100vh;
  background: var(--background, #0A0F14);
  color: var(--foreground, #E2E8F0);
  font-family: 'DM Sans', -apple-system, sans-serif;
  transition: background 0.2s, color 0.2s;
}

/* Light mode overrides */
:root.light .pp-shell {
  background: #f8fafc;
  color: #0f172a;
}

.pp-green { color: #00C853; }

/* Header */
.pp-header {
  position: relative;
  padding: 64px 20px 48px;
  text-align: center;
  overflow: hidden;
}
.pp-header-bg {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,200,83,0.08) 0%, transparent 70%);
  pointer-events: none;
}
.pp-header-inner { position: relative; max-width: 760px; margin: 0 auto; }
.pp-title {
  font-size: clamp(28px, 5vw, 44px);
  font-weight: 800; line-height: 1.15;
  color: var(--foreground, #fff);
  margin: 0 0 12px;
}
:root.light .pp-title { color: #0f172a; }
.pp-subtitle {
  font-size: 16px; color: #94a3b8; line-height: 1.6;
  max-width: 560px; margin: 0 auto;
}
:root.light .pp-subtitle { color: #64748b; }

/* Content */
.pp-content { padding: 40px 20px 64px; }
.pp-content-inner {
  max-width: 760px; margin: 0 auto;
  line-height: 1.8; font-size: 15px;
}
.pp-content-inner h2 {
  font-size: 22px; font-weight: 700;
  color: var(--foreground, #e2e8f0);
  margin: 40px 0 12px; padding-bottom: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
:root.light .pp-content-inner h2 {
  color: #0f172a;
  border-bottom-color: #e2e8f0;
}
.pp-content-inner h3 { font-size: 17px; font-weight: 600; margin: 24px 0 8px; }
.pp-content-inner p  { margin: 0 0 16px; color: #94a3b8; }
:root.light .pp-content-inner p { color: #475569; }
.pp-content-inner strong { color: var(--foreground, #e2e8f0); font-weight: 600; }
:root.light .pp-content-inner strong { color: #0f172a; }
.pp-content-inner a { color: #00C853; text-decoration: none; }
.pp-content-inner a:hover { text-decoration: underline; }
.pp-content-inner ul { padding-left: 20px; margin: 0 0 16px; color: #94a3b8; }
:root.light .pp-content-inner ul { color: #475569; }
.pp-content-inner li { margin-bottom: 6px; }

.pp-content-inner .pp-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px; padding: 24px; margin: 20px 0;
}
:root.light .pp-content-inner .pp-card {
  background: #fff;
  border-color: #e2e8f0;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.pp-content-inner .pp-highlight {
  background: rgba(0,200,83,0.06);
  border-left: 3px solid #00C853;
  padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 20px 0;
}
.pp-content-inner .pp-date {
  font-size: 12px; color: #64748B;
  font-family: 'JetBrains Mono', monospace; margin-bottom: 8px;
}

/* Footer */
.pp-footer {
  border-top: 1px solid rgba(255,255,255,0.06);
  padding: 32px 20px;
}
:root.light .pp-footer { border-top-color: #e2e8f0; }
.pp-footer-inner { max-width: 1080px; margin: 0 auto; text-align: center; }
.pp-footer-links {
  display: flex; flex-wrap: wrap; justify-content: center;
  gap: 8px 20px; margin-bottom: 20px;
}
.pp-footer-links a { color: #64748B; font-size: 13px; text-decoration: none; transition: color 0.2s; }
.pp-footer-links a:hover { color: #00C853; }
.pp-footer-copy {
  display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #475569;
}
@media (min-width: 640px) {
  .pp-footer-copy { flex-direction: row; justify-content: center; gap: 16px; }
}
`;
