// ─── SafeBet IQ — Responsible Profitability B1: governed metric definitions ────
//
// B1 is the governed metric FOUNDATION (Authority §4.1/§4.5, Track B1). It defines
// Responsible-Profitability metrics with full provenance + availability governance, and
// enforces the safeguard: high-risk / critical / restricted / self-excluded players are
// NEVER framed as growth, upsell or recovery opportunities. Responsible Profitability is
// READ-ONLY operator intelligence — no incentives, campaigns, targeting or automated actions.
//
// A metric being in this contract does NOT mean it is currently measurable. A metric whose
// supporting data is not authorised, period-aligned and certified returns NOT_AVAILABLE with a
// data-provenance reason — never an estimated allocation, synthetic figure or inferred average.

export const RP_METRICS_VERSION = '1.0.0';

export type MetricAvailability = 'MEASURABLE' | 'NOT_AVAILABLE';
export type MetricProvenance = 'CERTIFIED' | 'OPERATIONAL_PROJECTION' | 'SYNTHETIC_DEMO' | 'DERIVED';

export interface RpMetricDefinition {
  id: string;
  name: string;
  meaning: string;                       // business meaning
  numerator?: string;                    // where applicable
  denominator?: string;                  // where applicable
  sourceProjections: string[];           // authoritative source(s)
  periodAlignment: 'CERTIFIED_PERIOD' | 'POINT_IN_TIME' | 'NONE';
  riskStateTiming: string;               // when the risk state is evaluated
  dataQualityRequirements: string;
  freshnessRequirements: string;
  missingDataBehaviour: string;
  provenance: MetricProvenance;
  safeguards: string[];
  prohibitedInterpretations: string[];
  availability: MetricAvailability;
  notAvailableReason?: string;           // required when availability = NOT_AVAILABLE
}

// Cross-cutting safeguard applied to EVERY metric (Authority §4.1; owner §5).
export const RP_UNIVERSAL_SAFEGUARDS: string[] = [
  'High-risk, critical, restricted and self-excluded players are never presented as growth, upsell or recovery opportunities.',
  'Read-only intelligence only — no incentives, campaigns, targeting recommendations or automated actions are produced.',
  'No vulnerable-player targeting, no loss-recovery framing, no hidden risk-score override, no automatic intervention suppression.',
  'Cross-operator identity federation remains OFF; no unauthorised cross-operator identity sharing.',
  'Small-group results below the k-anonymity floor are suppressed to prevent identifiable player exposure.',
];

// Minimum cohort size before a count/ratio may be surfaced (identifiable-exposure guard, §7).
export const RP_MIN_COHORT = 10;

