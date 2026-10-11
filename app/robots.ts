import type { MetadataRoute } from "next";

/**
 * robots.ts — served as /robots.txt by Next.js App Router.
 *
 * Policy:
 *  - Allow all legitimate crawlers on every public page.
 *  - Disallow /api/* (internal JSON endpoints — no value to crawlers).
 *  - Disallow /lookup (canonical alias of /team; avoids duplicate-content).
 *  - Point to the canonical sitemap URL.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",   // Internal REST endpoints
          "/lookup", // Alias of /team — use canonical instead
        ],
      },
    ],
    sitemap: "https://mudra-26.vercel.app/sitemap.xml",
  };
}
