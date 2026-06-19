import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard/",
          "/api/",
          "/login",
          "/register",
          "/subscribe",
        ],
      },
    ],
    sitemap: "https://www.naijamarketintel.com/sitemap.xml",
    host: "https://www.naijamarketintel.com",
  };
}
