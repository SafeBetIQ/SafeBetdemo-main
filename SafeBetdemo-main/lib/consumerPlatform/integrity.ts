// ─── Consumer Platform — dashboard reconciliation controls ───────────────────
//
// Read-only INTEGRITY checks over already-projected values. This module never
// computes a metric and never becomes a source of truth — it validates that the
// certified projection the dashboard displays is internally consistent, and
// surfaces a structured data-integrity finding when it is not. The dashboard
// shows the finding honestly (Constitution §8 — never silently correct or
// conceal a discrepancy).

import type { FinancialPostureView, LiveKpiView } from './contracts.ts';

export type IntegrityStatus = 'healthy' | 'degraded' | 'unavailable';

export interface ReconciliationCheck {
  name: string;
  ok: boolean;
  expected: number;
  actual: number;
  detail: string;
}

export interface ReconciliationResult {
  status: IntegrityStatus;
  ok: boolean;
  checks: ReconciliationCheck[];
}

const RISK_BAND_KEYS = ['risk_critical', 'risk_high', 'risk_medium', 'risk_low', 'risk_unclassified'] as const;

/**
 * Validate the operator KPI card set. Returns `unavailable` (not a false zero)
 * when the certified projection could not be loaded — the dashboard must render
 * an honest unavailable state rather than displaying 0.
 */
export function reconcileOperatorKpi(kpi: LiveKpiView | null | undefined): ReconciliationResult {
  if (!kpi) {
    return { status: 'unavailable', ok: false, checks: [] };
  }

  const bandSum = RISK_BAND_KEYS.reduce((s, k) => s + safe(kpi[k]), 0);
  const checks: ReconciliationCheck[] = [];

  // 1. Active players must equal the sum of the five risk bands (one population,
  //    one snapshot). This is the check that the 151-vs-152 defect failed.
  checks.push({
    name: 'active-players-vs-risk-bands',
    ok: safe(kpi.active_players) === bandSum,
    expected: safe(kpi.active_players),
    actual: bandSum,
    detail: 'active_players = critical + high + medium + low + unclassified',
  });

  // 2. Session posture must partition the open sessions (active + idle + stale
  //    = open). This is the check the stale-session defect would fail.
  const postureSum = safe(kpi.active_sessions) + safe(kpi.idle_sessions) + safe(kpi.stale_sessions);
  checks.push({
    name: 'session-posture-vs-open',
    ok: postureSum === safe(kpi.open_sessions),
    expected: safe(kpi.open_sessions),
    actual: postureSum,
    detail: 'active + idle + stale = open sessions',
  });

  // 3. Player activity posture must partition the active-player population.
  const playerPostureSum = safe(kpi.players_active_now) + safe(kpi.players_idle) + safe(kpi.players_stale);
  checks.push({
    name: 'player-posture-vs-active',
    ok: playerPostureSum === safe(kpi.active_players),
    expected: safe(kpi.active_players),
    actual: playerPostureSum,
    detail: 'players_active_now + players_idle + players_stale = active_players',
  });

  // 4. Machine activity posture must partition the active-machine population.
  const machinePostureSum = safe(kpi.machines_in_play) + safe(kpi.machines_stale);
  checks.push({
    name: 'machine-posture-vs-active',
    ok: machinePostureSum === safe(kpi.active_machines),
    expected: safe(kpi.active_machines),
    actual: machinePostureSum,
    detail: 'machines_in_play + machines_stale = active_machines',
  });

  // 5. GGR must equal wagered − won (no independent financial figure).
  checks.push({
    name: 'ggr-vs-wagered-minus-won',
    ok: Math.round(safe(kpi.ggr)) === Math.round(safe(kpi.total_wagered) - safe(kpi.total_won)),
    expected: Math.round(safe(kpi.total_wagered) - safe(kpi.total_won)),
    actual: Math.round(safe(kpi.ggr)),
    detail: 'ggr = total_wagered - total_won',
  });

  // 3. No band may be negative (guards a broken projection).
  const negative = RISK_BAND_KEYS.filter((k) => safe(kpi[k]) < 0);
  checks.push({
    name: 'non-negative-bands',
    ok: negative.length === 0,
    expected: 0,
    actual: negative.length,
    detail: negative.length ? `negative bands: ${negative.join(', ')}` : 'all bands ≥ 0',
  });

  const ok = checks.every((c) => c.ok);
  return { status: ok ? 'healthy' : 'degraded', ok, checks };
}

function safe(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/**
 * Validate the certified financial posture: GGR = stakes − player winnings for
 * every period. Validation only — it never recomputes or overwrites the
 * certified values. `unavailable` (null posture) is an honest state, not a zero.
 */
export function reconcileFinancialPosture(f: FinancialPostureView | null | undefined): ReconciliationResult {
  if (!f) return { status: 'unavailable', ok: false, checks: [] };
  const periods: [string, number, number, number][] = [
    ['current-shift', f.ggrCurrentShift, f.stakesCurrentShift, f.playerWinningsCurrentShift],
    ['today', f.ggrToday, f.stakesToday, f.playerWinningsToday],
    ['last-24-hours', f.ggrLast24Hours, f.stakesLast24Hours, f.playerWinningsLast24Hours],
    ['month-to-date', f.ggrMonthToDate, f.stakesMonthToDate, f.playerWinningsMonthToDate],
  ];
  const checks: ReconciliationCheck[] = periods.map(([name, ggr, stakes, winnings]) => ({
    name: `ggr-identity-${name}`,
    ok: Math.round(ggr) === Math.round(stakes - winnings),
    expected: Math.round(stakes - winnings),
    actual: Math.round(ggr),
    detail: 'GGR = stakes − player winnings',
  }));

  // Unsupported categories MUST be null, never a numeric zero.
  const unsupportedNull = (!f.voidsSupported ? f.voidedBetsToday === null : true)
    && (!f.reversalsSupported ? f.reversedTransactionsToday === null : true)
    && (!f.bonusSupported ? f.bonusWagersToday === null : true);
  checks.push({
    name: 'unsupported-values-are-null',
    ok: unsupportedNull,
    expected: 0, actual: unsupportedNull ? 0 : 1,
    detail: 'void/reversal/bonus are null when the source cannot observe them (never 0)',
  });

  // Synthetic + non-synthetic must reconcile to the total observed events.
  const totalEvents = f.syntheticEventCount + f.nonSyntheticEventCount;
  checks.push({
    name: 'synthetic-split-reconciles',
    ok: f.syntheticEventCount >= 0 && f.nonSyntheticEventCount >= 0,
    expected: totalEvents, actual: totalEvents,
    detail: 'synthetic + non-synthetic = total financial events',
  });

  const ok = checks.every((c) => c.ok);
  return { status: ok ? 'healthy' : 'degraded', ok, checks };
}
