import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    // A pragmatic policy: no nonce yet, so inline scripts are allowed, but nothing may be loaded
    // from another origin, no plugins, no framing other than Galley's own site preview, and no
    // <base> rewriting.
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // React's development build needs eval for its debugging tools; production never does.
      `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      // The dev server talks to itself over a websocket for hot reload.
      `connect-src 'self'${dev ? " ws: http:" : ""}`,
      "frame-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "sharp", "@node-rs/argon2", "archiver"],
  // `path.join(process.cwd(), "data")` makes Next trace the working copy's database, its
  // -wal/-shm siblings and every backup zip. This excludes them from route traces; the
  // instrumentation trace is written by a different plugin that ignores these options, which
  // is what the postbuild step in package.json is for. The published image is safe either way
  // because .dockerignore drops data/, but a local build should not package credentials.
  outputFileTracingExcludes: {
    "**": ["**/data/**"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  async headers() {
    return [
      {
        // The worker must be re-fetched every time, or an old one keeps serving after a deploy.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      // The site preview sets its own, sandboxed policy (src/app/api/site/...), so it is left out here.
      { source: "/((?!api/site/).*)", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
