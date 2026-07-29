// ─── Event Validation (Phase 3.2) ────────────────────────────────────────────
//
// Gatekeeper of the Enterprise Event Platform. Invalid events are REJECTED
// with the full list of violations — never silently repaired.
//
// Two checkpoints, matching the lifecycle:
//   • validateDraft    — structural checks before enrichment
//   • validateEnvelope — full integrity check on the enriched envelope,
//                        immediately before persistence
//
// Pure functions; no I/O, no state.

import { ENVELOPE_SCHEMA_VERSION, EVENT_TYPE_SET, type CasinoEventDraft, type CasinoEventEnvelope } from './envelope.ts';
import { isSafeBetId } from '../playerIdentity/index.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Max tolerated clock skew into the future (ms). */
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

export class EventValidationError extends Error {
  readonly violations: string[];
  constructor(stage: 'draft' | 'envelope', violations: string[]) {
    super(`event rejected at ${stage} validation: ${violations.join('; ')}`);
    this.name = 'EventValidationError';
    this.violations = violations;
  }
}

function checkTimestamp(value: unknown, field: string, violations: string[]): void {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    violations.push(`${field} must be an ISO-8601 timestamp`);
    return;
  }
  if (Date.parse(value) > Date.now() + MAX_FUTURE_SKEW_MS) {
    violations.push(`${field} is in the future beyond tolerated clock skew`);
  }
}

/** Structural validation of a producer submission. Throws on violation. */
export function validateDraft(draft: CasinoEventDraft, casinoId: string): void {
  const v: string[] = [];

  if (!draft || typeof draft !== 'object') {
    throw new EventValidationError('draft', ['event draft must be an object']);
  }
  if (!draft.eventType || !EVENT_TYPE_SET.has(draft.eventType)) {
    v.push(`eventType '${draft.eventType}' is not in the event vocabulary`);
  }
  checkTimestamp(draft.occurredAt, 'occurredAt', v);
  if (!UUID_PATTERN.test(casinoId)) {
    v.push('casinoId must be a UUID');
  }
  const hasId = typeof draft.safeBetPlayerId === 'string' && draft.safeBetPlayerId.length > 0;
  const hasRef = typeof draft.casinoPlayerRef === 'string' && draft.casinoPlayerRef.trim().length > 0;
  if (!hasId && !hasRef) {
    v.push('identity required: provide safeBetPlayerId or casinoPlayerRef');
  }
  if (hasId && !isSafeBetId(draft.safeBetPlayerId)) {
    v.push(`safeBetPlayerId '${draft.safeBetPlayerId}' is not a canonical SB-PLR id`);
  }
  if (draft.payload !== undefined && (typeof draft.payload !== 'object' || draft.payload === null || Array.isArray(draft.payload))) {
    v.push('payload must be a plain object when present');
  }

  if (v.length > 0) throw new EventValidationError('draft', v);
}

/** Full integrity validation of the enriched envelope. Throws on violation. */
export function validateEnvelope(e: CasinoEventEnvelope): void {
  const v: string[] = [];

  if (!UUID_PATTERN.test(e.eventId)) v.push('eventId must be a UUID');
  if (!e.correlationId) v.push('correlationId is required');
  if (!e.traceId) v.push('traceId is required');
  if (!UUID_PATTERN.test(e.tenantId)) v.push('tenantId must be a UUID');
  if (!UUID_PATTERN.test(e.casinoId)) v.push('casinoId must be a UUID');
  if (!e.jurisdiction) v.push('jurisdiction is required');
  if (!isSafeBetId(e.safeBetPlayerId)) v.push('safeBetPlayerId must be a canonical SB-PLR id');
  if (!e.producer) v.push('producer is required');
  if (e.schemaVersion !== ENVELOPE_SCHEMA_VERSION) v.push(`schemaVersion must be ${ENVELOPE_SCHEMA_VERSION}`);
  if (!EVENT_TYPE_SET.has(e.eventType)) v.push(`eventType '${e.eventType}' is not in the event vocabulary`);
  checkTimestamp(e.occurredAt, 'occurredAt', v);
  checkTimestamp(e.receivedAt, 'receivedAt', v);
  checkTimestamp(e.processedAt, 'processedAt', v);
  if (!Number.isInteger(e.replayNumber) || e.replayNumber < 0) v.push('replayNumber must be a non-negative integer');
  if (typeof e.payload !== 'object' || e.payload === null) v.push('payload must be an object');

  if (v.length > 0) throw new EventValidationError('envelope', v);
}
