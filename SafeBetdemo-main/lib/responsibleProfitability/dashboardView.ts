// ─── SafeBet IQ — Responsible Profitability B3: dashboard presentation helpers ──
//
// PURE, testable presentation logic for the B3 operator dashboards. It never
// invents data: it maps the governed B1/B2 API states to badges/labels, keeps the
// B1 financial period and the B2 ALL_RECORDED scope VISIBLY separate, refuses to
// chart a suppressed/unavailable value, and builds an injection-safe CSV export
// from the already-suppressed governed response only (no new server surface).

export type Availability = 'MEASURABLE' | 'PARTIAL' | 'NOT_AVAILABLE' | 'SUPPRESSED' | 'UNAVAILABLE' | 'STALE' | 'ZERO';

// Distinct visual meaning for each state (owner §5 — never collapse these).
export const AVAILABILITY_PRESENTATION: Record<string, { label: string; tone: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  MEASURABLE:    { label: 'Measured',                 tone: 'default' },
  ZERO:          { label: 'Zero',                     tone: 'secondary' },
  PARTIAL:       { label: 'Partial',                  tone: 'secondary' },
  SUPPRESSED:    { label: 'Suppressed (small group)', tone: 'secondary' },
  NOT_AVAILABLE: { label: 'Not available',            tone: 'outline' },
  STALE:         { label: 'Stale',                    tone: 'destructive' },
  UNAVAILABLE:   { label: 'Unavailable',              tone: 'outline' },
};
export function availabilityPresentation(a: string) {
  return AVAILABILITY_PRESENTATION[a] ?? { label: a, tone: 'outline' as const };
}

// Time-scope chips — B1 financial period vs B2 ALL_RECORDED must never be conflated.
export const SCOPE_FINANCIAL = 'Certified financial period';
export const SCOPE_ALL_RECORDED = 'All recorded interventions (not a financial period)';

/**
 * A metric may be charted ONLY when it is genuinely measurable with a numeric value
 * (or an explicit numeric breakdown). Suppressed / NOT_AVAILABLE / null-value metrics
 * must render an honest empty-state, never a zero-filled or fabricated chart.
 */
export function isChartable(m: { availability?: string; value?: number | null; breakdown?: Record<string, unknown> | null } | null | undefined): boolean {
  if (!m) return false;
  if (m.availability !== 'MEASURABLE' && m.availability !== 'PARTIAL') return false;
  const hasValue = typeof m.value === 'number' && Number.isFinite(m.value);
  const hasBreakdown = !!m.breakdown && Object.keys(m.breakdown).length > 0;
  return hasValue || hasBreakdown;
}

/** Turn a numeric breakdown into recharts-friendly rows, ONLY when chartable. */
export function breakdownToChartData(m: { availability?: string; breakdown?: Record<string, number | string> | null } | null | undefined): { name: string; value: number }[] {
  if (!isChartable(m) || !m?.breakdown) return [];
  const out: { name: string; value: number }[] = [];
  for (const [k, v] of Object.entries(m.breakdown)) {
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isFinite(n)) out.push({ name: k, value: n });
  }
  return out;
}

// ─── Injection-safe CSV export of the governed (already-suppressed) values ──────

/** Escape a CSV cell; neutralise spreadsheet formula injection (=,+,-,@, tab, CR). */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;            // formula-injection guard
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export interface GovernedMetricRow {
  id: string; name: string; availability: string; display: string;
  provenance?: string; value?: number | null; ratio?: number | null;
}
export interface GovernedExportInput {
  casinoId: string;
  financialPeriod: string;            // B1 scope
  currency: string;
  financialStatus: string;
  reconciliation: string;
  containsSyntheticData: boolean;
  b1Metrics: GovernedMetricRow[];
  b2Metrics: GovernedMetricRow[];
  b2ObservationWindow: string;        // 'ALL_RECORDED'
  metricsVersionB1: string;
  metricsVersionB2: string;
  generatedAt: string;
}

/**
 * Build the governed CSV. Every row carries casino scope, the correct time-scope
 * (financial period for B1, ALL_RECORDED for B2), metric version, provenance,
 * availability/suppression, and reconciliation — and ONLY the already-suppressed
 * display values (never a raw or re-derived figure, never a player identifier).
 */
export function buildGovernedCsv(input: GovernedExportInput): string {
  const header = ['section', 'metric_id', 'metric_name', 'time_scope', 'availability', 'value_display', 'provenance', 'casino_id', 'metrics_version', 'reconciliation', 'currency', 'contains_synthetic_data', 'generated_at'];
  const rows: string[][] = [header];
  const synth = input.containsSyntheticData ? 'true' : 'false';
  for (const m of input.b1Metrics) {
    rows.push(['B1_FINANCIAL_RG', m.id, m.name, input.financialPeriod, m.availability, m.display, m.provenance ?? '', input.casinoId, input.metricsVersionB1, input.reconciliation, input.currency, synth, input.generatedAt]);
  }
  for (const m of input.b2Metrics) {
    rows.push(['B2_INTERVENTION_OUTCOMES', m.id, m.name, input.b2ObservationWindow, m.availability, m.display, m.provenance ?? '', input.casinoId, input.metricsVersionB2, 'n/a', '', synth, input.generatedAt]);
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}
