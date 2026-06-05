// src/app/methodology/page.tsx
// NaijaMarket Intel — How We Verify Prices (Methodology & Trust page)
// [1p] G1-WEB — top B2B conversion lever

import PublicPageShell from "@/components/PublicPageShell";

export const metadata = {
  title: "How We Verify Prices | NaijaMarket Intel",
  description:
    "NaijaMarket Intel's price verification methodology: GPS-confirmed traders, 3-validator consensus, confidence scoring, and 3× daily generation across 282 Nigerian markets.",
};

// ─── Stat card data ───────────────────────────────────────────────────────────
const STATS = [
  { value: "282", label: "Markets covered" },
  { value: "610", label: "Tracked commodities" },
  { value: "37", label: "States + FCT" },
  { value: "3×", label: "Daily price updates" },
];

// ─── Pipeline steps ───────────────────────────────────────────────────────────
const PIPELINE = [
  {
    step: "01",
    title: "GPS-Verified Field Submission",
    body: `Approved traders submit prices directly from physical market stalls via WhatsApp.
Each submission is geo-fenced: the trader's GPS coordinates must fall within 500 m of the
declared market. Submissions outside this radius are automatically rejected before
reaching the database. Each trader carries a reputation score (0–100) updated with
every accepted or rejected submission — traders scoring ≥ 80 receive instant approval.`,
  },
  {
    step: "02",
    title: "3-Validator Consensus",
    body: `Every submitted price is independently reviewed by three validators assigned
to that market. Validators compare the submission against our rolling baseline (EWMA of
verified historical prices) and vote approve or reject. A submission requires majority
consensus (2 of 3) to be marked APPROVED. Price variance > ±30% from baseline triggers
an automatic fraud flag and escalates to senior review regardless of validator votes.`,
  },
  {
    step: "03",
    title: "Confidence Scoring",
    body: `Each price in our database carries a confidence_score (0–100) computed from
four factors: consensus margin (unanimous vs split vote), validator accuracy ratings,
submitting trader's reputation score, and distance from the item's 30-day baseline.
A score of 85+ is considered high-confidence. Consumers with BUSINESS tier and above
see this score alongside every price so they can weight their decisions accordingly.`,
  },
  {
    step: "04",
    title: "3× Daily Generation",
    body: `Verified submissions feed a three-slot daily price generation pipeline running
at 08:30, 11:30, and 14:30 WAT (West Africa Time). Each slot generates 172,020 price
points across all item-market combinations. Markets with verified submissions for a given
slot use REAL_ANCHORED pricing. Markets without a fresh submission carry forward a
simulated estimate (SIM_TRACKED) anchored to the last verified price, clearly flagged in
the data. A watchdog function detects and backfills any missed slots automatically.`,
  },
  {
    step: "05",
    title: "NBS Cross-Reference & NFPI",
    body: `Our platform maintains a parallel reference dataset sourced from the National
Bureau of Statistics (NBS). NBS items are excluded from consumer-facing prices but used
to calibrate the NaijaFood Price Index (NFPI). The NFPI is a Laspeyres-type index with
base period January 2016 = 100, computed monthly across a fixed basket of 44 food
commodities weighted by Nigerian household expenditure patterns. The current NFPI reflects
the April 2026 CPI rebase (NBS inflation rate: 16.06%).`,
  },
];

// ─── Coverage table ───────────────────────────────────────────────────────────
const CATEGORIES = [
  { cat: "Grains & Cereals", items: "Rice, Maize, Millet, Sorghum, Wheat flour", markets: 282 },
  { cat: "Tubers & Roots", items: "Yam, Cassava, Sweet potato, Cocoyam", markets: 267 },
  { cat: "Vegetables & Tomatoes", items: "Tomatoes, Onions, Pepper, Spinach", markets: 254 },
  { cat: "Proteins", items: "Beans, Fish, Chicken, Beef, Eggs", markets: 231 },
  { cat: "Oils & Fats", items: "Palm oil, Groundnut oil, Soya oil", markets: 248 },
  { cat: "Cash Crops", items: "Groundnut, Sesame, Soybean, Cashew", markets: 176 },
];

