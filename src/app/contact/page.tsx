// src/app/contact/page.tsx
// NaijaMarket Intel - Contact Page

import Link from "next/link";

export const metadata = {
  title: "Contact Us | NaijaMarket Intel",
  description: "Get in touch with the NaijaMarket Intel team.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-terminal-bg text-gray-300">
      <header className="border-b border-terminal-border py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-naija-green to-naija-gold rounded-lg flex items-center justify-center">
              <span className="text-terminal-bg font-bold text-sm">NM</span>
            </div>
            <span className="font-display font-bold text-lg text-white">
              NaijaMarket<span className="text-naija-green">Intel</span>
            </span>
          </Link>
          <Link href="/" className="text-sm text-gray-500 hover:text-white transition-colors">← Back to Home</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-white mb-2">Contact Us</h1>
        <p className="text-gray-500 mb-8">We&apos;d love to hear from you. Reach out through any of the channels below.</p>

        <div className="grid md:grid-cols-2 gap-6">
          {/* General Inquiries */}
          <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
            <div className="text-2xl mb-3">📧</div>
            <h3 className="text-lg font-semibold text-white mb-2">General Inquiries</h3>
            <p className="text-sm text-gray-400 mb-3">Questions about the platform, features, or partnerships.</p>
            <a href="mailto:hello@naijamarketintel.com" className="text-naija-green hover:underline text-sm font-medium">
              hello@naijamarketintel.com
            </a>
          </div>

          {/* Support */}
          <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
            <div className="text-2xl mb-3">🛟</div>
            <h3 className="text-lg font-semibold text-white mb-2">Technical Support</h3>
            <p className="text-sm text-gray-400 mb-3">Issues with your account, subscriptions, or WhatsApp integration.</p>
            <a href="mailto:support@naijamarketintel.com" className="text-naija-green hover:underline text-sm font-medium">
              support@naijamarketintel.com
            </a>
          </div>

          {/* Enterprise / API */}
          <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
            <div className="text-2xl mb-3">🏢</div>
            <h3 className="text-lg font-semibold text-white mb-2">Enterprise &amp; API</h3>
            <p className="text-sm text-gray-400 mb-3">Enterprise pricing, API access, bulk data licensing, and B2B partnerships.</p>
            <a href="mailto:enterprise@naijamarketintel.com" className="text-naija-green hover:underline text-sm font-medium">
              enterprise@naijamarketintel.com
            </a>
          </div>

          {/* WhatsApp */}
          <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
            <div className="text-2xl mb-3">💬</div>
            <h3 className="text-lg font-semibold text-white mb-2">WhatsApp</h3>
            <p className="text-sm text-gray-400 mb-3">Quick support via our WhatsApp bot. Type <strong className="text-white">help</strong> to get started.</p>
            <a href="https://wa.me/14155238886?text=join%20daily-drew" className="text-naija-green hover:underline text-sm font-medium" target="_blank" rel="noopener noreferrer">
              Open WhatsApp →
            </a>
          </div>
        </div>

        {/* Office */}
        <div className="mt-10 bg-terminal-surface border border-terminal-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Our Offices</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-naija-green mb-1">Nigeria (Operations)</p>
              <p className="text-sm text-gray-400">Lagos, Nigeria</p>
            </div>
            <div>
              <p className="text-sm font-medium text-naija-green mb-1">Finland (Headquarters)</p>
              <p className="text-sm text-gray-400">Helsinki, Finland</p>
            </div>
          </div>
        </div>

        {/* Trader / Validator */}
        <div className="mt-10 bg-naija-green/10 border border-naija-green/30 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Become a Market Trader or Validator</h3>
          <p className="text-sm text-gray-400 mb-3">Earn airtime rewards by submitting verified commodity prices from Nigerian markets or validating price submissions.</p>
          <p className="text-sm text-gray-400">Send <strong className="text-white">Hi</strong> to our WhatsApp number to get started — registration takes less than 2 minutes.</p>
        </div>
      </main>

      <footer className="border-t border-terminal-border py-6 px-6 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} NaijaMarket Intel. All rights reserved.
      </footer>
    </div>
  );
}
