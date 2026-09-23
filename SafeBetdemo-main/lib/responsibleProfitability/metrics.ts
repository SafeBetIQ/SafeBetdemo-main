// ─── SafeBet IQ — Responsible Profitability B1: metric computation ────────────
//
// Pure, deterministic. Composes MEASURABLE metrics from the certified financial posture
// (reused, never recomputed → reconciles by construction) + canonical risk-band KPI counts +
// self-exclusion protection + intervention coverage. Metrics whose supporting data is not
// authorised/period-aligned/certified are returned NOT_AVAILABLE with a provenance reason
// (never estimated/inferred). Small cohorts are suppressed (identifiable-exposure guard).

import {
  RP_METRICS_VERSION, RP_MIN_COHORT, RP_METRIC_DEFINITIONS, rpMetricById,
  type MetricProvenance,
} from './definitions.ts';
import {
  ggrForPeriod, certifiedMoney,
  financialStatusLabel, financialCurrency, financialTimezone, syntheticDisclosure,
  type FinancialPeriod,
} from '../certifiedFinancial.ts';
import type { FinancialPostureView } from '../consumerPlatform/contracts.ts';

export interface RpKpi {
  active_players: number | null;
  risk_critical: number | null;
  risk_high: number | null;
  risk_medium: number | null;
  risk_low: number | null;
}

/** Intervention-coverage inputs; provenance flags whether the data is real or a labelled synthetic demo fixture. */
export interface RpInterventionCoverage {
  elevatedRiskPlayers: number;
  elevatedRiskWithIntervention: number;
  provenance: 'OPERATIONAL_PROJECTION' | 'SYNTHETIC_DEMO';
}

export interface RpInput {
  casinoId: string;
  period: FinancialPeriod;
  financial: FinancialPostureView | null;
  kpi: RpKpi | null;
  activeSelfExclusions: number | null;
  interventionCoverage: RpInterventionCoverage | null;   // null => NOT_AVAILABLE (e.g. unseeded)
  now?: string;
}

export interface RpMetricResult {
  id: string;
  name: string;
  availability: 'MEASURABLE' | 'NOT_AVAILABLE' | 'SUPPRESSED';
  value: number | null;
  ratio?: number | null;
  display: string;                 // human-facing; "—" when unavailable/suppressed
  provenance: MetricProvenance;
  freshness?: string;
  reason?: string;                 // NOT_AVAILABLE/SUPPRESSED explanation
  framing: 'PERFORMANCE' | 'EXPOSURE_TO_REDUCE' | 'PROTECTION' | 'COVERAGE_GAP' | 'DATA_QUALITY';
}

export interface RpOverview {
  metricsVersion: string;
  casinoId: string;
  period: FinancialPeriod;
  generatedAt: string;
  currency: string;
  timezone: string;
  financialStatus: string;
  containsSyntheticData: boolean;
  syntheticDisclosure: string | null;
  reconciliation: 'RECONCILES_TO_CERTIFIED_POSTURE' | 'UNAVAILABLE';
  metrics: RpMetricResult[];
}

const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
/** Suppress a count below the k-anonymity floor (0 is a legitimate, non-identifying value). */
const suppressed = (c: number | null): boolean => c !== null && c > 0 && c < RP_MIN_COHORT;

function notAvailable(id: string, framing: RpMetricResult['framing']): RpMetricResult {
  const d = rpMetricById(id)!;
  return { id, name: d.name, availability: 'NOT_AVAILABLE', value: null, display: '—', provenance: d.provenance, reason: d.notAvailableReason ?? d.missingDataBehaviour, framing };
}

