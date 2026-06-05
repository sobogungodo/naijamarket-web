// src/app/privacy/page.tsx
// NaijaMarket Intel — Privacy Policy
// [1x] G1-WEB — Updated June 2026
// Fixes: Twilio→Meta Cloud API, South Africa North→Sweden Central,
//        Helsinki→Lahti, added international transfer clause (section 5a),
//        added WhatsApp opt-in section (section 4a)

import PublicPageShell from "@/components/PublicPageShell";

export const metadata = { title: "Privacy Policy | NaijaMarket Intel" };

export default function PrivacyPage() {
  return (
    <PublicPageShell
      title="Privacy Policy"
      subtitle="How we collect, use, and protect your data."
    >
      <p className="pp-date">Last updated: June 5, 2026</p>

      <h2>1. Introduction</h2>
      <p>
        NaijaMarket Intel (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), operated by
        Giggababytes Oy, is committed to protecting the privacy and personal data
        of our users. This Privacy Policy explains how we collect, use, disclose,
        and safeguard your information when you use our platform.
      </p>
      <p>
        We comply with the <strong>Nigeria Data Protection Act (NDPA) 2023</strong>,
        the <strong>EU General Data Protection Regulation (GDPR)</strong>, and the{" "}
        <strong>Finland Data Protection Act</strong>.
      </p>

      <h2>2. Data We Collect</h2>
      <h3>2.1 Information You Provide</h3>
      <ul>
        <li><strong>Account data:</strong> Phone number, name, email address (for Business+ tiers)</li>
        <li><strong>Price submissions:</strong> Commodity prices, market selection, GPS coordinates</li>
        <li><strong>Validation data:</strong> Approval/rejection votes on price submissions</li>
        <li><strong>Payment information:</strong> Phone number for airtime rewards, subscription payment details via Paystack or Flutterwave</li>
        <li><strong>Subscription preferences:</strong> Tier selections, downgrade instructions, billing history</li>
      </ul>

      <h3>2.2 Automatically Collected Data</h3>
      <ul>
        <li><strong>Device information:</strong> Device type, operating system, browser type</li>
        <li><strong>Location data:</strong> GPS coordinates when submitting prices (required for geo-verification)</li>
        <li><strong>Usage data:</strong> Pages visited, features used, price query history</li>
        <li><strong>WhatsApp interaction data:</strong> Message timestamps, flow completion rates, opt-in status</li>
      </ul>

      <h2>3. How We Use Your Data</h2>
      <ul>
        <li>Verify price submissions through GPS geo-fencing (500 m radius check)</li>
        <li>Run the 3-validator consensus engine to approve or reject submitted prices</li>
        <li>Process airtime rewards (VTPass) and subscription payments (Paystack, Flutterwave)</li>
        <li>Deliver WhatsApp price alerts, subscription notifications, and renewal reminders</li>
        <li>Compute the NaijaFood Price Index (NFPI) and market analytics</li>
        <li>Detect and prevent fraudulent submissions (GPS fraud, rapid submission abuse)</li>
        <li>Comply with Nigerian and Finnish legal obligations</li>
      </ul>

      <h2>4. GPS Data</h2>
      <div className="pp-card">
        <p>
          We collect GPS coordinates <strong>only</strong> when you submit a price
          as a Trader. GPS data is used exclusively to verify that the submission
          originates from the stated market location (within 500 m radius). GPS data
          is stored securely and is not shared with third parties for tracking purposes.
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

      <h2>5. Data Sharing</h2>
      <p>We do not sell your personal data. We may share data with:</p>
      <ul>
        <li>
          <strong>Service providers:</strong> Meta (WhatsApp Cloud API for messaging),
          Paystack / Flutterwave (payment processing), VTPass (airtime rewards),
          Microsoft Azure (cloud hosting — Sweden Central, EU), Vercel (web hosting)
        </li>
        <li>
          <strong>Legal obligations:</strong> When required by Nigerian or Finnish law,
          or to protect the rights and safety of our users
        </li>
        <li>
          <strong>Aggregate analytics:</strong> Anonymized, non-identifiable market
          data may be shared with research institutions and government agencies
        </li>
      </ul>

      <h2>5a. International Data Transfers</h2>
      <div className="pp-card">
        <p>
          Giggababytes Oy is incorporated in Finland (EU). Your personal data is
          processed and stored on <strong>Microsoft Azure, Sweden Central region</strong>{" "}
          (European Economic Area). Data flows from Nigeria to the EU are governed by
          the NDPA 2023 (Chapter 5 — Cross-Border Data Transfer) and the EU GDPR
          standard contractual clauses (SCCs) where applicable. By using our platform,
          you consent to this transfer. For questions about international transfers,
          contact{" "}
          <a href="mailto:privacy@naijamarketintel.ng">privacy@naijamarketintel.ng</a>.
        </p>
      </div>

      <h2>6. Data Retention</h2>
      <p>
        We retain your personal data for as long as your account is active. Price
        submission data is retained indefinitely as part of our historical market
        database (personal identifiers anonymized after 24 months). You may request
        deletion of your account and personal data at any time by contacting us at{" "}
        <a href="mailto:privacy@naijamarketintel.ng">privacy@naijamarketintel.ng</a>.
      </p>

      <h2>7. Your Rights</h2>
      <p>Under the NDPA 2023 and GDPR, you have the right to:</p>
      <ul>
        <li>Access your personal data</li>
        <li>Correct inaccurate data</li>
        <li>Request deletion of your data (&quot;right to be forgotten&quot;)</li>
        <li>Restrict or object to processing</li>
        <li>Data portability (receive your data in a machine-readable format)</li>
        <li>Withdraw consent at any time without affecting prior processing</li>
        <li>Lodge a complaint with the Nigeria Data Protection Commission (NDPC) or the Finnish Data Protection Ombudsman</li>
      </ul>

      <h2>8. Security</h2>
      <p>
        We implement industry-standard security measures including encrypted data
        transmission (TLS 1.3), encrypted storage on{" "}
        <strong>Microsoft Azure (Sweden Central region, EU)</strong>, role-based
        access controls, Azure SQL firewall rules, and regular security audits. All
        financial data uses DECIMAL precision and is never stored in plain text.
        WhatsApp communications use end-to-end encryption provided by Meta.
      </p>

      <h2>9. Contact &amp; Data Protection Officer</h2>
      <p>
        For privacy-related inquiries or to exercise your data rights, contact our
        Data Protection Officer:
      </p>
      <p>
        <strong>Giggababytes Oy</strong><br />
        Jyrkankatu 1C 24, 15500 Lahti, Finland<br />
        <a href="mailto:privacy@naijamarketintel.ng">privacy@naijamarketintel.ng</a>
      </p>
      <p>
        For Nigerian data protection matters:{" "}
        <a href="mailto:ndpa@naijamarketintel.ng">ndpa@naijamarketintel.ng</a>
      </p>
    </PublicPageShell>
  );
}
