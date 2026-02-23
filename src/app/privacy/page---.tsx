// src/app/privacy/page.tsx
// NaijaMarket Intel - Privacy Policy

import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | NaijaMarket Intel",
  description: "How NaijaMarket Intel collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-terminal-bg text-gray-300">
      {/* Header */}
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
          <Link href="/" className="text-sm text-gray-500 hover:text-white transition-colors">
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-gray-500 mb-8">Last updated: February 2026</p>

        <div className="space-y-8 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Information We Collect</h2>
            <p>NaijaMarket Intel (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) collects the following information when you use our platform:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li><strong className="text-white">Account Information:</strong> Name, email address, phone number, and subscription tier when you register.</li>
              <li><strong className="text-white">Usage Data:</strong> Price queries, market searches, alert preferences, and feature usage patterns.</li>
              <li><strong className="text-white">Device Information:</strong> Browser type, IP address, and device identifiers for security and analytics.</li>
              <li><strong className="text-white">Location Data:</strong> GPS coordinates only when explicitly provided by traders for market verification (within 500m radius).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Provide real-time commodity price intelligence across Nigerian markets.</li>
              <li>Deliver price alerts, Morning Briefs, and market notifications via WhatsApp and email.</li>
              <li>Verify trader submissions through GPS-based market proximity checks.</li>
              <li>Detect and prevent fraudulent activity on the platform.</li>
              <li>Improve our services through aggregated, anonymized analytics.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Data Sharing</h2>
            <p>We do not sell your personal data. We may share anonymized, aggregated market data with enterprise clients, research organizations, and government agencies for market intelligence purposes. Individual price submissions are never attributed to specific traders in shared data.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Data Security</h2>
            <p>We protect your data using industry-standard measures including encrypted connections (TLS), secure Azure cloud infrastructure hosted in South Africa, role-based access controls, and regular security audits. Financial data (airtime rewards, subscription payments) is processed through verified payment providers (Paystack, Flutterwave) and never stored on our servers.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Your Rights</h2>
            <p>You have the right to access, correct, or delete your personal data at any time. You can manage your preferences through WhatsApp (type &quot;status&quot;) or via the website Settings page. To request data deletion, contact us at privacy@naijamarketintel.com.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Cookies</h2>
            <p>We use essential cookies for authentication and session management. We do not use third-party advertising cookies. Analytics cookies are used only for aggregated platform improvement metrics.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Contact</h2>
            <p>For privacy-related inquiries, contact us at <a href="mailto:privacy@naijamarketintel.com" className="text-naija-green hover:underline">privacy@naijamarketintel.com</a>.</p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-terminal-border py-6 px-6 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} NaijaMarket Intel. All rights reserved.
      </footer>
    </div>
  );
}
