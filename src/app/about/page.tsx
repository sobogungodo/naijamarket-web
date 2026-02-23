import PublicPageShell from "@/components/PublicPageShell";

export const metadata = { title: "About | NaijaMarket Intel" };

export default function AboutPage() {
  return (
    <PublicPageShell
      title="About NaijaMarket Intel"
      subtitle="The Bloomberg of Nigerian Commodities — real-time, GPS-verified market intelligence."
    >
      <h2>Our Mission</h2>
      <p>
        NaijaMarket Intel exists to end information asymmetry in Nigerian commodity
        markets. Every day, millions of traders, businesses, and households make
        purchasing decisions based on incomplete or manipulated price information —
        losing an estimated <strong>₦150K–₦10M monthly</strong> per business.
      </p>
      <p>
        We built a platform that crowdsources verified commodity prices from
        on-ground traders across Nigeria, validates them through community consensus
        and GPS verification, and delivers real-time market intelligence to anyone
        who needs it.
      </p>

      <h2>How It Works</h2>
      <div className="pp-card">
        <h3>📡 Crowdsourced Price Collection</h3>
        <p>
          Over 5,000 registered traders submit daily prices from physical markets
          across 37 states. Each submission is GPS-tagged to verify the trader is
          physically present at the market.
        </p>
      </div>
      <div className="pp-card">
        <h3>🛡️ Community Validation</h3>
        <p>
          Every price submission goes through a 3-validator consensus process.
          Validators independently approve or reject prices, ensuring 95%+
          confidence in every data point.
        </p>
      </div>
      <div className="pp-card">
        <h3>📊 Bloomberg-Grade Analytics</h3>
        <p>
          Verified prices feed into our analytics engine — powering inflation
          tracking, regional comparisons, arbitrage scanners, market screeners,
          and custom price alerts delivered via WhatsApp.
        </p>
      </div>

      <h2>Our Coverage</h2>
      <p>
        We currently track <strong>610+ commodities</strong> across{" "}
        <strong>224 markets</strong> in all <strong>37 states</strong> of Nigeria.
        Prices are updated <strong>3× daily</strong> (morning, midday, afternoon)
        to capture intra-day volatility.
      </p>

      <h2>The Team</h2>
      <p>
        NaijaMarket Intel is a product of{" "}
        <strong>Giggababytes Oy</strong>, a Finnish-Nigerian technology company
        with 50+ years of combined experience in data engineering, market
        intelligence, and Nigerian business operations. We&apos;re headquartered
        in Finland with deep operational presence across Nigeria.
      </p>

      <div className="pp-highlight">
        <strong>🇳🇬 Built for Nigeria · 🇫🇮 Powered from Finland</strong>
        <p style={{ marginBottom: 0, marginTop: 8 }}>
          We combine world-class cloud infrastructure with intimate understanding
          of Nigerian market dynamics to deliver intelligence that actually works
          on the ground.
        </p>
      </div>

      <h2>Contact</h2>
      <p>
        Have questions? Reach us at{" "}
        <a href="mailto:info@naijamarketintel.ng">info@naijamarketintel.ng</a>
        {" "}or chat with us on{" "}
        <a href="https://wa.me/14155238886" target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>.
      </p>
    </PublicPageShell>
  );
}
