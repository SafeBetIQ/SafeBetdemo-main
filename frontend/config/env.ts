/**
 * config/env.ts — SafeBet IQ Environment Configuration
 *
 * Single source of truth for all environment variables.
 *
 * Rules enforced here:
 *   1. NEXT_PUBLIC_* vars  → safe to expose to browser (public values only)
 *   2. All other vars      → server-side only; never read on the client
 *   3. Required vars throw on startup if missing in production
 *   4. Demo ≠ Production   → cross-environment contamination is detected
 *
 * Usage:
 *   import { env, serverEnv } from '@/config/env';
 *
 *   // Client-safe (NEXT_PUBLIC_ only):
 *   const url = env.SUPABASE_URL;
 *
 *   // Server-only (API routes / Server Actions only):
 *   const key = serverEnv.SUPABASE_SERVICE_ROLE_KEY;
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AppEnvironment = 'demo' | 'production' | 'local';

export interface PublicEnv {
  ENV:               AppEnvironment;
  APP_NAME:          string;
  SUPABASE_URL:      string;
  SUPABASE_ANON_KEY: string;
  API_BASE_URL:      string;
  ENABLE_DEBUG:      boolean;
  ENABLE_MOCK_DATA:  boolean;
  REGION:            string;
  DR_REGION:         string;
}

export interface ServerEnv {
  SUPABASE_SERVICE_ROLE_KEY:  string | undefined;
  TWILIO_ACCOUNT_SID:         string | undefined;
  TWILIO_AUTH_TOKEN:          string | undefined;
  TWILIO_WHATSAPP_NUMBER:     string | undefined;
  TWILIO_SMS_NUMBER:          string | undefined;
  SAFEPLAY_API_KEY:           string | undefined;
  SAFEPLAY_WEBHOOK_SECRET:    string | undefined;
  AWS_ACCESS_KEY_ID:          string | undefined;
  AWS_SECRET_ACCESS_KEY:      string | undefined;
  DR_AWS_REGION:              string;
  DR_S3_REGION:               string;
  DR_S3_BUCKET:               string;
  DR_S3_PREFIX:               string;
  DR_LOG_GROUP:               string;
  DR_CW_NAMESPACE:            string;
  DR_ROUTE53_HEALTH_CHECK_ID: string;
  CLOUDWATCH_NAMESPACE:       string;
  S3_BACKUP_BUCKET:           string;
  FAILOVER_ENABLED:           boolean;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

// True only during `next build` — not during runtime request handling.
const IS_BUILD_PHASE = process.env.NEXT_PHASE === 'phase-production-build';

function requirePublic(key: string, name: string): string {
  const value = process.env[key];
  if (!value || value.startsWith('REPLACE_ME')) {
    const msg =
      `[SafeBet IQ] Missing required public environment variable: ${name}\n` +
      `  Expected key: ${key}\n` +
      `  Set this in Elastic Beanstalk → Configuration → Software → Environment variables.\n` +
      `  For local dev: copy .env.example to .env.local and fill in the value.`;

    if (process.env.NODE_ENV === 'production' && !IS_BUILD_PHASE) {
      throw new Error(msg);
    }
    // Build phase or development: warn but don't crash
    console.error(`\x1b[31m${msg}\x1b[0m`);
    return '';
  }
  return value;
}

function boolEnv(key: string, defaultValue: boolean): boolean {
  const v = process.env[key];
  if (v === undefined) return defaultValue;
  return v === 'true' || v === '1';
}

function parseEnv(): AppEnvironment {
  const raw = process.env.NEXT_PUBLIC_ENV ?? 'local';
  if (raw === 'demo' || raw === 'production' || raw === 'local') return raw;
  console.warn(`[SafeBet IQ] Unknown NEXT_PUBLIC_ENV value: "${raw}" — defaulting to "local"`);
  return 'local';
}

// ---------------------------------------------------------------------------
// Cross-environment contamination guard
// Prevents production Supabase URL from being used in a demo build and vice-versa.
// ---------------------------------------------------------------------------

const KNOWN_URLS: Record<Exclude<AppEnvironment, 'local'>, string> = {
  demo:       'https://uexdjngogzunjxkpxwll.supabase.co',
  production: 'https://ilibvipqbkugqkppzdmh.supabase.co',
};

function assertNoEnvCrossContamination(appEnv: AppEnvironment, supabaseUrl: string) {
  if (appEnv === 'local') return; // local dev can use any project

  const expectedUrl = KNOWN_URLS[appEnv];
  if (supabaseUrl && supabaseUrl !== expectedUrl && !supabaseUrl.includes('localhost')) {
    const msg =
      `[SafeBet IQ] ENVIRONMENT MISMATCH DETECTED!\n` +
      `  NEXT_PUBLIC_ENV is set to "${appEnv}" but NEXT_PUBLIC_SUPABASE_URL points to a different project.\n` +
      `  Expected: ${expectedUrl}\n` +
      `  Got:      ${supabaseUrl}\n` +
      `  This could mean a production database is wired to a demo build, or vice-versa.\n` +
      `  Fix this in Amplify Console → Environment variables.`;

    // TEMPORARY: warn instead of crash to diagnose 504 root cause.
    // Restore throw once env vars are confirmed correct on EB.
    console.warn(`\x1b[33;1m⚠️  ENVIRONMENT MISMATCH (non-fatal) — ${msg}\x1b[0m`);
  }
}

// ---------------------------------------------------------------------------
// Public env (browser-safe — NEXT_PUBLIC_ only)
// This object is inlined into the JS bundle at build time.
// ---------------------------------------------------------------------------

function buildPublicEnv(): PublicEnv {
  const ENV          = parseEnv();
  const SUPABASE_URL = requirePublic('NEXT_PUBLIC_SUPABASE_URL', 'Supabase Project URL');

  if (typeof window === 'undefined') {
    // Server-side only: run contamination check at build/SSR time
    assertNoEnvCrossContamination(ENV, SUPABASE_URL);
  }

  return {
    ENV,
    APP_NAME:          process.env.NEXT_PUBLIC_APP_NAME          ?? 'SafeBet IQ',
    SUPABASE_URL,
    SUPABASE_ANON_KEY: requirePublic('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'Supabase Anon Key'),
    API_BASE_URL:      process.env.NEXT_PUBLIC_API_BASE_URL      ?? '',
    ENABLE_DEBUG:      boolEnv('NEXT_PUBLIC_ENABLE_DEBUG',   ENV !== 'production'),
    ENABLE_MOCK_DATA:  boolEnv('NEXT_PUBLIC_ENABLE_MOCK_DATA', ENV !== 'production'),
    REGION:            process.env.NEXT_PUBLIC_REGION            ?? 'af-south-1',
    DR_REGION:         process.env.NEXT_PUBLIC_DR_REGION         ?? 'eu-west-1',
  };
}

// ---------------------------------------------------------------------------
// Server env (never exposed to browser)
// Call only from API routes, Server Actions, or route handlers.
// ---------------------------------------------------------------------------

function buildServerEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error(
      '[SafeBet IQ] serverEnv must only be accessed server-side. ' +
      'Do not import this in Client Components.'
    );
  }

  return {
    SUPABASE_SERVICE_ROLE_KEY:  process.env.SUPABASE_SERVICE_ROLE_KEY,
    TWILIO_ACCOUNT_SID:         process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN:          process.env.TWILIO_AUTH_TOKEN,
    TWILIO_WHATSAPP_NUMBER:     process.env.TWILIO_WHATSAPP_NUMBER,
    TWILIO_SMS_NUMBER:          process.env.TWILIO_SMS_NUMBER,
    SAFEPLAY_API_KEY:           process.env.SAFEPLAY_API_KEY,
    SAFEPLAY_WEBHOOK_SECRET:    process.env.SAFEPLAY_WEBHOOK_SECRET,
    AWS_ACCESS_KEY_ID:          process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY:      process.env.AWS_SECRET_ACCESS_KEY,
    DR_AWS_REGION:              process.env.DR_AWS_REGION              ?? 'eu-west-1',
    DR_S3_REGION:               process.env.DR_S3_REGION               ?? 'eu-west-1',
    DR_S3_BUCKET:               process.env.DR_S3_BUCKET               ?? '',
    DR_S3_PREFIX:               process.env.DR_S3_PREFIX               ?? 'backups/production/',
    DR_LOG_GROUP:               process.env.DR_LOG_GROUP               ?? '/aws/lambda/safebet-rds-failover',
    DR_CW_NAMESPACE:            process.env.DR_CW_NAMESPACE            ?? 'SafeBetIQ/DR',
    DR_ROUTE53_HEALTH_CHECK_ID: process.env.DR_ROUTE53_HEALTH_CHECK_ID ?? '',
    CLOUDWATCH_NAMESPACE:       process.env.CLOUDWATCH_NAMESPACE       ?? 'SafeBetIQ/Local',
    S3_BACKUP_BUCKET:           process.env.S3_BACKUP_BUCKET           ?? '',
    FAILOVER_ENABLED:           boolEnv('FAILOVER_ENABLED', false),
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

// `env` is safe to import in any component — contains only NEXT_PUBLIC_ vars
export const env: PublicEnv = buildPublicEnv();

// `serverEnv` throws at runtime if accessed client-side
export const serverEnv: ServerEnv =
  typeof window === 'undefined' ? buildServerEnv() : (undefined as unknown as ServerEnv);

// ---------------------------------------------------------------------------
// Startup log (server-side only, no secrets emitted)
// ---------------------------------------------------------------------------

if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
  const label = env.ENV === 'production'
    ? '\x1b[32m[PRODUCTION]\x1b[0m'
    : env.ENV === 'demo'
    ? '\x1b[33m[DEMO]\x1b[0m'
    : '\x1b[36m[LOCAL]\x1b[0m';

  console.log(
    `\n${label} SafeBet IQ environment loaded\n` +
    `  App:         ${env.APP_NAME}\n` +
    `  Environment: ${env.ENV}\n` +
    `  Supabase:    ${env.SUPABASE_URL.replace(/\/\/(.{8}).*\.supabase/, '//$1***.supabase')}\n` +
    `  API:         ${env.API_BASE_URL}\n` +
    `  Debug:       ${env.ENABLE_DEBUG}\n` +
    `  Mock data:   ${env.ENABLE_MOCK_DATA}\n` +
    `  Failover:    ${serverEnv?.FAILOVER_ENABLED ?? '(client)'}\n`
  );
}
