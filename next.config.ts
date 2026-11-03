import {contentSecurityPolicy} from './src/lib/security/csp'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    minimumCacheTTL: 86400,
    remotePatterns: process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('https://') ? [{protocol:'https',hostname:new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,pathname:'/storage/v1/object/public/product-images/**',search:''}] : [],
  },
  async headers() {
    return [{source:'/:path*',headers:[
      {key:'Content-Security-Policy',value:contentSecurityPolicy()},
      {key:'X-Frame-Options',value:'DENY'},
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
      {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
    ]}]
  },
  // Opt in only the current preview hostname, rather than every public tunnel.
  ...(process.env.CAMPUSMART_DEV_ORIGIN ? {
    allowedDevOrigins: [process.env.CAMPUSMART_DEV_ORIGIN],
  } : {}),
  // Browser tests use a separate build directory and leave the developer's server running.
  ...(process.env.CAMPUSMART_E2E === "1" ? { distDir: ".next-e2e" } : {}),
  // Validate production without deleting artifacts owned by a running dev server.
  ...(process.env.CAMPUSMART_BUILD_CHECK === "1" ? {
    distDir: ".next-build-check",
    typescript: { tsconfigPath: "tsconfig.build-check.json" },
  } : {}),
};

export default nextConfig;
