"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import Link from "next/link";
import EmailSignup from "@/components/EmailSignup";

// ============================================================================
// NaijaMarket Intel — Landing Page v2.0
// "The Bloomberg of Nigerian Commodities"
// Mobile-first · WhatsApp demo · Live price checker · 3-tier pricing
// Deploy to: src/app/page.tsx
// ============================================================================

// ---------------------------------------------------------------------------
// DATA
// ---------------------------------------------------------------------------

const TICKER = [
  { s: "RICE.NGN", p: "₦82,450", c: "+0.34%", u: true },
  { s: "BEANS.NGN", p: "₦61,920", c: "+0.12%", u: true },
  { s: "GARRI.NGN", p: "₦24,300", c: "-0.45%", u: false },
  { s: "PALM.NGN", p: "₦48,100", c: "+0.28%", u: true },
  { s: "YAM.NGN", p: "₦2,850", c: "-0.18%", u: false },
  { s: "TOMATO.NGN", p: "₦42,500", c: "+1.26%", u: true },
  { s: "ONION.NGN", p: "₦35,200", c: "-0.52%", u: false },
  { s: "PEPPER.NGN", p: "₦30,800", c: "+0.67%", u: true },
  { s: "FISH.NGN", p: "₦11,650", c: "+0.19%", u: true },
  { s: "PLANTAIN.NGN", p: "₦4,250", c: "+0.84%", u: true },
  { s: "GNUT.NGN", p: "₦55,300", c: "+0.41%", u: true },
  { s: "EGGS.NGN", p: "₦3,180", c: "-0.31%", u: false },
];

interface PriceRow {
  mk: string;
  st: string;
  pr: string;
  ch: string;
  up: boolean;
}

interface PriceResult {
  item: string;
  rows: PriceRow[];
}

const DEMO_PRICES: Record<string, PriceResult> = {
  rice: {
    item: "Rice (50kg) - Foreign",
    rows: [
      { mk: "Mile 12 Market", st: "Lagos", pr: "₦82,450", ch: "+0.34%", up: true },
      { mk: "Kano Main Market", st: "Kano", pr: "₦79,800", ch: "+0.18%", up: true },
      { mk: "Onitsha Main Market", st: "Anambra", pr: "₦84,200", ch: "-0.22%", up: false },
      { mk: "Wuse Market", st: "FCT", pr: "₦83,100", ch: "+0.41%", up: true },
    ],
  },
  beans: {
    item: "Beans - Brown (per kg)",
    rows: [
      { mk: "Mile 12 Market", st: "Lagos", pr: "₦61,920", ch: "+0.12%", up: true },
      { mk: "Bodija Market", st: "Oyo", pr: "₦58,400", ch: "-0.35%", up: false },
      { mk: "Kano Main Market", st: "Kano", pr: "₦55,300", ch: "+0.28%", up: true },
      { mk: "Jos Main Market", st: "Plateau", pr: "₦57,800", ch: "+0.15%", up: true },
    ],
  },
  garri: {
    item: "Garri - White (50kg)",
    rows: [
      { mk: "Mile 12 Market", st: "Lagos", pr: "₦24,300", ch: "-0.45%", up: false },
      { mk: "Onitsha Main Market", st: "Anambra", pr: "₦22,100", ch: "-0.62%", up: false },
      { mk: "Wuse Market", st: "FCT", pr: "₦25,600", ch: "+0.18%", up: true },
      { mk: "Kano Main Market", st: "Kano", pr: "₦26,800", ch: "+0.32%", up: true },
    ],
  },
  tomatoes: {
    item: "Tomatoes (Big Basket)",
    rows: [
      { mk: "Mile 12 Market", st: "Lagos", pr: "₦42,500", ch: "+1.26%", up: true },
      { mk: "Bodija Market", st: "Oyo", pr: "₦38,200", ch: "+0.85%", up: true },
      { mk: "Jos Main Market", st: "Plateau", pr: "₦35,400", ch: "-0.42%", up: false },
      { mk: "Wuse Market", st: "FCT", pr: "₦44,100", ch: "+1.08%", up: true },
    ],
  },
  "palm oil": {
    item: "Palm Oil (25 Litres)",
    rows: [
      { mk: "Mile 12 Market", st: "Lagos", pr: "₦48,100", ch: "+0.28%", up: true },
      { mk: "Onitsha Main Market", st: "Anambra", pr: "₦45,600", ch: "-0.15%", up: false },
      { mk: "Kano Main Market", st: "Kano", pr: "₦51,200", ch: "+0.44%", up: true },
      { mk: "Wuse Market", st: "FCT", pr: "₦49,300", ch: "+0.19%", up: true },
    ],
  },
};

const FEATURES = [
  { icon: "📡", title: "Real-Time Prices", desc: "Live GPS-verified prices from 224 markets. Updated 3× daily by on-ground traders.", accent: "#00C853" },
  { icon: "📊", title: "Bloomberg-Grade Analytics", desc: "Inflation tracking, heatmaps, arbitrage scanner, and market screeners at startup prices.", accent: "#FFB300" },
  { icon: "🛡️", title: "Fraud-Proof Verification", desc: "GPS validation, community consensus, and ML anomaly detection. 95%+ confidence.", accent: "#00B0FF" },
  { icon: "🔔", title: "Smart Price Alerts", desc: "Set thresholds. Get WhatsApp notifications when prices cross your targets.", accent: "#FF5252" },
  { icon: "📈", title: "Inflation Tracker", desc: "NaijaMarket Food Price Index vs NBS. Real inflation, not months later.", accent: "#E040FB" },
  { icon: "🌍", title: "Regional Comparison", desc: "Compare prices across states. Spot arbitrage opportunities before competitors.", accent: "#26A69A" },
];

const TIERS = [
  {
    nm: "FREE", pr: "₦0", pd: "", tg: null, ac: "#64FFDA", hl: false,
    ft: ["5 price queries/day", "3 markets", "Daily updates", "WhatsApp access", "Basic search"],
    ct: "Start Free", hr: "/register",
  },
  {
    nm: "GOLD", pr: "₦7,500", pd: "/mo", tg: "MOST POPULAR", ac: "#FFD740", hl: true,
    ft: ["Unlimited queries", "All 224 markets", "Unlimited price alerts", "Arbitrage scanner", "Heatmaps & trends", "Historical data", "CSV & PDF export", "Priority support"],
    ct: "Go Gold", hr: "/register?plan=gold",
  },
  {
    nm: "ENTERPRISE", pr: "₦150K", pd: "/mo", tg: null, ac: "#00E5FF", hl: false,
    ft: ["API access", "Custom dashboards", "Power BI integration", "Multi-user seats", "Dedicated account mgr", "SLA guarantee", "White-label reports", "Bulk data export"],
    ct: "Contact Sales", hr: "mailto:sales@naijamarketintel.ng",
  },
];

