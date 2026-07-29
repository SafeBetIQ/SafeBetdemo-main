// ─── Enterprise Operational Modes (Phase 4.4, WS2) ───────────────────────────
//
// The platform's operating mode influences OPERATIONS ONLY — simulator
// behaviour, logging verbosity, alert thresholds, maintenance cadence,
// demonstration datasets. It NEVER changes business rules: identity,
// projections, intelligence, and policy decisions are byte-identical across
// modes (Constitution — one runtime reality, policy as data). Mode is a
// deployment/operations concern, resolved from the environment.

export const OPERATING_MODES = ['development', 'demonstration', 'staging', 'production'] as const;
export type OperatingMode = (typeof OPERATING_MODES)[number];

export const DEFAULT_MODE: OperatingMode = 'demonstration';

export interface OperationalProfile {
  mode: OperatingMode;
  /** Structured-log verbosity floor. */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  /** May the in-browser/edge simulator produce synthetic events? */
  simulatorEnabled: boolean;
  /** Projection-lag seconds beyond which health is degraded/critical. */
  lagWarnSeconds: number;
  lagCriticalSeconds: number;
  /** Months of event partitions to keep hot before archive is advised. */
  retentionHotMonths: number;
  /** Are demonstration datasets permitted / expected? */
  demoDataAllowed: boolean;
}

const PROFILES: Record<OperatingMode, OperationalProfile> = {
  development: {
    mode: 'development', logLevel: 'debug', simulatorEnabled: true,
    lagWarnSeconds: 120, lagCriticalSeconds: 600, retentionHotMonths: 3, demoDataAllowed: true,
  },
  demonstration: {
    mode: 'demonstration', logLevel: 'info', simulatorEnabled: true,
    lagWarnSeconds: 90, lagCriticalSeconds: 300, retentionHotMonths: 6, demoDataAllowed: true,
  },
  staging: {
    mode: 'staging', logLevel: 'info', simulatorEnabled: true,
    lagWarnSeconds: 60, lagCriticalSeconds: 180, retentionHotMonths: 12, demoDataAllowed: true,
  },
  production: {
    mode: 'production', logLevel: 'warn', simulatorEnabled: false,
    lagWarnSeconds: 30, lagCriticalSeconds: 120, retentionHotMonths: 24, demoDataAllowed: false,
  },
};

export function normalizeMode(value: string | null | undefined): OperatingMode {
  const v = (value ?? '').toLowerCase();
  return (OPERATING_MODES as readonly string[]).indexOf(v) !== -1 ? (v as OperatingMode) : DEFAULT_MODE;
}

/** Resolve the operating mode from the environment (browser/Node/Deno safe). */
export function resolveOperatingMode(): OperatingMode {
  try {
    if (typeof process !== 'undefined' && process.env) {
      const m = process.env.SAFEBET_OPERATING_MODE ?? process.env.NEXT_PUBLIC_SAFEBET_OPERATING_MODE;
      if (m) return normalizeMode(m);
    }
  } catch { /* no process */ }
  try {
    const deno = (globalThis as { Deno?: { env?: { get(k: string): string | undefined } } }).Deno;
    const m = deno?.env?.get?.('SAFEBET_OPERATING_MODE');
    if (m) return normalizeMode(m);
  } catch { /* env not permitted */ }
  return DEFAULT_MODE;
}

export function operationalProfile(mode: OperatingMode = resolveOperatingMode()): OperationalProfile {
  return PROFILES[mode];
}