export function computeResponsibleProfitability(input: RpInput): RpOverview {
  const { financial: fp, kpi, period } = input;
  const status = financialStatusLabel(fp);
  const metrics: RpMetricResult[] = [];

  // ── certified_ggr (reused certified posture — reconciles by construction) ──
  const ggr = ggrForPeriod(fp, period);
  metrics.push({ id: 'certified_ggr', name: 'Certified GGR (period)', availability: ggr === null ? 'NOT_AVAILABLE' : 'MEASURABLE',
    value: ggr, display: certifiedMoney(ggr), provenance: 'CERTIFIED', freshness: status, framing: 'PERFORMANCE',
    reason: ggr === null ? 'Certified GGR unavailable for this period.' : undefined });

  // ── risk_posture_distribution + elevated_risk_exposure (canonical KPI bands) ──
  // Each band is read as number-or-null: a MISSING band is null (never coerced to 0 — finding 3).
  const crit = kpi ? n(kpi.risk_critical) : null;
  const high = kpi ? n(kpi.risk_high) : null;
  const med = kpi ? n(kpi.risk_medium) : null;
  const low = kpi ? n(kpi.risk_low) : null;
  const active = kpi ? n(kpi.active_players) : null;

  if (!kpi) {
    metrics.push(notAvailable('risk_posture_distribution', 'EXPOSURE_TO_REDUCE'));
  } else {
    // k-anon EACH band: a genuine 0 renders "0"; a MISSING band renders "—" (never 0 — finding 3);
    // a small non-zero band (>0,<floor) is masked "<N" so per-band figures never expose a small group.
    const band = (c: number | null): string => (c === null ? '—' : suppressed(c) ? `<${RP_MIN_COHORT}` : String(c));
    metrics.push({ id: 'risk_posture_distribution', name: 'Player risk-posture distribution', availability: 'MEASURABLE',
      // No aggregate numeric value is emitted: the display carries per-band (masked) figures only, so no
      // total can be combined with a masked band to recover it (finding 2 — complementary calculation).
      value: null, display: `${band(crit)} critical · ${band(high)} high · ${band(med)} medium · ${band(low)} low`,
      provenance: 'OPERATIONAL_PROJECTION', framing: 'EXPOSURE_TO_REDUCE' });
  }

  // elevated_risk_exposure = critical + high. BOTH bands must be present, else NOT_AVAILABLE — a missing
  // band is never treated as 0 (finding 3). It is suppressed when the sum OR EITHER component is a small
  // group, because a visible component plus the sum would otherwise recover the masked one, and any ratio
  // (elevated/active) would recover the count — so value, ratio AND display are all withheld (finding 2).
  if (crit === null || high === null) {
    metrics.push({ ...notAvailable('elevated_risk_exposure', 'EXPOSURE_TO_REDUCE'),
      reason: 'Required risk-band inputs are missing; elevated exposure is not computed (missing is never treated as zero).' });
  } else {
    const elevated = crit + high;
    const hide = suppressed(elevated) || suppressed(crit) || suppressed(high);
    metrics.push({ id: 'elevated_risk_exposure', name: 'Elevated harm-risk exposure',
      availability: hide ? 'SUPPRESSED' : 'MEASURABLE',
      value: hide ? null : elevated,
      ratio: hide ? null : (active && active > 0 ? elevated / active : null),
      display: hide ? '—' : `${elevated}${active && active > 0 ? ` of ${active}` : ''}`,
      provenance: 'OPERATIONAL_PROJECTION', framing: 'EXPOSURE_TO_REDUCE',
      reason: hide ? 'Cohort at or below the identifiable-exposure floor; suppressed (including complementary recovery).' : undefined });
  }

  // ── self_exclusion_protection (protection framing) ──
  const se = n(input.activeSelfExclusions);
  metrics.push({ id: 'self_exclusion_protection', name: 'Self-exclusion protection in force',
    availability: se === null ? 'NOT_AVAILABLE' : (suppressed(se) ? 'SUPPRESSED' : 'MEASURABLE'),
    value: (se === null || suppressed(se)) ? null : se, display: se === null ? '—' : (suppressed(se) ? '—' : String(se)),
    provenance: 'OPERATIONAL_PROJECTION', framing: 'PROTECTION',
    reason: se === null ? 'Self-exclusion data unavailable.' : (suppressed(se) ? 'Cohort below the identifiable-exposure floor; suppressed.' : undefined) });

  // ── intervention_coverage (runtime availability against actual data) ──
  const cov = input.interventionCoverage;
  if (!cov || cov.elevatedRiskPlayers <= 0) {
    metrics.push({ ...notAvailable('intervention_coverage', 'COVERAGE_GAP'),
      reason: cov ? 'No elevated-risk cohort to measure coverage against.' : 'Intervention state is unpopulated (no operational or labelled-synthetic intervention data present).' });
  } else {
    const ratio = cov.elevatedRiskWithIntervention / cov.elevatedRiskPlayers;
    metrics.push({ id: 'intervention_coverage', name: 'Intervention coverage', availability: 'MEASURABLE',
      value: cov.elevatedRiskWithIntervention, ratio, display: `${(ratio * 100).toFixed(0)}% (${cov.elevatedRiskWithIntervention}/${cov.elevatedRiskPlayers})`,
      provenance: cov.provenance === 'SYNTHETIC_DEMO' ? 'SYNTHETIC_DEMO' : 'DERIVED', framing: 'COVERAGE_GAP' });
  }

  // ── financial_data_quality ──
  metrics.push({ id: 'financial_data_quality', name: 'Financial data quality & reconciliation', availability: 'MEASURABLE',
    value: null, display: status, provenance: 'CERTIFIED', freshness: status, framing: 'DATA_QUALITY' });

  // ── defined-but-not-measurable metrics: always NOT_AVAILABLE with provenance ──
  for (const id of ['ggr_attributable_to_elevated_risk', 'harm_adjusted_profitability', 'healthy_player_retention', 'intervention_outcome_effectiveness']) {
    metrics.push(notAvailable(id, id === 'healthy_player_retention' ? 'PERFORMANCE' : 'EXPOSURE_TO_REDUCE'));
  }

  return {
    metricsVersion: RP_METRICS_VERSION, casinoId: input.casinoId, period, generatedAt: input.now ?? new Date().toISOString(),
    currency: financialCurrency(fp), timezone: financialTimezone(fp), financialStatus: status,
    containsSyntheticData: !!fp?.containsSyntheticData, syntheticDisclosure: syntheticDisclosure(fp),
    // Reconciliation is reported only when the SELECTED period's certified value is actually present.
    // "Reconciles by construction" is meaningful only when there is a value to reconcile to — if this
    // period's certified GGR is unavailable, reconciliation is UNAVAILABLE, not RECONCILES (finding 5).
    reconciliation: fp && ggr !== null ? 'RECONCILES_TO_CERTIFIED_POSTURE' : 'UNAVAILABLE',
    metrics,
  };
}

