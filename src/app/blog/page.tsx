import PublicPageShell from "@/components/PublicPageShell";
import Link from "next/link";

export const metadata = { title: "Blog | NaijaMarket Intel" };

const POSTS = [
  {
    date: "Feb 20, 2026",
    title: "How Information Asymmetry Costs Nigerian Businesses Billions",
    excerpt:
      "Price manipulation in commodity markets isn't just an inconvenience — it's a systematic wealth transfer from buyers to information gatekeepers. Here's how verified market data changes the equation.",
    tag: "Market Intelligence",
    tagColor: "#00C853",
  },
  {
    date: "Feb 14, 2026",
    title: "NaijaMarket Food Price Index: February 2026 Report",
    excerpt:
      "Our monthly Food Price Index shows 8.9% year-over-year inflation across tracked commodities. Rice prices stabilizing while tomato season volatility creates opportunities.",
    tag: "Price Report",
    tagColor: "#FFB300",
  },
  {
    date: "Feb 7, 2026",
    title: "Why GPS Verification Matters for Market Data Integrity",
    excerpt:
      "Anyone can type a number into a form. The question is: were they actually at the market? GPS verification with mock-location detection is the foundation of our trust system.",
    tag: "Technology",
    tagColor: "#00B0FF",
  },
  {
    date: "Jan 28, 2026",
    title: "From Mile 12 to Kano: Regional Price Arbitrage in Nigerian Markets",
    excerpt:
      "A bag of rice can cost ₦4,400 more in Lagos than Kano. We analyzed 3 months of verified data to map regional price gaps and arbitrage corridors across Nigeria.",
    tag: "Analysis",
    tagColor: "#E040FB",
  },
  {
    date: "Jan 15, 2026",
    title: "Launching NaijaMarket Intel: The Bloomberg of Nigerian Commodities",
    excerpt:
      "After two years of building, testing, and iterating with real traders in real markets, we're launching NaijaMarket Intel — the first real-time commodity intelligence platform built for Nigeria.",
    tag: "Announcement",
    tagColor: "#26A69A",
  },
];

export default function BlogPage() {
  return (
    <PublicPageShell
      title="Blog"
      subtitle="Market insights, product updates, and analysis from the NaijaMarket Intel team."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {POSTS.map((post, i) => (
          <article key={i} className="pp-card" style={{ cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span className="pp-date" style={{ marginBottom: 0 }}>{post.date}</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 100,
                  background: `${post.tagColor}15`,
                  color: post.tagColor,
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: 0.5,
                }}
              >
                {post.tag}
              </span>
            </div>
            <h3 style={{ marginTop: 0, fontSize: 18 }}>{post.title}</h3>
            <p style={{ marginBottom: 0, color: "#94A3B8" }}>{post.excerpt}</p>
          </article>
        ))}
      </div>

      <div className="pp-highlight" style={{ marginTop: 40, textAlign: "center" }}>
        <p style={{ marginBottom: 0 }}>
          Want to contribute or have a story idea?{" "}
          <Link href="/contact">Get in touch</Link> — we&apos;re always looking for
          perspectives from traders, analysts, and market experts.
        </p>
      </div>
    </PublicPageShell>
  );
}
