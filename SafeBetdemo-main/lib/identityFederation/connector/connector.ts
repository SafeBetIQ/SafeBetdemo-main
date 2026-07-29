// ─── Operator Connector (Milestone 4.4) ──────────────────────────────────────
//
// One controlled, vendor-neutral operator connector. It authenticates (bound to
// ONE operator/tenant/jurisdiction), reads synthetic source records, resolves the
// tenant-scoped SB-PLR, hashes approved attributes BEFORE the SafeBet IQ boundary
// (Phase 4.2), and submits hash-only contributions through the certified Event
// Platform (Phase 4.3). It is WRITE-ONLY w.r.t. federation and holds no handle to
// the Registry / Correlation / Policy — it cannot read federation data. It starts
// DISABLED; activation is explicit + audited. NON-PRODUCTION sandbox only.

import type { JurisdictionCode } from '../types.ts';
import { isAttributeEnabled } from '../jurisdictionProfiles.ts';
import { type FederationCryptoProvider } from '../crypto/index.ts';
import { type SbPlrResolver } from '../contribution/index.ts';
import { type FederationEventPlatform, type ContributionServiceContext } from '../contribution/index.ts';
import {
  type ConnectorConfig, type ConnectorState, type ConnectorCheckpoint, type ConnectorHealth,
  type SandboxSource, type CheckpointStore, type ConnectorAuthenticator, type ConnectorAuditSink,
  type ConnectorAuditAction, type ConnectorDeadLetter, type ConnectorReconciliationReport, type OperatorSourceRecord,
  InMemoryCheckpointStore, InMemoryConnectorAuditSink, sealConnectorAudit, canConnectorTransition, ConnectorError,
} from './model.ts';

/** Authorised platform/regulator context for governed connector administration. */
export interface ConnectorAdminContext { plane: 'regulator' | 'platform-admin'; actorRef: string; }

export interface OperatorConnectorOptions {
  config: ConnectorConfig;
  authenticator: ConnectorAuthenticator;
  credential: string;                     // presented at activation; validated, never stored on the connector
  source: SandboxSource;
  crypto: FederationCryptoProvider;
  resolver: SbPlrResolver;
  platform: FederationEventPlatform;
  checkpointStore?: CheckpointStore;
  auditSink?: ConnectorAuditSink;
  now?: () => string;
  datasetVersion?: string;
  circuitThreshold?: number;
}

export interface SyncSummary { processed: number; accepted: number; rejected: number; deduplicated: number; deadLettered: number; revoked: number; stopped: string | null; }

export class OperatorConnector {
  private readonly o: OperatorConnectorOptions;
  private readonly checkpointStore: CheckpointStore;
  private readonly auditSink: ConnectorAuditSink;
  private readonly now: () => string;
  private readonly datasetVersion: string;
  private readonly circuitThreshold: number;

  private state: ConnectorState = 'provisioned';
  private checkpoint: ConnectorCheckpoint;
  private circuitOpen = false;
  private rateLimited = false;
  private windowStart = 0;
  private windowCount = 0;
  private lastErrorCode: string | null = null;
  private lastReadAt: string | null = null;
  private lastSubmitAt: string | null = null;
  private lastAckAt: string | null = null;
  private readonly deadLetters = new Map<string, ConnectorDeadLetter>();
  private readonly seq = new Set<number>();
  // reconciliation counters
  private c = { discovered: 0, eligible: 0, excluded: 0, generated: 0, submitted: 0, accepted: 0, rejected: 0, deduplicated: 0, revoked: 0 };

