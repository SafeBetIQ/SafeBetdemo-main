// ─── Wagering & GGR — model (Milestone 4.5) ──────────────────────────────────
//
// SANDBOX / PILOT-PATH financial event contract + integer-minor-unit money (NO
// floating-point), currency handling, wager/settlement lifecycle, rejection
// taxonomy, idempotency, and a PII/amount-safe financial audit. All amounts are
// exact integer minor units (e.g. cents). NON-PRODUCTION synthetic data only; no
// real player / financial / production records.

import type { JurisdictionCode } from '../types.ts';

export const FINANCIAL_EVENT_SCHEMA_VERSION = 'fin-evt-1';
export const PROJECTION_VERSION = 'fin-proj-1';

/** Financial event categories (mapped to the certified Event Platform families). */
export const FINANCIAL_EVENT_TYPES = [
  'session-started', 'session-ended', 'wager-placed', 'wager-settled',
  'wager-voided', 'refund-recorded', 'financial-correction',
] as const;
export type FinancialEventType = (typeof FINANCIAL_EVENT_TYPES)[number];

export const SETTLEMENT_RESULTS = ['won', 'lost'] as const;
export type SettlementResult = (typeof SETTLEMENT_RESULTS)[number];

/** Wager lifecycle (certified transitions). */
export const WAGER_STATES = ['placed', 'won', 'lost', 'voided', 'refunded', 'corrected'] as const;
export type WagerState = (typeof WAGER_STATES)[number];
export const WAGER_TRANSITIONS: Record<WagerState, WagerState[]> = {
  placed: ['won', 'lost', 'voided', 'refunded'],
  won: ['voided', 'corrected'],
  lost: ['voided', 'corrected'],
  voided: [], refunded: [], corrected: [],
};
export function canWagerTransition(from: WagerState, to: WagerState): boolean { return WAGER_TRANSITIONS[from]?.includes(to) ?? false; }

/**
 * A financial event. Amounts are INTEGER MINOR UNITS (never float). Player
 * reference is the anonymous SB-PLR (never PII). One currency per event.
 */
export interface FinancialEvent {
  eventId: string;
  eventType: FinancialEventType;
  eventSchemaVersion: string;
  eventTimestamp: string;
  sourceOperatorId: string;
  tenantId: string;
  jurisdiction: JurisdictionCode;
  sbPlr: string;
  sessionId: string;
  wagerId?: string;
  product?: string;
  channel?: string;
  currency: string;               // ISO-4217 (sandbox uses one currency; see limitation)
  amountMinor?: number;           // integer minor units (stake / payout / refund)
  settlementResult?: SettlementResult;
  sourceSequence?: number;
  idempotencyKey: string;
  sourceSystemRef: string;
  correctionOfEventId?: string;
}

// ── GGR formula (documented; integer minor units) ────────────────────────────
// Turnover  = Σ stake(wager) over wagers with state ∈ {won, lost}   (void/refund excluded)
// WinsPaid  = Σ payout over settlements with result = won            (of non-void/refund wagers)
// GGR       = Turnover − WinsPaid
// Voids/refunds reverse the wager entirely (stake and any payout excluded).
// Currency: a single currency per operator; mixed currencies are NOT summed.
export const GGR_FORMULA = 'GGR = Σ stake(settled non-void/refund wagers) − Σ payout(won settlements); integer minor units';

// ── Rejection taxonomy ───────────────────────────────────────────────────────
export const FIN_REJECTIONS = [
  'unauthenticated-source', 'unauthorised-operator', 'tenant-mismatch', 'wrong-jurisdiction',
  'unsupported-schema', 'unknown-schema-field', 'invalid-currency', 'currency-mismatch',
  'invalid-amount', 'negative-amount', 'precision-error', 'invalid-session', 'cross-tenant-session',
  'session-player-mismatch', 'session-ended', 'invalid-wager', 'unknown-wager', 'duplicate-wager',
  'duplicate-event', 'replay-detected', 'invalid-transition', 'settle-unknown-wager', 'double-settlement',
  'refund-exceeds-eligible', 'reassign-denied', 'plaintext-pii-detected', 'invalid-sequence',
] as const;
export type FinRejection = (typeof FIN_REJECTIONS)[number];

export const PERMANENT_FIN_REJECTIONS: ReadonlySet<FinRejection> = new Set<FinRejection>(FIN_REJECTIONS.filter((r) => r !== 'invalid-session'));

export interface AcceptedFinancialEvent {
  eventId: string; acceptedAt: string; eventType: FinancialEventType;
  tenantId: string; sourceOperatorId: string; jurisdiction: JurisdictionCode; sbPlr: string;
  sessionId: string; wagerId: string | null; product: string | null; channel: string | null;
  currency: string; amountMinor: number | null; settlementResult: SettlementResult | null;
  sourceSequence: number | null; contentKey: string; provenanceRef: string; auditRef: string;
}

export interface FinRejectionRecord {
  eventId: string; rejectedAt: string; reason: FinRejection; permanent: boolean;
  tenantId: string | null; sourceOperatorId: string | null; jurisdiction: JurisdictionCode | null;
  eventType: string | null; detail: string; auditRef: string;
}

