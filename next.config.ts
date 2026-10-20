import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let a phone on the same Wi-Fi hit the laptop's LAN address in `next dev`.
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.local"],
  cacheComponents: true,
  partialPrefetching: true,
  outputFileTracingExcludes: {
    "*": ["./data/cache/**", "./data/raw/**", "./agent-tools/**"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
