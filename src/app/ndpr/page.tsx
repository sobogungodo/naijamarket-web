import PublicPageShell from "@/components/PublicPageShell";

export const metadata = { title: "NDPR Compliance | NaijaMarket Intel" };

export default function NDPRPage() {
  return (
    <PublicPageShell
      title="NDPR Compliance"
      subtitle="Our commitment to the Nigeria Data Protection Regulation."
    >
      <p className="pp-date">Last updated: February 23, 2026</p>

      <div className="pp-highlight">
        <p style={{ marginBottom: 0 }}>
          NaijaMarket Intel is fully committed to compliance with the{" "}
          <strong>Nigeria Data Protection Regulation (NDPR) 2019</strong> and the{" "}
          <strong>Nigeria Data Protection Act (NDPA) 2023</strong>, administered by
          the Nigeria Data Protection Commission (NDPC).
        </p>
      </div>

      <h2>Lawful Basis for Processing</h2>
      <p>We process personal data under the following lawful bases:</p>
      <ul>
        <li><strong>Consent:</strong> You provide explicit consent when registering and submitting price data</li>
        <li><strong>Contract:</strong> Processing is necessary to deliver our services (price intelligence, alerts, rewards)</li>
        <li><strong>Legitimate interest:</strong> Fraud detection and platform integrity protection</li>
      </ul>

      <h2>Data Processing Activities</h2>
      <div className="pp-card">
        <h3>Trader Data</h3>
        <ul>
          <li>Phone number (account identification)</li>
          <li>GPS coordinates (submission verification — collected only during price submission)</li>
          <li>Reputation score (calculated from submission history)</li>
          <li>Reward balance (airtime credits earned)</li>
        </ul>
      </div>
      <div className="pp-card">
        <h3>Validator Data</h3>
        <ul>
          <li>Phone number (account identification)</li>
          <li>Accuracy rate (calculated from validation history)</li>
          <li>Reward balance (airtime credits earned)</li>
        </ul>
      </div>
      <div className="pp-card">
        <h3>Consumer Data</h3>
        <ul>
          <li>Phone number or email (account identification)</li>
          <li>Subscription tier and payment history</li>
          <li>Query history and alert preferences</li>
        </ul>
      </div>

      <h2>Data Protection Officer</h2>
      <p>
        In compliance with NDPR Article 3.1, we have appointed a Data Protection
        Officer (DPO) who can be reached at:
      </p>
      <p>
        <strong>Email:</strong>{" "}
        <a href="mailto:dpo@naijamarketintel.ng">dpo@naijamarketintel.ng</a><br />
        <strong>Company:</strong> Giggababytes Oy<br />
        <strong>Address:</strong> Helsinki, Finland
      </p>

      <h2>Data Subject Rights</h2>
      <p>Under the NDPR, Nigerian data subjects have the following rights:</p>
      <ul>
        <li><strong>Right to be informed</strong> — We provide clear information about how your data is used</li>
        <li><strong>Right of access</strong> — Request a copy of all personal data we hold about you</li>
        <li><strong>Right to rectification</strong> — Correct any inaccurate personal data</li>
        <li><strong>Right to erasure</strong> — Request deletion of your personal data</li>
        <li><strong>Right to restrict processing</strong> — Limit how we use your data</li>
        <li><strong>Right to data portability</strong> — Receive your data in a structured format</li>
        <li><strong>Right to object</strong> — Object to processing based on legitimate interest</li>
      </ul>

      <h2>Cross-Border Data Transfer</h2>
      <p>
        As Giggababytes Oy is headquartered in Finland (EU), some data processing
        occurs within the European Economic Area. All cross-border transfers comply
        with NDPR requirements and are protected by EU GDPR standards, which provide
        an equivalent level of data protection.
      </p>
      <p>
        Our primary database is hosted on <strong>Microsoft Azure South Africa North</strong>{" "}
        (Johannesburg), ensuring data residency within Africa for operational data.
      </p>

      <h2>Data Breach Notification</h2>
      <p>
        In the event of a personal data breach, we will notify the Nigeria Data
        Protection Commission within 72 hours of becoming aware of the breach, as
        required by NDPR. Affected data subjects will be notified without undue
        delay when the breach is likely to result in high risk to their rights.
      </p>

      <h2>Filing a Complaint</h2>
      <p>
        If you believe your data protection rights have been violated, you may file
        a complaint with the{" "}
        <strong>Nigeria Data Protection Commission (NDPC)</strong> at{" "}
        <a href="https://ndpc.gov.ng" target="_blank" rel="noopener noreferrer">
          ndpc.gov.ng
        </a>.
      </p>
    </PublicPageShell>
  );
}