// ── Access (deny-by-default) ─────────────────────────────────────────────────
export type FinancialPlane = 'financial-service' | 'regulator' | 'operator' | 'casino-admin' | 'unauthenticated';
export interface FinancialAccessContext {
  plane: FinancialPlane; operatorId?: string; tenantId?: string;
  jurisdiction: JurisdictionCode | null; sovereignJurisdictions?: JurisdictionCode[];
}
export class FinancialAccessError extends Error { readonly code = 'access-denied'; constructor(m: string) { super(`access denied: ${m}`); this.name = 'FinancialAccessError'; } }

// ── Financial audit (append-only; PII/amount-safe references only) ───────────
export const FIN_AUDIT_ACTIONS = ['event-received', 'event-accepted', 'event-rejected', 'duplicate-detected', 'replay-detected', 'projection-rebuilt', 'reconciliation-run', 'integrity-verified'] as const;
export type FinAuditAction = (typeof FIN_AUDIT_ACTIONS)[number];
export interface FinancialAuditRecord {
  auditId: string; at: string; action: FinAuditAction; eventId: string | null;
  tenantId: string | null; sourceOperatorId: string | null; jurisdiction: JurisdictionCode | null;
  eventType: string | null; detail: string;
}
let finAuditCounter = 0;
export function sealFinancialAudit(input: Omit<FinancialAuditRecord, 'auditId'> & Partial<Pick<FinancialAuditRecord, 'auditId'>>): FinancialAuditRecord {
  return deepFreeze({ ...input, auditId: input.auditId ?? `fin-audit-${++finAuditCounter}` }) as FinancialAuditRecord;
}
export interface FinancialAuditSink { append(r: FinancialAuditRecord): void; list(): readonly FinancialAuditRecord[]; count(): number; }
export class InMemoryFinancialAuditSink implements FinancialAuditSink {
  private readonly records: FinancialAuditRecord[] = [];
  append(r: FinancialAuditRecord): void { this.records.push(deepFreeze(r)); }
  list(): readonly FinancialAuditRecord[] { return Object.freeze(this.records.slice()); }
  count(): number { return this.records.length; }
}

// ── Validation helpers ───────────────────────────────────────────────────────
export class FinancialRejected extends Error { readonly reason: FinRejection; constructor(reason: FinRejection, detail: string) { super(`[${reason}] ${detail}`); this.name = 'FinancialRejected'; this.reason = reason; } }

export const ALLOWED_FIN_FIELDS: ReadonlySet<string> = new Set(['eventId', 'eventType', 'eventSchemaVersion', 'eventTimestamp', 'sourceOperatorId', 'tenantId', 'jurisdiction', 'sbPlr', 'sessionId', 'wagerId', 'product', 'channel', 'currency', 'amountMinor', 'settlementResult', 'sourceSequence', 'idempotencyKey', 'sourceSystemRef', 'correctionOfEventId']);
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const ISO4217 = /^[A-Z]{3}$/;

/** Strict schema + PII rejection + integer-precision + currency validation. Fails closed. */
export function validateFinancialSchema(raw: Record<string, unknown>): void {
  for (const k of Object.keys(raw)) if (!ALLOWED_FIN_FIELDS.has(k)) throw new FinancialRejected('unknown-schema-field', `unknown field '${k}'`);
  for (const k of ['eventId', 'eventType', 'eventSchemaVersion', 'eventTimestamp', 'sourceOperatorId', 'tenantId', 'jurisdiction', 'sbPlr', 'sessionId', 'currency', 'idempotencyKey', 'sourceSystemRef']) {
    if (raw[k] === undefined || raw[k] === null || raw[k] === '') throw new FinancialRejected('unsupported-schema', `missing required field '${k}'`);
  }
  if (raw.eventSchemaVersion !== FINANCIAL_EVENT_SCHEMA_VERSION) throw new FinancialRejected('unsupported-schema', 'unsupported schema version');
  if (!(FINANCIAL_EVENT_TYPES as readonly string[]).includes(raw.eventType as string)) throw new FinancialRejected('unsupported-schema', `unknown event type '${String(raw.eventType)}'`);
  if (typeof raw.currency !== 'string' || !ISO4217.test(raw.currency)) throw new FinancialRejected('invalid-currency', 'currency must be ISO-4217');
  if (raw.amountMinor !== undefined && raw.amountMinor !== null) {
    if (typeof raw.amountMinor !== 'number' || !Number.isInteger(raw.amountMinor)) throw new FinancialRejected('precision-error', 'amountMinor must be an integer (minor units)');
    if ((raw.amountMinor as number) < 0) throw new FinancialRejected('negative-amount', 'amountMinor must not be negative');
  }
  // PII leakage scan on identity/reference string fields (no plaintext).
  for (const k of ['sbPlr', 'sessionId', 'wagerId', 'sourceSystemRef', 'product', 'channel']) {
    const v = raw[k];
    if (typeof v === 'string' && EMAIL.test(v)) throw new FinancialRejected('plaintext-pii-detected', `field '${k}' looks like plaintext PII`);
  }
}

const US = '␟';
export function finContentKey(e: Pick<FinancialEvent, 'tenantId' | 'eventType' | 'sessionId' | 'wagerId' | 'settlementResult'>): string {
  return [e.tenantId, e.eventType, e.sessionId, e.wagerId ?? '', e.settlementResult ?? ''].join(US);
}

export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o as object)) deepFreeze((o as Record<string, unknown>)[k]);
  }
  return o;
}
