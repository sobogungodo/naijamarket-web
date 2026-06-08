// src/app/terms/page.tsx
// NaijaMarket Intel – Terms of Service
// Updated June 2026: Added IP ownership, liability limitation, prohibited data
// reselling, explicit data declaration compliance (GDPR/NDPA/CCPA alignment)

import PublicPageShell from "@/components/PublicPageShell";

export const metadata = { title: "Terms of Service | NaijaMarket Intel" };

export default function TermsPage() {
  return (
    <PublicPageShell
      title="Terms of Service"
      subtitle="The rules that govern your use of NaijaMarket Intel."
    >
      <p className="pp-date">Last updated: June 8, 2026</p>

      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing or using NaijaMarket Intel (&quot;the Platform&quot;), operated by
        Giggababytes Oy (&quot;the Company&quot;), a company registered in Finland
        (Business ID: 3419597-7), you agree to be bound by these Terms of
        Service. If you do not agree, do not use the Platform.
      </p>

      <h2>2. Service Description</h2>
      <p>
        NaijaMarket Intel is a commodity price intelligence platform that provides
        crowdsourced, GPS-verified market prices across Nigeria. The Platform
        operates through web and WhatsApp interfaces and offers tiered subscription
        plans from FREE to ENTERPRISE.
      </p>

      <h2>3. User Accounts</h2>
      <ul>
        <li>You must provide accurate and complete registration information</li>
        <li>You are responsible for maintaining the confidentiality of your account</li>
        <li>One account per person — account sharing is prohibited</li>
        <li>You must be at least 18 years old to use the Platform</li>
        <li>We reserve the right to suspend or terminate accounts that violate these terms</li>
      </ul>

      <h2>4. Trader Terms</h2>
      <div className="pp-card">
        <p>If you submit price data as a Trader, you agree to:</p>
        <ul>
          <li>Submit accurate, truthful commodity prices from physical markets</li>
          <li>Be physically present at the market when submitting prices (GPS verification required)</li>
          <li>Not use GPS spoofing, mock locations, or any location manipulation tools</li>
          <li>Not collude with other traders or validators to manipulate prices</li>
          <li>Accept that fraudulent submissions will result in reputation penalties and potential account termination</li>
        </ul>
        <p>
          <strong>Rewards:</strong> Approved submissions earn ₦20 in airtime credits.
          Minimum payout balance is ₦500. Payouts are processed weekly on Fridays.
        </p>
      </div>

      <h2>5. Validator Terms</h2>
      <div className="pp-card">
        <p>If you participate as a Validator, you agree to:</p>
        <ul>
          <li>Provide honest, independent assessments of price submissions</li>
          <li>Not coordinate votes with other validators or traders</li>
          <li>Complete validations within the 30-minute deadline</li>
          <li>Accept that inaccurate validations affect your accuracy score</li>
        </ul>
        <p>
          <strong>Rewards:</strong> Majority-consensus validations earn ₦50 in airtime
          credits. Validators below 60% accuracy may be suspended.
        </p>
      </div>

      <h2>6. Subscription Terms</h2>
      <ul>
        <li>FREE tier users receive limited queries per day at no cost</li>
        <li>Paid subscriptions (SILVER, GOLD, BUSINESS, CORPORATE, ENTERPRISE) are billed on their respective billing cycles (SILVER: weekly; all others: monthly)</li>
        <li>Subscriptions auto-renew unless cancelled before the renewal date</li>
        <li>Refunds are not provided for partial periods — you retain access until the period ends</li>
        <li>Enterprise subscriptions require a separate service agreement</li>
      </ul>

      <h2>7. Subscription Downgrade Policy</h2>
      <div className="pp-card">
        <ul>
          <li>You may request a downgrade at any time via WhatsApp (type <strong>downgrade</strong>)</li>
          <li>Downgrades take effect at the <strong>end of your current billing period</strong></li>
          <li><strong>No refunds</strong> are issued for unused time on the current subscription</li>
          <li>You retain all benefits of your current tier until the downgrade effective date</li>
          <li>You may cancel a pending downgrade at any time before the effective date by typing <strong>cancel-downgrade</strong> on WhatsApp</li>
          <li>Once a downgrade takes effect, it cannot be reversed except through a new upgrade purchase</li>
        </ul>
      </div>

      <h2>8. Prohibited Conduct</h2>
      <p>The following activities are strictly prohibited on the Platform:</p>
      <ul>
        <li>Submitting false or misleading price data</li>
        <li>Using GPS spoofing or location manipulation tools</li>
        <li>Creating multiple accounts to circumvent limits or earn multiple rewards</li>
        <li>Attempting to access restricted areas or other users&apos; accounts</li>
        <li>Using automated tools (bots, scrapers, crawlers) to extract price data without a licensed API subscription</li>
        <li>Reselling, redistributing, or republishing Platform data without a valid data licensing agreement from the Company</li>
        <li>Reverse-engineering any part of the Platform&apos;s infrastructure, algorithms, or pricing models</li>
        <li>Using the Platform to transmit malware, spam, or any harmful content</li>
        <li>Any conduct that disrupts or interferes with the Platform&apos;s services</li>
      </ul>
      <p>
        Violations may result in immediate account suspension, permanent ban, and where
        applicable, legal action under Nigerian and Finnish law.
      </p>

      <h2>9. Intellectual Property &amp; Data Ownership</h2>
      <div className="pp-card">
        <p>
          All content, data, indices, price models, algorithms, software, trademarks,
          and intellectual property on the Platform — including the{" "}
          <strong>NaijaMarket Intel</strong> name, brand, logo, and the{" "}
          <strong>NaijaFood Price Index (NFPI)</strong> — are the exclusive property
          of Giggababytes Oy and are protected under Finnish, Nigerian, and international
          intellectual property law.
        </p>
        <ul>
          <li>
            <strong>Name &amp; Brand:</strong> &quot;NaijaMarket Intel&quot; and all associated
            marks are proprietary. You may not use our name, logo, or brand in any
            way without prior written consent.
          </li>
          <li>
            <strong>Price Data:</strong> Verified price data generated by the Platform
            is a proprietary data product. Personal use via subscription is permitted.
            Commercial redistribution, resale, or incorporation into third-party
            products requires a separate data licensing agreement.
          </li>
          <li>
            <strong>User-Submitted Data:</strong> By submitting price data, you grant
            Giggababytes Oy a perpetual, worldwide, royalty-free licence to use,
            store, process, and publish that data as part of the Platform&apos;s price
            intelligence product.
          </li>
          <li>
            <strong>API Access:</strong> Programmatic access to Platform data is
            available only under a signed B2B API licence agreement (CORPORATE or
            ENTERPRISE tier). Any unauthorised automated access is a violation of
            these terms and applicable computer misuse laws.
          </li>
        </ul>
      </div>

      <h2>10. Disclaimer &amp; Limitation of Liability</h2>
      <div className="pp-card">
        <p>
          The Platform provides price intelligence as an <strong>informational service
          only</strong>. Commodity prices are crowdsourced and verified through
          statistical consensus, but the Company makes no warranty that prices are
          accurate, complete, or current at any given moment.
        </p>
        <ul>
          <li>
            <strong>No Investment Advice:</strong> Price data on this Platform does
            not constitute financial, investment, or trading advice. You use the data
            at your own risk.
          </li>
          <li>
            <strong>Liability Cap:</strong> To the maximum extent permitted by law,
            Giggababytes Oy&apos;s total liability to you for any claim arising from use
            of the Platform shall not exceed the subscription fees you paid in the
            three (3) months preceding the claim.
          </li>
          <li>
            <strong>Indirect Damages:</strong> We are not liable for any indirect,
            incidental, consequential, or punitive damages, including lost profits,
            resulting from your use of or inability to use the Platform.
          </li>
          <li>
            <strong>Service Availability:</strong> We do not guarantee uninterrupted
            availability. Scheduled maintenance, platform updates, or force majeure
            events may cause temporary outages without constituting a breach of these
            terms.
          </li>
        </ul>
      </div>

      <h2>11. Data Collection &amp; Privacy Obligations</h2>
      <p>
        To operate the Platform, we collect the following categories of data.
        Full details are set out in our{" "}
        <a href="/privacy" className="pp-link">Privacy Policy</a>:
      </p>
      <ul>
        <li><strong>Identity data:</strong> Phone number, name, email address</li>
        <li><strong>Location data:</strong> GPS coordinates during price submissions</li>
        <li><strong>Usage analytics:</strong> Pages visited, features used, query history</li>
        <li><strong>Device &amp; technical data:</strong> Device type, operating system, browser</li>
        <li><strong>Payment data:</strong> Subscription billing records via Paystack</li>
        <li><strong>Crash &amp; error logs:</strong> System error logs for platform stability</li>
        <li><strong>WhatsApp interaction data:</strong> Message flow states, opt-in status</li>
      </ul>
      <p>
        As Giggababytes Oy is incorporated in Finland (EU), we are subject to the{" "}
        <strong>EU General Data Protection Regulation (GDPR)</strong> for all users
        regardless of location, as well as the{" "}
        <strong>Nigeria Data Protection Act (NDPA) 2023</strong> for Nigerian users.
        GDPR violations can carry fines of up to €20 million or 4% of annual global
        turnover. We take compliance seriously and have implemented technical and
        organisational safeguards accordingly.
      </p>

      <h2>12. Governing Law &amp; Dispute Resolution</h2>
      <p>
        These Terms are governed by the laws of Finland. Disputes shall first be
        referred to good-faith negotiation. If unresolved within 30 days, disputes
        shall be submitted to arbitration under the Rules of the Finland Chamber of
        Commerce Arbitration Institute in Helsinki. Nigerian consumer protection
        rights under the Federal Competition and Consumer Protection Act (FCCPA)
        are not waived by this clause.
      </p>

      <h2>13. Changes to Terms</h2>
      <p>
        We may update these Terms at any time. Material changes will be communicated
        via WhatsApp notification or email. Continued use of the Platform after
        changes take effect constitutes acceptance of the updated Terms.
      </p>

      <h2>14. Contact</h2>
      <p>
        For questions about these Terms, contact us at{" "}
        <a href="mailto:legal@naijamarketintel.ng" className="pp-link">
          legal@naijamarketintel.ng
        </a>{" "}
        or via our{" "}
        <a href="/contact" className="pp-link">Contact page</a>.
      </p>
    </PublicPageShell>
  );
}
