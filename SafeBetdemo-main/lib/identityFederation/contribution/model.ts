// ─── Operator Federation Contribution — model (Milestone 4.3) ────────────────
//
// The hash-only federation contribution EVENT contract + strict runtime
// validation (schema + PII-leakage rejection + digest/version checks), the
// accepted / rejected / dead-letter records, the content-idempotency key, the
// append-only secret-free contribution audit, and the rejection-reason taxonomy.
//
// The Event Platform is authoritative for accepted contributions. NO plaintext
// PII, raw pepper, or secret ever appears in an event, record, audit, or
// dead-letter entry. PILOT NON-PRODUCTION ONLY.

import type { JurisdictionCode, AttributeType } from '../types.ts';

export const FEDERATION_CONTRIBUTION_EVENT_TYPE = 'IDENTITY_FEDERATION_ATTRIBUTE';
export const EVENT_SCHEMA_VERSION = 'evt-1';
export const MAX_EVENT_BYTES = 4096;

/** The hash-only federation contribution event (append-only, jurisdiction-bound). */
export interface FederationContributionEvent {
  eventId: string;
  eventType: typeof FEDERATION_CONTRIBUTION_EVENT_TYPE;
  eventSchemaVersion: string;
  eventTimestamp: string;
  sourceOperatorId: string;
  tenantId: string;
  jurisdiction: JurisdictionCode;
  sbPlr: string;
  attributeType: AttributeType;
  digest: string;                       // HMAC-SHA-256 hex (64) — never a plaintext value
  hmacAlgorithm: string;
  pepperVersion: string;
  normalisationVersion: string;
  canonicalFormatVersion: string;
  contributionSchemaVersion: string;
  sourceSystemRef: string;
  sourceSequence?: number;
  idempotencyKey: string;               // operator-supplied; server derives the authoritative key
  traceId?: string;
  expiryAt?: string | null;
  supersedesEventId?: string | null;
  revokesEventId?: string | null;
}

/** The exact permitted event field set (unknown fields are rejected at runtime). */
export const ALLOWED_EVENT_FIELDS: ReadonlySet<string> = new Set([
  'eventId', 'eventType', 'eventSchemaVersion', 'eventTimestamp', 'sourceOperatorId', 'tenantId',
  'jurisdiction', 'sbPlr', 'attributeType', 'digest', 'hmacAlgorithm', 'pepperVersion',
  'normalisationVersion', 'canonicalFormatVersion', 'contributionSchemaVersion', 'sourceSystemRef',
  'sourceSequence', 'idempotencyKey', 'traceId', 'expiryAt', 'supersedesEventId', 'revokesEventId',
]);

