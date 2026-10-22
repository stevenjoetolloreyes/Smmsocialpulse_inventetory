import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app is a self-contained dashboard; keep the default output so it
  // deploys cleanly on Vercel.
  reactStrictMode: true,
  // The database migrations are read from disk at runtime (src/lib/db.ts),
  // so make sure the drizzle/ folder is traced into every serverless
  // function bundle.
  outputFileTracingIncludes: {
    "/*": ["./drizzle/**/*"],
  },
};

export default nextConfig;
