// ─── Connector translation + data quality (v1.1) ─────────────────────────────
//
// PURE adapter: (external record, mapping config) → CasinoEventDraft + friendly
// diagnostics. No business logic, no I/O. The Event Platform remains the
// authoritative validator; these diagnostics are a pre-flight to help casino
// administrators fix their feed before it reaches the platform.

import { EVENT_TYPE_SET, type CasinoEventDraft } from '../eventPlatform/index.ts';
import type {
  ConnectorContext, DataQualityDiagnostic, ExternalRecord,
  MappingConfig, TranslationResult,
} from './types.ts';

function get(record: ExternalRecord, field: string | undefined): unknown {
  if (!field) return undefined;
  // dotted paths for nested source records
  let cur: unknown = record;
  for (const seg of field.split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function str(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return undefined;
}

/** Normalise an external timestamp to an ISO-8601 string (or null if invalid). */
export function normalizeTimestamp(value: unknown, offsetMinutes?: number): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // epoch seconds (10 digits) vs millis (13 digits)
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const s = value.trim();
    const hasOffset = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s);
    if (hasOffset) {
      const t = Date.parse(s);
      return Number.isNaN(t) ? null : new Date(t).toISOString();
    }
    // Naive timestamp (no offset). Force deterministic UTC interpretation
    // regardless of the host timezone: a bare date-time is parsed as UTC, then
    // the configured fixed offset (if any) is applied to recover the true UTC.
    const isDateTime = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s);
    const t = Date.parse(isDateTime ? s.replace(' ', 'T') + 'Z' : s);
    if (Number.isNaN(t)) return null;
    if (offsetMinutes !== undefined) {
      return new Date(t - offsetMinutes * 60_000).toISOString();
    }
    return new Date(t).toISOString();
  }
  return null;
}

function normalizeMachineId(value: string | undefined, prefix?: string): string | undefined {
  if (!value) return undefined;
  if (!prefix) return value;
  return value.startsWith(prefix) ? value : `${prefix}${value}`;
}

