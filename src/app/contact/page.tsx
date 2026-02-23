import PublicPageShell from "@/components/PublicPageShell";

export const metadata = { title: "Contact | NaijaMarket Intel" };

export default function ContactPage() {
  return (
    <PublicPageShell
      title="Contact Us"
      subtitle="Questions, partnerships, or feedback — we'd love to hear from you."
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
        <div className="pp-card">
          <h3 style={{ marginTop: 0 }}>💬 WhatsApp (Fastest)</h3>
          <p>
            Chat with us directly on WhatsApp for quick questions or to try our
            price query service.
          </p>
          <p>
            <a
              href="https://wa.me/14155238886?text=Hi%20NaijaMarket"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open WhatsApp Chat →
            </a>
          </p>
        </div>

        <div className="pp-card">
          <h3 style={{ marginTop: 0 }}>📧 Email</h3>
          <p>For detailed inquiries, partnerships, or formal communications.</p>
          <ul>
            <li>
              <strong>General:</strong>{" "}
              <a href="mailto:info@naijamarketintel.ng">info@naijamarketintel.ng</a>
            </li>
            <li>
              <strong>Enterprise Sales:</strong>{" "}
              <a href="mailto:sales@naijamarketintel.ng">sales@naijamarketintel.ng</a>
            </li>
            <li>
              <strong>Technical Support:</strong>{" "}
              <a href="mailto:support@naijamarketintel.ng">support@naijamarketintel.ng</a>
            </li>
            <li>
              <strong>Privacy & Data:</strong>{" "}
              <a href="mailto:privacy@naijamarketintel.ng">privacy@naijamarketintel.ng</a>
            </li>
          </ul>
        </div>

        <div className="pp-card">
          <h3 style={{ marginTop: 0 }}>🏢 Company</h3>
          <p>
            <strong>Giggababytes Oy</strong><br />
            Helsinki, Finland<br />
            <a href="mailto:olawale.sobogungod@giggabytes.eu">
              olawale.sobogungod@giggabytes.eu
            </a>
          </p>
        </div>

        <div className="pp-card">
          <h3 style={{ marginTop: 0 }}>🤝 Partnerships</h3>
          <p>
            We partner with market associations, agricultural agencies, fintech
            companies, and government institutions across Nigeria. If you represent
            an organization interested in market intelligence data, API access, or
            white-label solutions, reach out to our enterprise team.
          </p>
          <p>
            <a href="mailto:partnerships@naijamarketintel.ng">
              partnerships@naijamarketintel.ng
            </a>
          </p>
        </div>
      </div>

      <div className="pp-highlight" style={{ marginTop: 32 }}>
        <h3 style={{ marginTop: 0 }}>🐛 Found a Bug?</h3>
        <p style={{ marginBottom: 0 }}>
          If you encounter any technical issues on the platform, please email{" "}
          <a href="mailto:support@naijamarketintel.ng">support@naijamarketintel.ng</a>{" "}
          with a description of the issue, your device/browser, and screenshots
          if possible. We typically respond within 24 hours.
        </p>
      </div>
    </PublicPageShell>
  );
}
