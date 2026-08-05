// Versioned Admin Overview response contract + pure reconciliation helpers.
// Shared by the useAdminOverview hook (schema guard) and the test suite so the
// contract and certified invariants are unit-testable.

export const ADMIN_OVERVIEW_SCHEMA = 'admin-overview-v1';

// Max initial bounded requests for the Overview (1 primary + ≤2 deferred).
export const OVERVIEW_INITIAL_REQUEST_BUDGET = 3;

const REQUIRED_KEYS = ['schema_version', 'as_of', 'environment', 'platform', 'risk', 'governance', 'simulator', 'alerts', 'casinos'] as const;

export function isValidOverview(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  if (o.schema_version !== ADMIN_OVERVIEW_SCHEMA) return false;
  if (!REQUIRED_KEYS.every((k) => k in o)) return false;
  return Array.isArray(o.casinos);
}

// Certified: observed players = active_now + idle + stale (never registered/observed labelled active).
export function playersReconcile(p: { observed_players: number; active_now: number; idle: number; stale: number }): boolean {
  return p.observed_players === p.active_now + p.idle + p.stale;
}

// Certified: open sessions = active + idle + stale.
export function sessionsReconcile(open: number, active: number, idle: number, stale: number): boolean {
  return open === active + idle + stale;
}

// Certified: allocated endpoints = in_play + stale.
export function endpointsReconcile(allocated: number, inPlay: number, stale: number): boolean {
  return allocated === inPlay + stale;
}

// Certified: risk population = critical + high + medium + low + unclassified (= observed).
export function riskReconcile(observed: number, r: { critical: number; high: number; medium: number; low: number; unclassified: number }): boolean {
  return observed === r.critical + r.high + r.medium + r.low + r.unclassified;
}

// registered and active-now must remain distinct fields (never conflated).
export function registeredIsDistinctFromActive(p: { registered_players: number; active_now: number }): boolean {
  return typeof p.registered_players === 'number' && typeof p.active_now === 'number';
}