export const RP_METRIC_DEFINITIONS: RpMetricDefinition[] = [
  {
    id: 'certified_ggr',
    name: 'Certified GGR (period)',
    meaning: 'Certified gross gaming revenue for the casino and reporting period; the sustainable commercial-performance anchor.',
    numerator: 'certified settled stakes − certified player winnings (per period)',
    sourceProjections: ['projection_financial_posture'],
    periodAlignment: 'CERTIFIED_PERIOD',
    riskStateTiming: 'n/a (financial)',
    dataQualityRequirements: 'financial_data_status not UNAVAILABLE; reconciles to the certified posture by construction (B1 never recomputes GGR).',
    freshnessRequirements: 'financial_snapshot_at present; freshness surfaced (LOADING/FRESH/STALE/PARTIAL/UNAVAILABLE).',
    missingDataBehaviour: 'return "—" (never 0) when the certified value is null/unavailable.',
    provenance: 'CERTIFIED',
    safeguards: RP_UNIVERSAL_SAFEGUARDS,
    prohibitedInterpretations: ['Must not be presented as a target to maximise regardless of harm.'],
    availability: 'MEASURABLE',
  },
  {
    id: 'risk_posture_distribution',
    name: 'Player risk-posture distribution',
    meaning: 'Count of active players by canonical risk band (critical/high/medium/low) — the harm-risk exposure context.',
    numerator: 'players per band', denominator: 'active players',
    sourceProjections: ['projection_player_state (via live-floor KPI canonical bands)'],
    periodAlignment: 'POINT_IN_TIME',
    riskStateTiming: 'current projected risk state at read time.',
    dataQualityRequirements: 'KPI available; band counts reconcile to active_players.',
    freshnessRequirements: 'projection freshness surfaced.',
    missingDataBehaviour: 'NOT_AVAILABLE when the KPI is unavailable; suppress bands below the cohort floor.',
    provenance: 'OPERATIONAL_PROJECTION',
    safeguards: RP_UNIVERSAL_SAFEGUARDS,
    prohibitedInterpretations: ['High/critical counts are harm-risk exposure to reduce — never a revenue segment to grow.'],
    availability: 'MEASURABLE',
  },
  {
    id: 'elevated_risk_exposure',
    name: 'Elevated harm-risk exposure',
    meaning: 'Number of active players in high or critical risk bands — the population where harm-reduction focus is warranted.',
    numerator: 'critical + high players', denominator: 'active players',
    sourceProjections: ['projection_player_state (KPI bands)'],
    periodAlignment: 'POINT_IN_TIME',
    riskStateTiming: 'current projected risk state.',
    dataQualityRequirements: 'KPI available.', freshnessRequirements: 'projection freshness surfaced.',
    missingDataBehaviour: 'NOT_AVAILABLE when KPI unavailable; suppress if cohort < floor.',
    provenance: 'OPERATIONAL_PROJECTION',
    safeguards: RP_UNIVERSAL_SAFEGUARDS,
    prohibitedInterpretations: ['This is an exposure-to-reduce measure, NOT a revenue-attribution or upsell segment.'],
    availability: 'MEASURABLE',
  },
  {
    id: 'self_exclusion_protection',
    name: 'Self-exclusion protection in force',
    meaning: 'Count of active self-exclusions protecting players at this casino — a responsible-gambling protection measure.',
    numerator: 'active self_exclusions',
    sourceProjections: ['self_exclusions'],
    periodAlignment: 'POINT_IN_TIME',
    riskStateTiming: 'current exclusion status.',
    dataQualityRequirements: 'self_exclusions readable under casino RLS.',
    freshnessRequirements: 'point-in-time.',
    missingDataBehaviour: 'NOT_AVAILABLE when unreadable; suppress if < floor.',
    provenance: 'OPERATIONAL_PROJECTION',
    safeguards: RP_UNIVERSAL_SAFEGUARDS,
    prohibitedInterpretations: ['Self-excluded players are protected persons — never a recovery/re-engagement target.'],
    availability: 'MEASURABLE',
  },
  {
    id: 'intervention_coverage',
    name: 'Intervention coverage',
    meaning: 'Share of elevated-risk players that have at least one recorded responsible-gambling intervention.',
    numerator: 'elevated-risk players with ≥1 intervention', denominator: 'elevated-risk players',
    sourceProjections: ['projection_intervention_state', 'projection_player_state'],
    periodAlignment: 'POINT_IN_TIME',
    riskStateTiming: 'current risk state vs recorded interventions.',
    dataQualityRequirements: 'projection_intervention_state populated; provenance (operational vs SYNTHETIC_DEMO) preserved end-to-end.',
    freshnessRequirements: 'projection freshness surfaced.',
    missingDataBehaviour: 'NOT_AVAILABLE when intervention state is unpopulated (currently 0 rows on Demo unless a labelled synthetic fixture is present).',
    provenance: 'DERIVED',
    safeguards: RP_UNIVERSAL_SAFEGUARDS,
    prohibitedInterpretations: ['Coverage is not an outcome/effectiveness claim; low coverage is a gap to close, not a cost to cut.'],
    availability: 'MEASURABLE',   // availability is re-evaluated at runtime against actual intervention data
  },
  {
    id: 'financial_data_quality',
    name: 'Financial data quality & reconciliation',
    meaning: 'Certified financial freshness, data mode, synthetic disclosure and reconciliation status for the period.',
    sourceProjections: ['projection_financial_posture'],
    periodAlignment: 'CERTIFIED_PERIOD',
    riskStateTiming: 'n/a',
    dataQualityRequirements: 'expose financial_data_status/mode/lag/snapshot + contains_synthetic_data honestly.',
    freshnessRequirements: 'surface LOADING/FRESH/STALE/PARTIAL/UNAVAILABLE.',
    missingDataBehaviour: 'UNAVAILABLE status shown; never fabricated.',
    provenance: 'CERTIFIED',
    safeguards: RP_UNIVERSAL_SAFEGUARDS,
    prohibitedInterpretations: [],
    availability: 'MEASURABLE',
  },

  // ── DEFINED BUT NOT CURRENTLY MEASURABLE (owner §4) — honest NOT_AVAILABLE ──
  {
    id: 'ggr_attributable_to_elevated_risk',
    name: 'GGR attributable to elevated-harm-risk players',
    meaning: 'Share of certified GGR generated by high/critical-risk players — the direct "revenue at harm-risk" measure.',
    numerator: 'certified GGR of elevated-risk players (period-aligned)', denominator: 'certified GGR (period)',
    sourceProjections: ['(required) authorised, period-aligned, player-attributed certified financial — DOES NOT EXIST'],
    periodAlignment: 'CERTIFIED_PERIOD',
    riskStateTiming: 'risk state aligned to the financial period.',
    dataQualityRequirements: 'per-player certified GGR aligned to the certified posture period.',
    freshnessRequirements: 'certified freshness.',
    missingDataBehaviour: 'NOT_AVAILABLE with provenance — never derived from aggregate GGR × risk-player counts, never an estimated allocation or inferred average.',
    provenance: 'CERTIFIED',
    safeguards: RP_UNIVERSAL_SAFEGUARDS,
    prohibitedInterpretations: ['Must not be approximated from aggregate GGR and risk counts (owner §4).'],
    availability: 'NOT_AVAILABLE',
    notAvailableReason: 'The certified financial posture is casino-aggregate only; projection_player_state wager/win totals are lifetime, uncertified and NOT period-aligned to the certified windows, so they cannot reconcile to certified period GGR. No authorised per-player period-aligned certified financial exists.',
  },
  {
    id: 'harm_adjusted_profitability',
    name: 'Harm-adjusted profitability',
    meaning: 'Sustainable profitability adjusted for the estimated cost of player harm.',
    sourceProjections: ['(required) a validated, defensible harm-cost methodology + player-attributed certified financial — NOT DEFINED'],
    periodAlignment: 'CERTIFIED_PERIOD',
    riskStateTiming: 'aligned to period.',
    dataQualityRequirements: 'documented, defensible harm-cost model.',
    freshnessRequirements: 'certified freshness.',
    missingDataBehaviour: 'NOT_AVAILABLE — not presented as a quantified outcome (owner §3).',
    provenance: 'DERIVED',
    safeguards: RP_UNIVERSAL_SAFEGUARDS,
    prohibitedInterpretations: ['Must not be presented as a quantified outcome without a documented, defensible methodology and inputs.'],
    availability: 'NOT_AVAILABLE',
    notAvailableReason: 'No documented, defensible harm-cost methodology and no player-attributed certified financial exist; presenting a number would be indefensible.',
  },
  {
    id: 'healthy_player_retention',
    name: 'Retention of lower-risk (healthy) players',
    meaning: 'Retention/continuation of low/medium-risk players — the sustainable customer-relationship measure.',
    sourceProjections: ['(required) player retention/churn measurement — DOES NOT EXIST'],
    periodAlignment: 'CERTIFIED_PERIOD',
    riskStateTiming: 'cohort tracked across periods.',
    dataQualityRequirements: 'a retention/churn projection.',
    freshnessRequirements: 'period-aligned.',
    missingDataBehaviour: 'NOT_AVAILABLE with provenance.',
    provenance: 'DERIVED',
    safeguards: RP_UNIVERSAL_SAFEGUARDS,
    prohibitedInterpretations: [],
    availability: 'NOT_AVAILABLE',
    notAvailableReason: 'No player-retention/churn measurement exists (the only "retention" tables are POPIA data-retention policies). No inferred substitute is permitted.',
  },
  {
    id: 'intervention_outcome_effectiveness',
    name: 'Intervention outcome effectiveness',
    meaning: 'Whether recorded interventions reduced subsequent harm-risk (outcome, not coverage).',
    sourceProjections: ['(required) intervention outcome data (post-intervention harm trajectory) — NOT AVAILABLE (B2 scope)'],
    periodAlignment: 'CERTIFIED_PERIOD',
    riskStateTiming: 'pre/post-intervention risk trajectory.',
    dataQualityRequirements: 'intervention outcomes captured over time.',
    freshnessRequirements: 'longitudinal.',
    missingDataBehaviour: 'NOT_AVAILABLE with provenance (owner: B2 Intervention Outcome Intelligence, not B1).',
    provenance: 'DERIVED',
    safeguards: RP_UNIVERSAL_SAFEGUARDS,
    prohibitedInterpretations: ['Coverage must never be presented as effectiveness.'],
    availability: 'NOT_AVAILABLE',
    notAvailableReason: 'Intervention outcomes are not measured (projection_intervention_state holds counts, not outcomes); effectiveness intelligence is B2 scope, out of B1.',
  },
];

export function rpMetricById(id: string): RpMetricDefinition | undefined {
  return RP_METRIC_DEFINITIONS.find((m) => m.id === id);
}
