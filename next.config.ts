import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content Security Policy.
 *
 * Origins were inventoried from the actual site: everything is same-origin
 * (pages, API, self-hosted next/font fonts, music, artwork) except event
 * posters, which come from Cloudinary. Tally / Instagram / Flaticon are plain
 * links opened in a new tab, which CSP does not restrict.
 *
 * - script-src 'self' 'unsafe-inline': only same-origin script files, plus
 *   inline scripts, with no eval. The inline allowance is required because
 *   Next.js embeds each page's data as inline <script> tags, which cannot be
 *   hashed ahead of time (verified: with script-src 'self' alone — even with
 *   experimental SRI — every page fails to hydrate). Removing it needs
 *   per-request nonces (a Proxy), which forces every page to render
 *   dynamically and gives up CDN caching of pages — a deliberate trade-off
 *   to decide separately. React escapes all rendered data and the app has no
 *   raw-HTML sinks, and the policy still blocks third-party scripts, eval,
 *   plugins, cross-origin fetch/XHR (connect-src) and <base> hijacking.
 * - style-src keeps 'unsafe-inline': server-rendered style="" attributes and
 *   next/font's inline @font-face rules require it. Inline styles cannot run
 *   script.
 * - Development additionally needs 'unsafe-eval' for React's dev tooling.
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  // Only on Vercel (HTTPS); on plain-http localhost it would break requests.
  ...(process.env.VERCEL ? ["upgrade-insecure-requests"] : []),
].join("; ");

/**
 * Baseline security headers for every response. HSTS is added by Vercel for
 * its domains, so it is not repeated here.
 */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["ogl"],
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // Public artwork and music rarely change: let browsers reuse them for an
      // hour and the CDN serve a cached copy for a day while revalidating.
      // (Files are not fingerprinted, so this is not "immutable".)
      {
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }],
      },
      {
        source: "/music/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;
