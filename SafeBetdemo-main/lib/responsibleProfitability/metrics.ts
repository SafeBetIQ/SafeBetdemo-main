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
  ggrForPeriod, stakesForPeriod, winningsForPeriod, certifiedMoney,
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

  // supporting certified stakes/winnings (context, same source)
  const stakes = stakesForPeriod(fp, period); const wins = winningsForPeriod(fp, period);

  // ── risk_posture_distribution + elevated_risk_exposure (canonical KPI bands) ──
  if (!kpi) {
    metrics.push(notAvailable('risk_posture_distribution', 'EXPOSURE_TO_REDUCE'));
    metrics.push(notAvailable('elevated_risk_exposure', 'EXPOSURE_TO_REDUCE'));
  } else {
    const crit = n(kpi.risk_critical), high = n(kpi.risk_high), med = n(kpi.risk_medium), low = n(kpi.risk_low);
    const active = n(kpi.active_players);
    const elevated = (crit ?? 0) + (high ?? 0);
    // k-anon EACH band: a genuine 0 renders "0", but a small non-zero band (>0,<floor)
    // is masked "<N" so per-band figures can never expose a small identifiable group —
    // consistent with the elevated-exposure suppression below.
    const band = (c: number | null): string => (c === null ? '—' : suppressed(c) ? `<${RP_MIN_COHORT}` : String(c));
    metrics.push({ id: 'risk_posture_distribution', name: 'Player risk-posture distribution', availability: 'MEASURABLE',
      value: active, display: `${band(crit)} critical · ${band(high)} high · ${band(med)} medium · ${band(low)} low`,
      provenance: 'OPERATIONAL_PROJECTION', framing: 'EXPOSURE_TO_REDUCE' });
    metrics.push({ id: 'elevated_risk_exposure', name: 'Elevated harm-risk exposure',
      availability: suppressed(elevated) ? 'SUPPRESSED' : 'MEASURABLE',
      value: suppressed(elevated) ? null : elevated, ratio: active ? elevated / active : null,
      display: suppressed(elevated) ? '—' : `${elevated}${active ? ` of ${active}` : ''}`,
      provenance: 'OPERATIONAL_PROJECTION', framing: 'EXPOSURE_TO_REDUCE',
      reason: suppressed(elevated) ? 'Cohort below the identifiable-exposure floor; suppressed.' : undefined });
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
    // B1 reuses the certified posture verbatim for all financial values → reconciles by construction.
    reconciliation: fp ? 'RECONCILES_TO_CERTIFIED_POSTURE' : 'UNAVAILABLE',
    metrics,
  };
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
