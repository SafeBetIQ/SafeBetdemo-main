// ─── SafeBet IQ — B8 Follow-Up Scheduling (pure domain layer) ────────────────────
//
// Governed scheduling of follow_up_date on EXISTING interventions: SCHEDULE / RESCHEDULE
// / UNSCHEDULE only. No creation, no follow_up_required change, no completion, no
// effectiveness, no SLA. SAST (Africa/Johannesburg) business dates; past/today/future
// all allowed. No I/O here; the atomic DB function sbiq_b8_set_follow_up is the authority.

import { sastToday, classifyFollowUp, dayDiff } from './workload.ts';

export type FollowUpAction = 'SCHEDULE' | 'RESCHEDULE' | 'UNSCHEDULE';
export const FOLLOW_UP_LIST_LIMIT = 100;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function realCalendarDate(s: string): boolean {
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export type DateParse = { ok: true; date: string } | { ok: false; code: string; error: string };

/** Strict YYYY-MM-DD calendar date (past/today/future all allowed; no time, no tz). */
export function parseFollowUpDate(body: unknown): DateParse {
  if (!body || typeof body !== 'object') return { ok: false, code: 'BODY', error: 'request body is required' };
  const rec = body as Record<string, unknown>;
  for (const k of Object.keys(rec)) {
    if (k !== 'follow_up_date') return { ok: false, code: 'UNEXPECTED_FIELD', error: `unexpected field: ${k}` };
  }
  const v = rec.follow_up_date;
  if (typeof v !== 'string' || !DATE_RE.test(v)) return { ok: false, code: 'DATE_FORMAT', error: 'follow_up_date must be YYYY-MM-DD' };
  if (!realCalendarDate(v)) return { ok: false, code: 'DATE_INVALID', error: 'follow_up_date is not a valid calendar date' };
  return { ok: true, date: v };
}

/** Unschedule accepts only an empty body (no fields). */
export function parseEmptyBody(body: unknown): { ok: true } | { ok: false; code: string; error: string } {
  if (body === null || body === undefined) return { ok: true };
  if (typeof body !== 'object') return { ok: false, code: 'BODY', error: 'body must be empty' };
  if (Object.keys(body as object).length > 0) return { ok: false, code: 'UNEXPECTED_FIELD', error: 'no fields are accepted' };
  return { ok: true };
}

// ── Bounded follow-up list DTO (own-casino; follow_up_required=true only) ──────────
export type FollowUpState = 'UNSCHEDULED' | 'DUE_TODAY' | 'OVERDUE' | 'FUTURE';

export interface FollowUpRow {
  id: string;
  player_id: string;
  intervention_type: string | null;
  intervention_date: string | null;
  follow_up_date: string | null;
}
export interface FollowUpItemDTO {
  interventionId: string;
  opaquePlayerRef: string;           // last-8 of player_id — the governed B4.1 UI convention
  interventionType: string | null;
  interventionDate: string | null;
  followUpDate: string | null;
  followUpState: FollowUpState;
  daysOverdue: number | null;        // integer only for OVERDUE, else null
}

export function opaquePlayerRef(playerId: string): string {
  return `…${(playerId ?? '').slice(-8)}`;
}

export function toFollowUpState(followUpDate: string | null, today: string = sastToday()): FollowUpState {
  const c = classifyFollowUp({ follow_up_required: true, follow_up_date: followUpDate }, today);
  return c === 'overdue' ? 'OVERDUE' : c === 'due_today' ? 'DUE_TODAY' : c === 'future' ? 'FUTURE' : 'UNSCHEDULED';
}

export function mapFollowUpRow(row: FollowUpRow, today: string = sastToday()): FollowUpItemDTO {
  const state = toFollowUpState(row.follow_up_date, today);
  return {
    interventionId: row.id,
    opaquePlayerRef: opaquePlayerRef(row.player_id),
    interventionType: row.intervention_type ?? null,
    interventionDate: row.intervention_date ?? null,
    followUpDate: row.follow_up_date ?? null,
    followUpState: state,
    daysOverdue: state === 'OVERDUE' ? dayDiff(row.follow_up_date, today) : null,
  };
}

// Factual grouped ordering (NOT a priority/performance score):
// UNSCHEDULED, then OVERDUE (oldest due first), DUE_TODAY, FUTURE (earliest due first).
const STATE_RANK: Record<FollowUpState, number> = { UNSCHEDULED: 0, OVERDUE: 1, DUE_TODAY: 2, FUTURE: 3 };
export function orderFollowUps(items: FollowUpItemDTO[]): FollowUpItemDTO[] {
  return [...items].sort((a, b) => {
    if (STATE_RANK[a.followUpState] !== STATE_RANK[b.followUpState]) return STATE_RANK[a.followUpState] - STATE_RANK[b.followUpState];
    // within OVERDUE oldest-first / FUTURE earliest-first → both ascending by followUpDate; ties by id
    const ad = a.followUpDate ?? '', bd = b.followUpDate ?? '';
    if (ad !== bd) return ad < bd ? -1 : 1;
    return a.interventionId < b.interventionId ? -1 : a.interventionId > b.interventionId ? 1 : 0;
  });
}

// ── RPC result → HTTP mapping ─────────────────────────────────────────────────────
export type RpcResult = 'APPLIED' | 'NOOP' | 'INVALID_STATE' | 'NOT_FOUND';
export function httpForResult(r: RpcResult): { status: number; ok: boolean; code?: string } {
  switch (r) {
    case 'APPLIED': return { status: 200, ok: true };
    case 'NOOP': return { status: 200, ok: true, code: 'NOOP' };
    case 'INVALID_STATE': return { status: 409, ok: false, code: 'INVALID_STATE' };
    case 'NOT_FOUND': return { status: 404, ok: false };
  }
}