  constructor(opts: OperatorConnectorOptions) {
    this.o = opts;
    this.checkpointStore = opts.checkpointStore ?? new InMemoryCheckpointStore();
    this.auditSink = opts.auditSink ?? new InMemoryConnectorAuditSink();
    this.now = opts.now ?? (() => new Date().toISOString());
    this.datasetVersion = opts.datasetVersion ?? 'sandbox-1';
    this.circuitThreshold = opts.circuitThreshold ?? 3;
    this.checkpoint = this.checkpointStore.get(opts.config.connectorId) ?? { cursor: 0, lastSourceSequence: null, lastSourceTimestamp: null, lastAcceptedEventId: null, connectorVersion: opts.config.connectorVersion, datasetVersion: this.datasetVersion };
    this.audit('connector-provisioned', null, null, 'provisioned (disabled)');
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  /** Validate authentication + bind identity, then activate (explicit). */
  activate(credentialOverride?: string): void {
    this.transition('validating', 'system');
    const binding = this.o.authenticator.validate(this.o.config.connectorId, credentialOverride ?? this.o.credential);
    if (binding.operatorId !== this.o.config.operatorId || binding.tenantId !== this.o.config.tenantId || binding.jurisdiction !== this.o.config.jurisdiction) {
      this.state = 'failed';
      throw new ConnectorError('binding-mismatch', 'auth binding does not match connector config');
    }
    this.audit('authentication-validated', null, null, 'authentication validated');
    this.transition('active', 'system');
    this.audit('connector-activated', null, null, 'connector activated');
  }

  suspend(ctx: ConnectorAdminContext): void { this.assertAdmin(ctx); this.transition('suspended', ctx.actorRef); this.audit('connector-suspended', null, null, `suspended by ${ctx.actorRef}`); }
  reactivate(ctx: ConnectorAdminContext, approvedReview: boolean): void {
    this.assertAdmin(ctx);
    if (!approvedReview) throw new ConnectorError('reactivation-not-approved', 'reactivation requires an approved review');
    this.transition('active', ctx.actorRef); this.audit('connector-reactivated', null, null, `reactivated by ${ctx.actorRef}`);
  }
  revoke(ctx: ConnectorAdminContext): void {
    this.assertAdmin(ctx); this.o.authenticator.revoke(this.o.config.connectorId); this.transition('revoked', ctx.actorRef);
    this.audit('connector-revoked', null, null, `revoked by ${ctx.actorRef}`);
  }
  retire(ctx: ConnectorAdminContext): void { this.assertAdmin(ctx); this.transition('retired', ctx.actorRef); this.audit('connector-retired', null, null, 'retired'); }

  // ── Sync ─────────────────────────────────────────────────────────────────────
  sync(): SyncSummary {
    if (this.state !== 'active' && this.state !== 'degraded') throw new ConnectorError('not-active', `connector is ${this.state}; cannot sync`);
    // re-validate auth every sync (fails closed on revoke/expiry)
    this.o.authenticator.validate(this.o.config.connectorId, this.o.credential);

    const summary: SyncSummary = { processed: 0, accepted: 0, rejected: 0, deduplicated: 0, deadLettered: 0, revoked: 0, stopped: null };
    const batch = this.o.source.read(this.checkpoint.cursor, this.o.config.rateLimit.maxBatch);
    this.c.discovered += batch.length;
    this.lastReadAt = this.now();

    for (const rec of batch) {
      if (this.rateWindowExceeded()) { this.rateLimited = true; summary.stopped = 'rate-limited'; break; }
      this.audit('source-record-read', rec.sourceRef, null, `read source ${rec.sourceRef}`);

      const outcome = this.processRecord(rec, summary);
      if (outcome === 'backpressure') { summary.stopped = 'backpressure'; break; }   // preserve checkpoint, do NOT advance

      // Advance checkpoint ONLY after safe processing.
      this.checkpoint = { cursor: this.checkpoint.cursor + 1, lastSourceSequence: rec.sourceSequence, lastSourceTimestamp: rec.sourceTimestamp, lastAcceptedEventId: this.checkpoint.lastAcceptedEventId, connectorVersion: this.o.config.connectorVersion, datasetVersion: this.datasetVersion };
      this.checkpointStore.set(this.o.config.connectorId, this.checkpoint);
      this.audit('checkpoint-advanced', rec.sourceRef, null, `checkpoint → ${this.checkpoint.cursor}`);
      summary.processed++;
    }
    return summary;
  }

  private processRecord(rec: OperatorSourceRecord, summary: SyncSummary): 'ok' | 'backpressure' {
    // Sequence controls (duplicate/out-of-order).
    if (this.seq.has(rec.sourceSequence)) { this.c.excluded++; this.audit('contribution-rejected', rec.sourceRef, null, `duplicate source sequence ${rec.sourceSequence}`); return 'ok'; }
    // Source correction / revocation.
    if (rec.status === 'revoked') { this.revokeContributionsFor(rec); summary.revoked++; this.c.revoked++; this.seq.add(rec.sourceSequence); return 'ok'; }
    if (rec.status === 'corrected' && rec.supersedesSourceRef) { this.audit('source-correction-processed', rec.sourceRef, null, `supersedes ${rec.supersedesSourceRef}`); }

    // SB-PLR resolution (tenant-scoped; never creates SB-PLR).
    const id = this.o.resolver.resolve(rec.sbPlr);
    if (!id || id.status !== 'active' || id.tenantId !== this.o.config.tenantId || id.operatorId !== this.o.config.operatorId || id.jurisdiction !== this.o.config.jurisdiction) {
      this.c.excluded++; this.c.rejected++; summary.rejected++;
      this.audit('contribution-rejected', rec.sourceRef, null, 'SB-PLR mapping invalid/cross-tenant');
      return 'ok';
    }
    this.audit('sbplr-resolved', rec.sourceRef, null, 'SB-PLR resolved');
    this.c.eligible++;

    const attrs = rec.attributes.filter((a) => this.o.config.supportedAttributes.includes(a.type) && isAttributeEnabled(this.o.config.jurisdiction, a.type));
    if (attrs.length === 0) { this.c.excluded++; return 'ok'; }

    for (const a of attrs) {
      // HASH-BEFORE-BOUNDARY: plaintext value stays local and is discarded after hashing.
      let digest, stamp;
      try { const h = this.o.crypto.hashAttribute(this.o.config.jurisdiction, a.type, a.value); digest = h.hash; stamp = h.stamp; }
      catch (e) { this.c.rejected++; summary.rejected++; this.lastErrorCode = (e as ConnectorError).code ?? 'crypto-error'; this.audit('contribution-rejected', rec.sourceRef, null, `hash failed: ${this.lastErrorCode}`); continue; }
      this.c.generated++; this.audit('contribution-generated', rec.sourceRef, null, `generated ${a.type} contribution`);

      const eventId = `${this.o.config.connectorId}:${rec.sourceRef}:${a.type}:${rec.sourceVersion}`;  // deterministic → idempotent
      const event = {
        eventId, eventType: 'IDENTITY_FEDERATION_ATTRIBUTE', eventSchemaVersion: 'evt-1', eventTimestamp: this.now(),
        sourceOperatorId: this.o.config.operatorId, tenantId: this.o.config.tenantId, jurisdiction: this.o.config.jurisdiction,
        sbPlr: rec.sbPlr, attributeType: a.type, digest, hmacAlgorithm: stamp.algorithm, pepperVersion: stamp.pepperVersion,
        normalisationVersion: stamp.normalisationVersion, canonicalFormatVersion: stamp.canonicalFormatVersion,
        contributionSchemaVersion: stamp.contributionSchemaVersion, sourceSystemRef: `src:${this.o.config.connectorId}:${rec.sourceRef}`,
        sourceSequence: rec.sourceSequence, idempotencyKey: eventId, traceId: `trace:${eventId}`,
      };
      const ctx: ContributionServiceContext = { plane: 'contribution-service', operatorId: this.o.config.operatorId, tenantId: this.o.config.tenantId, jurisdiction: this.o.config.jurisdiction };
      this.c.submitted++; this.lastSubmitAt = this.now(); this.windowCount++;
      this.audit('contribution-submitted', rec.sourceRef, eventId, 'submitted to Event Platform');
      const res = this.o.platform.submit(ctx, event);

      if (res.accepted) {
        this.lastAckAt = this.now(); this.checkpoint.lastAcceptedEventId = res.record.eventId;
        if (res.duplicate) { this.c.deduplicated++; summary.deduplicated++; } else { this.c.accepted++; summary.accepted++; }
        this.deadLetters.delete(eventId);
        this.audit('contribution-accepted', rec.sourceRef, eventId, res.duplicate ? 'accepted (duplicate)' : 'accepted');
        this.closeCircuit();
      } else if ('rejection' in res) {
        this.c.rejected++; summary.rejected++; this.lastErrorCode = res.rejection.reason;
        this.audit('contribution-rejected', rec.sourceRef, eventId, res.rejection.reason);
      } else {
        // transient dead-letter → connector retry/backpressure
        summary.deadLettered++; this.recordDeadLetter(rec, eventId, res.deadLetter.classification);
        if (this.openCircuit()) return 'backpressure';
      }
    }
    this.seq.add(rec.sourceSequence);
    return 'ok';
  }

  private revokeContributionsFor(rec: OperatorSourceRecord): void {
    const ctx: ContributionServiceContext = { plane: 'contribution-service', operatorId: this.o.config.operatorId, tenantId: this.o.config.tenantId, jurisdiction: this.o.config.jurisdiction };
    for (const a of rec.attributes) {
      const eventId = `${this.o.config.connectorId}:${rec.sourceRef}:${a.type}:${rec.sourceVersion}`;
      try { this.o.platform.revoke(ctx, eventId, 'source-record revoked'); } catch { /* nothing to revoke */ }
    }
    this.audit('source-correction-processed', rec.sourceRef, null, 'source revocation processed');
  }

  // ── Backpressure / rate / dead-letter ────────────────────────────────────────
  private rateWindowExceeded(): boolean {
    const t = Date.now();
    if (t - this.windowStart > this.o.config.rateLimit.windowMs) { this.windowStart = t; this.windowCount = 0; }
    return this.windowCount >= this.o.config.rateLimit.maxPerWindow;
  }
  private recordDeadLetter(rec: OperatorSourceRecord, eventId: string, category: string): void {
    const prior = this.deadLetters.get(eventId);
    const attempts = (prior?.attempts ?? 0) + 1;
    this.deadLetters.set(eventId, { connectorId: this.o.config.connectorId, operatorId: this.o.config.operatorId, tenantId: this.o.config.tenantId, jurisdiction: this.o.config.jurisdiction, sourceRef: rec.sourceRef, eventId, failureCategory: category, attempts, lastAttemptAt: this.now(), errorCode: category, resolution: attempts >= this.o.config.retryPolicy.maxRetries ? 'exhausted' : 'open' });
    this.audit(attempts >= this.o.config.retryPolicy.maxRetries ? 'dead-letter-created' : 'retry-scheduled', rec.sourceRef, eventId, `dead-letter ${category} (attempt ${attempts})`);
  }
  private openCircuit(): boolean {
    const open = Array.from(this.deadLetters.values()).filter((d) => d.resolution !== 'resolved').length;
    if (open >= this.circuitThreshold) { this.circuitOpen = true; if (this.state === 'active') { this.state = 'degraded'; this.audit('connector-degraded', null, null, 'circuit opened (backpressure)'); } return true; }
    return false;
  }
  private closeCircuit(): void { if (this.circuitOpen) { this.circuitOpen = false; if (this.state === 'degraded') this.state = 'active'; } }

  // ── Health + reconciliation ──────────────────────────────────────────────────
  health(): ConnectorHealth {
    const open = Array.from(this.deadLetters.values()).filter((d) => d.resolution === 'open').length;
    return {
      connectorId: this.o.config.connectorId, status: this.state, lastSuccessfulReadAt: this.lastReadAt,
      lastSubmissionAt: this.lastSubmitAt, lastAcknowledgementAt: this.lastAckAt, checkpointCursor: this.checkpoint.cursor,
      pendingRetries: open, deadLetters: this.deadLetters.size, rejections: this.c.rejected,
      authStatus: this.o.authenticator.status(this.o.config.connectorId), rateLimited: this.rateLimited, circuitOpen: this.circuitOpen, lastErrorCode: this.lastErrorCode,
    };
  }
  reconcile(): ConnectorReconciliationReport {
    const differences: string[] = [];
    const accountedSource = this.c.eligible + this.c.excluded + this.c.revoked;
    if (accountedSource !== this.c.discovered) differences.push(`discovered ${this.c.discovered} ≠ eligible+excluded+revoked ${accountedSource}`);
    const accountedContrib = this.c.accepted + this.c.deduplicated + this.c.rejected;
    if (this.c.submitted !== accountedContrib + Array.from(this.deadLetters.values()).filter((d) => d.resolution === 'open').length) {
      // submitted may exceed accounted by open dead-letters (awaiting retry)
      const openDl = Array.from(this.deadLetters.values()).filter((d) => d.resolution === 'open').length;
      if (this.c.submitted !== accountedContrib + openDl) differences.push(`submitted ${this.c.submitted} ≠ accepted+deduped+rejected+openDeadLetter`);
    }
    return {
      connectorId: this.o.config.connectorId, sourceDiscovered: this.c.discovered, sourceEligible: this.c.eligible, sourceExcluded: this.c.excluded,
      contributionsGenerated: this.c.generated, contributionsSubmitted: this.c.submitted, contributionsAccepted: this.c.accepted,
      contributionsRejected: this.c.rejected, contributionsDeduplicated: this.c.deduplicated, revoked: this.c.revoked,
      retryBacklog: Array.from(this.deadLetters.values()).filter((d) => d.resolution === 'open').length,
      deadLetterBacklog: Array.from(this.deadLetters.values()).filter((d) => d.resolution === 'exhausted').length,
      balanced: differences.length === 0, differences,
    };
  }

  deadLetterQueue(): ConnectorDeadLetter[] { return Array.from(this.deadLetters.values()); }
  currentCheckpoint(): ConnectorCheckpoint { return { ...this.checkpoint }; }
  status(): ConnectorState { return this.state; }
  auditTrail(): readonly ReturnType<ConnectorAuditSink['list']>[number][] { return this.auditSink.list(); }

  // ── internals ───────────────────────────────────────────────────────────────
  private transition(to: ConnectorState, actor: string): void {
    if (!canConnectorTransition(this.state, to)) throw new ConnectorError('invalid-transition', `connector ${this.state} → ${to} not permitted`);
    this.state = to; void actor;
  }
  private assertAdmin(ctx: ConnectorAdminContext): void {
    if (!ctx || (ctx.plane !== 'regulator' && ctx.plane !== 'platform-admin')) throw new ConnectorError('unauthorised', 'connector administration requires a regulator/platform-admin context');
  }
  private audit(action: ConnectorAuditAction, sourceRef: string | null, eventId: string | null, detail: string): void {
    this.auditSink.append(sealConnectorAudit({ at: this.now(), action, connectorId: this.o.config.connectorId, operatorId: this.o.config.operatorId, tenantId: this.o.config.tenantId, jurisdiction: this.o.config.jurisdiction, sourceRef, eventId, detail }));
  }
}
