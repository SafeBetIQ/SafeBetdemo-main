// ─── SafeBet IQ — B9 Governed Intervention Recording (pure domain layer) ─────────
//
// Alert-derived recording of a REAL intervention. Occurrence/record only — no
// effectiveness/completion/clinical/enforcement/ranking. No free text, no standalone
// creation, no player search. The server derives casino/player (from the alert) + actor;
// the caller supplies only the governed operator fields + an Idempotency-Key header.
// No I/O here; the atomic SECURITY DEFINER function sbiq_b9_record_alert_intervention
// is the integrity authority (honest insert, audit, B6 link, fingerprinted idempotency).

export const B9_INTERVENTION_TYPES = [
  'manual_review', 'limit_setting', 'timeout', 'self_exclusion_referral', 'helpline_referral', 'counseling_referral',
] as const;
export type B9InterventionType = (typeof B9_INTERVENTION_TYPES)[number];

export const B9_OUTCOMES = ['accepted', 'declined', 'pending', 'successful', 'unsuccessful'] as const;
export type B9Outcome = (typeof B9_OUTCOMES)[number];

// Fields the server/DB/alert own — a caller may NEVER supply them (beyond the 4 accepted keys).
export const B9_FORBIDDEN_BODY_FIELDS: readonly string[] = [
  'casino_id', 'player_id', 'staff_id', 'actor', 'actor_id', 'role', 'user_id', 'user_role', 'source', 'channel',
  'intervention_date', 'created_at', 'timestamp', 'trigger_reason', 'action_taken', 'notes', 'message_content',
  'risk_score', 'auto_triggered', 'intervention_successful', 'dispatch_status', 'idempotency_key', 'b9_idempotency_key',
  'b9_request_fingerprint', 'id',
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function realCalendarDate(s: string): boolean {
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// Internal (not exported) to avoid a barrel name-clash with traceability.isUuid.
function isUuid(v: unknown): v is string { return typeof v === 'string' && UUID_RE.test(v); }

export type IdemParse = { ok: true; key: string } | { ok: false; code: string; error: string };
/** Idempotency-Key is a mandatory UUID request HEADER (never the body). */
export function parseIdempotencyKey(header: string | null | undefined): IdemParse {
  if (!header) return { ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', error: 'Idempotency-Key header is required' };
  if (!isUuid(header)) return { ok: false, code: 'IDEMPOTENCY_KEY_INVALID', error: 'Idempotency-Key must be a uuid' };
  return { ok: true, key: header };
}

export interface B9RecordFields {
  intervention_type: B9InterventionType;
  outcome: B9Outcome | null;
  follow_up_required: boolean;
  follow_up_date: string | null;
}
export type RecordBodyParse = { ok: true; fields: B9RecordFields } | { ok: false; code: string; error: string };

/** The ONLY accepted body keys are intervention_type, outcome?, follow_up_required, follow_up_date?. */
export function parseRecordBody(body: unknown): RecordBodyParse {
  if (!body || typeof body !== 'object') return { ok: false, code: 'BODY', error: 'request body is required' };
  const rec = body as Record<string, unknown>;
  for (const k of Object.keys(rec)) {
    if (['intervention_type', 'outcome', 'follow_up_required', 'follow_up_date'].includes(k)) continue;
    if (B9_FORBIDDEN_BODY_FIELDS.includes(k)) return { ok: false, code: 'FORBIDDEN_FIELD', error: `field not accepted from caller: ${k}` };
    return { ok: false, code: 'UNEXPECTED_FIELD', error: `unexpected field: ${k}` };
  }
  if (!B9_INTERVENTION_TYPES.includes(rec.intervention_type as B9InterventionType)) {
    return { ok: false, code: 'INTERVENTION_TYPE', error: 'intervention_type must be one of the six operator types' };
  }
  let outcome: B9Outcome | null = null;
  if (rec.outcome !== undefined && rec.outcome !== null) {
    if (!B9_OUTCOMES.includes(rec.outcome as B9Outcome)) return { ok: false, code: 'OUTCOME', error: 'invalid recorded intervention outcome' };
    outcome = rec.outcome as B9Outcome;
  }
  if (typeof rec.follow_up_required !== 'boolean') return { ok: false, code: 'FOLLOW_UP_REQUIRED', error: 'follow_up_required (boolean) is required' };
  let followUpDate: string | null = null;
  if (rec.follow_up_date !== undefined && rec.follow_up_date !== null) {
    if (typeof rec.follow_up_date !== 'string' || !DATE_RE.test(rec.follow_up_date)) return { ok: false, code: 'DATE_FORMAT', error: 'follow_up_date must be YYYY-MM-DD' };
    if (!realCalendarDate(rec.follow_up_date)) return { ok: false, code: 'DATE_INVALID', error: 'follow_up_date is not a valid calendar date' };
    followUpDate = rec.follow_up_date;
  }
  if (rec.follow_up_required !== true && followUpDate !== null) {
    return { ok: false, code: 'FOLLOW_UP_INCONSISTENT', error: 'follow_up_date requires follow_up_required=true' };
  }
  return { ok: true, fields: { intervention_type: rec.intervention_type as B9InterventionType, outcome, follow_up_required: rec.follow_up_required, follow_up_date: followUpDate } };
}

// RPC status → HTTP mapping.
export type B9Status = 'CREATED' | 'REPLAYED' | 'IDEMPOTENCY_CONFLICT' | 'NOT_FOUND';
export function httpForStatus(s: B9Status): { status: number; ok: boolean; code?: string } {
  switch (s) {
    case 'CREATED': return { status: 201, ok: true };
    case 'REPLAYED': return { status: 200, ok: true, code: 'REPLAYED' };
    case 'IDEMPOTENCY_CONFLICT': return { status: 409, ok: false, code: 'IDEMPOTENCY_CONFLICT' };
    case 'NOT_FOUND': return { status: 404, ok: false };
  }
}
