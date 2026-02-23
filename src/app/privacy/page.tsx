import PublicPageShell from "@/components/PublicPageShell";

export const metadata = { title: "Privacy Policy | NaijaMarket Intel" };

export default function PrivacyPage() {
  return (
    <PublicPageShell
      title="Privacy Policy"
      subtitle="How we collect, use, and protect your data."
    >
      <p className="pp-date">Last updated: February 23, 2026</p>

      <h2>1. Introduction</h2>
      <p>
        NaijaMarket Intel (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), operated by
        Giggababytes Oy, is committed to protecting the privacy and personal data
        of our users. This Privacy Policy explains how we collect, use, disclose,
        and safeguard your information when you use our platform.
      </p>
      <p>
        We comply with the <strong>Nigeria Data Protection Regulation (NDPR)</strong>,
        the <strong>EU General Data Protection Regulation (GDPR)</strong>, and the{" "}
        <strong>Finland Data Protection Act</strong>.
      </p>

      <h2>2. Data We Collect</h2>
      <h3>2.1 Information You Provide</h3>
      <ul>
        <li><strong>Account data:</strong> Phone number, name, email address (for Business+ tiers)</li>
        <li><strong>Price submissions:</strong> Commodity prices, market selection, GPS coordinates</li>
        <li><strong>Validation data:</strong> Approval/rejection votes on price submissions</li>
        <li><strong>Payment information:</strong> Phone number for airtime rewards, subscription payment details</li>
      </ul>

      <h3>2.2 Automatically Collected Data</h3>
      <ul>
        <li><strong>Device information:</strong> Device type, operating system, browser type</li>
        <li><strong>Location data:</strong> GPS coordinates when submitting prices (required for verification)</li>
        <li><strong>Usage data:</strong> Pages visited, features used, query history</li>
        <li><strong>WhatsApp interaction data:</strong> Message timestamps, flow completion rates</li>
      </ul>

      <h2>3. How We Use Your Data</h2>
      <ul>
        <li>Verify price submissions through GPS validation</li>
        <li>Calculate reputation scores and accuracy rates</li>
        <li>Process airtime rewards and subscription payments</li>
        <li>Generate aggregate market intelligence and analytics</li>
        <li>Detect and prevent fraud, collusion, and manipulation</li>
        <li>Send price alerts and platform notifications via WhatsApp</li>
        <li>Improve our services through anonymized usage analytics</li>
      </ul>

      <h2>4. GPS Data</h2>
      <div className="pp-highlight">
        <p style={{ marginBottom: 0 }}>
          We collect GPS coordinates <strong>only</strong> when you submit a price
          from a market. This data is used solely to verify that the submission
          originates from the stated market location (within 500m radius). GPS data
          is stored securely and is not shared with third parties for tracking purposes.
        </p>
      </div>

      <h2>5. Data Sharing</h2>
      <p>We do not sell your personal data. We may share data with:</p>
      <ul>
        <li><strong>Service providers:</strong> Twilio (WhatsApp), Paystack/Flutterwave (payments), VTPass (airtime), Microsoft Azure (hosting)</li>
        <li><strong>Legal obligations:</strong> When required by Nigerian or Finnish law, or to protect the rights and safety of our users</li>
        <li><strong>Aggregate analytics:</strong> Anonymized, non-identifiable market data may be shared with research institutions and government agencies</li>
      </ul>

      <h2>6. Data Retention</h2>
      <p>
        We retain your personal data for as long as your account is active. Price
        submission data is retained indefinitely as part of our historical market
        database (anonymized after 24 months). You may request deletion of your
        account and personal data at any time.
      </p>

      <h2>7. Your Rights</h2>
      <p>Under NDPR and GDPR, you have the right to:</p>
      <ul>
        <li>Access your personal data</li>
        <li>Correct inaccurate data</li>
        <li>Request deletion of your data</li>
        <li>Restrict or object to processing</li>
        <li>Data portability</li>
        <li>Withdraw consent at any time</li>
      </ul>

      <h2>8. Security</h2>
      <p>
        We implement industry-standard security measures including encrypted data
        transmission (TLS 1.3), encrypted storage on Microsoft Azure (South Africa
        North region), role-based access controls, and regular security audits. All
        financial data uses DECIMAL precision and is never stored in plain text.
      </p>

      <h2>9. Contact</h2>
      <p>
        For privacy-related inquiries, contact our Data Protection Officer at{" "}
        <a href="mailto:privacy@naijamarketintel.ng">privacy@naijamarketintel.ng</a>.
      </p>
      <p>
        <strong>Giggababytes Oy</strong><br />
        Helsinki, Finland<br />
        <a href="mailto:privacy@naijamarketintel.ng">privacy@naijamarketintel.ng</a>
      </p>
    </PublicPageShell>
  );
}
