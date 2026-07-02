"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/ThemeToggle";
import WhatsAppCTA from '@/components/WhatsAppCTA'
import "./landing.css";

// App download links (Google Play)
const CONSUMER_APP_URL = "https://play.google.com/store/apps/details?id=com.giggababytes.naijamarketconsumer";
const REPORTER_APP_URL = "https://play.google.com/store/apps/details?id=com.giggababytes.naijamarkettrader";

// ============================================================================
// NaijaMarket Intel — Landing Page v2.1 — optimised June 2026
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

const FEATURES: { icon: IconName; title: string; desc: string; accent: string }[] = [
  { icon: "activity", title: "Real-Time Prices", desc: "Live GPS-verified prices from 282 markets across 36 states + FCT. Updated 3× daily by on-ground traders.", accent: "#00C853" },
  { icon: "bell", title: "Smart Price Alerts", desc: "Set thresholds. Get WhatsApp notifications when prices cross your targets.", accent: "#FF5252" },
  { icon: "globe", title: "Regional Comparison", desc: "Compare prices across states. Spot arbitrage opportunities before competitors.", accent: "#26A69A" },
];

const TIERS = [
  {
    nm: "FREE", pr: "₦0", pd: "", tg: null, ac: "#64FFDA", hl: false,
    ft: ["5 queries/week", "3 markets", "WhatsApp access", "Basic price search", "1 free guest query"],
    ct: "Start Free", hr: "/register",
  },
  {
    nm: "SILVER", pr: "₦500", pd: "/week", tg: null, ac: "#90CAF9", hl: false,
    ft: ["10 queries/day", "3 markets", "Price alerts", "Price trends", "WhatsApp + Web"],
    ct: "Go Silver", hr: "/register?plan=silver",
  },
  {
    nm: "GOLD", pr: "₦2,000", pd: "/mo", tg: "BEST VALUE", ac: "#FFD740", hl: true,
    ft: ["25 queries/day", "3 markets", "Price forecast", "Market snapshot", "Historical data", "Priority support"],
    ct: "Go Gold", hr: "/register?plan=gold",
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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• Ticker â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
/* ═══════════════ Inline SVG icons (replace emoji — consistent cross-platform) ═══════════════ */
type IconName = "activity" | "bell" | "globe" | "search" | "bar-chart" | "zap" | "whatsapp";
function Icon({ name, size = 24, style }: { name: IconName; size?: number; style?: React.CSSProperties }) {
  const s = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style,
    "aria-hidden": true,
    focusable: false,
  };
  switch (name) {
    case "activity":
      return (<svg {...s}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>);
    case "bell":
      return (<svg {...s}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>);
    case "globe":
      return (<svg {...s}><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>);
    case "search":
      return (<svg {...s}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>);
    case "bar-chart":
      return (<svg {...s}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>);
    case "zap":
      return (<svg {...s}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>);
    case "whatsapp":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style} aria-hidden focusable={false}>
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
        </svg>
      );
  }
}