// ─── Pure authorization / staleness helpers (route-side, exported for testing) ─

/**
 * The Consumer Platform gateway is the authorization AUTHORITY (it enforces
 * principalMayAccessCasino server-side). This maps its HTTP status to whether the
 * route may proceed with any privileged (service-role) read. A 401/403 is
 * propagated as a denial; any other non-2xx means authorization could not be
 * confirmed, so NO privileged read runs, but it is not a hard denial.
 */
export function gatewayAuthorizationOutcome(status: number): { authorized: boolean; denyStatus: number | null } {
  if (status >= 200 && status < 300) return { authorized: true, denyStatus: null };
  if (status === 401 || status === 403) return { authorized: false, denyStatus: status };
  return { authorized: false, denyStatus: null };
}

/**
 * Resolve the single casino a Responsible-Profitability request may read, or a
 * denial status. Operators are pinned to their own casino; a differing requested
 * casino is refused for anyone pinned. Administrators (no casino assignment) must
 * name a casino. No caller can ever widen beyond this — the gateway re-checks it.
 */
export function resolveRpScope(
  profile: string | null,
  casinoId: string | undefined,
  requestedCasinoId: string | undefined,
): { scopeCasino: string } | { deny: number } {
  if (profile !== 'casino-operator' && profile !== 'administrator') return { deny: 403 };
  if (casinoId && requestedCasinoId && requestedCasinoId !== casinoId) return { deny: 403 };
  if (profile === 'casino-operator') {
    if (!casinoId) return { deny: 403 };
    return { scopeCasino: casinoId };
  }
  const scope = casinoId ?? requestedCasinoId;
  if (!scope) return { deny: 403 };
  return { scopeCasino: scope };
}

/** Client staleness guard: accept a fetched overview only if it is for the currently-selected period. */
export function isOverviewForPeriod(o: { period: FinancialPeriod } | null | undefined, period: FinancialPeriod): boolean {
  return !!o && o.period === period;
}

/** Guard for callers/tests: no MEASURABLE metric may carry growth/upsell/recovery framing. */
export function assertNoOpportunityFraming(o: RpOverview): void {
  const banned = /opportunit|upsell|grow revenue|win.?back|recover(y| the)|reactivat|target (high|critical)|incentiv/i;
  for (const m of o.metrics) {
    if (banned.test(m.name) || banned.test(m.display) || (m.reason && banned.test(m.reason))) {
      throw new Error(`Responsible-Profitability safeguard violation: opportunity framing on metric ${m.id}`);
    }
  }
}
