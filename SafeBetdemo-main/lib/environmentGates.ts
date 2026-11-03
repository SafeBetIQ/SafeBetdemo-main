// ─── Environment gates for Demo-only behaviour (M1B-P1F) ─────────────────────
//
// Demo-only surfaces (the synthetic quick-login operator selector and the
// casino-simulator burst producer) must appear ONLY in the actual Demo
// environment. They fail CLOSED everywhere else — Pilot, production, an unset
// value, or any typo — instead of the previous "everything except production"
// rule, which exposed them on any new non-production environment (e.g. Pilot).
//
// Pure functions taking the env value, so callers keep the LITERAL
// `process.env.NEXT_PUBLIC_ENV` reference that Next.js inlines at build time:
//   isDemoEnvironment(process.env.NEXT_PUBLIC_ENV)
// This matches the server-side gate already used by /api/demo-auth/login and
// the demo super-admin routes (NEXT_PUBLIC_ENV === 'demo').

export const DEMO_ENVIRONMENT = 'demo';

/** True only for the exact Demo environment value. */
export function isDemoEnvironment(env: string | null | undefined): boolean {
  return env === DEMO_ENVIRONMENT;
}

/** The Demo quick-login operator selector renders only in Demo. */
export function demoOperatorSelectorEnabled(env: string | null | undefined): boolean {
  return isDemoEnvironment(env);
}

/** The casino-simulator burst producer (synthetic event generation) runs only in Demo. */
export function casinoSimulatorEnabled(env: string | null | undefined): boolean {
  return isDemoEnvironment(env);
}

// ─── Explicit environment presentation (M1B-P1F Correction 5) ────────────────
//
// The global environment banner must present each environment EXPLICITLY, rather
// than "demo unless production". In particular Pilot must identify itself as
// Pilot and must NOT show the Demo banner, a Demo label, or synthetic/demo
// messaging — and must not imply it contains real operator data. Production shows
// no banner. Any unknown/unset value fails safe to a neutral non-production
// banner (never silently looks like production, never mislabels as Demo).
//
// Keyed off NEXT_PUBLIC_SAFEBET_ENV (the public environment identity), matching
// the existing banner input.

export type EnvironmentKind = 'demo' | 'pilot' | 'production' | 'unknown';

export interface EnvironmentPresentation {
  /** Whether the environment banner renders at all (production = false). */
  show: boolean;
  /** Stable classification for tests/telemetry. */
  kind: EnvironmentKind;
  /** Banner text (empty when not shown). */
  label: string;
}

/**
 * Presentation for the environment banner. Explicit per environment; no Demo
 * wording leaks into Pilot, and Pilot does not imply real operator data.
 */
export function environmentPresentation(env: string | null | undefined): EnvironmentPresentation {
  switch (env) {
    case 'production':
      return { show: false, kind: 'production', label: '' };
    case 'demo':
      return { show: true, kind: 'demo', label: 'SafeBet IQ Demo · Non-Production · Synthetic Data' };
    case 'pilot':
      return { show: true, kind: 'pilot', label: 'SafeBet IQ Pilot · Controlled Pilot Environment · Not Live Operator Data' };
    default:
      return { show: true, kind: 'unknown', label: 'SafeBet IQ · Non-Production Environment' };
  }
}
