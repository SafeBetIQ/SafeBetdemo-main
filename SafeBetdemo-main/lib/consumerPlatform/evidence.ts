// ─── Certified Evidence API — shared framework ───────────────────────────────
//
// One framework for the four evidence domains (financial / session / player /
// machine). Pure functions only: envelope assembly, filter + pagination
// validation, aggregate reconciliation, and CSV-injection-safe export. The edge
// function performs the JWT-scoped DB reads and calls into here — no metric is
// recomputed, and aggregates are supplied by the certified projection.
//
// Security invariant: scope is derived from the verified JWT by the caller; the
// helpers here NEVER widen scope. `narrowCasinoScope` only permits a requested
// casino that equals the authorised casino.

export type EvidenceDomain = 'financial' | 'session' | 'player' | 'machine';
export const EVIDENCE_DOMAINS: EvidenceDomain[] = ['financial', 'session', 'player', 'machine'];

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;
export const MAX_EXPORT_ROWS = 5000;

export interface EvidenceScope { tenantId: string | null; operatorId: string | null; casinoId: string; }
export interface EvidenceSnapshot { snapshotAt: string; timezone: string; dataStatus: string; projectionLagSeconds: number; }
export interface EvidenceCheck { name: string; ok: boolean; expected: number; actual: number; detail: string; }
export interface EvidenceReconciliation { status: 'passed' | 'failed' | 'unavailable'; checks: EvidenceCheck[]; }
export interface EvidencePagination { page: number; pageSize: number; totalRecords: number; totalPages: number; }
export interface EvidenceEnvelope {
  scope: EvidenceScope;
  snapshot: EvidenceSnapshot;
  reconciliation: EvidenceReconciliation;
  filters: Record<string, unknown>;
  pagination: EvidencePagination;
  aggregates: Record<string, unknown>;
  records: Record<string, unknown>[];
  correlationId: string;
}

export class EvidenceError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) { super(message); this.name = 'EvidenceError'; this.status = status; }
}

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;

/** Validate + clamp pagination. Rejects an unbounded/oversized request. */
export function validatePagination(rawPage?: unknown, rawPageSize?: unknown): { page: number; pageSize: number; offset: number } {
  const page = Math.floor(num(rawPage ?? 1));
  const pageSize = Math.floor(num(rawPageSize ?? DEFAULT_PAGE_SIZE));
  if (page < 1) throw new EvidenceError('page must be >= 1');
  if (pageSize < 1) throw new EvidenceError('pageSize must be >= 1');
  if (pageSize > MAX_PAGE_SIZE) throw new EvidenceError(`pageSize exceeds maximum of ${MAX_PAGE_SIZE}`);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

/** Narrow-only casino scope: a requested casino may only equal the authorised one. */
export function narrowCasinoScope(authorisedCasinoId: string, requestedCasinoId: string | null | undefined): string {
  if (!requestedCasinoId || requestedCasinoId === authorisedCasinoId) return authorisedCasinoId;
  throw new EvidenceError('cross-casino access denied', 403);
}

/** Assemble the standard envelope. `totalRecords` is over the COMPLETE filtered set. */
export function buildEnvelope(input: {
  scope: EvidenceScope; snapshot: EvidenceSnapshot; reconciliation: EvidenceReconciliation;
  filters: Record<string, unknown>; page: number; pageSize: number; totalRecords: number;
  aggregates: Record<string, unknown>; records: Record<string, unknown>[]; correlationId: string;
}): EvidenceEnvelope {
  return {
    scope: input.scope, snapshot: input.snapshot, reconciliation: input.reconciliation,
    filters: input.filters,
    pagination: {
      page: input.page, pageSize: input.pageSize,
      totalRecords: input.totalRecords,
      totalPages: Math.max(0, Math.ceil(input.totalRecords / input.pageSize)),
    },
    aggregates: input.aggregates, records: input.records, correlationId: input.correlationId,
  };
}

// ─── Per-domain reconciliation (aggregates are certified; we only verify) ────
export function reconcileSession(a: Record<string, unknown>): EvidenceReconciliation {
  const sum = num(a.active_sessions) + num(a.idle_sessions) + num(a.stale_sessions);
  return finalise([check('open=active+idle+stale', num(a.open_sessions), sum)]);
}
export function reconcilePlayer(a: Record<string, unknown>): EvidenceReconciliation {
  const posture = num(a.players_active_now) + num(a.players_idle) + num(a.players_stale);
  const bands = num(a.risk_critical) + num(a.risk_high) + num(a.risk_medium) + num(a.risk_low) + num(a.risk_unclassified);
  return finalise([
    check('observed=active_now+idle+stale', num(a.active_players), posture),
    check('active=critical+high+medium+low+unclassified', num(a.active_players), bands),
  ]);
}
export function reconcileMachine(a: Record<string, unknown>): EvidenceReconciliation {
  const sum = num(a.machines_in_play) + num(a.machines_stale);
  return finalise([check('allocated=in_play+stale', num(a.active_machines), sum)]);
}
export function reconcileFinancial(a: Record<string, unknown>): EvidenceReconciliation {
  if (String(a.financial_data_status ?? 'unavailable') === 'unavailable') return { status: 'unavailable', checks: [] };
  const checks: EvidenceCheck[] = [
    check('ggr_today=stakes-winnings', num(a.stakes_today) - num(a.player_winnings_today), num(a.ggr_today)),
    check('synthetic+non_synthetic=total', num(a.financial_events_total), num(a.synthetic_event_count) + num(a.non_synthetic_event_count)),
  ];
  // Unsupported categories MUST be null (not zero).
  const nullOk = (a.voids_supported ? true : a.voided_bets_today == null)
    && (a.reversals_supported ? true : a.reversed_transactions_today == null);
  checks.push({ name: 'unsupported-values-null', ok: nullOk, expected: 0, actual: nullOk ? 0 : 1, detail: 'void/reversal null when unsupported' });
  return finalise(checks);
}

function check(name: string, expected: number, actual: number): EvidenceCheck {
  return { name, ok: Math.round(expected) === Math.round(actual), expected: Math.round(expected), actual: Math.round(actual), detail: name };
}
function finalise(checks: EvidenceCheck[]): EvidenceReconciliation {
  return { status: checks.every((c) => c.ok) ? 'passed' : 'failed', checks };
}

// ─── CSV export (formula-injection safe) ─────────────────────────────────────
/** Neutralise CSV formula injection: prefix a leading =,+,-,@,tab,CR with a quote. */
export function csvCell(value: unknown): string {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}
export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const head = columns.map(csvCell).join(',');
  const body = rows.map((r) => columns.map((c) => csvCell(r[c])).join(',')).join('\n');
  return body ? `${head}\n${body}` : head;
}
