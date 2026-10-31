import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Browser tests use a separate build directory and leave the developer's server running.
  ...(process.env.CAMPUSMART_E2E === "1" ? { distDir: ".next-e2e" } : {}),
};

export default nextConfig;
