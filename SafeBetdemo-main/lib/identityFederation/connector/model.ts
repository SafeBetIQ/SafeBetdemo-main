// ─── Operator Connector Sandbox — model, auth, source (Milestone 4.4) ────────
//
// A CONTROLLED, VENDOR-NEUTRAL operator connector for a NON-PRODUCTION sandbox.
// It reads approved synthetic operator records, resolves the operator's tenant-
// scoped SB-PLR, hashes approved attributes BEFORE the SafeBet IQ boundary (4.2
// crypto), and submits a validated hash-only contribution through the certified
// Event Platform (4.3). It is WRITE-ONLY w.r.t. federation contributions and
// cannot read any federation data. No production casino / credential / endpoint.

import type { JurisdictionCode, AttributeType } from '../types.ts';

// ── Lifecycle ────────────────────────────────────────────────────────────────
export const CONNECTOR_STATES = ['provisioned', 'validating', 'active', 'degraded', 'suspended', 'revoked', 'failed', 'retired'] as const;
export type ConnectorState = (typeof CONNECTOR_STATES)[number];

export const CONNECTOR_TRANSITIONS: Record<ConnectorState, ConnectorState[]> = {
  provisioned: ['validating', 'revoked', 'retired'],
  validating: ['active', 'failed', 'revoked', 'retired'],
  active: ['degraded', 'suspended', 'revoked', 'failed', 'retired'],
  degraded: ['active', 'suspended', 'revoked', 'failed', 'retired'],
  suspended: ['active', 'revoked', 'retired'],
  failed: ['validating', 'suspended', 'revoked', 'retired'],
  revoked: [],
  retired: [],
};
export function canConnectorTransition(from: ConnectorState, to: ConnectorState): boolean {
  return CONNECTOR_TRANSITIONS[from]?.includes(to) ?? false;
}

export class ConnectorError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(`[${code}] ${message}`); this.name = 'ConnectorError'; this.code = code; }
}

// ── Connector contract (no secrets exposed) ──────────────────────────────────
export interface RateLimit { maxBatch: number; maxPerWindow: number; windowMs: number; maxConcurrent: number; }
export interface RetryPolicy { maxRetries: number; baseDelayMs: number; }

export interface ConnectorConfig {
  connectorId: string;
  operatorId: string;
  tenantId: string;
  jurisdiction: JurisdictionCode;
  connectorVersion: string;
  sourceType: string;
  supportedAttributes: AttributeType[];
  rateLimit: RateLimit;
  retryPolicy: RetryPolicy;
}

export interface ConnectorCheckpoint {
  cursor: number;                 // last processed source index
  lastSourceSequence: number | null;
  lastSourceTimestamp: string | null;
  lastAcceptedEventId: string | null;
  connectorVersion: string;
  datasetVersion: string;
}

export interface ConnectorHealth {
  connectorId: string;
  status: ConnectorState;
  lastSuccessfulReadAt: string | null;
  lastSubmissionAt: string | null;
  lastAcknowledgementAt: string | null;
  checkpointCursor: number;
  pendingRetries: number;
  deadLetters: number;
  rejections: number;
  authStatus: 'valid' | 'revoked' | 'unknown';
  rateLimited: boolean;
  circuitOpen: boolean;
  lastErrorCode: string | null;
}

// ── Source data contract (operator side; plaintext stays in the sandbox) ─────
export const SOURCE_STATUSES = ['active', 'corrected', 'revoked'] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

/** A synthetic operator source record. Plaintext attribute VALUES never leave the connector. */
export interface OperatorSourceRecord {
  sourceRef: string;
  sourceSequence: number;
  sourceTimestamp: string;
  sourceVersion: string;
  status: SourceStatus;
  sbPlr: string;                  // the operator's tenant-scoped SB-PLR (system of record)
  attributes: { type: AttributeType; value: string }[];   // synthetic plaintext — hashed before boundary
  supersedesSourceRef?: string;
}

export interface SandboxSource {
  read(fromCursor: number, max: number): OperatorSourceRecord[];
  count(): number;
}

/** Deterministic in-memory sandbox source (non-production; synthetic). */
export class InMemorySandboxSource implements SandboxSource {
  private readonly records: OperatorSourceRecord[];
  constructor(records: OperatorSourceRecord[] = []) { this.records = records.map((r) => Object.freeze({ ...r, attributes: r.attributes.map((a) => ({ ...a })) })); }
  read(fromCursor: number, max: number): OperatorSourceRecord[] { return this.records.slice(fromCursor, fromCursor + max).map((r) => ({ ...r, attributes: r.attributes.map((a) => ({ ...a })) })); }
  count(): number { return this.records.length; }
}

// ── Connector authentication (runtime-private secrets; one operator/tenant) ──
export interface ConnectorIdentityBinding { operatorId: string; tenantId: string; jurisdiction: JurisdictionCode; expiresAt?: string | null; }

// NON-EXPORTED module WeakMap → connector secrets are runtime-inaccessible.
const SECRETS = new WeakMap<ConnectorAuthenticator, Map<string, string>>();
function secretsOf(a: ConnectorAuthenticator): Map<string, string> {
  const m = SECRETS.get(a);
  if (!m) throw new ConnectorError('detached', 'authenticator material unavailable');
  return m;
}