/** Translate one external record. Returns a draft (or null) + diagnostics. */
export function translateRecord(
  record: ExternalRecord,
  config: MappingConfig,
  ctx: ConnectorContext = {},
): TranslationResult {
  const diagnostics: DataQualityDiagnostic[] = [];

  if (!record || typeof record !== 'object' || Array.isArray(record) || Object.keys(record).length === 0) {
    return { draft: null, diagnostics: [{ severity: 'error', code: 'EMPTY_RECORD', message: 'record is empty or not an object', hint: 'ensure the connector emits one object per event' }] };
  }

  // ── Event type: mapped source code, or a configured default ───────────────
  let eventType: string | undefined;
  const sourceType = str(get(record, config.fields.eventType));
  if (sourceType && config.eventTypeMap && sourceType in config.eventTypeMap) {
    eventType = config.eventTypeMap[sourceType];
  } else if (sourceType && EVENT_TYPE_SET.has(sourceType)) {
    eventType = sourceType; // already a SafeBet event type
  } else if (config.defaultEventType) {
    eventType = config.defaultEventType;
  }
  if (!eventType) {
    diagnostics.push(sourceType
      ? { severity: 'error', code: 'UNMAPPED_EVENT_TYPE', field: config.fields.eventType, message: `source event type '${sourceType}' has no mapping`, hint: `add '${sourceType}' to eventTypeMap or set defaultEventType` }
      : { severity: 'error', code: 'MISSING_EVENT_TYPE', message: 'no event type on the record and no defaultEventType', hint: 'map fields.eventType or set defaultEventType' });
  } else if (!EVENT_TYPE_SET.has(eventType)) {
    diagnostics.push({ severity: 'error', code: 'UNMAPPED_EVENT_TYPE', message: `mapped event type '${eventType}' is not in the SafeBet vocabulary`, hint: 'map to a valid SafeBet event type (see API_REFERENCE §4.1)' });
    eventType = undefined;
  }

  // ── Identity: an already-resolved SB-PLR id, or a raw casino reference ─────
  const safeBetPlayerId = str(get(record, config.fields.safeBetPlayerId));
  const casinoPlayerRef = str(get(record, config.fields.playerRef));
  if (!safeBetPlayerId && !casinoPlayerRef) {
    diagnostics.push({ severity: 'error', code: 'MISSING_IDENTITY', field: config.fields.playerRef ?? config.fields.safeBetPlayerId, message: 'no player reference on the record', hint: 'map fields.playerRef to the loyalty/account id (never PII)' });
  }

  // ── Timestamp ─────────────────────────────────────────────────────────────
  const rawTs = get(record, config.fields.occurredAt);
  const occurredAt = normalizeTimestamp(rawTs, config.offsetMinutes);
  if (occurredAt === null) {
    diagnostics.push(rawTs === undefined
      ? { severity: 'error', code: 'MISSING_TIMESTAMP', field: config.fields.occurredAt, message: 'no timestamp on the record', hint: 'map fields.occurredAt to the event time (ISO-8601 or epoch)' }
      : { severity: 'error', code: 'TIMESTAMP_ANOMALY', field: config.fields.occurredAt, message: `timestamp '${String(rawTs)}' is unparseable`, hint: 'emit ISO-8601 with offset, or epoch seconds/millis; set offsetMinutes for naive local times' });
  } else if (Date.parse(occurredAt) > Date.now() + 5 * 60_000) {
    diagnostics.push({ severity: 'warning', code: 'TIMESTAMP_ANOMALY', field: config.fields.occurredAt, message: 'timestamp is in the future', hint: 'check source clock/timezone; the Event Platform rejects >5min future skew' });
  }

  // ── Identifiers ───────────────────────────────────────────────────────────
  const sessionId = str(get(record, config.fields.sessionId)) ?? null;
  const rawMachine = str(get(record, config.fields.machineId)) ?? str(get(record, config.fields.tableId));
  const machineId = normalizeMachineId(rawMachine, config.machinePrefix) ?? null;
  if (machineId && ctx.knownMachineIds && !ctx.knownMachineIds.has(machineId)) {
    diagnostics.push({ severity: 'warning', code: 'UNKNOWN_MACHINE', field: config.fields.machineId, message: `machine '${machineId}' is not in the known-machine set`, hint: 'verify the machine mapping / floor registry' });
  }

  // ── Payload + metadata (pure field copy — NO calculation) ─────────────────
  const payload: Record<string, unknown> = {};
  for (const [src, key] of Object.entries(config.payload ?? {})) {
    const v = get(record, src);
    if (v !== undefined) payload[key] = v;
  }
  const metadata: Record<string, unknown> = {};
  for (const [src, key] of Object.entries(config.metadata ?? {})) {
    const v = get(record, src);
    if (v !== undefined) metadata[key] = v;
  }
  if (Object.keys(metadata).length > 0) payload.metadata = metadata;

  const idempotencyKey = str(get(record, config.idempotencyKeyField));

  const fatal = diagnostics.some(d => d.severity === 'error');
  if (fatal || !eventType || occurredAt === null) {
    return { draft: null, diagnostics };
  }

  const draft: CasinoEventDraft = {
    eventType,
    occurredAt,
    ...(safeBetPlayerId ? { safeBetPlayerId } : {}),
    ...(casinoPlayerRef ? { casinoPlayerRef } : {}),
    sessionId,
    machineId,
    ...(idempotencyKey ? { idempotencyKey } : {}),
    payload,
  };
  return { draft, diagnostics };
}

/** Translate a batch of records. */
export function translateBatch(
  records: ExternalRecord[],
  config: MappingConfig,
  ctx: ConnectorContext = {},
): { drafts: CasinoEventDraft[]; diagnostics: DataQualityDiagnostic[]; rejected: number } {
  const drafts: CasinoEventDraft[] = [];
  const diagnostics: DataQualityDiagnostic[] = [];
  let rejected = 0;
  for (const record of records) {
    const { draft, diagnostics: d } = translateRecord(record, config, ctx);
    diagnostics.push(...d);
    if (draft) drafts.push(draft);
    else rejected += 1;
  }
  return { drafts, diagnostics, rejected };
}
