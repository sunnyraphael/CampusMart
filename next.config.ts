import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Browser tests use a separate build directory and leave the developer's server running.
  ...(process.env.CAMPUSMART_E2E === "1" ? { distDir: ".next-e2e" } : {}),
  // Validate production without deleting artifacts owned by a running dev server.
  ...(process.env.CAMPUSMART_BUILD_CHECK === "1" ? {
    distDir: ".next-build-check",
    typescript: { tsconfigPath: "tsconfig.build-check.json" },
  } : {}),
};

export default nextConfig;
