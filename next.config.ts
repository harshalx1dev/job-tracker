import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Native / WASM packages that must not be bundled.
  serverExternalPackages: [
    "nodemailer",
    "@electric-sql/pglite",
    "postgres",
    "unpdf",
    "mammoth",
    "puppeteer-core",
    "@sparticuz/chromium",
  ],
  // The PDF route launches @sparticuz/chromium, whose compressed browser lives in
  // bin/ and is loaded at runtime, so file tracing doesn't see it. Without this,
  // Vercel deploys the route without Chromium and every export fails.
  outputFileTracingIncludes: {
    "/api/resumes/\\[id\\]/pdf": [
      "./node_modules/@sparticuz/chromium/bin/**/*",
    ],
  },
  experimental: {
    // Resume uploads go through a server action (files up to 4 MB).
    serverActions: { bodySizeLimit: "5mb" },
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
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
