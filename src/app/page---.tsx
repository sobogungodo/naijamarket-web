"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  TrendingUp, 
  BarChart3, 
  Bell, 
  Globe, 
  Zap, 
  Shield,
  ArrowRight,
  Check,
  Mail,
  Phone,
  MapPin,
  Send,
  MessageCircle,
} from "lucide-react";

// ============================================================================
// LANDING PAGE
// ============================================================================

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-terminal-bg">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-terminal-bg/80 backdrop-blur-xl border-b border-terminal-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-naija-green to-naija-gold rounded-lg flex items-center justify-center">
              <span className="text-terminal-bg font-bold text-sm">NM</span>
            </div>
            <span className="font-display font-bold text-lg text-white">
              NaijaMarket<span className="text-naija-green">Intel</span>
            </span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">
              Features
            </Link>
            <Link href="#pricing" className="text-sm text-gray-400 hover:text-white transition-colors">
              Pricing
            </Link>
            <Link href="#api" className="text-sm text-gray-400 hover:text-white transition-colors">
              API
            </Link>
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
              Sign In
            </Link>
            <Link 
              href="/register" 
              className="px-4 py-2 bg-naija-green text-terminal-bg text-sm font-medium rounded-lg hover:bg-naija-green-400 transition-colors"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-6">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-naija-green/10 border border-naija-green/30 rounded-full text-naija-green text-sm">
              <Zap className="w-4 h-4" />
              <span>The Bloomberg of African Commodities</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold text-white leading-tight">
              Real-Time Price Intelligence{" "}
              <span className="text-gradient">for Nigerian Markets</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
              Track commodity prices across 226+ markets. Get GPS-verified data from 
              10,000+ traders. Make smarter procurement decisions.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                href="/register"
                className="w-full sm:w-auto px-8 py-3 bg-naija-green text-terminal-bg font-semibold rounded-lg hover:bg-naija-green-400 transition-all hover:scale-105 flex items-center justify-center gap-2"
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/dashboard"
                className="w-full sm:w-auto px-8 py-3 bg-terminal-surface border border-terminal-border text-white font-semibold rounded-lg hover:bg-terminal-elevated transition-colors flex items-center justify-center gap-2"
              >
                View Demo
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap items-center justify-center gap-8 pt-8 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-naija-green" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-naija-green" />
                <span>226+ markets covered</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-naija-green" />
                <span>Updated every hour</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Terminal Preview */}
      <section className="px-4 pb-20">
        <div className="container mx-auto max-w-6xl">
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-naija-green/20 via-transparent to-naija-gold/20 blur-3xl" />
            
            {/* Terminal Window */}
            <div className="relative bg-terminal-surface border border-terminal-border rounded-xl overflow-hidden shadow-terminal">
              {/* Window Controls */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-terminal-border bg-terminal-bg">
                <div className="w-3 h-3 rounded-full bg-price-down" />
                <div className="w-3 h-3 rounded-full bg-naija-gold" />
                <div className="w-3 h-3 rounded-full bg-price-up" />
                <span className="ml-4 text-xs text-gray-500 font-mono">NM:SNAPSHOT</span>
              </div>
              
              {/* Terminal Content */}
              <div className="p-6 space-y-4 font-mono text-sm">
                {/* Command Input */}
                <div className="flex items-center gap-2">
                  <span className="text-naija-gold">NM&gt;</span>
                  <span className="text-white">SNAPSHOT</span>
                  <span className="w-2 h-4 bg-naija-gold animate-pulse" />
                </div>
                
                {/* Market Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                  {[
                    { label: "NFPI INDEX", value: "127.4", change: "+2.3%", up: true },
                    { label: "RICE 50KG", value: "₦78,500", change: "+1.8%", up: true },
                    { label: "TOMATO BASKET", value: "₦45,000", change: "-5.2%", up: false },
                    { label: "PALM OIL 25L", value: "₦52,000", change: "+0.5%", up: true },
                  ].map((item) => (
                    <div key={item.label} className="bg-terminal-bg/50 p-3 rounded border border-terminal-border">
                      <div className="text-2xs text-gray-500">{item.label}</div>
                      <div className="text-lg text-white">{item.value}</div>
                      <div className={item.up ? "text-price-up text-xs" : "text-price-down text-xs"}>
                        {item.change}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* ASCII Chart */}
                <div className="text-green-500 pt-4">
                  <div className="text-gray-500 text-xs mb-2">NFPI 30-DAY TREND</div>
                  <pre className="text-xs leading-tight">
{`  130│                    ╭─────╮
     │              ╭────╯     │
  125│         ╭────╯          ╰──
     │    ╭────╯
  120│────╯
     └────────────────────────────
       W1    W2    W3    W4    NOW`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 border-t border-terminal-border">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
              Bloomberg-Grade Market Intelligence
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Built for traders, procurement teams, and analysts who need reliable 
              commodity price data for Nigerian markets.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: TrendingUp,
                title: "Real-Time Prices",
                description: "GPS-verified price submissions from 10,000+ traders across 226 markets. Updated hourly.",
              },
              {
                icon: BarChart3,
                title: "NFPI Index",
                description: "Nigeria's first food price index. Track inflation and market trends at a glance.",
              },
              {
                icon: Bell,
                title: "Price Alerts",
                description: "Set custom alerts for any item. Get notified via WhatsApp, email, or SMS instantly.",
              },
              {
                icon: Globe,
                title: "Market Coverage",
                description: "From Mile 12 to Onitsha, Ariaria to Wuse. All major Nigerian markets in one place.",
              },
              {
                icon: Zap,
                title: "API Access",
                description: "Integrate price data into your systems. RESTful API with 99.9% uptime guarantee.",
              },
              {
                icon: Shield,
                title: "Validated Data",
                description: "3-validator consensus on every submission. Fraud detection and quality scoring.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group p-6 bg-terminal-surface border border-terminal-border rounded-xl hover:border-naija-green/50 transition-colors"
              >
                <div className="w-12 h-12 bg-naija-green/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-naija-green/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-naija-green" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-400 text-sm">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 border-t border-terminal-border bg-terminal-surface/50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-gray-400">
              Start free, upgrade when you need more.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                name: "Free",
                price: "₦0",
                period: "forever",
                features: [
                  "3 queries per day",
                  "Basic price lookup",
                  "1 market",
                  "24h data delay",
                ],
                cta: "Get Started",
                highlighted: false,
              },
              {
                name: "Standard",
                price: "₦2,000",
                period: "/month",
                features: [
                  "100 queries per day",
                  "5 markets",
                  "Price alerts",
                  "Historical trends",
                  "Export to CSV",
                ],
                cta: "Start Free Trial",
                highlighted: true,
              },
              {
                name: "Premium",
                price: "₦5,000",
                period: "/month",
                features: [
                  "Unlimited queries",
                  "All 226 markets",
                  "API access",
                  "Priority support",
                  "Custom reports",
                ],
                cta: "Contact Sales",
                highlighted: false,
              },
            ].map((tier) => (
              <div
                key={tier.name}
                className={`relative p-6 rounded-xl border ${
                  tier.highlighted
                    ? "bg-terminal-bg border-naija-green shadow-glow-green"
                    : "bg-terminal-surface border-terminal-border"
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-naija-green text-terminal-bg text-xs font-medium rounded-full">
                    Most Popular
                  </div>
                )}
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-white mb-2">{tier.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold text-white">{tier.price}</span>
                    <span className="text-gray-500 text-sm">{tier.period}</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-gray-400">
                      <Check className="w-4 h-4 text-naija-green flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`block w-full py-2 text-center rounded-lg font-medium transition-colors ${
                    tier.highlighted
                      ? "bg-naija-green text-terminal-bg hover:bg-naija-green-400"
                      : "bg-terminal-bg border border-terminal-border text-white hover:bg-terminal-elevated"
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter CTA Section */}
      <NewsletterCTA />

      {/* Footer */}
      <footer className="border-t border-terminal-border bg-terminal-bg">
        <div className="container mx-auto max-w-6xl px-4 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
            {/* Brand Column */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-naija-green to-naija-gold rounded-lg flex items-center justify-center">
                  <span className="text-terminal-bg font-bold text-sm">NM</span>
                </div>
                <span className="font-display font-bold text-lg text-white">
                  NaijaMarket<span className="text-naija-green">Intel</span>
                </span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed max-w-xs mb-6">
                Nigeria&apos;s most comprehensive commodity price intelligence platform. 
                Empowering traders, businesses, and analysts with real-time, 
                GPS-verified market data across 226+ markets.
              </p>
              <p className="text-xs text-gray-600">
                A product of <span className="text-gray-400">Giggababytes Oy</span>
              </p>
            </div>

            {/* Product Column */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Product</h4>
              <ul className="space-y-3">
                {[
                  { label: "Live Prices", href: "/dashboard/prices" },
                  { label: "Markets", href: "/dashboard/markets" },
                  { label: "Analytics", href: "/dashboard/analytics" },
                  { label: "Arbitrage", href: "/dashboard/arbitrage" },
                  { label: "API Portal", href: "/dashboard/api-portal" },
                  { label: "Reports", href: "/dashboard/reports" },
                ].map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} className="text-sm text-gray-500 hover:text-naija-green transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company Column */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Company</h4>
              <ul className="space-y-3">
                {[
                  { label: "About Us", href: "/about" },
                  { label: "Contact", href: "/contact" },
                  { label: "Pricing", href: "#pricing" },
                  { label: "Terms & Conditions", href: "/terms" },
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "API Documentation", href: "/dashboard/api-portal" },
                ].map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} className="text-sm text-gray-500 hover:text-naija-green transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact Column */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Contact</h4>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-naija-green shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-500">
                    Helsinki, Finland<br />
                    Lagos, Nigeria
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-naija-green shrink-0" />
                  <a href="tel:+2349030001333" className="text-sm text-gray-500 hover:text-white transition-colors">
                    +234 903 000 1333
                  </a>
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-naija-green shrink-0" />
                  <a href="mailto:support@naijafood.ng" className="text-sm text-gray-500 hover:text-white transition-colors">
                    support@naijafood.ng
                  </a>
                </li>
                <li className="flex items-center gap-3">
                  <MessageCircle className="w-4 h-4 text-naija-green shrink-0" />
                  <a href="https://wa.me/14155238886?text=Hi" className="text-sm text-gray-500 hover:text-white transition-colors">
                    WhatsApp Support
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-12 pt-8 border-t border-terminal-border flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              © {new Date().getFullYear()} NaijaMarket Intel. All rights reserved.
            </div>
            <div className="flex items-center gap-6 text-xs text-gray-600">
              <span>263 commodities</span>
              <span className="text-terminal-border">•</span>
              <span>219 markets</span>
              <span className="text-terminal-border">•</span>
              <span>31 states</span>
              <span className="text-terminal-border">•</span>
              <span>Real-time data</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// NEWSLETTER CTA COMPONENT
// ============================================================================

function NewsletterCTA() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
        setMessage("You\u2019re in! Watch your inbox for market updates.");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error || "Something went wrong. Try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  };

  return (
    <section className="py-20 px-4 border-t border-terminal-border">
      <div className="container mx-auto max-w-4xl">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-naija-green/10 via-terminal-surface to-naija-gold/10 border border-terminal-border p-8 md:p-12">
          {/* Background glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-naija-green/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-naija-gold/5 rounded-full blur-3xl" />

          <div className="relative flex flex-col md:flex-row items-center gap-8">
            {/* Text */}
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-3">
                Get commodity prices &amp; market{" "}
                <span className="text-naija-green">insights every day</span>
              </h2>
              <p className="text-gray-400 text-sm">
                Join 5,000+ traders, analysts, and procurement teams. Free daily market 
                summary delivered to your inbox every morning.
              </p>
            </div>

            {/* Form */}
            <div className="w-full md:w-auto">
              {status === "success" ? (
                <div className="flex items-center gap-2 px-6 py-3 bg-naija-green/20 border border-naija-green/30 rounded-lg">
                  <Check className="w-5 h-5 text-naija-green" />
                  <span className="text-naija-green text-sm font-medium">{message}</span>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    className="w-full md:w-64 px-4 py-3 bg-terminal-bg border border-terminal-border rounded-lg text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-naija-green transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="px-6 py-3 bg-naija-green text-terminal-bg font-semibold text-sm rounded-lg hover:bg-naija-green-400 transition-colors whitespace-nowrap flex items-center gap-2 disabled:opacity-50"
                  >
                    {status === "loading" ? (
                      <div className="w-4 h-4 border-2 border-terminal-bg border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Join Now
                  </button>
                </form>
              )}
              {status === "error" && (
                <p className="text-red-400 text-xs mt-2">{message}</p>
              )}
              <p className="text-gray-600 text-xs mt-3 text-center md:text-left">
                No spam, ever. Unsubscribe anytime.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