export const REJECTION_REASONS = [
  'unauthenticated-source', 'unauthorised-operator', 'invalid-tenant', 'tenant-mismatch',
  'wrong-jurisdiction', 'invalid-sbplr', 'cross-tenant-sbplr', 'unsupported-attribute-type',
  'invalid-digest', 'unsupported-algorithm', 'unknown-pepper-version', 'revoked-pepper-version',
  'unsupported-canonical-format', 'unsupported-normalisation-version', 'unsupported-schema',
  'duplicate-event', 'content-duplicate', 'replay-detected', 'invalid-sequence',
  'expired-contribution', 'plaintext-pii-detected', 'unknown-schema-field', 'payload-too-large',
  'missing-version-metadata', 'persistence-failure', 'projector-failure',
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

/** Rejection reasons that are PERMANENT (never retried). */
export const PERMANENT_REJECTIONS: ReadonlySet<RejectionReason> = new Set<RejectionReason>([
  'unauthenticated-source', 'unauthorised-operator', 'invalid-tenant', 'tenant-mismatch',
  'wrong-jurisdiction', 'invalid-sbplr', 'cross-tenant-sbplr', 'unsupported-attribute-type',
  'invalid-digest', 'unsupported-algorithm', 'unknown-pepper-version', 'revoked-pepper-version',
  'unsupported-canonical-format', 'unsupported-normalisation-version', 'unsupported-schema',
  'invalid-sequence', 'expired-contribution', 'plaintext-pii-detected', 'unknown-schema-field',
  'payload-too-large', 'missing-version-metadata',
]);

export interface AcceptedContributionRecord {
  eventId: string;
  acceptedAt: string;
  tenantId: string;
  sourceOperatorId: string;
  jurisdiction: JurisdictionCode;
  sbPlr: string;
  attributeType: AttributeType;
  digest: string;
  contentKey: string;
  pepperVersion: string;
  normalisationVersion: string;
  canonicalFormatVersion: string;
  contributionSchemaVersion: string;
  sourceSequence: number | null;
  idempotencyKey: string;
  expiryAt: string | null;
  revoked: boolean;
  revokedReason: string | null;
  supersededByEventId: string | null;
  provenanceRef: string;
  auditRef: string;
}

export interface RejectionRecord {
  eventId: string;
  rejectedAt: string;
  reason: RejectionReason;
  permanent: boolean;
  jurisdiction: JurisdictionCode | null;
  tenantId: string | null;
  sourceOperatorId: string | null;
  detail: string;                       // safe; no sensitive data
  auditRef: string;
}

export const DEADLETTER_CLASSES = ['permanently-rejected', 'retryable-persistence', 'retryable-projector', 'config-unavailable', 'crypto-version-unavailable', 'identity-resolution-unavailable'] as const;
export type DeadLetterClass = (typeof DEADLETTER_CLASSES)[number];

export interface DeadLetterRecord {
  eventId: string;
  classification: DeadLetterClass;
  retryable: boolean;
  attempts: number;
  lastAttemptAt: string;
  failureReason: string;                // safe
  jurisdiction: JurisdictionCode | null;
  tenantId: string | null;
  sourceOperatorId: string | null;
  resolution: 'open' | 'resolved' | 'exhausted';
  // NOTE: NO plaintext payload is ever stored here.
}

// ── Contribution audit (append-only, secret-free) ────────────────────────────
export const CONTRIBUTION_AUDIT_ACTIONS = [
  'contribution-received', 'contribution-accepted', 'contribution-rejected', 'duplicate-detected',
  'replay-detected', 'sequence-violation', 'projection-completed', 'projection-failed',
  'matching-handoff-completed', 'contribution-expired', 'contribution-revoked', 'retry-scheduled',
  'retry-exhausted', 'dead-letter-resolved',
] as const;
export type ContributionAuditAction = (typeof CONTRIBUTION_AUDIT_ACTIONS)[number];

export interface ContributionAuditRecord {
  auditId: string;
  at: string;
  action: ContributionAuditAction;
  eventId: string | null;
  jurisdiction: JurisdictionCode | null;
  tenantId: string | null;
  sourceOperatorId: string | null;
  sbPlr: string | null;
  detail: string;
}

let contribAuditCounter = 0;
export function sealContributionAudit(input: Omit<ContributionAuditRecord, 'auditId'> & Partial<Pick<ContributionAuditRecord, 'auditId'>>): ContributionAuditRecord {
  return deepFreeze({ ...input, auditId: input.auditId ?? `contrib-audit-${++contribAuditCounter}` }) as ContributionAuditRecord;
}

export interface ContributionAuditSink {
  append(record: ContributionAuditRecord): void;
  list(): readonly ContributionAuditRecord[];
  count(): number;
}
export class InMemoryContributionAuditSink implements ContributionAuditSink {
  private readonly records: ContributionAuditRecord[] = [];
  append(record: ContributionAuditRecord): void { this.records.push(deepFreeze(record)); }
  list(): readonly ContributionAuditRecord[] { return Object.freeze(this.records.slice()); }
  count(): number { return this.records.length; }
}

// ── Content idempotency key (server-derived; not operator-controlled) ────────
const US = '␟';
export function contentKeyOf(e: Pick<FederationContributionEvent, 'tenantId' | 'sbPlr' | 'attributeType' | 'pepperVersion' | 'digest'>): string {
  return [e.tenantId, e.sbPlr, e.attributeType, e.pepperVersion, e.digest].join(US);
}

// ── Validation error + helpers ───────────────────────────────────────────────
export class ContributionRejected extends Error {
  readonly reason: RejectionReason;
  constructor(reason: RejectionReason, detail: string) { super(`[${reason}] ${detail}`); this.name = 'ContributionRejected'; this.reason = reason; }
}

const HEX64 = /^[0-9a-f]{64}$/;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const LONG_DIGITS = /\d{7,}/;

/** Strict schema + runtime PII-leakage rejection. Fails closed (throws ContributionRejected). */
export function validateEventSchema(raw: Record<string, unknown>): void {
  // size
  if (JSON.stringify(raw).length > MAX_EVENT_BYTES) throw new ContributionRejected('payload-too-large', 'event exceeds maximum size');
  // unknown fields (disguised plaintext defence)
  for (const k of Object.keys(raw)) if (!ALLOWED_EVENT_FIELDS.has(k)) throw new ContributionRejected('unknown-schema-field', `unknown field '${k}'`);
  // required fields
  for (const k of ['eventId', 'eventType', 'eventSchemaVersion', 'eventTimestamp', 'sourceOperatorId', 'tenantId', 'jurisdiction', 'sbPlr', 'attributeType', 'digest', 'hmacAlgorithm', 'pepperVersion', 'normalisationVersion', 'canonicalFormatVersion', 'contributionSchemaVersion', 'sourceSystemRef', 'idempotencyKey']) {
    if (raw[k] === undefined || raw[k] === null || raw[k] === '') {
      if (['pepperVersion', 'normalisationVersion', 'canonicalFormatVersion', 'contributionSchemaVersion', 'hmacAlgorithm'].includes(k)) throw new ContributionRejected('missing-version-metadata', `missing ${k}`);
      throw new ContributionRejected('unsupported-schema', `missing required field '${k}'`);
    }
  }
  if (raw.eventType !== FEDERATION_CONTRIBUTION_EVENT_TYPE) throw new ContributionRejected('unsupported-schema', 'wrong event type');
  if (raw.eventSchemaVersion !== EVENT_SCHEMA_VERSION) throw new ContributionRejected('unsupported-schema', `unsupported schema version '${String(raw.eventSchemaVersion)}'`);
  // digest must be HMAC-SHA-256 hex (never a plaintext value)
  if (typeof raw.digest !== 'string' || !HEX64.test(raw.digest)) throw new ContributionRejected('invalid-digest', 'digest must be 64-char HMAC-SHA-256 hex');
  // PII leakage: no email / long-digit run in personal-risk string fields (digest excluded — it is hex)
  for (const k of ['sbPlr', 'sourceSystemRef', 'attributeType', 'sourceOperatorId', 'tenantId', 'traceId', 'idempotencyKey']) {
    const v = raw[k];
    if (typeof v === 'string' && (EMAIL.test(v) || LONG_DIGITS.test(v))) throw new ContributionRejected('plaintext-pii-detected', `field '${k}' looks like plaintext PII`);
  }
}

export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o as object)) deepFreeze((o as Record<string, unknown>)[k]);
  }
  return o;
}
