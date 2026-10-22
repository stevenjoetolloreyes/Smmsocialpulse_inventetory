import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app is a self-contained dashboard; keep the default output so it
  // deploys cleanly on Vercel.
  reactStrictMode: true,
};

export default nextConfig;
