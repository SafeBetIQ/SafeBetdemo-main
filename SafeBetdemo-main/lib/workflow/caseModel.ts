// ─── Workflow — case model helpers (pure) ────────────────────────────────────
//
// Pure functions: case numbering, SLA/due-date derivation, overdue detection.
// No I/O, no platform reads — deterministic given inputs.

import type { CaseType, Priority, CaseStatus } from './types.ts';

/** Short prefix per case type for human-readable case numbers. */
const TYPE_PREFIX: Record<CaseType, string> = {
  'high-risk-player': 'HRP',
  'rg-recommendation': 'RGR',
  'compliance-finding': 'CMP',
  'regulatory-investigation': 'REG',
  'manual': 'CAS',
};

/**
 * Human-readable, sortable case number: `<PREFIX>-<YEAR>-<seq6>`.
 * The sequence comes from a database sequence (monotonic) — this only formats.
 */
export function formatCaseNumber(caseType: CaseType, seq: number, now: Date = new Date()): string {
  const prefix = TYPE_PREFIX[caseType] ?? 'CAS';
  return `${prefix}-${now.getUTCFullYear()}-${String(seq).padStart(6, '0')}`;
}

/** Default SLA (hours to due) by priority. */
export const SLA_HOURS: Record<Priority, number> = {
  critical: 4,
  high: 24,
  medium: 72,
  low: 168,
};

/** Compute a due timestamp from the opening time and priority. */
export function computeDueAt(openedAt: string, priority: Priority): string {
  const opened = Date.parse(openedAt);
  const hours = SLA_HOURS[priority] ?? SLA_HOURS.medium;
  return new Date(opened + hours * 3_600_000).toISOString();
}

/** Terminal states carry no SLA obligation. */
export const TERMINAL_STATUSES: ReadonlySet<CaseStatus> = new Set<CaseStatus>(['resolved', 'closed', 'rejected']);

export function isTerminal(status: CaseStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/** Overdue = has a due date, is not terminal, and the due time has passed. */
export function isOverdue(dueAt: string | null, status: CaseStatus, now: Date = new Date()): boolean {
  if (!dueAt || isTerminal(status)) return false;
  return Date.parse(dueAt) < now.getTime();
}

/** Hours remaining until due (negative if overdue); null when no due date. */
export function hoursToDue(dueAt: string | null, now: Date = new Date()): number | null {
  if (!dueAt) return null;
  return Math.round(((Date.parse(dueAt) - now.getTime()) / 3_600_000) * 10) / 10;
}

/**
 * A recommended default priority for a case opened from Derived Intelligence.
 * This is a workflow triage convenience — it reads an ALREADY-COMPUTED
 * escalation level; it never computes risk. Absent intelligence → 'medium'.
 */
export function triagePriority(escalationLevel: string | null | undefined): Priority {
  switch ((escalationLevel ?? '').toLowerCase()) {
    case 'critical': return 'critical';
    case 'high': return 'high';
    case 'watch':
    case 'elevated':
    case 'medium': return 'medium';
    default: return 'low';
  }
}
