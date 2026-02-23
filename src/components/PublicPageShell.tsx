"use client";

import Link from "next/link";

// ============================================================================
// PublicPageShell — Shared layout for About, Privacy, NDPR, Blog, Terms, Contact
// Matches the landing page dark theme
// Deploy to: src/components/PublicPageShell.tsx
// ============================================================================

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
        {/* Nav */}
        <nav className="pp-nav">
          <div className="pp-nav-inner">
            <Link href="/" className="pp-logo">
              <div className="pp-logo-icon">NM</div>
              <span className="pp-logo-text">
                NaijaMarket<span className="pp-green">Intel</span>
              </span>
            </Link>
            <div className="pp-nav-links">
              <Link href="/#features">Features</Link>
              <Link href="/#pricing">Pricing</Link>
              <Link href="/login" className="pp-nav-signin">Sign In</Link>
              <Link href="/register" className="pp-btn-green">Get Started</Link>
            </div>
          </div>
        </nav>

        {/* Header */}
        <header className="pp-header">
          <div className="pp-header-bg" />
          <div className="pp-header-inner">
            <h1 className="pp-title">{title}</h1>
            {subtitle && <p className="pp-subtitle">{subtitle}</p>}
          </div>
        </header>

        {/* Content */}
        <main className="pp-content">
          <div className="pp-content-inner">{children}</div>
        </main>

        {/* Footer */}
        <footer className="pp-footer">
          <div className="pp-footer-inner">
            <div className="pp-footer-links">
              <Link href="/about">About</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/ndpr">NDPR</Link>
              <Link href="/blog">Blog</Link>
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

const SHELL_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

.pp-shell {
  min-height: 100vh;
  background: #0A0F14;
  color: #E2E8F0;
  font-family: 'DM Sans', -apple-system, sans-serif;
}
.pp-green { color: #00C853; }

/* Nav */
.pp-nav {
  position: sticky; top: 0; z-index: 50;
  background: rgba(10, 15, 20, 0.95);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.pp-nav-inner {
  max-width: 1080px; margin: 0 auto;
  display: flex; align-items: center; justify-content: space-between;
  height: 60px; padding: 0 20px;
}
.pp-logo { display: flex; align-items: center; gap: 8px; text-decoration: none; }
.pp-logo-icon {
  width: 32px; height: 32px; border-radius: 8px;
  background: linear-gradient(135deg, #00C853, #006428);
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 11px; color: #fff;
  font-family: 'JetBrains Mono', monospace;
}
.pp-logo-text { font-weight: 700; font-size: 15px; color: #fff; }
.pp-nav-links { display: flex; align-items: center; gap: 20px; }
.pp-nav-links a {
  color: #64748B; font-size: 13px; text-decoration: none;
  font-weight: 500; transition: color 0.2s;
}
.pp-nav-links a:hover { color: #fff; }
.pp-nav-signin { color: #00C853 !important; font-weight: 600 !important; }
.pp-btn-green {
  background: linear-gradient(135deg, #00C853, #00E676);
  color: #0A0F14 !important; font-weight: 700 !important;
  padding: 8px 16px; border-radius: 10px;
  font-size: 12px !important;
}

/* Header */
.pp-header {
  position: relative;
  padding: 80px 20px 48px;
  text-align: center;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.pp-header-bg {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(0,200,83,0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,200,83,0.015) 1px, transparent 1px);
  background-size: 50px 50px;
}
.pp-header-inner { position: relative; max-width: 1080px; margin: 0 auto; }
.pp-title {
  font-size: clamp(28px, 5vw, 42px);
  font-weight: 800; color: #fff;
  letter-spacing: -1px; margin-bottom: 8px;
}
.pp-subtitle {
  font-size: 16px; color: #94A3B8;
  max-width: 560px; margin: 0 auto; line-height: 1.6;
}

/* Content */
.pp-content { padding: 48px 20px 80px; }
.pp-content-inner {
  max-width: 800px; margin: 0 auto;
  font-size: 15px; color: #CBD5E1; line-height: 1.8;
}
.pp-content-inner h2 {
  font-size: 22px; font-weight: 700; color: #fff;
  margin: 40px 0 16px; letter-spacing: -0.5px;
}
.pp-content-inner h3 {
  font-size: 17px; font-weight: 700; color: #E2E8F0;
  margin: 28px 0 12px;
}
.pp-content-inner p { margin-bottom: 16px; }
.pp-content-inner ul, .pp-content-inner ol {
  margin: 12px 0 20px 24px;
}
.pp-content-inner li { margin-bottom: 8px; }
.pp-content-inner a { color: #00C853; text-decoration: underline; }
.pp-content-inner strong { color: #fff; }
.pp-content-inner .pp-card {
  background: rgba(15,20,30,0.6);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px; padding: 24px;
  margin: 20px 0;
}
.pp-content-inner .pp-highlight {
  background: rgba(0,200,83,0.06);
  border-left: 3px solid #00C853;
  padding: 16px 20px; border-radius: 0 8px 8px 0;
  margin: 20px 0;
}
.pp-content-inner .pp-date {
  font-size: 12px; color: #64748B;
  font-family: 'JetBrains Mono', monospace;
  margin-bottom: 8px;
}

/* Footer */
.pp-footer {
  border-top: 1px solid rgba(255,255,255,0.06);
  padding: 32px 20px;
}
.pp-footer-inner { max-width: 1080px; margin: 0 auto; text-align: center; }
.pp-footer-links {
  display: flex; flex-wrap: wrap; justify-content: center;
  gap: 8px 20px; margin-bottom: 20px;
}
.pp-footer-links a {
  color: #64748B; font-size: 13px; text-decoration: none;
  transition: color 0.2s;
}
.pp-footer-links a:hover { color: #00C853; }
.pp-footer-copy {
  display: flex; flex-direction: column; gap: 4px;
  font-size: 12px; color: #475569;
}

@media (min-width: 640px) {
  .pp-footer-copy { flex-direction: row; justify-content: center; gap: 16px; }
}
`;
