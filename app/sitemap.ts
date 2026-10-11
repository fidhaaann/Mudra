import type { MetadataRoute } from "next";

const BASE_URL = "https://mudra-26.vercel.app";

/**
 * sitemap.ts — served as /sitemap.xml by Next.js App Router.
 *
 * Only real, public, static pages are included:
 *  - /              Home
 *  - /events        Events listing
 *  - /schedule      Event schedule
 *  - /leaderboard   Live leaderboard
 *  - /team          Team & lookup
 *
 * Excluded:
 *  - /lookup        Canonical alias of /team (excluded to avoid duplicate-content penalty)
 *  - /api/*         Internal API routes — not human-readable pages
 *  - /events/[eventId]  Dynamic event detail pages (no canonical static list of IDs)
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${BASE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/events`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/schedule`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/leaderboard`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/team`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];
}