export class ConnectorAuthenticator {
  private readonly bindings = new Map<string, ConnectorIdentityBinding>();
  private readonly revoked = new Set<string>();
  private readonly now: () => string;
  constructor(now: () => string = () => new Date().toISOString()) { this.now = now; SECRETS.set(this, new Map<string, string>()); }

  /** Provision a connector credential bound to exactly one operator/tenant/jurisdiction. */
  provision(connectorId: string, binding: ConnectorIdentityBinding, secret: string): void {
    if (this.bindings.has(connectorId)) throw new ConnectorError('connector-exists', `connector ${connectorId} already provisioned`);
    if (!secret || secret.length < 8) throw new ConnectorError('weak-credential', 'credential too weak');
    this.bindings.set(connectorId, { ...binding });
    secretsOf(this).set(connectorId, secret);
  }

  /** Validate a presented credential; returns the bound identity or throws. Fails closed. */
  validate(connectorId: string, presentedSecret: string): ConnectorIdentityBinding {
    if (this.revoked.has(connectorId)) throw new ConnectorError('credential-revoked', 'connector credential revoked');
    const b = this.bindings.get(connectorId);
    if (!b) throw new ConnectorError('unknown-connector', 'unknown connector');
    if (b.expiresAt && b.expiresAt <= this.now()) throw new ConnectorError('credential-expired', 'connector credential expired');
    if (secretsOf(this).get(connectorId) !== presentedSecret) throw new ConnectorError('invalid-credential', 'invalid connector credential');
    return { ...b };
  }

  revoke(connectorId: string): void { this.revoked.add(connectorId); secretsOf(this).delete(connectorId); }
  isRevoked(connectorId: string): boolean { return this.revoked.has(connectorId); }
  status(connectorId: string): 'valid' | 'revoked' | 'unknown' { return this.revoked.has(connectorId) ? 'revoked' : (this.bindings.has(connectorId) ? 'valid' : 'unknown'); }
}

// ── Checkpoint store (durable-capable; in-memory pilot default) ──────────────
export interface CheckpointStore {
  get(connectorId: string): ConnectorCheckpoint | undefined;
  set(connectorId: string, checkpoint: ConnectorCheckpoint): void;
}
export class InMemoryCheckpointStore implements CheckpointStore {
  private readonly map = new Map<string, ConnectorCheckpoint>();
  get(connectorId: string): ConnectorCheckpoint | undefined { const c = this.map.get(connectorId); return c ? { ...c } : undefined; }
  set(connectorId: string, checkpoint: ConnectorCheckpoint): void { this.map.set(connectorId, { ...checkpoint }); }
}

// ── Connector audit (append-only, secret/PII-free) ───────────────────────────
export const CONNECTOR_AUDIT_ACTIONS = [
  'connector-provisioned', 'authentication-validated', 'connector-activated', 'source-record-read',
  'sbplr-resolved', 'contribution-generated', 'contribution-submitted', 'contribution-accepted',
  'contribution-rejected', 'checkpoint-advanced', 'retry-scheduled', 'dead-letter-created',
  'dead-letter-resolved', 'connector-degraded', 'connector-suspended', 'connector-reactivated',
  'connector-revoked', 'source-correction-processed', 'connector-retired',
] as const;
export type ConnectorAuditAction = (typeof CONNECTOR_AUDIT_ACTIONS)[number];

export interface ConnectorAuditRecord {
  auditId: string; at: string; action: ConnectorAuditAction;
  connectorId: string; operatorId: string | null; tenantId: string | null; jurisdiction: JurisdictionCode | null;
  sourceRef: string | null; eventId: string | null; detail: string;
}
let connAuditCounter = 0;
export function sealConnectorAudit(input: Omit<ConnectorAuditRecord, 'auditId'> & Partial<Pick<ConnectorAuditRecord, 'auditId'>>): ConnectorAuditRecord {
  return deepFreeze({ ...input, auditId: input.auditId ?? `conn-audit-${++connAuditCounter}` }) as ConnectorAuditRecord;
}
export interface ConnectorAuditSink { append(r: ConnectorAuditRecord): void; list(): readonly ConnectorAuditRecord[]; count(): number; }
export class InMemoryConnectorAuditSink implements ConnectorAuditSink {
  private readonly records: ConnectorAuditRecord[] = [];
  append(r: ConnectorAuditRecord): void { this.records.push(deepFreeze(r)); }
  list(): readonly ConnectorAuditRecord[] { return Object.freeze(this.records.slice()); }
  count(): number { return this.records.length; }
}

// ── Dead-letter + reconciliation ─────────────────────────────────────────────
export interface ConnectorDeadLetter {
  connectorId: string; operatorId: string; tenantId: string; jurisdiction: JurisdictionCode;
  sourceRef: string; eventId: string | null; failureCategory: string; attempts: number;
  lastAttemptAt: string; errorCode: string; resolution: 'open' | 'resolved' | 'exhausted';
  // NO raw source record / payload.
}

export interface ConnectorReconciliationReport {
  connectorId: string;
  sourceDiscovered: number; sourceEligible: number; sourceExcluded: number;
  contributionsGenerated: number; contributionsSubmitted: number; contributionsAccepted: number;
  contributionsRejected: number; contributionsDeduplicated: number;
  revoked: number; retryBacklog: number; deadLetterBacklog: number;
  balanced: boolean; differences: string[];
}

export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o as object)) deepFreeze((o as Record<string, unknown>)[k]);
  }
  return o;
}
