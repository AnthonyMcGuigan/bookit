import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The game is fully dynamic and per-user; we use the classic dynamic
  // rendering model rather than Cache Components.
  cacheComponents: false,
  poweredByHeader: false,
  serverExternalPackages: ["sharp"],
  experimental: {
    serverActions: {
      // Image uploads and package imports go through server actions.
      bodySizeLimit: "12mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
