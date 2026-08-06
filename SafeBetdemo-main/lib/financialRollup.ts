// Pure, testable helpers mirroring the certified financial-rollup contract. The
// database RPCs (sbiq_certified_financial_posture_v2 / sbiq_admin_financial_section /
// sbiq_admin_registered_status) are the runtime source of truth and exact parity
// with projection_financial_posture is proven by live SQL; these keep the contract
// (freshness, GGR formula, unsupported-not-zero, SAST boundaries) unit-testable.

export type Freshness = 'Current' | 'Delayed' | 'Stale' | 'Unknown';

// Rollup freshness from the last successful refresh (never "Current" just because a
// job exists — it considers how long ago the last success was).
export function rollupFreshness(lastSuccessMs: number | null, nowMs: number): Freshness {
  if (lastSuccessMs == null) return 'Unknown';
  const ageMin = (nowMs - lastSuccessMs) / 60000;
  if (ageMin >= 15) return 'Stale';
  if (ageMin >= 5) return 'Delayed';
  return 'Current';
}

export function registeredIsStale(refreshedAtMs: number | null, nowMs: number, staleAfterSeconds = 21600): boolean {
  if (refreshedAtMs == null) return true;
  return (nowMs - refreshedAtMs) / 1000 > staleAfterSeconds;
}

// Certified GGR = settled stakes − player winnings.
export function ggr(stakes: number, winnings: number): number {
  return stakes - winnings;
}

// Unsupported financial categories are NULL when the capability is unsupported —
// never converted to 0. Supported → 0 (no such events in the synthetic demo).
export function unsupportedValue(supported: boolean): number | null {
  return supported ? 0 : null;
}

// Financial capability status: 'unavailable' with no events; 'healthy' only when
// voids AND reversals are supported; otherwise 'partial'.
export function capabilityStatus(eventsTotal: number, voidsSupported: boolean, reversalsSupported: boolean): string {
  if (eventsTotal === 0) return 'unavailable';
  return voidsSupported && reversalsSupported ? 'healthy' : 'partial';
}

// Data mode from synthetic/non-synthetic counts.
export function dataMode(total: number, synthetic: number, nonSynthetic: number): string {
  if (total === 0) return 'unavailable';
  if (nonSynthetic === 0) return 'synthetic';
  if (synthetic === 0) return 'live';
  return 'mixed';
}

// Africa/Johannesburg is UTC+2 (no DST). SAST day/month boundaries are therefore
// hour-aligned in UTC (22:00 UTC the previous day). Returned as epoch ms (UTC).
const SAST_OFFSET_MS = 2 * 3600_000;
export function sastDayStartUtcMs(nowMs: number): number {
  const sast = nowMs + SAST_OFFSET_MS;
  const dayStartSast = Math.floor(sast / 86400_000) * 86400_000;
  return dayStartSast - SAST_OFFSET_MS;
}
export function sastBoundaryIsHourAligned(): boolean {
  return SAST_OFFSET_MS % 3600_000 === 0;   // +2h → aligned, so whole hourly buckets sum exactly
}

const REQUIRED_FINANCIAL_FIELDS = ['currency', 'ggr_today', 'status', 'is_simulated', 'snapshot_at', 'source', 'freshness', 'rollup_version'] as const;
export function financialSectionValid(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return REQUIRED_FINANCIAL_FIELDS.every((k) => k in o);
}
