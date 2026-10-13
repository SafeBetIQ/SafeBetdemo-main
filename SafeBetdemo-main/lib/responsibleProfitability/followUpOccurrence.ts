// ─── SafeBet IQ — B10 Governed Follow-Up Occurrence Recording (pure domain layer) ─
//
// Records the factual OCCURRENCE of a responsible-gambling follow-up against an existing
// intervention. Append-only, occurrence/record only. SEMANTIC FIREWALL: follow-up
// OCCURRENCE ≠ obligation COMPLETION ≠ intervention EFFECTIVENESS. No completion/closure/
// success/outcome/SLA field, no free text, no scheduling/requirement mutation.
//
// The caller supplies ONLY an Idempotency-Key header + { occurred_on }. The server derives
// casino/player (from the intervention) + actor; the atomic SECURITY DEFINER function
// sbiq_b10_record_follow_up_occurrence is the integrity authority. No I/O here.

import { sastToday } from './workload.ts';

// Fields the server/DB/intervention own — a caller may NEVER supply them (only occurred_on).
export const B10_FORBIDDEN_BODY_FIELDS: readonly string[] = [
  'casino_id', 'player_id', 'intervention_id', 'staff_id', 'actor', 'actor_id', 'role', 'user_id', 'user_role',
  'recorded_by', 'recorded_at', 'source', 'channel', 'scheduled_follow_up_date', 'follow_up_date', 'follow_up_required',
  'outcome', 'status', 'completed', 'completion', 'success', 'notes', 'message_content', 'reason', 'description',
  'risk_score', 'timing', 'timing_classification', 'idempotency_key', 'b10_idempotency_key', 'b10_request_fingerprint', 'id',
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function realCalendarDate(s: string): boolean {
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
// Internal (not exported) to avoid a barrel name-clash with the other RP isUuid helpers.
function b10IsUuid(v: unknown): v is string { return typeof v === 'string' && UUID_RE.test(v); }

export type IdemParse = { ok: true; key: string } | { ok: false; code: string; error: string };
/** Idempotency-Key is a mandatory UUID request HEADER (never the body). */
export function parseIdempotencyKey(header: string | null | undefined): IdemParse {
  if (!header) return { ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', error: 'Idempotency-Key header is required' };
  if (!b10IsUuid(header)) return { ok: false, code: 'IDEMPOTENCY_KEY_INVALID', error: 'Idempotency-Key must be a uuid' };
  return { ok: true, key: header };
}

export type OccurrenceBodyParse = { ok: true; occurredOn: string } | { ok: false; code: string; error: string };

/** The ONLY accepted body key is occurred_on (YYYY-MM-DD, SAST business date, not future). */
export function parseOccurrenceBody(body: unknown, today: string = sastToday()): OccurrenceBodyParse {
  if (!body || typeof body !== 'object') return { ok: false, code: 'BODY', error: 'request body is required' };
  const rec = body as Record<string, unknown>;
  for (const k of Object.keys(rec)) {
    if (k === 'occurred_on') continue;
    if (B10_FORBIDDEN_BODY_FIELDS.includes(k)) return { ok: false, code: 'FORBIDDEN_FIELD', error: `field not accepted from caller: ${k}` };
    return { ok: false, code: 'UNEXPECTED_FIELD', error: `unexpected field: ${k}` };
  }
  const v = rec.occurred_on;
  if (typeof v !== 'string' || !DATE_RE.test(v)) return { ok: false, code: 'DATE_FORMAT', error: 'occurred_on must be YYYY-MM-DD' };
  if (!realCalendarDate(v)) return { ok: false, code: 'DATE_INVALID', error: 'occurred_on is not a valid calendar date' };
  if (v > today) return { ok: false, code: 'DATE_FUTURE', error: 'occurred_on cannot be in the future' };   // lexical == chronological for ISO dates
  return { ok: true, occurredOn: v };
}

// ── Timing classification (DERIVED, never stored): factual date comparison only ──────
export type TimingClassification = 'NOT_APPLICABLE' | 'EARLY' | 'ON_DATE' | 'LATE';
export function classifyTiming(scheduledFollowUpDate: string | null, occurredOn: string): TimingClassification {
  if (!scheduledFollowUpDate) return 'NOT_APPLICABLE';
  if (occurredOn < scheduledFollowUpDate) return 'EARLY';
  if (occurredOn > scheduledFollowUpDate) return 'LATE';
  return 'ON_DATE';
}

// ── RPC status → HTTP mapping ────────────────────────────────────────────────────────
export type B10Status = 'CREATED' | 'REPLAYED' | 'IDEMPOTENCY_CONFLICT' | 'INVALID_STATE' | 'NOT_FOUND';
export const B10_STATUSES: readonly B10Status[] = ['CREATED', 'REPLAYED', 'IDEMPOTENCY_CONFLICT', 'INVALID_STATE', 'NOT_FOUND'];
export function httpForStatus(s: B10Status): { status: number; ok: boolean; code?: string } {
  switch (s) {
    case 'CREATED': return { status: 201, ok: true };
    case 'REPLAYED': return { status: 200, ok: true, code: 'REPLAYED' };
    case 'IDEMPOTENCY_CONFLICT': return { status: 409, ok: false, code: 'IDEMPOTENCY_CONFLICT' };
    case 'INVALID_STATE': return { status: 409, ok: false, code: 'INVALID_STATE' };   // ineligible / out-of-bounds occurred_on
    case 'NOT_FOUND': return { status: 404, ok: false };
  }
}

// ── Safe GET-history DTO ───────────────────────────────────────────────────────────
export interface FollowUpOccurrenceRow {
  id: string;
  occurred_on: string;
  recorded_at: string;
  scheduled_follow_up_date: string | null;
}
export interface FollowUpOccurrenceDTO {
  occurrenceId: string;
  occurredOn: string;
  recordedAt: string;
  scheduledFollowUpDate: string | null;
  timingClassification: TimingClassification;
}
export const FOLLOW_UP_OCCURRENCE_LIST_LIMIT = 50;

export function mapOccurrenceRow(row: FollowUpOccurrenceRow): FollowUpOccurrenceDTO {
  return {
    occurrenceId: row.id,
    occurredOn: row.occurred_on,
    recordedAt: row.recorded_at,
    scheduledFollowUpDate: row.scheduled_follow_up_date ?? null,
    timingClassification: classifyTiming(row.scheduled_follow_up_date ?? null, row.occurred_on),
  };
}

// ── B7 additive period aggregate (factual occurrence activity; NOT completion) ────────
export interface FollowUpOccurrenceTiming { early: number; onDate: number; late: number; notApplicable: number }
export interface FollowUpPeriodActivity {
  followUpOccurrencesRecorded: number;
  followUpOccurrenceTiming: FollowUpOccurrenceTiming;
}
export function buildFollowUpPeriodActivity(
  rows: { scheduled_follow_up_date: string | null; occurred_on: string }[],
): FollowUpPeriodActivity {
  const timing: FollowUpOccurrenceTiming = { early: 0, onDate: 0, late: 0, notApplicable: 0 };
  for (const r of rows) {
    switch (classifyTiming(r.scheduled_follow_up_date ?? null, r.occurred_on)) {
      case 'EARLY': timing.early += 1; break;
      case 'ON_DATE': timing.onDate += 1; break;
      case 'LATE': timing.late += 1; break;
      default: timing.notApplicable += 1;
    }
  }
  return { followUpOccurrencesRecorded: rows.length, followUpOccurrenceTiming: timing };
}
