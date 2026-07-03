// NaijaMarket Intel — JSON-LD Structured Data
// Adds rich snippet support for Google Search

export default function StructuredData() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "NaijaMarket Intel",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, Android",
    url: "https://www.naijamarketintel.com",
    description:
      "Real-time food price intelligence for Nigeria. Track 610 commodities across 226 markets in 36 states + FCT. Updated 3× daily by GPS-verified traders.",
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "0",
      highPrice: "1500000",
      priceCurrency: "NGN",
      offerCount: "6",
    },
    author: {
      "@type": "Organization",
      name: "Giggababytes Oy",
      url: "https://www.naijamarketintel.com",
      address: {
        "@type": "PostalAddress",
        addressCountry: "FI",
        addressLocality: "Lahti",
      },
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "12",
    },
    sameAs: [
      "https://wefunder.com/gigabytes.soft.ltd",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
