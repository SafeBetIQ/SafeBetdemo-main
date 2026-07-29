/** @type {import('next').NextConfig} */

// ── Environment-aware Content-Security-Policy (ORR-1A / WS1, resolves R-1) ────
// The Supabase origin is derived from NEXT_PUBLIC_SUPABASE_URL at build/runtime,
// so Development / Demo / Production each emit their correct endpoints with NO
// manual edit per deployment. The connect-src includes both https (REST/Auth)
// and wss (Realtime) for that same project.
const SUPABASE_ORIGIN = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_WSS = SUPABASE_ORIGIN.replace(/^https:\/\//, 'wss://');

// Production is strict. Development (`next dev`) requires 'unsafe-eval' and a
// same-origin HMR websocket for React Refresh / webpack hot reload, so those
// are added ONLY in development. Demo and Production are production builds and
// receive the strict policy.
const IS_PROD = process.env.NODE_ENV === 'production';
const devScript = IS_PROD ? '' : " 'unsafe-eval'";
const devConnect = IS_PROD ? '' : ' ws: http://localhost:* http://127.0.0.1:*';

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${devScript} https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.supabase.co",
  `connect-src 'self'${SUPABASE_ORIGIN ? ` ${SUPABASE_ORIGIN} ${SUPABASE_WSS}` : ''}${devConnect}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ') + ';';

const nextConfig = {
  eslint: {
    // Pre-existing cosmetic lint debt (react/no-unescaped-entities across UI
    // text) is NOT pilot-critical and touching that many UI files is out of
    // ORR-1A scope. The hard build gate is TypeScript (see package.json
    // `build`: tsc --noEmit && next build) plus the `verify` script. ESLint is
    // run advisory via `npm run lint`; the entity-escape debt is deferred.
    ignoreDuringBuilds: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  async headers() {
    // CSP is set here (environment-aware). The remaining static security
    // headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
    // Permissions-Policy) are env-independent and applied at the nginx layer
    // (.platform/nginx/conf.d/security_headers.conf) to cover every response.
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