export default function MethodologyPage() {
  return (
    <PublicPageShell
      title="How We Verify Prices"
      subtitle="GPS-confirmed traders. Consensus validation. 3× daily generation across 282 Nigerian markets."
    >
      <style>{STYLES}</style>

      {/* ── Stats bar ── */}
      <div className="meth-stats">
        {STATS.map((s) => (
          <div key={s.label} className="meth-stat-card">
            <span className="meth-stat-value">{s.value}</span>
            <span className="meth-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Introduction ── */}
      <p className="meth-lead">
        NaijaMarket Intel was built to solve a specific problem: Nigerian food prices are
        opaque, fragmented, and often misleading. A trader in Kano and a buyer in Lagos
        can be working from prices that are days old and sourced from a single reporter.
        We built a three-layer verification architecture to make our data verifiably
        accurate — not just plausible.
      </p>

      {/* ── Pipeline ── */}
      <h2>Verification Pipeline</h2>
      {PIPELINE.map((p) => (
        <div key={p.step} className="meth-pipeline-item">
          <div className="meth-step-badge">{p.step}</div>
          <div className="meth-step-body">
            <h3>{p.title}</h3>
            <p>{p.body}</p>
          </div>
        </div>
      ))}

      {/* ── Data freshness ── */}
      <h2>Data Freshness</h2>
      <div className="meth-slots">
        {[
          { slot: "Morning", utc: "07:30 UTC", wat: "08:30 WAT", desc: "Opening market prices" },
          { slot: "Midday",  utc: "10:30 UTC", wat: "11:30 WAT", desc: "Mid-session activity" },
          { slot: "Afternoon", utc: "13:30 UTC", wat: "14:30 WAT", desc: "Closing benchmark" },
        ].map((s) => (
          <div key={s.slot} className="meth-slot-card">
            <div className="meth-slot-dot" />
            <div>
              <strong>{s.slot}</strong>
              <span className="meth-slot-time">{s.wat} · {s.utc}</span>
              <span className="meth-slot-desc">{s.desc}</span>
            </div>
          </div>
        ))}
      </div>
      <p>
        Prices are generated three times daily. Each generation slot produces{" "}
        <strong>172,020 price points</strong> (610 items × 282 markets). The{" "}
        <code>price_date</code> field on every record reflects the date of generation.
        Consumer-facing APIs always serve the most recent slot. Our{" "}
        <code>Latest_Prices_Summary</code> view is refreshed before each morning slot and
        after each generation run.
      </p>

      {/* ── Coverage ── */}
      <h2>Coverage</h2>
      <p>
        We track <strong>610 commodity items</strong> across{" "}
        <strong>282 markets in 37 states and the FCT</strong>. Coverage spans the six
        geopolitical zones with market density proportional to trading volume. Below is
        the breakdown by category:
      </p>
      <div className="meth-table-wrap">
        <table className="meth-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Sample Items</th>
              <th>Markets</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((c) => (
              <tr key={c.cat}>
                <td><strong>{c.cat}</strong></td>
                <td className="meth-items-cell">{c.items}</td>
                <td className="meth-num-cell">{c.markets}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Data tiers ── */}
      <h2>Data Availability by Subscription Tier</h2>
      <div className="meth-tier-grid">
        {[
          { tier: "FREE",       color: "#6b7280", items: ["Live prices", "7-day history", "All markets"] },
          { tier: "SILVER",     color: "#94a3b8", items: ["+ NFPI access", "Bulk buyer tool", "Price alerts"] },
          { tier: "GOLD",       color: "#f59e0b", items: ["+ Price forecast", "Market snapshot", "Full history"] },
          { tier: "BUSINESS",   color: "#3b82f6", items: ["+ Cross-state arbitrage", "CSV/Excel export", "Full analytics"] },
          { tier: "CORPORATE",  color: "#8b5cf6", items: ["+ Multi-user access", "API access", "Confidence scores"] },
          { tier: "ENTERPRISE", color: "#10b981", items: ["+ Custom SLA", "White-label API", "Raw data feed"] },
        ].map((t) => (
          <div key={t.tier} className="meth-tier-card" style={{ borderTopColor: t.color }}>
            <span className="meth-tier-name" style={{ color: t.color }}>{t.tier}</span>
            <ul>
              {t.items.map((i) => <li key={i}>{i}</li>)}
            </ul>
          </div>
        ))}
      </div>

      {/* ── Archive ── */}
      <h2>Historical Archive</h2>
      <p>
        We maintain a <strong>10-year price archive</strong> (2016–2025) in Azure Blob
        Storage as compressed Parquet files, accessible via the ENTERPRISE data feed.
        The 24-month hot window (current month minus 24) is queryable in real time via
        API. Historical data uses the same item and market IDs as live data, making
        longitudinal analysis straightforward.
      </p>

      {/* ── Limitations ── */}
      <h2>Known Limitations</h2>
      <div className="meth-notice">
        <p>
          <strong>Prices are indicative, not transactional.</strong> NaijaMarket Intel
          reports observed market prices from physical traders. Prices on our platform
          reflect the conditions at the time and location of submission. Actual
          transaction prices may vary based on quantity, buyer relationship, and
          negotiation. Our data should not be used as the sole basis for procurement or
          trading decisions.
        </p>
        <p>
          Markets with no recent verified submission use SIM_TRACKED estimates, clearly
          flagged in the <code>data_source</code> field. Estimates are anchored to the
          last verified price adjusted for recent trend signals.
        </p>
      </div>

      {/* ── Support / contact ── */}
      <h2>Data Queries &amp; Enterprise Access</h2>
      <p>
        For data licensing, API access, custom SLAs, or questions about our methodology,
        contact our data team:
      </p>
      <ul>
        <li>
          <strong>Data inquiries:</strong>{" "}
          <a href="mailto:data@naijamarketintel.ng">data@naijamarketintel.ng</a>
        </li>
        <li>
          <strong>Enterprise sales:</strong>{" "}
          <a href="mailto:enterprise@naijamarketintel.ng">enterprise@naijamarketintel.ng</a>
        </li>
        <li>
          <strong>General support:</strong>{" "}
          <a href="mailto:support@naijamarketintel.ng">support@naijamarketintel.ng</a>
        </li>
        <li>
          <strong>WhatsApp:</strong>{" "}
          <a href="https://wa.me/2349131095009" target="_blank" rel="noopener noreferrer">
            Chat with us on WhatsApp
          </a>
        </li>
      </ul>
    </PublicPageShell>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const STYLES = `
.meth-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin: 2rem 0 2.5rem;
}
@media (max-width: 640px) {
  .meth-stats { grid-template-columns: repeat(2, 1fr); }
}
.meth-stat-card {
  background: rgba(59,130,246,0.08);
  border: 1px solid rgba(59,130,246,0.2);
  border-radius: 8px;
  padding: 1.25rem 1rem;
  text-align: center;
}
.meth-stat-value {
  display: block;
  font-size: 2rem;
  font-weight: 700;
  color: #3b82f6;
  line-height: 1;
}
.meth-stat-label {
  display: block;
  font-size: 0.78rem;
  color: var(--pp-muted, #94a3b8);
  margin-top: 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.meth-lead {
  font-size: 1.05rem;
  line-height: 1.75;
  margin-bottom: 2rem;
  color: var(--pp-text, inherit);
}
.meth-pipeline-item {
  display: flex;
  gap: 1.25rem;
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid rgba(148,163,184,0.15);
}
.meth-step-badge {
  flex-shrink: 0;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: rgba(59,130,246,0.12);
  border: 1px solid rgba(59,130,246,0.3);
  color: #3b82f6;
  font-size: 0.75rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 0.1rem;
}
.meth-step-body h3 {
  margin: 0 0 0.6rem;
  font-size: 1rem;
  font-weight: 600;
}
.meth-step-body p {
  margin: 0;
  line-height: 1.7;
  font-size: 0.93rem;
  color: var(--pp-muted, #94a3b8);
  white-space: pre-line;
}
.meth-slots {
  display: flex;
  gap: 1rem;
  margin: 1.25rem 0 1.5rem;
  flex-wrap: wrap;
}
.meth-slot-card {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  background: rgba(16,185,129,0.06);
  border: 1px solid rgba(16,185,129,0.2);
  border-radius: 8px;
  padding: 1rem 1.25rem;
  flex: 1;
  min-width: 180px;
}
.meth-slot-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  flex-shrink: 0;
  margin-top: 0.3rem;
}
.meth-slot-card strong { display: block; font-size: 0.95rem; }
.meth-slot-time {
  display: block;
  font-size: 0.8rem;
  color: #10b981;
  margin-top: 0.2rem;
  font-family: monospace;
}
.meth-slot-desc {
  display: block;
  font-size: 0.78rem;
  color: var(--pp-muted, #94a3b8);
  margin-top: 0.1rem;
}
.meth-table-wrap { overflow-x: auto; margin: 1.25rem 0 1.75rem; }
.meth-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}
.meth-table th {
  text-align: left;
  padding: 0.6rem 1rem;
  background: rgba(59,130,246,0.08);
  border-bottom: 1px solid rgba(59,130,246,0.2);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #3b82f6;
}
.meth-table td {
  padding: 0.65rem 1rem;
  border-bottom: 1px solid rgba(148,163,184,0.1);
  vertical-align: top;
}
.meth-items-cell { color: var(--pp-muted, #94a3b8); font-size: 0.85rem; }
.meth-num-cell { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
.meth-tier-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin: 1.25rem 0 1.75rem;
}
@media (max-width: 640px) {
  .meth-tier-grid { grid-template-columns: repeat(2, 1fr); }
}
.meth-tier-card {
  border-radius: 8px;
  border: 1px solid rgba(148,163,184,0.15);
  border-top-width: 3px;
  padding: 1rem;
  background: rgba(255,255,255,0.02);
}
.meth-tier-name {
  display: block;
  font-weight: 700;
  font-size: 0.82rem;
  letter-spacing: 0.06em;
  margin-bottom: 0.6rem;
}
.meth-tier-card ul {
  margin: 0;
  padding-left: 1rem;
  font-size: 0.82rem;
  color: var(--pp-muted, #94a3b8);
}
.meth-tier-card li { margin-bottom: 0.2rem; }
.meth-notice {
  background: rgba(245,158,11,0.06);
  border: 1px solid rgba(245,158,11,0.25);
  border-left-width: 4px;
  border-radius: 6px;
  padding: 1.25rem 1.5rem;
  margin: 1.25rem 0 1.75rem;
}
.meth-notice p { margin: 0 0 0.75rem; font-size: 0.93rem; line-height: 1.7; }
.meth-notice p:last-child { margin: 0; }
code {
  font-family: monospace;
  background: rgba(59,130,246,0.1);
  border: 1px solid rgba(59,130,246,0.2);
  border-radius: 3px;
  padding: 0.1em 0.4em;
  font-size: 0.88em;
}
`;