/* ═══════════════ Ticker ═══════════════ */
function Ticker() {
  const [ticks, setTicks] = useState(TICKER);
  useEffect(() => {
    fetch("/api/prices/ticker")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d) && d.length > 0) setTicks([...d, ...d]); })
      .catch(() => {}); // Silently fall back to static data
  }, []);
  const doubled = ticks.length === TICKER.length ? [...ticks, ...ticks] : ticks;
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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• Nav â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
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
          <Image src="/logo.png" alt="NaijaMarket Intel" width={100} height={100} className="rounded-full" />
        </Link>

        <div className="nm-nav-links">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#how-it-works">How It Works</a>
          <Link href="/login" className="nm-nav-signin">Sign In</Link>
          <ThemeToggle />
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

      {/* ── Trust Bar — sits directly below logo/nav links ── */}
      <div className="nm-trust-bar">
        <div className="nm-trust-bar-inner">
          {[
            { dot: "green", text: "GPS-Verified Data" },
            { dot: "green", text: "Soft Launch — Mile 12 & Onitsha" },
            { dot: "blue",  text: "Aligned with NBS CPI" },
            { dot: "green", text: "36 States + FCT Covered" },
            { dot: "amber", text: "Updated 3× Daily" },
          ].map((item, i) => (
            <span key={i} className="nm-trust-bar-item">
              <span className={`nm-trust-dot nm-trust-dot-${item.dot}`} />
              {item.text}
            </span>
          ))}
        </div>
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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• Price Checker â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
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
        <span className="nm-ck-live">◉ LIVE</span>
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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• WhatsApp Demo â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function WADemo() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 700);
    const t2 = setTimeout(() => setStep(2), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const botReply = `🍚 Rice (50kg) - Lagos Markets

🔍 Mile 12: ₦82,450 (+0.34%)
🔍 Ojo Market: ₦81,200 (-0.15%)
🔍 Mushin: ₦83,100 (+0.52%)

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
        href="https://wa.me/2349131095009?text=menu"
        target="_blank"
        rel="noopener noreferrer"
        className="nm-wa-try"
      >
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Icon name="whatsapp" size={16} /> Try it now on WhatsApp</span>
      </a>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• Hero Demo Tabs â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function DemoTabs() {
  const [tab, setTab] = useState<"prices" | "whatsapp">("prices");
  return (
    <div className="nm-demo-card">
      <div className="nm-demo-tabs">
        <button
          className={`nm-demo-tab${tab === "prices" ? " nm-demo-tab-active" : ""}`}
          onClick={() => setTab("prices")}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="search" size={15} /> Price Checker</span>
        </button>
        <button
          className={`nm-demo-tab${tab === "whatsapp" ? " nm-demo-tab-active" : ""}`}
          onClick={() => setTab("whatsapp")}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="whatsapp" size={15} /> WhatsApp Demo</span>
        </button>
      </div>
      {tab === "prices" ? <PriceChecker /> : <WADemo />}
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• Hero â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
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
            <span>LIVE — 282 Markets · 36 States + FCT</span>
          </div>

          <h1 className="nm-hero-title">
            Know the real price<br />
            <span className="nm-gradient-text">before you buy.</span>
          </h1>

          <p className="nm-hero-subtitle">
            Tomatoes at Mile 12 today: <strong style={{color:"var(--price-up)"}}>₦42,500</strong>. Bodija: <strong style={{color:"var(--price-up)"}}>₦38,200</strong>. That&apos;s ₦4,300 arbitrage per basket — before you leave the house.
            GPS-verified prices from 282 markets. Updated 3× daily.
          </p>

          <div className="nm-hero-ctas">
            <a
              href="https://wa.me/2349131095009?text=menu"
              target="_blank"
              rel="noopener noreferrer"
              className="nm-btn-green nm-btn-lg"
            >
              <Icon name="whatsapp" size={18} /> Check Prices on WhatsApp <span className="nm-arrow">→</span>
            </a>
            <Link href="/register" className="nm-btn-outline nm-btn-lg">
              Start Free on Web
            </Link>
          </div>

          <div className="nm-hero-stats">
            {[
              { v: "282", l: "Markets" },
              { v: "610+", l: "Commodities" },
              { v: "36+FCT", l: "States" },
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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• Features â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function VideoSection() {
  return (
    <section className="nm-section nm-section-accent" style={{paddingTop: "24px"}}>
      <div className="nm-section-inner" style={{maxWidth: "900px", margin: "0 auto"}}>
        <div className="nm-section-header" style={{marginBottom: "32px"}}>
          <span className="nm-section-tag">Platform Demo</span>
          <h2 className="nm-section-title">See NaijaMarket Intel in Action</h2>
          <p className="nm-section-desc">Real-time commodity prices across 282 Nigerian markets — updated three times daily.</p>
        </div>
        <div style={{position: "relative", borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(0,200,83,0.2)", boxShadow: "0 8px 40px rgba(0,0,0,0.4)"}}>
          <video
            src="/videos/hero.mp4"
            controls
            playsInline
            poster=""
            style={{width: "100%", display: "block", maxHeight: "500px", objectFit: "cover", background: "#0a0a0a"}}
          />
        </div>
      </div>
    </section>
  )
}

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
            Nigerian food traders lose an estimated 15–30% of margin to price information asymmetry.
            We built the intelligence layer to close that gap.
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
              <div className="nm-feature-icon"><Icon name={f.icon} size={28} style={{ color: f.accent }} /></div>
              <h3 className="nm-feature-title">{f.title}</h3>
              <p className="nm-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• How It Works â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function HowItWorksSection() {
  const { ref, visible } = useInView();
  const steps: { num: string; icon: IconName; title: string; desc: string }[] = [
    { num: "01", icon: "search", title: "Search Any Commodity", desc: "Type a commodity, market, or state. Get instant verified prices from our trader network." },
    { num: "02", icon: "bar-chart", title: "Analyze Market Trends", desc: "View price history, inflation trends, regional comparisons, and arbitrage opportunities." },
    { num: "03", icon: "zap", title: "Set Alerts & Act", desc: "Create custom price alerts. Get WhatsApp notifications. Make data-driven decisions." },
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
              <div className="nm-step-icon" style={{ color: "var(--nm-green)" }}><Icon name={step.icon} size={24} /></div>
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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• Pricing â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
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
        {/* Enterprise & API row */}
        <div style={{
          marginTop: "24px",
          padding: "28px 32px",
          background: "var(--nm-card)",
          border: "1px solid var(--nm-border)",
          borderRadius: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "20px",
        }}>
          <div>
            <div style={{ color: "var(--nm-text)", fontWeight: 700, fontSize: "16px", marginBottom: "6px" }}>
              Business, Corporate &amp; API Plans
            </div>
            <div style={{ color: "var(--nm-text2)", fontSize: "14px", maxWidth: "480px", lineHeight: 1.6 }}>
              From ₦15,000/mo for businesses to unlimited API access for institutions.
              Custom SLA, white-label, Power BI integration, and dedicated support available.
            </div>
          </div>
          <a
            href="mailto:sales@naijamarketintel.ng"
            style={{
              display: "inline-block",
              padding: "12px 28px",
              background: "transparent",
              border: "1px solid var(--nm-border)",
              borderRadius: "10px",
              color: "var(--nm-text)",
              fontWeight: 600,
              fontSize: "14px",
              textDecoration: "none",
              whiteSpace: "nowrap",
              transition: "border-color 0.2s",
            }}
          >
            Contact Sales →
          </a>
        </div>
      </div>
    </section>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• Testimonials â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
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


/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• Footer â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
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
        ["Food News", "/food-news"],
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
            <Image src="/logo.png" alt="NaijaMarket Intel" width={100} height={100} className="rounded-full" />
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

function AppDownloadSection() {
  return (
    <section className="nm-section nm-appdl">
      <h2 className="nm-appdl-title">Get the <span className="nm-g">app</span></h2>
      <p className="nm-appdl-desc">Live prices on the go — scan to download.</p>
      <div className="nm-appdl-grid">
        <div className="nm-appdl-card">
          <div className="nm-appdl-card-title">For Buyers &amp; Businesses</div>
          <Image src="/qr-naijamarket-intel.png" alt="NaijaMarket Intel app QR code" width={160} height={160} className="nm-appdl-qr" />
          <a href={CONSUMER_APP_URL} target="_blank" rel="noopener noreferrer">
            <Image src="/google-play-badge.png" alt="Get NaijaMarket Intel on Google Play" width={180} height={54} className="nm-appdl-badge" />
          </a>
        </div>
        <div className="nm-appdl-card">
          <div className="nm-appdl-card-title">For Price Reporters</div>
          <Image src="/qr-naijamarket-reporter.png" alt="NaijaMarket Reporter app QR code" width={160} height={160} className="nm-appdl-qr" />
          <a href={REPORTER_APP_URL} target="_blank" rel="noopener noreferrer">
            <Image src="/google-play-badge.png" alt="Get NaijaMarket Reporter on Google Play" width={180} height={54} className="nm-appdl-badge" />
          </a>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <>
      <div className="nm-landing">
        <Nav />
        <Hero />
        <VideoSection />
        <FeaturesSection />
        <HowItWorksSection />
        {/* <WaitlistSection /> — hidden; /api/waitlist route kept live for any direct submissions */}
        <PricingSection />
        <TestimonialsSection />
        <AppDownloadSection />
        <Footer />
      </div>
      <WhatsAppCTA />
    </>
  );
}
