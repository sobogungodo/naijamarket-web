// src/app/docs/page.tsx
// NaijaMarket Intel - API Documentation

import Link from "next/link";

export const metadata = {
  title: "API Documentation | NaijaMarket Intel",
  description: "REST API documentation for NaijaMarket Intel commodity price data.",
};

export default function DocsPage() {
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
        <h1 className="text-3xl font-bold text-white mb-2">API Documentation</h1>
        <p className="text-gray-500 mb-8">Access real-time Nigerian commodity price data programmatically.</p>

        <div className="space-y-8 leading-relaxed">
          {/* Overview */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Overview</h2>
            <p>The NaijaMarket Intel API provides RESTful access to verified commodity price data across 226+ Nigerian markets covering 610+ food commodities. Data is updated multiple times daily through our crowdsourced trader network with 3-validator consensus verification.</p>
          </section>

          {/* Base URL */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Base URL</h2>
            <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4 font-mono text-sm">
              <span className="text-naija-green">https://func-naijamarket-api.azurewebsites.net/api</span>
            </div>
          </section>

          {/* Endpoints */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Endpoints</h2>

            {/* Health */}
            <div className="bg-terminal-surface border border-terminal-border rounded-lg p-5 mb-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-naija-green/20 text-naija-green px-2 py-0.5 rounded text-xs font-mono font-bold">GET</span>
                <code className="text-white font-mono text-sm">/health</code>
              </div>
              <p className="text-sm text-gray-400">Check API status and version.</p>
            </div>

            {/* Price Lookup */}
            <div className="bg-terminal-surface border border-terminal-border rounded-lg p-5 mb-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-naija-green/20 text-naija-green px-2 py-0.5 rounded text-xs font-mono font-bold">GET</span>
                <code className="text-white font-mono text-sm">/prices/lookup?item=rice&amp;market=mile+12</code>
              </div>
              <p className="text-sm text-gray-400 mb-3">Look up current prices for a specific item and optional market.</p>
              <div className="text-xs text-gray-500">
                <p className="mb-1"><strong className="text-gray-400">Parameters:</strong></p>
                <ul className="ml-4 space-y-0.5">
                  <li><code className="text-naija-green">item</code> (required) — commodity name (e.g., rice, tomatoes, palm oil)</li>
                  <li><code className="text-naija-green">market</code> (optional) — market name filter</li>
                  <li><code className="text-naija-green">state</code> (optional) — state filter (e.g., Lagos, Anambra)</li>
                  <li><code className="text-naija-green">limit</code> (optional) — max results (default: 20)</li>
                </ul>
              </div>
            </div>

            {/* Markets */}
            <div className="bg-terminal-surface border border-terminal-border rounded-lg p-5 mb-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-naija-green/20 text-naija-green px-2 py-0.5 rounded text-xs font-mono font-bold">GET</span>
                <code className="text-white font-mono text-sm">/prices/markets?market=mile+12</code>
              </div>
              <p className="text-sm text-gray-400">Get all current prices for a specific market.</p>
            </div>

            {/* Arbitrage */}
            <div className="bg-terminal-surface border border-terminal-border rounded-lg p-5 mb-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-naija-green/20 text-naija-green px-2 py-0.5 rounded text-xs font-mono font-bold">GET</span>
                <code className="text-white font-mono text-sm">/arbitrage?item=rice&amp;min_spread=5</code>
              </div>
              <p className="text-sm text-gray-400">Find price differences for the same commodity across markets.</p>
            </div>

            {/* Morning Brief Preview */}
            <div className="bg-terminal-surface border border-terminal-border rounded-lg p-5 mb-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-naija-green/20 text-naija-green px-2 py-0.5 rounded text-xs font-mono font-bold">GET</span>
                <code className="text-white font-mono text-sm">/morning-brief/preview?type=OVERVIEW</code>
              </div>
              <p className="text-sm text-gray-400">Preview today&apos;s Morning Brief content.</p>
            </div>
          </section>

          {/* Authentication */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Authentication</h2>
            <p>Public endpoints (health, price lookup) require no authentication. Protected endpoints require an API key passed as a query parameter:</p>
            <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4 font-mono text-sm mt-3">
              <span className="text-gray-500">GET</span> <span className="text-white">/api/prices/lookup?item=rice&amp;code=</span><span className="text-naija-gold">YOUR_API_KEY</span>
            </div>
            <p className="mt-3">API keys are available on CORPORATE and ENTERPRISE subscription tiers. Contact <a href="mailto:api@naijamarketintel.com" className="text-naija-green hover:underline">api@naijamarketintel.com</a> for enterprise access.</p>
          </section>

          {/* Rate Limits */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Rate Limits</h2>
            <div className="bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-terminal-border text-left">
                    <th className="p-3 text-gray-400 font-medium">Tier</th>
                    <th className="p-3 text-gray-400 font-medium">Requests/Hour</th>
                    <th className="p-3 text-gray-400 font-medium">Requests/Day</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-terminal-border/50">
                    <td className="p-3 text-white">FREE</td>
                    <td className="p-3">10</td>
                    <td className="p-3">50</td>
                  </tr>
                  <tr className="border-b border-terminal-border/50">
                    <td className="p-3 text-white">CORPORATE</td>
                    <td className="p-3">500</td>
                    <td className="p-3">5,000</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-white">ENTERPRISE</td>
                    <td className="p-3">5,000</td>
                    <td className="p-3">50,000</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Response Format */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Response Format</h2>
            <p className="mb-3">All responses are JSON with the following structure:</p>
            <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4 font-mono text-sm">
              <pre className="text-gray-300">{`{
  "status": "success",
  "count": 15,
  "data": [...],
  "duration_ms": 42
}`}</pre>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-terminal-border py-6 px-6 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} NaijaMarket Intel. All rights reserved.
      </footer>
    </div>
  );
}
