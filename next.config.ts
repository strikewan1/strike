import type { NextConfig } from "next";
import type { SentryBuildOptions } from "@sentry/nextjs";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "*.supabase.co";

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV === "development" ? "'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://${supabaseHost}`,
  `font-src 'self' data:`,
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  `connect-src 'self' data: blob: https://${supabaseHost} wss://${supabaseHost} https://api.minimax.chat`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
];

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: cspDirectives.filter(Boolean).join("; "),
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

let nextConfig: NextConfig = {
  // Apply security headers to all responses
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },

  // Restrict image optimization to known hosts
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHost,
        pathname: "/storage/v1/object/**",
      },
    ],
  },
};

// Wrap with Sentry when DSN is set (zero cost otherwise)
if (process.env.SENTRY_DSN) {
  // Dynamic import avoids pulling Sentry into the bundle when unused
  const sentryBuildOptions: SentryBuildOptions = {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    // Don't upload source maps during dev to keep iteration fast
    disableLogger: true,
    silent: !process.env.CI,
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { withSentryConfig } = require("@sentry/nextjs") as typeof import("@sentry/nextjs");
  nextConfig = withSentryConfig(nextConfig, sentryBuildOptions);
}

export default nextConfig;
