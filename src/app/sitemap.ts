import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.naijamarketintel.com";
  const now = new Date();

  const staticPages = [
    { url: base, priority: 1.0, changeFrequency: "daily" as const },
    { url: `${base}/register`, priority: 0.9, changeFrequency: "monthly" as const },
    { url: `${base}/subscribe`, priority: 0.9, changeFrequency: "monthly" as const },
    { url: `${base}/blog`, priority: 0.8, changeFrequency: "weekly" as const },
    { url: `${base}/blog--`, priority: 0.5, changeFrequency: "weekly" as const },
    { url: `${base}/food-news`, priority: 0.8, changeFrequency: "weekly" as const },
    { url: `${base}/methodology`, priority: 0.6, changeFrequency: "monthly" as const },
    { url: `${base}/docs`, priority: 0.6, changeFrequency: "monthly" as const },
    { url: `${base}/contact`, priority: 0.5, changeFrequency: "yearly" as const },
    { url: `${base}/privacy`, priority: 0.4, changeFrequency: "yearly" as const },
    { url: `${base}/terms`, priority: 0.4, changeFrequency: "yearly" as const },
    { url: `${base}/ndpr`, priority: 0.4, changeFrequency: "yearly" as const },
  ];

  return staticPages.map((page) => ({
    url: page.url,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
