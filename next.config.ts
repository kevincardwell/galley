import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "sharp", "@node-rs/argon2", "archiver"],
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
      { source: "/(.*)", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
