// src/app/privacy/page.tsx
// NaijaMarket Intel – Privacy Policy
// Updated June 2026: Full data inventory declaration, explicit retention periods,
// GDPR/NDPA/CCPA alignment, data subject rights, international transfer clause,
// WhatsApp consent section

import PublicPageShell from "@/components/PublicPageShell";

export const metadata = { title: "Privacy Policy | NaijaMarket Intel" };

export default function PrivacyPage() {
  return (
    <PublicPageShell
      title="Privacy Policy"
      subtitle="How we collect, use, and protect your data."
    >
      <p className="pp-date">Last updated: June 8, 2026</p>

      <h2>1. Introduction</h2>
      <p>
        NaijaMarket Intel (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), operated by
        Giggababytes Oy (Business ID: 3419597-7), is committed to protecting
        the privacy and personal data of our users. This Privacy Policy explains
        how we collect, use, disclose, and safeguard your information when you
        use our platform.
      </p>
      <p>
        Giggababytes Oy is incorporated in <strong>Finland (EU)</strong>. This
        means the{" "}
        <strong>EU General Data Protection Regulation (GDPR)</strong> applies to
        all users of this Platform regardless of where you are located — not
        only EU residents. We also comply with the{" "}
        <strong>Nigeria Data Protection Act (NDPA) 2023</strong> and the{" "}
        <strong>Finland Data Protection Act</strong>.
      </p>
      <div className="pp-card">
        <p>
          <strong>Your rights under GDPR include:</strong> the right to access your
          data, correct inaccuracies, request deletion (&quot;right to be forgotten&quot;),
          restrict or object to processing, and data portability. To exercise any
          right, contact{" "}
          <a href="mailto:privacy@naijamarketintel.ng" className="pp-link">
            privacy@naijamarketintel.ng
          </a>.
        </p>
      </div>

      <h2>2. Complete Data We Collect</h2>
      <p>
        We are required to declare every category of data the Platform collects.
        The following is a complete inventory:
      </p>

      <h3>2.1 Information You Provide Directly</h3>
      <ul>
        <li><strong>Identity data:</strong> Phone number, full name, email address (Business+ tiers)</li>
        <li><strong>Price submissions:</strong> Commodity names, prices, market selection, submission timestamps</li>
        <li><strong>GPS / location data:</strong> Latitude and longitude coordinates captured at the moment of price submission</li>
        <li><strong>Validation data:</strong> Approval or rejection votes on price submissions</li>
        <li><strong>Payment &amp; billing data:</strong> Phone number for airtime rewards; subscription payment details processed via Paystack (we do not store raw card numbers)</li>
        <li><strong>Subscription preferences:</strong> Tier selections, downgrade instructions, billing history, renewal choices</li>
        <li><strong>WhatsApp messages:</strong> Conversation content with our WhatsApp bot, opt-in/opt-out status, message flow state</li>
      </ul>

      <h3>2.2 Automatically Collected Data</h3>
      <ul>
        <li><strong>Device information:</strong> Device type, model, operating system, browser type and version</li>
        <li><strong>Network data:</strong> IP address, approximate geographic location derived from IP</li>
        <li><strong>Usage analytics:</strong> Pages visited, features used, price query history, session duration, click events (via Google Analytics GA4)</li>
        <li><strong>Crash logs &amp; error reports:</strong> Application error logs, function failure records, HTTP error codes — used exclusively for platform stability and debugging</li>
        <li><strong>Performance data:</strong> Page load times, API response times</li>
        <li><strong>WhatsApp interaction metadata:</strong> Message delivery timestamps, flow completion rates, opt-in status, session identifiers</li>
      </ul>

      <h3>2.3 Data We Do NOT Collect</h3>
      <ul>
        <li>Raw bank card numbers (Paystack handles PCI-DSS compliance)</li>
        <li>Government-issued ID numbers unless required for future KYC verification (you will be notified in advance)</li>
        <li>Biometric data</li>
        <li>Content of private messages between users (there is no user-to-user messaging)</li>
      </ul>

      <h2>3. How We Use Your Data</h2>
      <ul>
        <li>Verify price submissions through GPS geo-fencing (500 m radius check)</li>
        <li>Run the 3-validator consensus engine to approve or reject submitted prices</li>
        <li>Process airtime rewards (VTPass) and subscription payments (Paystack)</li>
        <li>Deliver WhatsApp price alerts, subscription notifications, and renewal reminders</li>
        <li>Compute the NaijaFood Price Index (NFPI) and market analytics</li>
        <li>Detect and prevent fraudulent submissions (GPS fraud, rapid submission abuse, collusion)</li>
        <li>Improve platform performance using crash logs and usage analytics</li>
        <li>Comply with Nigerian, Finnish, and EU legal obligations</li>
        <li>Respond to customer support requests</li>
      </ul>

      <h2>3a. Data Retention Periods</h2>
      <p>
        We retain your data only for as long as necessary for the purposes stated
        in this policy. The following table sets out our retention periods:
      </p>
      <div className="pp-card">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", paddingBottom: "8px", borderBottom: "1px solid #333", color: "#fff" }}>Data Category</th>
              <th style={{ textAlign: "left", paddingBottom: "8px", borderBottom: "1px solid #333", color: "#fff" }}>Retention Period</th>
              <th style={{ textAlign: "left", paddingBottom: "8px", borderBottom: "1px solid #333", color: "#fff" }}>Reason</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #222" }}>Account identity data</td>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #222" }}>Duration of account + 2 years</td>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #222" }}>Dispute resolution</td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #222" }}>Price submissions</td>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #222" }}>24 months hot, then archived</td>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #222" }}>Historical price intelligence</td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #222" }}>GPS coordinates</td>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #222" }}>12 months</td>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #222" }}>Fraud detection audit trail</td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #222" }}>Payment &amp; billing records</td>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #222" }}>7 years</td>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #222" }}>Legal/tax obligation (Finland)</td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #222" }}>WhatsApp session data</td>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #222" }}>30 days after last interaction</td>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #222" }}>Session state management</td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #222" }}>Crash logs &amp; error data</td>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #222" }}>90 days</td>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #222" }}>Debugging only</td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #222" }}>Usage analytics</td>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #222" }}>26 months (GA4 default)</td>
              <td style={{ padding: "8px 0", borderBottom: "1px solid #222" }}>Platform improvement</td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0" }}>Deleted account data</td>
              <td style={{ padding: "8px 0" }}>30 days post-deletion</td>
              <td style={{ padding: "8px 0" }}>Grace period / recovery</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>4. GPS Data</h2>
      <div className="pp-card">
        <p>
          We collect GPS coordinates <strong>only</strong> when you submit a price
          as a Trader. GPS data is used exclusively to verify that the submission
          originates from the stated market location (within 500 m radius). GPS
          coordinates are stored in our secure Azure SQL database and are not
          shared with third parties for tracking or advertising purposes.
        </p>
      </div>

      <h2>4a. WhatsApp Messaging Consent</h2>
      <p>
        By initiating a conversation with NaijaMarket Intel on WhatsApp, you consent
        to receive price data, alerts, and service notifications via WhatsApp. This
        consent is logged in our platform and complies with Meta&apos;s WhatsApp Business
        Policy and the NDPA 2023 consent requirements. You may withdraw consent at any
        time by sending <strong>STOP</strong> to our WhatsApp number, after which we
        will not send proactive messages to your number. You can re-subscribe by
        messaging us again.
      </p>

      <h2>5. International Data Transfers</h2>
      <p>
        Your data is stored and processed on <strong>Microsoft Azure infrastructure
        in the Sweden Central region</strong> (Stockholm, EU). As an EU-based
        processor, all data storage is within the European Economic Area and subject
        to GDPR Article 46 safeguards.
      </p>
      <p>
        Some data is processed by third-party services outside the EU:
      </p>
      <ul>
        <li><strong>Meta (WhatsApp):</strong> Message routing via Meta&apos;s Cloud API infrastructure. Meta is certified under the EU-US Data Privacy Framework.</li>
        <li><strong>Paystack:</strong> Nigerian payment processor. Data is subject to NDPA 2023 and Paystack&apos;s privacy policy.</li>
        <li><strong>Google Analytics (GA4):</strong> Usage analytics routed through Google servers. Google is certified under the EU-US Data Privacy Framework.</li>
        <li><strong>VTPass:</strong> Nigerian airtime fulfilment. Phone numbers shared only for reward disbursement.</li>
      </ul>

      <h2>6. Data Security</h2>
      <p>
        We implement the following technical and organisational security measures:
      </p>
      <ul>
        <li>TLS encryption for all data in transit</li>
        <li>Azure SQL Transparent Data Encryption (TDE) for data at rest</li>
        <li>Azure Firewall IP allowlist controls on database access</li>
        <li>Function-level API key authentication on all endpoints</li>
        <li>Parameterised queries throughout to prevent SQL injection</li>
        <li>GPS fraud detection algorithms to prevent location manipulation</li>
      </ul>

      <h2>7. Third-Party Data Sharing</h2>
      <p>
        We do not sell your personal data. We share data only with:
      </p>
      <ul>
        <li><strong>Service processors:</strong> Microsoft Azure, Meta, Paystack, VTPass — solely to operate the Platform</li>
        <li><strong>Legal authorities:</strong> Where required by Nigerian or Finnish law, court order, or to prevent fraud</li>
        <li><strong>B2B API clients:</strong> Aggregate, anonymised price data only — never individual user data</li>
      </ul>

      <h2>8. Children&apos;s Privacy</h2>
      <p>
        The Platform is not directed at children under 18. We do not knowingly
        collect data from minors. If you believe a minor has submitted data,
        contact us immediately at{" "}
        <a href="mailto:privacy@naijamarketintel.ng" className="pp-link">
          privacy@naijamarketintel.ng
        </a>.
      </p>

      <h2>9. Cookies &amp; Analytics</h2>
      <p>
        Our web application uses cookies and similar technologies for:
      </p>
      <ul>
        <li><strong>Session management:</strong> Keeping you logged in during your visit</li>
        <li><strong>Analytics:</strong> Google Analytics GA4 (measurement ID: G-S7SPQG4JNF) to understand platform usage. Analytics data is anonymised.</li>
        <li><strong>Preferences:</strong> Storing your theme and display preferences</li>
      </ul>
      <p>
        You can disable non-essential cookies via your browser settings. Disabling
        session cookies will prevent you from logging in.
      </p>

      <h2>10. Your Rights</h2>
      <div className="pp-card">
        <p>Under GDPR and NDPA 2023, you have the right to:</p>
        <ul>
          <li><strong>Access:</strong> Request a copy of all data we hold about you</li>
          <li><strong>Correction:</strong> Request correction of inaccurate data</li>
          <li><strong>Deletion:</strong> Request deletion of your account and associated data (subject to legal retention obligations)</li>
          <li><strong>Restriction:</strong> Request we limit processing of your data</li>
          <li><strong>Portability:</strong> Receive your data in a structured, machine-readable format</li>
          <li><strong>Object:</strong> Object to processing based on legitimate interest</li>
          <li><strong>Withdraw consent:</strong> Withdraw WhatsApp messaging consent at any time by sending STOP</li>
        </ul>
        <p>
          To exercise any right, email{" "}
          <a href="mailto:privacy@naijamarketintel.ng" className="pp-link">
            privacy@naijamarketintel.ng
          </a>. We will respond within 30 days. If you are in the EU and believe we have
          violated GDPR, you may lodge a complaint with the Finnish Data Protection
          Ombudsman (<a href="https://tietosuoja.fi" target="_blank" rel="noreferrer" className="pp-link">tietosuoja.fi</a>).
        </p>
      </div>

      <h2>11. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material changes will
        be communicated via WhatsApp notification and/or email at least 14 days
        before taking effect. The &quot;Last updated&quot; date at the top of this page
        reflects the most recent revision.
      </p>

      <h2>12. Contact &amp; Data Controller</h2>
      <p>
        <strong>Data Controller:</strong> Giggababytes Oy<br />
        Jyrkankatu 1C 24, 15500 Lahti, Finland<br />
        Email:{" "}
        <a href="mailto:privacy@naijamarketintel.ng" className="pp-link">
          privacy@naijamarketintel.ng
        </a><br />
        Platform:{" "}
        <a href="https://www.naijamarketintel.ng" className="pp-link">
          www.naijamarketintel.ng
        </a>
      </p>
    </PublicPageShell>
  );
}
