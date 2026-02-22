// src/app/terms/page.tsx
// NaijaMarket Intel - Terms of Service

import Link from "next/link";

export const metadata = {
  title: "Terms of Service | NaijaMarket Intel",
  description: "Terms and conditions for using NaijaMarket Intel platform.",
};

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-gray-500 mb-8">Last updated: February 2026</p>

        <div className="space-y-8 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using NaijaMarket Intel (&quot;the Platform&quot;), you agree to be bound by these Terms of Service. The Platform is operated by NaijaMarket Intel, providing commodity price intelligence services across Nigerian markets.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. User Roles &amp; Responsibilities</h2>
            <p className="mb-2">The Platform supports three user roles:</p>
            <ul className="list-disc ml-6 space-y-2">
              <li><strong className="text-white">Traders:</strong> Submit commodity prices from physical markets. Must be physically present within 500m of the market (GPS verified). Earn ₦20 per approved submission. Must provide accurate pricing — repeated fraudulent submissions result in permanent suspension.</li>
              <li><strong className="text-white">Validators:</strong> Verify price submissions through consensus voting. Earn ₦50 per validation. Must vote honestly — accuracy below 60% results in suspension.</li>
              <li><strong className="text-white">Consumers:</strong> Access real-time verified commodity prices. Subscription tiers range from FREE to ENTERPRISE with varying access levels.</li>
            </ul>
            <p className="mt-2">Each phone number may only be registered for ONE role. Role switching is not permitted.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Subscription &amp; Payment</h2>
            <p>Consumer subscriptions are billed according to the selected tier (FREE, SABI, BUSINESS, CORPORATE, ENTERPRISE). Payment is processed through Paystack and Flutterwave. Subscriptions auto-renew unless cancelled. Refunds are available within 48 hours of initial subscription only.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Rewards &amp; Payouts</h2>
            <p>Trader and Validator rewards accumulate in platform balance. Minimum payout threshold is ₦500. Weekly payouts are distributed as airtime via VTPass every Friday at 6 PM WAT. NaijaMarket Intel reserves the right to withhold rewards for fraudulent activity pending investigation.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Prohibited Conduct</h2>
            <ul className="list-disc ml-6 space-y-1">
              <li>Submitting false or manipulated commodity prices.</li>
              <li>Using GPS spoofing or location falsification tools.</li>
              <li>Creating multiple accounts for the same role.</li>
              <li>Colluding with validators to approve fraudulent submissions.</li>
              <li>Scraping, copying, or redistributing platform data without authorization.</li>
              <li>Attempting to exploit the rewards system through automated submissions.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Data Accuracy Disclaimer</h2>
            <p>While we implement rigorous validation (3-validator consensus, GPS verification, ML anomaly detection), NaijaMarket Intel does not guarantee the absolute accuracy of all listed prices. Prices are crowdsourced and should be used as market intelligence, not as the sole basis for financial decisions.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Service Availability</h2>
            <p>We aim for 99.9% uptime but do not guarantee uninterrupted service. Scheduled maintenance windows are communicated in advance via WhatsApp and email.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Termination</h2>
            <p>We reserve the right to suspend or terminate accounts that violate these terms. Users may delete their accounts at any time by contacting support@naijamarketintel.com.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Contact</h2>
            <p>For questions about these terms, contact <a href="mailto:legal@naijamarketintel.com" className="text-naija-green hover:underline">legal@naijamarketintel.com</a>.</p>
          </section>
        </div>
      </main>

      <footer className="border-t border-terminal-border py-6 px-6 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} NaijaMarket Intel. All rights reserved.
      </footer>
    </div>
  );
}
