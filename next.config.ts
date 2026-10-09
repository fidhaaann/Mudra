import type { NextConfig } from "next";

/**
 * Baseline security headers for every response. A strict Content-Security-
 * Policy is intentionally not set here: the site relies on inline styles,
 * WebGL and third-party registration links, so a CSP needs its own testing
 * pass before it can be enforced without breaking pages.
 */
const SECURITY_HEADERS = [
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