const TESTIMONIALS = [
  { nm: "Alhaji Musa Ibrahim", rl: "Rice Trader · Kano", q: "Before NaijaMarket, I was losing ₦500K monthly to price manipulation. Now I check prices before every deal.", av: "MI" },
  { nm: "Chioma Okafor", rl: "Procurement Manager · Lagos", q: "We reduced food procurement costs by 18% in 3 months. The arbitrage scanner alone pays for the subscription.", av: "CO" },
  { nm: "Adebayo Fashola", rl: "Market Analyst · Abuja", q: "The inflation tracker is more accurate than waiting for NBS. Real-time, verified, and actually useful for our reports.", av: "AF" },
];

// ---------------------------------------------------------------------------
// HOOKS
// ---------------------------------------------------------------------------

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry?.isIntersecting) setVisible(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

// ---------------------------------------------------------------------------
// COMPONENTS
// ---------------------------------------------------------------------------

/* ═══════════════ Ticker ═══════════════ */
function Ticker() {
  const doubled = [...TICKER, ...TICKER];
  return (
    <div className="nm-tk">
      <div className="nm-tk-track">
        {doubled.map((t, i) => (
          <span key={i} className="nm-tk-item">
            <span className="nm-tk-sym">{t.s}</span>
            <span className="nm-tk-pr">{t.p}</span>
            <span className={t.u ? "nm-tk-up" : "nm-tk-dn"}>{t.c}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════ Nav ═══════════════ */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav className={`nm-nav${scrolled ? " nm-nav-s" : ""}`}>
      <Ticker />
      <div className="nm-nav-inner">
        <Link href="/" className="nm-logo">
          <div className="nm-logo-icon">NM</div>
          <span className="nm-logo-text">
            NaijaMarket<span className="nm-g">Intel</span>
          </span>
        </Link>

        <div className="nm-nav-links">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#how-it-works">How It Works</a>
          <Link href="/login" className="nm-nav-signin">Sign In</Link>
          <Link href="/register" className="nm-btn-green nm-btn-sm">
            Get Started Free
          </Link>
        </div>

        <button
          className="nm-hamburger"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span className={menuOpen ? "nm-hb-x" : ""} />
        </button>
      </div>

      {menuOpen && (
        <div className="nm-mobile-menu">
          <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
          <a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How It Works</a>
          <Link href="/login" onClick={() => setMenuOpen(false)}>Sign In</Link>
          <Link
            href="/register"
            className="nm-btn-green"
            onClick={() => setMenuOpen(false)}
          >
            Get Started Free
          </Link>
        </div>
      )}
    </nav>
  );
}

/* ═══════════════ Price Checker ═══════════════ */
function PriceChecker() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PriceResult | null>(null);
  const [loading, setLoading] = useState(false);

  function search(val: string) {
    setQuery(val);
    const term = val.toLowerCase().trim();
    if (!term) { setResults(null); return; }
    setLoading(true);
    setTimeout(() => {
      const match = Object.entries(DEMO_PRICES).find(
        ([key]) => term.includes(key) || key.includes(term)
      );
      setResults(match ? match[1] : null);
      setLoading(false);
    }, 350);
  }

  return (
    <div className="nm-ck">
      <div className="nm-ck-head">
        <span className="nm-ck-live">● LIVE</span>
        <span className="nm-ck-title">Try it — search any commodity</span>
      </div>

      <form
        onSubmit={(e: FormEvent) => { e.preventDefault(); search(query); }}
        className="nm-ck-search"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          placeholder="Type: rice, beans, garri, tomatoes..."
          value={query}
          onChange={(e) => search(e.target.value)}
          className="nm-ck-input"
        />
      </form>

      <div className="nm-ck-chips">
        {["Rice", "Beans", "Garri", "Tomatoes", "Palm Oil"].map((chip) => (
          <button
            key={chip}
            onClick={() => search(chip)}
            className={`nm-chip${query.toLowerCase() === chip.toLowerCase() ? " nm-chip-active" : ""}`}
          >
            {chip}
          </button>
        ))}
      </div>

      {loading && (
        <div className="nm-ck-loading">
          <div className="nm-spinner" />
          <span>Fetching live prices...</span>
        </div>
      )}

      {!loading && results && (
        <div className="nm-ck-results nm-fade-in">
          <div className="nm-ck-item-name">{results.item}</div>
          <div className="nm-ck-table">
            <div className="nm-ck-row nm-ck-row-h">
              <span>Market</span><span>State</span><span>Price</span><span>24h</span>
            </div>
            {results.rows.map((r, i) => (
              <div
                key={i}
                className="nm-ck-row nm-fade-in"
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <span className="nm-ck-mkt">{r.mk}</span>
                <span className="nm-ck-state">{r.st}</span>
                <span className="nm-ck-price">{r.pr}</span>
                <span className={r.up ? "nm-ck-up" : "nm-ck-down"}>{r.ch}</span>
              </div>
            ))}
          </div>
          <div className="nm-ck-footer">
            <span>Confidence: <strong>94%</strong> · 3+ validators</span>
            <Link href="/register" className="nm-ck-cta">See all markets →</Link>
          </div>
        </div>
      )}

      {!loading && !results && query.length > 2 && (
        <div className="nm-ck-empty">
          No demo data for &quot;{query}&quot;.{" "}
          <Link href="/register">Sign up</Link> to search 610+ commodities.
        </div>
      )}
    </div>
  );
}

/* ═══════════════ WhatsApp Demo ═══════════════ */
function WADemo() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 700);
    const t2 = setTimeout(() => setStep(2), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const botReply = `🍚 Rice (50kg) - Lagos Markets

📍 Mile 12: ₦82,450 (+0.34%)
📍 Ojo Market: ₦81,200 (-0.15%)
📍 Mushin: ₦83,100 (+0.52%)

📊 Avg: ₦82,250 | 🔄 Updated 2h ago

Reply ALERT RICE 80000 to get notified`;

  return (
    <div className="nm-wa">
      <div className="nm-wa-head">
        <div className="nm-wa-avatar">NM</div>
        <div>
          <div className="nm-wa-name">NaijaMarket Intel</div>
          <div className="nm-wa-status">online</div>
        </div>
      </div>
      <div className="nm-wa-body">
        {step >= 1 && (
          <div className="nm-wa-msg nm-wa-user nm-fade-in">RICE LAGOS</div>
        )}
        {step >= 2 && (
          <div className="nm-wa-msg nm-wa-bot nm-fade-in">{botReply}</div>
        )}
      </div>
      <a
        href="https://wa.me/14155238886?text=RICE%20LAGOS"
        target="_blank"
        rel="noopener noreferrer"
        className="nm-wa-try"
      >
        💬 Try it now on WhatsApp
      </a>
    </div>
  );
}

/* ═══════════════ Hero Demo Tabs ═══════════════ */
function DemoTabs() {
  const [tab, setTab] = useState<"prices" | "whatsapp">("prices");
  return (
    <div className="nm-demo-card">
      <div className="nm-demo-tabs">
        <button
          className={`nm-demo-tab${tab === "prices" ? " nm-demo-tab-active" : ""}`}
          onClick={() => setTab("prices")}
        >
          🔍 Price Checker
        </button>
        <button
          className={`nm-demo-tab${tab === "whatsapp" ? " nm-demo-tab-active" : ""}`}
          onClick={() => setTab("whatsapp")}
        >
          💬 WhatsApp Demo
        </button>
      </div>
      {tab === "prices" ? <PriceChecker /> : <WADemo />}
    </div>
  );
}

/* ═══════════════ Hero ═══════════════ */
function Hero() {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 150); }, []);

  return (
    <section className="nm-hero">
      <div className="nm-hero-grid-bg" />
      <div className="nm-hero-glow" />

      <div className={`nm-hero-inner${visible ? " nm-visible" : ""}`}>
        <div className="nm-hero-copy">
          <div className="nm-hero-badge">
            <span className="nm-pulse-dot" />
            <span>LIVE — 224 Markets Tracking</span>
          </div>

          <h1 className="nm-hero-title">
            Know the real price<br />
            <span className="nm-gradient-text">before you buy.</span>
          </h1>

          <p className="nm-hero-subtitle">
            Real-time, GPS-verified commodity prices from every major market in
            Nigeria. Stop losing money to price manipulation and information
            asymmetry.
          </p>

          <div className="nm-hero-ctas">
            <Link href="/register" className="nm-btn-green nm-btn-lg">
              Start Free — No Card Required{" "}
              <span className="nm-arrow">→</span>
            </Link>
            <Link href="/dashboard/prices" className="nm-btn-outline nm-btn-lg">
              Explore Live Prices
            </Link>
          </div>

          <div className="nm-hero-stats">
            {[
              { v: "224", l: "Markets" },
              { v: "610+", l: "Commodities" },
              { v: "37", l: "States" },
              { v: "3×", l: "Daily" },
            ].map((stat, i) => (
              <div key={i} className="nm-stat">
                <div className="nm-stat-val">{stat.v}</div>
                <div className="nm-stat-label">{stat.l}</div>
              </div>
            ))}
          </div>


        </div>

        <div className="nm-hero-demo">
          <DemoTabs />
        </div>
      </div>
    </section>
  );
}

