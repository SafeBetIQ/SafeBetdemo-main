// Pure mirror of the Demo simulator GOVERNANCE decisions implemented in SQL
// (sbiq_demo_live_tick / sbiq_demo_activate_showcase / sbiq_demo_sim_health_overall).
// The database functions are the runtime source of truth and enforce these
// server-side; these mirrors make the contract unit-testable. Keep in sync.

export const DEMO_SIM_LIMITS = {
  MAX_SIM_EVENTS_PER_TICK: 1000,
  MAX_SIM_EVENTS_PER_CASINO_PER_TICK: 250,
  SIM_EVENTS_PER_DAY_WARNING: 75000,
  SIM_EVENTS_PER_DAY_HARDSTOP: 120000,
  MAX_SHOWCASE_ACTIVATIONS_PER_HOUR: 3,      // per casino
  MAX_REGULATOR_ACTIVATIONS_PER_HOUR: 2,
  MAX_ACTIVE_SHOWCASE_WINDOWS: 8,
  CASINO_SHOWCASE_MINUTES: 30,
  CASINO_SHOWCASE_COOLDOWN_MINUTES: 10,
  CASINO_SHOWCASE_MAX_MINUTES: 45,
  REGULATOR_SHOWCASE_MINUTES: 45,
  REGULATOR_SHOWCASE_COOLDOWN_MINUTES: 15,
  REGULATOR_SHOWCASE_MAX_MINUTES: 60,
  LATE_TICK_MINUTES: 8,
  STORAGE_INTERNAL_ALLOC_MB: 8192,
  STORAGE_WARN_PCT: 70,
  STORAGE_CRITICAL_PCT: 85,
} as const;

export type VolumeMode = 'normal' | 'reduced' | 'hardstop';

/** Mirror of the tick's daily-volume gate. */
export function volumeMode(eventsToday: number): VolumeMode {
  if (eventsToday >= DEMO_SIM_LIMITS.SIM_EVENTS_PER_DAY_HARDSTOP) return 'hardstop';
  if (eventsToday >= DEMO_SIM_LIMITS.SIM_EVENTS_PER_DAY_WARNING) return 'reduced';
  return 'normal';
}

/** Per-casino generation is bounded by per-casino cap AND remaining tick budget. */
export function boundedNeed(need: number, tickBudgetRemaining: number): number {
  return Math.max(0, Math.min(need, DEMO_SIM_LIMITS.MAX_SIM_EVENTS_PER_CASINO_PER_TICK, tickBudgetRemaining));
}

export type ShowcaseDecision = 'accepted' | 'extended' | 'cooldown' | 'rate_limited' | 'max_windows' | 'disabled';

export interface ShowcaseState {
  showcaseEnabled: boolean;
  isRegulator: boolean;
  hasActiveWindow: boolean;
  minutesSinceActivation: number;   // for the active window, if any
  activationsLastHour: number;      // accepted+extended for this scope
  activeWindowCount: number;        // total active windows
}

/** Mirror of sbiq_demo_activate_showcase decision (login always succeeds regardless). */
export function showcaseDecision(s: ShowcaseState): ShowcaseDecision {
  if (!s.showcaseEnabled) return 'disabled';
  const cooldown = s.isRegulator ? DEMO_SIM_LIMITS.REGULATOR_SHOWCASE_COOLDOWN_MINUTES : DEMO_SIM_LIMITS.CASINO_SHOWCASE_COOLDOWN_MINUTES;
  const perHour = s.isRegulator ? DEMO_SIM_LIMITS.MAX_REGULATOR_ACTIVATIONS_PER_HOUR : DEMO_SIM_LIMITS.MAX_SHOWCASE_ACTIVATIONS_PER_HOUR;
  if (s.hasActiveWindow) {
    return s.minutesSinceActivation < cooldown ? 'cooldown' : 'extended';
  }
  if (s.activationsLastHour >= perHour) return 'rate_limited';
  if (s.activeWindowCount >= DEMO_SIM_LIMITS.MAX_ACTIVE_SHOWCASE_WINDOWS) return 'max_windows';
  return 'accepted';
}

/** Extended expiry is capped at max_minutes from the ORIGINAL activation. */
export function cappedExpiryMinutes(minutesSinceActivation: number, requestMinutes: number, isRegulator: boolean): number {
  const max = isRegulator ? DEMO_SIM_LIMITS.REGULATOR_SHOWCASE_MAX_MINUTES : DEMO_SIM_LIMITS.CASINO_SHOWCASE_MAX_MINUTES;
  // remaining life from original activation, never beyond the cap
  return Math.max(0, Math.min(requestMinutes, max - minutesSinceActivation));
}

export type StorageState = 'ok' | 'warning' | 'critical';
export function storageState(usedMb: number, allocMb = DEMO_SIM_LIMITS.STORAGE_INTERNAL_ALLOC_MB): StorageState {
  const pct = (usedMb / allocMb) * 100;
  if (pct >= DEMO_SIM_LIMITS.STORAGE_CRITICAL_PCT) return 'critical';
  if (pct >= DEMO_SIM_LIMITS.STORAGE_WARN_PCT) return 'warning';
  return 'ok';
}

export type Health = 'Healthy' | 'Warning' | 'Critical' | 'Disabled' | 'Unknown';
export interface HealthInputs {
  simulatorEnabled: boolean;
  lastSuccessfulTickMinutesAgo: number | null; // null => never
  reconcilesAll: boolean;
  maxOpenAlertSeverity: 0 | 1 | 2 | 3;          // 0 none,1 info,2 warning,3 critical
  pctOfDailyHardstop: number;
  eventsToday: number;
  storagePct: number;
}

/** Mirror of sbiq_demo_sim_health_overall classification. Never "Healthy" just
 *  because the cron exists — freshness, limits, reconciliation and alerts count. */
export function overallHealth(h: HealthInputs): Health {
  if (!h.simulatorEnabled) return 'Disabled';
  if (h.lastSuccessfulTickMinutesAgo === null) return 'Unknown';
  const late = h.lastSuccessfulTickMinutesAgo >= DEMO_SIM_LIMITS.LATE_TICK_MINUTES;
  if (h.maxOpenAlertSeverity === 3 || !h.reconcilesAll || late || h.pctOfDailyHardstop >= 100) return 'Critical';
  if (h.maxOpenAlertSeverity === 2 || h.eventsToday >= DEMO_SIM_LIMITS.SIM_EVENTS_PER_DAY_WARNING || h.storagePct >= DEMO_SIM_LIMITS.STORAGE_WARN_PCT) return 'Warning';
  return 'Healthy';
}

/** Snapshot age: certified age in seconds + stale flag (uses certified as_of, not render time). */
export function snapshotAge(asOfMs: number, nowMs: number, staleAfterSeconds = 120): { ageSeconds: number; stale: boolean } {
  const ageSeconds = Math.floor((nowMs - asOfMs) / 1000);
  return { ageSeconds, stale: ageSeconds > staleAfterSeconds };
}
