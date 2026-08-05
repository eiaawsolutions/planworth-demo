import type { NextConfig } from "next";

/**
 * Security headers, carried over from the sibling Claritas/CACI demos.
 *
 * CSP notes that matter for this project:
 *   connect-src 'self'  — the browser may call our own route handlers
 *                         (/api/concierge SSE, /api/extract, /api/audit) but NOT
 *                         api.anthropic.com. All model traffic is proxied
 *                         server-side so the API key never reaches the client.
 *   font-src 'self' data: — fonts must be self-hosted. next/font/google
 *                         downloads at build time, which satisfies this; a
 *                         <link> to fonts.googleapis.com would be blocked.
 *   X-Accel-Buffering: no — keeps SSE chunks flowing if a reverse proxy
 *                         (Railway's edge) sits in front of the app.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Accel-Buffering", value: "no" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js needs inline styles, and eval for HMR/RSC in dev.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // This whole app is a client-facing prospect demo — never let it be indexed.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...securityHeaders, { key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
