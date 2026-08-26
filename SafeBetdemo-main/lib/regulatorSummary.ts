// ─── Regulator summary metric contract (REG-SUM-1) ───────────────────────────
// One place that defines what each regulator summary metric MEANS, which server
// field carries it, and how it renders. The values come from the server-side
// certified rollup (sbiq_regulator_national via regulator-portal national-overview)
// — this module never sums operators in the browser; it selects the correct
// pre-aggregated field and labels it precisely.
//
// Why this exists: the national response carries BOTH a current-activity number
// (activePlayers = freshness "active now") AND the active-player POPULATION
// (observedPlayers = players in the activity projection). The regulator's
// "active players across scope" is the population (observedPlayers). Labelling the
// small freshness number "Active players" caused the 1,125-vs-10,206 confusion.
//
// Metric semantics (different time windows — surfaced explicitly, never merged):
//   Active players (population) = observedPlayers  — players in the activity projection
//   Active now (freshness)      = activePlayers    — active within the certified freshness window
//   Monitored                   = playersMonitored — players with a compliance-monitoring posture
//                                                     (a persistent set; may exceed currently-active)
//   Interventions               = interventions    — records in the intervention projection

export type Rec = Record<string, unknown>;

const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined ? null
  : (typeof v === 'number' && Number.isFinite(v)) ? v
  : (Number.isFinite(Number(v)) ? Number(v) : null);

export interface RegulatorSummary {
  /** False when the national rollup could not be loaded — render "unavailable", NOT zeros. */
  available: boolean;
  jurisdiction: string | null;
  operators: number | null;
  /** Active-player POPULATION in scope (observedPlayers). The headline "Active players". */
  activePlayers: number | null;
  /** Currently active within the freshness window (activePlayers/active-now). */
  activeNow: number | null;
  monitored: number | null;
  interventions: number | null;
  /** Population observed but without a compliance-monitoring posture (population − monitored, floored at 0). */
  activeNotMonitored: number | null;
}

/**
 * Derive the regulator summary from the national-overview payload (already the
 * `data` object). A null/absent payload means the query failed → available:false
 * and null metrics, so the UI shows an unavailable state rather than false zeros.
 */
export function deriveRegulatorSummary(nat: Rec | null | undefined): RegulatorSummary {
  if (!nat) {
    return {
      available: false, jurisdiction: null, operators: null,
      activePlayers: null, activeNow: null, monitored: null, interventions: null,
      activeNotMonitored: null,
    };
  }
  const population = numOrNull(nat.observedPlayers);
  const monitored = numOrNull(nat.playersMonitored);
  const activeNotMonitored =
    population !== null && monitored !== null ? Math.max(0, population - monitored) : null;
  return {
    available: true,
    jurisdiction: (nat.jurisdiction as string | null) ?? null,
    operators: numOrNull(nat.operators),
    activePlayers: population,             // observedPlayers — the population headline
    activeNow: numOrNull(nat.activePlayers), // active-now / freshness
    monitored,
    interventions: numOrNull(nat.interventions),
    activeNotMonitored,
  };
}

// Concise, regulator-facing definitions (used for tooltips). Derived from the
// actual sbiq_regulator_national rollup semantics — do not paraphrase loosely.
export const REGULATOR_METRIC_DEFS = {
  operators: 'Operators in your authorised jurisdiction.',
  activePlayers: 'Active-player population across your authorised operators (players in the activity projection). Server-aggregated, not summed in the browser.',
  activeNow: 'Players active within the certified freshness window right now — a subset of the active-player population.',
  monitored: 'Players with a compliance-monitoring posture across your authorised operators. A persistent set that can exceed currently-active players.',
  interventions: 'Interventions recorded in the intervention projection across your authorised operators (0 when none are recorded).',
} as const;

/** Display a summary count: null → the unavailable marker; a real number → grouped. */
export const SUMMARY_UNAVAILABLE = '—';
export function summaryCount(v: number | null): string {
  return v === null ? SUMMARY_UNAVAILABLE : v.toLocaleString();
}
