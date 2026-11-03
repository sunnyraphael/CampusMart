import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    // Inline scripts/styles are currently required by the app. This baseline
    // restricts framing and plugins; it is not a nonce-based XSS policy.
    const policy = ["default-src 'self'", "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com" + (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''), "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", "font-src 'self' data: https://fonts.gstatic.com", "img-src 'self' data: blob: https:", "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com" + (process.env.NODE_ENV === 'development' ? ' ws: wss: http://127.0.0.1:54329' : ''), "frame-src https://challenges.cloudflare.com", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"].join('; ')
    return [{source:'/:path*',headers:[
      {key:'Content-Security-Policy',value:policy},
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
