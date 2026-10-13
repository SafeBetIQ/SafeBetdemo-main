// ─── SafeBet IQ — B11 Follow-Up Requirement Closure (pure domain layer) ──────────
//
// Governs the one post-creation transition follow_up_required true→false (and
// follow_up_date→NULL). Means ONLY "no further follow-up is currently required" — NOT
// completion, effectiveness, recovery, risk reduction, case closure, SLA, or compliance.
// Append-only/one-way (no reopen). The caller supplies ONLY an Idempotency-Key header and
// an empty body. The atomic SECURITY DEFINER function sbiq_b11_close_follow_up_requirement
// is the integrity + durable-idempotency authority. No I/O here.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function b11IsUuid(v: unknown): v is string { return typeof v === 'string' && UUID_RE.test(v); }

export type IdemParse = { ok: true; key: string } | { ok: false; code: string; error: string };
/** Idempotency-Key is a mandatory UUID request HEADER (never the body). */
export function parseIdempotencyKey(header: string | null | undefined): IdemParse {
  if (!header) return { ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', error: 'Idempotency-Key header is required' };
  if (!b11IsUuid(header)) return { ok: false, code: 'IDEMPOTENCY_KEY_INVALID', error: 'Idempotency-Key must be a uuid' };
  return { ok: true, key: header };
}

export type EmptyBodyParse = { ok: true } | { ok: false; code: string; error: string };
/** B11 takes NO body fields. An absent body or {} is valid; anything with fields (or a
 *  non-object JSON type: array/string/number/boolean) is rejected. */
export function parseEmptyBody(body: unknown): EmptyBodyParse {
  if (body === null || body === undefined) return { ok: true };
  if (typeof body !== 'object' || Array.isArray(body)) return { ok: false, code: 'BODY', error: 'request body must be empty' };
  if (Object.keys(body as object).length > 0) return { ok: false, code: 'UNEXPECTED_FIELD', error: 'no fields are accepted' };
  return { ok: true };
}

// RPC status → HTTP mapping.
export type B11Status = 'CLOSED' | 'REPLAYED' | 'NOOP' | 'IDEMPOTENCY_CONFLICT' | 'NOT_FOUND';
export const B11_STATUSES: readonly B11Status[] = ['CLOSED', 'REPLAYED', 'NOOP', 'IDEMPOTENCY_CONFLICT', 'NOT_FOUND'];
export function httpForStatus(s: B11Status): { status: number; ok: boolean; code?: string } {
  switch (s) {
    case 'CLOSED': return { status: 200, ok: true };
    case 'REPLAYED': return { status: 200, ok: true, code: 'REPLAYED' };
    case 'NOOP': return { status: 200, ok: true, code: 'NOOP' };
    case 'IDEMPOTENCY_CONFLICT': return { status: 409, ok: false, code: 'IDEMPOTENCY_CONFLICT' };
    case 'NOT_FOUND': return { status: 404, ok: false };
  }
}