/* ═══════════════ Trust Bar ═══════════════ */
function TrustBar() {
  const { ref, visible } = useInView();
  const items = [
    { icon: "🛡️", text: "GPS-Verified Data" },
    { icon: "👥", text: "5,000+ Active Traders" },
    { icon: "📊", text: "Aligned with NBS at 8.9%" },
    { icon: "🇳🇬", text: "37 States Covered" },
    { icon: "⚡", text: "Updated 3× Daily" },
  ];
  return (
    <div ref={ref} className={`nm-trust${visible ? " nm-visible" : ""}`}>
      <div className="nm-trust-inner">
        {items.map((item, i) => (
          <div key={i} className="nm-trust-item">
            <span>{item.icon}</span>
            <span>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════ Features ═══════════════ */
function FeaturesSection() {
  const { ref, visible } = useInView();
  return (
    <section id="features" className="nm-section" ref={ref}>
      <div className="nm-section-inner">
        <div className="nm-section-header">
          <span className="nm-section-tag">What We Offer</span>
          <h2 className="nm-section-title">
            Market Intelligence That<br />
            <span className="nm-g">Actually Saves You Money</span>
          </h2>
          <p className="nm-section-desc">
            Nigerian businesses lose ₦150K–₦10M monthly to price manipulation.
            We built the tools to end that.
          </p>
        </div>
        <div className={`nm-features-grid${visible ? " nm-visible" : ""}`}>
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="nm-feature-card"
              style={{ animationDelay: `${i * 0.08}s`, "--nm-accent": f.accent } as React.CSSProperties}
            >
              <div className="nm-feature-glow" />
              <div className="nm-feature-icon">{f.icon}</div>
              <h3 className="nm-feature-title">{f.title}</h3>
              <p className="nm-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════ How It Works ═══════════════ */
function HowItWorksSection() {
  const { ref, visible } = useInView();
  const steps = [
    { num: "01", icon: "🔍", title: "Search Any Commodity", desc: "Type a commodity, market, or state. Get instant verified prices from our trader network." },
    { num: "02", icon: "📊", title: "Analyze Market Trends", desc: "View price history, inflation trends, regional comparisons, and arbitrage opportunities." },
    { num: "03", icon: "⚡", title: "Set Alerts & Act", desc: "Create custom price alerts. Get WhatsApp notifications. Make data-driven decisions." },
  ];

  return (
    <section id="how-it-works" className="nm-section nm-section-accent" ref={ref}>
      <div className="nm-section-inner">
        <div className="nm-section-header">
          <span className="nm-section-tag">How It Works</span>
          <h2 className="nm-section-title">
            Three Steps to<br />
            <span className="nm-g">Smarter Procurement</span>
          </h2>
        </div>
        <div className={`nm-steps${visible ? " nm-visible" : ""}`}>
          {steps.map((step, i) => (
            <div
              key={i}
              className="nm-step"
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              <div className="nm-step-num">{step.num}</div>
              <div className="nm-step-icon">{step.icon}</div>
              <h3 className="nm-step-title">{step.title}</h3>
              <p className="nm-step-desc">{step.desc}</p>
              {i < 2 && <div className="nm-step-connector" />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════ Pricing ═══════════════ */
function PricingSection() {
  const { ref, visible } = useInView();
  return (
    <section id="pricing" className="nm-section" ref={ref}>
      <div className="nm-section-inner">
        <div className="nm-section-header">
          <span className="nm-section-tag">Pricing</span>
          <h2 className="nm-section-title">
            Plans That Grow{" "}
            <span className="nm-g">With Your Business</span>
          </h2>
          <p className="nm-section-desc">
            Start free. Upgrade when you&apos;re ready. Cancel anytime.
          </p>
        </div>
        <div className={`nm-pricing-grid${visible ? " nm-visible" : ""}`}>
          {TIERS.map((tier, i) => (
            <div
              key={i}
              className={`nm-price-card${tier.hl ? " nm-price-card-hl" : ""}`}
              style={{ animationDelay: `${i * 0.1}s`, "--nm-accent": tier.ac } as React.CSSProperties}
            >
              {tier.tg && <div className="nm-price-tag">{tier.tg}</div>}
              <div className="nm-price-name">{tier.nm}</div>
              <div className="nm-price-amount">
                <span className="nm-price-num">{tier.pr}</span>
                {tier.pd && <span className="nm-price-period">{tier.pd}</span>}
              </div>
              <ul className="nm-price-features">
                {tier.ft.map((feature, j) => (
                  <li key={j}>
                    <span className="nm-check">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href={tier.hr}
                className={`nm-price-cta ${tier.hl ? "nm-btn-green" : "nm-btn-outline"}`}
              >
                {tier.ct}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════ Testimonials ═══════════════ */
function TestimonialsSection() {
  const { ref, visible } = useInView();
  return (
    <section className="nm-section nm-section-accent" ref={ref}>
      <div className="nm-section-inner">
        <div className="nm-section-header">
          <span className="nm-section-tag">Testimonials</span>
          <h2 className="nm-section-title">
            Trusted by <span className="nm-g">Nigerian Traders</span>
          </h2>
        </div>
        <div className={`nm-testimonials${visible ? " nm-visible" : ""}`}>
          {TESTIMONIALS.map((t, i) => (
            <div
              key={i}
              className="nm-testimonial"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="nm-test-quote">&ldquo;</div>
              <p className="nm-test-text">{t.q}</p>
              <div className="nm-test-author">
                <div className="nm-test-avatar">{t.av}</div>
                <div>
                  <div className="nm-test-name">{t.nm}</div>
                  <div className="nm-test-role">{t.rl}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════ CTA ═══════════════ */
function CTASection() {
  return (
    <section className="nm-section">
      <div className="nm-cta-box">
        <div className="nm-cta-glow-1" />
        <div className="nm-cta-glow-2" />
        <h2 className="nm-cta-title">
          Stop Guessing.<br />
          <span className="nm-g">Start Knowing.</span>
        </h2>
        <p className="nm-cta-desc">
          Join thousands of Nigerian traders and businesses making smarter
          decisions with verified market data.
        </p>
        <div className="nm-cta-buttons">
          <Link href="/register" className="nm-btn-green nm-btn-lg">
            Get Started Free →
          </Link>
          <a
            href="https://wa.me/14155238886?text=Hi%20NaijaMarket"
            target="_blank"
            rel="noopener noreferrer"
            className="nm-btn-outline nm-btn-lg"
          >
            💬 Chat on WhatsApp
          </a>
        </div>
        <div className="nm-cta-signup">
          <div className="nm-cta-divider">
            <span className="nm-cta-divider-line" />
            <span className="nm-cta-divider-text">or get free weekly market briefs</span>
            <span className="nm-cta-divider-line" />
          </div>
          <EmailSignup variant="footer" source="cta_section" />
        </div>
      </div>
    </section>
  );
}

/* ═══════════════ Footer ═══════════════ */
function Footer() {
  const columns = [
    {
      title: "Product",
      links: [
        ["Prices", "/dashboard/prices"],
        ["Markets", "/dashboard/markets"],
        ["Inflation", "/dashboard/inflation"],
        ["Compare", "/dashboard/compare"],
      ],
    },
    {
      title: "Company",
      links: [
        ["About", "/about"],
        ["Pricing", "#pricing"],
        ["Contact", "/contact"],
        ["Blog", "/blog"],
      ],
    },
    {
      title: "Legal",
      links: [
        ["Terms", "/terms"],
        ["Privacy", "/privacy"],
        ["NDPR", "/ndpr"],
      ],
    },
  ];

  return (
    <footer className="nm-footer">
      <div className="nm-footer-inner">
        <div className="nm-footer-brand">
          <div className="nm-logo" style={{ marginBottom: 16 }}>
            <div className="nm-logo-icon">NM</div>
            <span className="nm-logo-text">
              NaijaMarket<span className="nm-g">Intel</span>
            </span>
          </div>
          <p className="nm-footer-tagline">
            Real-time, GPS-verified commodity price intelligence for Nigeria.
            The Bloomberg of Nigerian Commodities.
          </p>

        </div>
        {columns.map((col, i) => (
          <div key={i} className="nm-footer-col">
            <div className="nm-footer-col-title">{col.title}</div>
            {col.links.map(([label, href], j) => (
              <Link key={j} href={href ?? "#"} className="nm-footer-link">
                {label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="nm-footer-bottom">
        <span>© 2026 NaijaMarket Intel by Giggababytes Oy</span>
        <span>🇳🇬 Built for Nigeria · 🇫🇮 Powered from Finland</span>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// MAIN PAGE COMPONENT
// ---------------------------------------------------------------------------

export default function LandingPage() {
  return (
    <>
      <style>{PAGE_STYLES}</style>
      <div className="nm-landing">
        <Nav />
        <TrustBar />
        <Hero />
        <FeaturesSection />
        <HowItWorksSection />
        <PricingSection />
        <TestimonialsSection />
        <CTASection />
        <Footer />
      </div>
    </>
  );
}

// ============================================================================
// STYLES — Mobile-first with tablet (640px) + desktop (1024px) breakpoints
// ============================================================================

const PAGE_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');

:root {
  --nm-bg: #0A0F14;
  --nm-bg2: #0F1520;
  --nm-card: rgba(15, 20, 30, 0.6);
  --nm-border: rgba(255, 255, 255, 0.06);
  --nm-green: #00C853;
  --nm-green-dim: rgba(0, 200, 83, 0.1);
  --nm-text: #E2E8F0;
  --nm-text2: #94A3B8;
  --nm-text3: #64748B;
  --nm-text4: #475569;
  --nm-font: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  --nm-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --nm-radius: 12px;
}

/* ── Light Mode Overrides ── */
html.light :root,
html.light {
  --nm-bg: #f0f4f8;
  --nm-bg2: #ffffff;
  --nm-card: rgba(255, 255, 255, 0.9);
  --nm-border: rgba(0, 0, 0, 0.08);
  --nm-green: #00a846;
  --nm-green-dim: rgba(0, 168, 70, 0.1);
  --nm-text: #0f172a;
  --nm-text2: #334155;
  --nm-text3: #64748b;
  --nm-text4: #94a3b8;
}

html:not(.dark) {
  --nm-bg: #f0f4f8;
  --nm-bg2: #ffffff;
  --nm-card: rgba(255, 255, 255, 0.9);
  --nm-border: rgba(0, 0, 0, 0.08);
  --nm-green: #00a846;
  --nm-green-dim: rgba(0, 168, 70, 0.1);
  --nm-text: #0f172a;
  --nm-text2: #334155;
  --nm-text3: #64748b;
  --nm-text4: #94a3b8;
}

* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
::selection { background: rgba(0, 200, 83, 0.3); color: #fff; }
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--nm-bg); }
::-webkit-scrollbar-thumb { background: rgba(0, 200, 83, 0.2); border-radius: 3px; }

/* ── Base ── */
.nm-landing {
  min-height: 100vh;
  background: var(--nm-bg);
  color: var(--nm-text);
  font-family: var(--nm-font);
  overflow-x: hidden;
  transition: background 0.2s ease, color 0.2s ease;
}
.nm-nav-s {
  background: var(--nm-bg) !important;
  opacity: 0.97;
}
.nm-g { color: var(--nm-green); }
.nm-gradient-text {
  background: linear-gradient(135deg, #00C853, #69F0AE);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* ── Animations ── */
@keyframes nm-ticker-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
@keyframes nm-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.5); }
}
@keyframes nm-fade-up {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes nm-spin {
  to { transform: rotate(360deg); }
}
.nm-fade-in { animation: nm-fade-up 0.5s ease both; }

/* ── Ticker ── */
.nm-tk {
  background: rgba(0, 0, 0, 0.5);
  border-bottom: 1px solid rgba(0, 200, 83, 0.1);
  height: 34px;
  display: flex;
  align-items: center;
  overflow: hidden;
}
.nm-tk-track {
  display: flex;
  gap: 28px;
  animation: nm-ticker-scroll 45s linear infinite;
  white-space: nowrap;
}
.nm-tk-item {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  font-size: 11px;
  font-family: var(--nm-mono);
}
.nm-tk-sym { color: var(--nm-text3); font-weight: 600; }
.nm-tk-pr { color: var(--nm-text); }
.nm-tk-up { color: #00C853; font-weight: 600; }
.nm-tk-dn { color: #FF5252; font-weight: 600; }

/* ── Nav ── */
.nm-nav {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 100;
  transition: all 0.3s ease;
}
.nm-nav-s {
  background: rgba(var(--nm-bg-rgb, 10, 15, 20), 0.95);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(0, 200, 83, 0.08);
}
.nm-nav-inner {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
  padding: 0 16px;
}
.nm-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
}
.nm-logo-icon {
  width: 34px; height: 34px;
  border-radius: 8px;
  background: linear-gradient(135deg, #00C853, #006428);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 12px;
  color: #fff;
  font-family: var(--nm-mono);
  box-shadow: 0 0 14px rgba(0, 200, 83, 0.25);
}
.nm-logo-text { font-weight: 700; font-size: 16px; color: #fff; }
.nm-nav-links {
  display: none;
  align-items: center;
  gap: 24px;
}
.nm-nav-links a {
  color: var(--nm-text3);
  font-size: 13px;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
}
.nm-nav-links a:hover { color: #fff; }
.nm-nav-signin { color: var(--nm-green) !important; font-weight: 600 !important; }

/* Hamburger */
.nm-hamburger {
  display: flex;
  width: 38px; height: 38px;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid var(--nm-border);
  border-radius: 8px;
  cursor: pointer;
  position: relative;
}
.nm-hamburger span,
.nm-hamburger span::before,
.nm-hamburger span::after {
  display: block;
  width: 16px; height: 2px;
  background: var(--nm-text2);
  border-radius: 1px;
  transition: all 0.2s;
}
.nm-hamburger span::before,
.nm-hamburger span::after {
  content: '';
  position: absolute;
}
.nm-hamburger span::before { transform: translateY(-5px); }
.nm-hamburger span::after { transform: translateY(5px); }
.nm-hb-x { background: transparent !important; }
.nm-hb-x::before { transform: rotate(45deg) !important; }
.nm-hb-x::after { transform: rotate(-45deg) !important; }

/* Mobile Menu */
.nm-mobile-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 16px 16px;
  background: rgba(10, 15, 20, 0.98);
  border-bottom: 1px solid var(--nm-border);
  backdrop-filter: blur(20px);
}
.nm-mobile-menu a {
  display: block;
  padding: 12px 14px;
  color: var(--nm-text2);
  font-size: 15px;
  text-decoration: none;
  border-radius: 8px;
  transition: background 0.2s;
}
.nm-mobile-menu a:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

/* ── Buttons ── */
.nm-btn-green {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(135deg, #00C853, #00E676);
  color: #0A0F14;
  font-weight: 700;
  border-radius: var(--nm-radius);
  text-decoration: none;
  border: none;
  cursor: pointer;
  box-shadow: 0 2px 16px rgba(0, 200, 83, 0.2);
  transition: all 0.3s ease;
  font-family: var(--nm-font);
}
.nm-btn-green:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 28px rgba(0, 200, 83, 0.35);
}
.nm-btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--nm-border);
  color: var(--nm-text);
  font-weight: 600;
  border-radius: var(--nm-radius);
  text-decoration: none;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: var(--nm-font);
}
.nm-btn-outline:hover {
  border-color: rgba(0, 200, 83, 0.25);
  background: rgba(255, 255, 255, 0.06);
}
.nm-btn-sm { padding: 9px 18px; font-size: 12px; }
.nm-btn-lg { padding: 14px 24px; font-size: 14px; }
.nm-arrow { font-size: 18px; }

/* ── Hero ── */
.nm-hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
  position: relative;
  overflow: hidden;
  padding: 110px 16px 48px;
}
.nm-hero-grid-bg {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(0, 200, 83, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 200, 83, 0.02) 1px, transparent 1px);
  background-size: 50px 50px;
}
.nm-hero-glow {
  position: absolute;
  top: 15%; left: 50%;
  transform: translateX(-50%);
  width: 500px; height: 500px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0, 200, 83, 0.06) 0%, transparent 70%);
  filter: blur(80px);
}
.nm-hero-inner {
  max-width: 1280px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 40px;
  position: relative;
  z-index: 2;
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}
.nm-hero-inner.nm-visible {
  opacity: 1;
  transform: translateY(0);
}
.nm-hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  width: fit-content;
  background: var(--nm-green-dim);
  border: 1px solid rgba(0, 200, 83, 0.2);
  border-radius: 100px;
  padding: 5px 12px;
  margin-bottom: 16px;
  font-size: 11px;
  color: var(--nm-green);
  font-weight: 600;
  font-family: var(--nm-mono);
}
.nm-pulse-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--nm-green);
  animation: nm-pulse 2s infinite;
}
.nm-hero-title {
  font-size: clamp(30px, 7vw, 54px);
  font-weight: 800;
  line-height: 1.08;
  color: #fff;
  letter-spacing: -1.5px;
  margin-bottom: 16px;
}
.nm-hero-subtitle {
  font-size: clamp(14px, 2.5vw, 17px);
  color: var(--nm-text2);
  line-height: 1.7;
  max-width: 500px;
  margin-bottom: 28px;
}
.nm-hero-ctas {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 32px;
}
.nm-hero-stats {
  display: grid;
  grid-template-columns: repeat(4, auto);
  gap: 20px;
  width: fit-content;
}
.nm-stat-val {
  font-size: 22px;
  font-weight: 800;
  color: #fff;
  font-family: var(--nm-mono);
  line-height: 1;
}
.nm-stat-label {
  font-size: 11px;
  color: var(--nm-text3);
  margin-top: 3px;
}
.nm-hero-demo { width: 100%; }

/* ── Demo Card ── */
.nm-demo-card {
  background: var(--nm-bg2);
  border: 1px solid var(--nm-border);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 16px 50px rgba(0, 0, 0, 0.35), 0 0 24px rgba(0, 200, 83, 0.03);
}
.nm-demo-tabs {
  display: flex;
  border-bottom: 1px solid var(--nm-border);
}
.nm-demo-tab {
  flex: 1;
  padding: 11px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--nm-text3);
  background: none;
  border: none;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  font-family: var(--nm-font);
}
.nm-demo-tab-active {
  color: var(--nm-green);
  border-bottom-color: var(--nm-green);
  background: rgba(0, 200, 83, 0.04);
}

/* ── Price Checker ── */
.nm-ck { padding: 14px; }
.nm-ck-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.nm-ck-live {
  font-size: 10px;
  color: var(--nm-green);
  font-family: var(--nm-mono);
  font-weight: 600;
  background: var(--nm-green-dim);
  padding: 2px 7px;
  border-radius: 4px;
}
.nm-ck-title { font-size: 12px; color: var(--nm-text2); font-weight: 500; }
.nm-ck-search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--nm-border);
  border-radius: 10px;
  padding: 9px 12px;
  margin-bottom: 8px;
  transition: border-color 0.2s;
}
.nm-ck-search:focus-within { border-color: rgba(0, 200, 83, 0.3); }
.nm-ck-input {
  flex: 1;
  background: none;
  border: none;
  color: var(--nm-text);
  font-size: 13px;
  font-family: var(--nm-font);
  outline: none;
}
.nm-ck-input::placeholder { color: var(--nm-text4); }
.nm-ck-chips { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 12px; }
.nm-chip {
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--nm-border);
  border-radius: 100px;
  color: var(--nm-text3);
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--nm-font);
}
.nm-chip:hover, .nm-chip-active {
  background: var(--nm-green-dim);
  border-color: rgba(0, 200, 83, 0.3);
  color: var(--nm-green);
}
.nm-ck-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 0;
  font-size: 12px;
  color: var(--nm-text3);
}
.nm-spinner {
  width: 14px; height: 14px;
  border: 2px solid var(--nm-border);
  border-top-color: var(--nm-green);
  border-radius: 50%;
  animation: nm-spin 0.6s linear infinite;
}
.nm-ck-results { animation: nm-fade-up 0.4s ease; }
.nm-ck-item-name { font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 8px; }
.nm-ck-table { font-family: var(--nm-mono); font-size: 11px; }
.nm-ck-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1.2fr 1fr;
  padding: 7px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  animation: nm-fade-up 0.3s ease both;
}
.nm-ck-row-h {
  color: var(--nm-text4);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-size: 9px;
  border-bottom-color: var(--nm-border);
  animation: none;
}
.nm-ck-mkt { color: var(--nm-text); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nm-ck-state { color: var(--nm-text3); }
.nm-ck-price { color: #fff; font-weight: 600; text-align: right; }
.nm-ck-up { color: #00C853; font-weight: 600; text-align: right; }
.nm-ck-down { color: #FF5252; font-weight: 600; text-align: right; }
.nm-ck-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--nm-border);
  font-size: 10px;
  color: var(--nm-text3);
}
.nm-ck-footer strong { color: var(--nm-green); }
.nm-ck-cta {
  color: var(--nm-green);
  font-weight: 600;
  text-decoration: none;
  font-size: 11px;
  font-family: var(--nm-font);
}
.nm-ck-empty { padding: 16px 0; font-size: 12px; color: var(--nm-text3); text-align: center; }
.nm-ck-empty a { color: var(--nm-green); }

/* ── WhatsApp Demo ── */
.nm-wa-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: #075E54;
}
.nm-wa-avatar {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00C853, #006428);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  color: #fff;
  font-family: var(--nm-mono);
}
.nm-wa-name { font-size: 13px; font-weight: 700; color: #fff; }
.nm-wa-status { font-size: 10px; color: rgba(255, 255, 255, 0.6); }
.nm-wa-body {
  padding: 14px;
  min-height: 180px;
  background: #0B1118;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.nm-wa-msg {
  max-width: 88%;
  padding: 7px 10px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-line;
}
.nm-wa-user {
  align-self: flex-end;
  background: #005C4B;
  color: #fff;
  border-bottom-right-radius: 2px;
  font-family: var(--nm-mono);
  font-weight: 600;
}
.nm-wa-bot {
  align-self: flex-start;
  background: #1F2937;
  color: var(--nm-text);
  border-bottom-left-radius: 2px;
  font-family: var(--nm-mono);
  font-size: 11px;
}
.nm-wa-try {
  display: block;
  text-align: center;
  padding: 12px;
  background: #25D366;
  color: #fff;
  font-weight: 700;
  font-size: 13px;
  text-decoration: none;
  transition: background 0.2s;
  font-family: var(--nm-font);
}
.nm-wa-try:hover { background: #20BD5A; }

/* ── Trust Bar ── */
.nm-trust {
  border-top: 1px solid var(--nm-border);
  border-bottom: 1px solid var(--nm-border);
  background: rgba(0, 200, 83, 0.02);
  padding: 16px;
  opacity: 0;
  transform: translateY(8px);
  transition: all 0.6s ease;
}
.nm-trust.nm-visible { opacity: 1; transform: translateY(0); }
.nm-trust-inner {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px 24px;
}
.nm-trust-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--nm-text2);
  font-weight: 500;
  white-space: nowrap;
}

/* ── Sections ── */
.nm-section { padding: 64px 16px; }
.nm-section-accent {
  background: linear-gradient(180deg, transparent, rgba(0, 200, 83, 0.012), transparent);
}
.nm-section-inner { max-width: 1280px; margin: 0 auto; }
.nm-section-header { text-align: center; margin-bottom: 48px; }
.nm-section-tag {
  font-size: 11px;
  font-weight: 700;
  color: var(--nm-green);
  letter-spacing: 3px;
  text-transform: uppercase;
  font-family: var(--nm-mono);
}
.nm-section-title {
  font-size: clamp(24px, 5vw, 40px);
  font-weight: 800;
  color: #fff;
  margin-top: 10px;
  letter-spacing: -1px;
  line-height: 1.15;
}
.nm-section-desc {
  font-size: 15px;
  color: var(--nm-text3);
  max-width: 500px;
  margin: 10px auto 0;
  line-height: 1.6;
}

/* ── Features Grid ── */
.nm-features-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
.nm-features-grid.nm-visible .nm-feature-card { animation: nm-fade-up 0.5s ease both; }
.nm-feature-card {
  background: var(--nm-card);
  border: 1px solid var(--nm-border);
  border-radius: 14px;
  padding: 24px;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
  opacity: 0;
}
.nm-feature-card:hover {
  border-color: color-mix(in srgb, var(--nm-accent, #00C853) 40%, transparent);
  transform: translateY(-3px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.2);
}
.nm-feature-glow {
  position: absolute;
  top: -24px; right: -24px;
  width: 70px; height: 70px;
  border-radius: 50%;
  background: var(--nm-accent, #00C853);
  opacity: 0.04;
  filter: blur(28px);
}
.nm-feature-icon { font-size: 28px; margin-bottom: 12px; }
.nm-feature-title { font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 6px; }
.nm-feature-desc { font-size: 13px; color: var(--nm-text3); line-height: 1.6; }

/* ── Steps ── */
.nm-steps { display: flex; flex-direction: column; gap: 20px; }
.nm-steps.nm-visible .nm-step { animation: nm-fade-up 0.5s ease both; }
.nm-step {
  text-align: center;
  position: relative;
  opacity: 0;
  background: var(--nm-card);
  border: 1px solid var(--nm-border);
  border-radius: 14px;
  padding: 28px 20px;
}
.nm-step-num {
  font-size: 32px;
  font-weight: 900;
  color: rgba(0, 200, 83, 0.07);
  font-family: var(--nm-mono);
  position: absolute;
  top: 10px; left: 16px;
}
.nm-step-icon {
  width: 56px; height: 56px;
  border-radius: 14px;
  margin: 0 auto 14px;
  background: var(--nm-green-dim);
  border: 1px solid rgba(0, 200, 83, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}
.nm-step-title { font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 8px; }
.nm-step-desc {
  font-size: 13px;
  color: var(--nm-text3);
  line-height: 1.6;
  max-width: 320px;
  margin: 0 auto;
}
.nm-step-connector { display: none; }

/* ── Pricing ── */
.nm-pricing-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
.nm-pricing-grid.nm-visible .nm-price-card { animation: nm-fade-up 0.5s ease both; }
.nm-price-card {
  background: var(--nm-card);
  border: 1px solid var(--nm-border);
  border-radius: 14px;
  padding: 24px;
  position: relative;
  opacity: 0;
  transition: all 0.3s ease;
}
.nm-price-card:hover:not(.nm-price-card-hl) {
  border-color: color-mix(in srgb, var(--nm-accent, #64FFDA) 40%, transparent);
  transform: translateY(-3px);
}
.nm-price-card-hl {
  background: rgba(0, 200, 83, 0.04);
  border-color: rgba(0, 200, 83, 0.22);
  box-shadow: 0 0 32px rgba(0, 200, 83, 0.05);
}
.nm-price-tag {
  position: absolute;
  top: -10px; left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #FFD740, #FFC107);
  color: #0A0F14;
  font-size: 9px;
  font-weight: 800;
  padding: 3px 12px;
  border-radius: 100px;
  font-family: var(--nm-mono);
  letter-spacing: 0.5px;
  white-space: nowrap;
}
.nm-price-name {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--nm-accent, #64FFDA);
  font-family: var(--nm-mono);
  margin-bottom: 6px;
}
.nm-price-amount { margin-bottom: 18px; }
.nm-price-num { font-size: 28px; font-weight: 800; color: #fff; }
.nm-price-period { font-size: 13px; color: var(--nm-text3); }
.nm-price-features { list-style: none; margin-bottom: 20px; }
.nm-price-features li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 12px;
  color: var(--nm-text2);
}
.nm-check { color: var(--nm-green); font-size: 12px; }
.nm-price-cta {
  display: block;
  text-align: center;
  width: 100%;
  padding: 11px;
  border-radius: 10px;
  font-size: 13px;
}

/* ── Testimonials ── */
.nm-testimonials { display: grid; grid-template-columns: 1fr; gap: 16px; }
.nm-testimonials.nm-visible .nm-testimonial { animation: nm-fade-up 0.5s ease both; }
.nm-testimonial {
  background: var(--nm-card);
  border: 1px solid var(--nm-border);
  border-radius: 14px;
  padding: 24px;
  transition: all 0.3s ease;
  opacity: 0;
}
.nm-testimonial:hover {
  border-color: rgba(0, 200, 83, 0.12);
  transform: translateY(-3px);
}
.nm-test-quote {
  font-size: 24px;
  color: rgba(0, 200, 83, 0.12);
  font-family: Georgia, serif;
  line-height: 1;
}
.nm-test-text {
  font-size: 13px;
  color: var(--nm-text2);
  line-height: 1.7;
  font-style: italic;
  margin: 6px 0 16px;
}
.nm-test-author { display: flex; align-items: center; gap: 10px; }
.nm-test-avatar {
  width: 36px; height: 36px;
  border-radius: 9px;
  background: linear-gradient(135deg, #00C853, #006428);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  font-family: var(--nm-mono);
}
.nm-test-name { font-size: 13px; font-weight: 700; color: #fff; }
.nm-test-role { font-size: 11px; color: var(--nm-text3); }

/* ── CTA ── */
.nm-cta-box {
  max-width: 780px;
  margin: 0 auto;
  text-align: center;
  background: linear-gradient(135deg, rgba(0, 200, 83, 0.05), rgba(0, 100, 40, 0.05));
  border: 1px solid rgba(0, 200, 83, 0.1);
  border-radius: 18px;
  padding: 52px 24px;
  position: relative;
  overflow: hidden;
}
.nm-cta-glow-1, .nm-cta-glow-2 {
  position: absolute;
  border-radius: 50%;
  filter: blur(50px);
}
.nm-cta-glow-1 {
  top: -36px; right: -36px;
  width: 140px; height: 140px;
  background: rgba(0, 200, 83, 0.04);
}
.nm-cta-glow-2 {
  bottom: -28px; left: -28px;
  width: 110px; height: 110px;
  background: rgba(0, 200, 83, 0.03);
}
.nm-cta-title {
  font-size: clamp(26px, 5vw, 38px);
  font-weight: 800;
  color: #fff;
  letter-spacing: -1px;
  margin-bottom: 12px;
  position: relative;
}
.nm-cta-desc {
  font-size: 15px;
  color: var(--nm-text2);
  max-width: 420px;
  margin: 0 auto 28px;
  line-height: 1.6;
}
.nm-cta-buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

/* ── Footer ── */
.nm-footer {
  border-top: 1px solid var(--nm-border);
  padding: 40px 16px 20px;
}
.nm-footer-inner {
  max-width: 1280px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr;
  gap: 28px;
  margin-bottom: 28px;
}
.nm-footer-tagline {
  font-size: 13px;
  color: var(--nm-text3);
  line-height: 1.6;
  max-width: 280px;
}
.nm-footer-col-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--nm-text2);
  letter-spacing: 1px;
  text-transform: uppercase;
  font-family: var(--nm-mono);
  margin-bottom: 12px;
}
.nm-footer-link {
  display: block;
  font-size: 13px;
  color: var(--nm-text3);
  text-decoration: none;
  padding: 3px 0;
  transition: color 0.2s;
}
.nm-footer-link:hover { color: var(--nm-green); }
.nm-footer-bottom {
  max-width: 1280px;
  margin: 0 auto;
  border-top: 1px solid var(--nm-border);
  padding-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 11px;
  color: var(--nm-text4);
}

/* ── Email Signup ── */
.nm-hero-signup {
  margin-top: 28px;
}
.nm-cta-signup {
  margin-top: 28px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.nm-cta-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  max-width: 400px;
}
.nm-cta-divider-line {
  flex: 1;
  height: 1px;
  background: rgba(255,255,255,0.08);
}
.nm-cta-divider-text {
  font-size: 11px;
  color: var(--nm-text3);
  white-space: nowrap;
  font-family: var(--nm-mono);
  letter-spacing: 0.3px;
}
.nm-footer-signup {
  margin-top: 16px;
}

/* ══════════════════════════════════════════════════════════
   TABLET — 640px+
   ══════════════════════════════════════════════════════════ */
@media (min-width: 640px) {
  .nm-features-grid { grid-template-columns: repeat(2, 1fr); }
  .nm-steps { flex-direction: row; }
  .nm-step { flex: 1; }
  .nm-pricing-grid { grid-template-columns: repeat(3, 1fr); }
  .nm-testimonials { grid-template-columns: repeat(3, 1fr); }
  .nm-footer-inner { grid-template-columns: 2fr 1fr 1fr 1fr; }
  .nm-footer-bottom { flex-direction: row; justify-content: space-between; }
  .nm-hero-stats { gap: 32px; }
  .nm-stat-val { font-size: 26px; }
}

/* ══════════════════════════════════════════════════════════
   DESKTOP — 1024px+
   ══════════════════════════════════════════════════════════ */
@media (min-width: 1024px) {
  .nm-nav-inner { padding: 0 40px; height: 68px; }
  .nm-nav-links { display: flex; }
  .nm-hamburger { display: none; }
  .nm-mobile-menu { display: none !important; }

  .nm-hero { padding: 120px 40px 80px; }
  .nm-hero-inner {
    flex-direction: row;
    gap: 56px;
    align-items: center;
  }
  .nm-hero-copy { flex: 1; }
  .nm-hero-demo { flex: 1; max-width: 500px; }

  .nm-section { padding: 90px 40px; }
  .nm-features-grid { grid-template-columns: repeat(3, 1fr); }

  .nm-step-connector {
    display: block;
    position: absolute;
    top: 50%; right: -18px;
    width: 36px; height: 2px;
    background: linear-gradient(90deg, rgba(0, 200, 83, 0.2), transparent);
  }

  .nm-pricing-grid { gap: 20px; }
  .nm-price-card-hl { transform: scale(1.03); }

  .nm-footer { padding: 56px 40px 28px; }
}
`;
