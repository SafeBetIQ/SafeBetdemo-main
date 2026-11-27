// M1B-P2B.2 — Exact Pilot Supabase target enforcement (fail-closed).
//
// When the application is operating in the Pilot environment, the ONLY permitted Supabase
// project URL is the authorised Pilot project. Any other URL (Production, Demo, Guardian, an
// unknown 4th project, a lookalike hostname, an appended path/query, a malformed value, a
// missing value, or conflicting Pilot environment indicators) fails closed BEFORE any Supabase
// client is constructed — i.e. before any outbound database connection.
//
// Outside Pilot, behaviour is preserved: the URL is required (as before) but not allow-listed,
// so Production / Demo / Guardian deployments are unaffected.

export const PILOT_SUPABASE_URL = 'https://umejmtnzxbmezraercdj.supabase.co';

// Production / Demo / Guardian project refs — explicitly rejected in Pilot (defence in depth;
// the exact-match check below already excludes them).
const FORBIDDEN_PROJECT_REFS = ['ilibvipqbkugqkppzdmh', 'uexdjngogzunjxkpxwll', 'druuskabkgyotslcgnys'];

/** True when any Pilot indicator is set. */
function pilotIndicated(): boolean {
  return process.env.NEXT_PUBLIC_ENV === 'pilot' || process.env.NEXT_PUBLIC_SAFEBET_ENV === 'pilot';
}

/**
 * Validate the Supabase URL for the current environment and return it.
 * In Pilot it must be EXACTLY the authorised Pilot project URL; otherwise it throws (fail closed).
 * The pure logic is parameterised on `env` so it is unit-testable without mutating process.env.
 */
export function assertSupabaseTarget(
  url: string | undefined | null,
  env: { NEXT_PUBLIC_ENV?: string; NEXT_PUBLIC_SAFEBET_ENV?: string } = {
    NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
    NEXT_PUBLIC_SAFEBET_ENV: process.env.NEXT_PUBLIC_SAFEBET_ENV,
  },
): string {
  const a = env.NEXT_PUBLIC_ENV;
  const b = env.NEXT_PUBLIC_SAFEBET_ENV;
  const isPilot = a === 'pilot' || b === 'pilot';

  if (!isPilot) {
    // Non-Pilot: preserve existing behaviour (presence required, no allowlist).
    if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
    return url;
  }

  // Pilot: conflicting environment indicators fail closed (e.g. one says 'pilot', another 'demo').
  if ((a && a !== 'pilot') || (b && b !== 'pilot')) {
    throw new Error('[pilot-target] conflicting Pilot environment indicators — fail closed');
  }
  // Missing URL fails closed.
  if (!url) throw new Error('[pilot-target] NEXT_PUBLIC_SUPABASE_URL missing in Pilot — fail closed');
  // Any forbidden project ref fails closed.
  for (const ref of FORBIDDEN_PROJECT_REFS) {
    if (url.includes(ref)) {
      throw new Error('[pilot-target] NEXT_PUBLIC_SUPABASE_URL targets a forbidden project (Production/Demo/Guardian) — fail closed');
    }
  }
  // EXACT allowlist — rejects unknown projects, lookalike hostnames, appended paths/queries,
  // trailing slashes and malformed values.
  if (url !== PILOT_SUPABASE_URL) {
    throw new Error('[pilot-target] NEXT_PUBLIC_SUPABASE_URL is not the exact authorised Pilot project URL — fail closed');
  }
  return url;
}

/** Read NEXT_PUBLIC_SUPABASE_URL from the environment, validate it, and return it. */
export function getSupabaseUrl(): string {
  return assertSupabaseTarget(process.env.NEXT_PUBLIC_SUPABASE_URL);
}
