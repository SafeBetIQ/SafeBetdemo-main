// ─── Federation Event Platform boundary (Milestone 4.3) ──────────────────────
//
// The certified (non-production) Event Platform boundary for hash-only federation
// contributions. It is AUTHORITATIVE for accepted contributions and performs the
// full validation pipeline (schema → auth/attribution → jurisdiction → SB-PLR →
// attribute policy → cryptographic version → idempotency → replay → sequence →
// privacy → persistence → audit). Accepted contributions are append-only and
// reconstructable; rejected/dead-letter records carry NO plaintext payload.
// Deny-by-default access. PILOT NON-PRODUCTION ONLY.

import type { JurisdictionCode } from '../types.ts';
import { isAttributeEnabled } from '../jurisdictionProfiles.ts';
import { HMAC_ALGORITHM, CANONICAL_FORMAT_VERSION, NORMALISATION_VERSION, CONTRIBUTION_SCHEMA_VERSION } from '../crypto/index.ts';
import { type SbPlrResolver, validateContributionSbPlr } from './identity.ts';
import {
  type FederationContributionEvent, type AcceptedContributionRecord, type RejectionRecord,
  type DeadLetterRecord, type DeadLetterClass, type RejectionReason,
  type ContributionAuditSink, type ContributionAuditAction,
  InMemoryContributionAuditSink, sealContributionAudit, ContributionRejected,
  validateEventSchema, contentKeyOf, PERMANENT_REJECTIONS, deepFreeze,
} from './model.ts';

// ── Access (deny-by-default) ─────────────────────────────────────────────────
export type ContributionPlane = 'contribution-service' | 'regulator' | 'operator' | 'casino-admin' | 'unauthenticated';
export interface ContributionServiceContext {
  plane: ContributionPlane;
  operatorId?: string;
  tenantId?: string;
  jurisdiction: JurisdictionCode | null;
  sovereignJurisdictions?: JurisdictionCode[];
}

export class ContributionAccessError extends Error {
  readonly code = 'access-denied';
  constructor(reason: string) { super(`access denied: ${reason}`); this.name = 'ContributionAccessError'; }
}

/** Transient (retryable) processing failure → dead-letter, not a permanent rejection. */
export class TransientProcessingError extends Error {
  readonly classification: DeadLetterClass;
  constructor(classification: DeadLetterClass, message: string) { super(message); this.name = 'TransientProcessingError'; this.classification = classification; }
}

export type SubmitResult =
  | { accepted: true; record: AcceptedContributionRecord; duplicate?: boolean }
  | { accepted: false; rejection: RejectionRecord }
  | { accepted: false; deadLetter: DeadLetterRecord };

export interface EventPlatformOptions {
  resolver: SbPlrResolver;
  verifyPepperVersion: (jurisdiction: JurisdictionCode, version: string) => boolean;
  isRevokedPepperVersion?: (jurisdiction: JurisdictionCode, version: string) => boolean;
  auditSink?: ContributionAuditSink;
  now?: () => string;
  maxRetries?: number;
  /** Test-only fault injection for dead-letter/retry validation (eventId → classification|null). */
  faultInjector?: (eventId: string) => DeadLetterClass | null;
}

export class FederationEventPlatform {
  private readonly resolver: SbPlrResolver;
  private readonly verifyPepperVersion: (j: JurisdictionCode, v: string) => boolean;
  private readonly isRevokedPepperVersion: (j: JurisdictionCode, v: string) => boolean;
  private readonly auditSink: ContributionAuditSink;
  private readonly now: () => string;
  private readonly maxRetries: number;
  private readonly faultInjector?: (eventId: string) => DeadLetterClass | null;

  private readonly accepted: AcceptedContributionRecord[] = [];
  private readonly acceptedById = new Map<string, AcceptedContributionRecord>();
  private readonly contentIndex = new Map<string, string>();       // contentKey → eventId
  private readonly seenEventIds = new Set<string>();
  private readonly seq = new Map<string, { last: number; seen: Set<number> }>();  // (operator|tenant) → seq state
  private readonly revocations = new Map<string, { reason: string; at: string }>(); // eventId → revocation
  private readonly deadLetters = new Map<string, DeadLetterRecord>();

  constructor(opts: EventPlatformOptions) {
    this.resolver = opts.resolver;
    this.verifyPepperVersion = opts.verifyPepperVersion;
    this.isRevokedPepperVersion = opts.isRevokedPepperVersion ?? (() => false);
    this.auditSink = opts.auditSink ?? new InMemoryContributionAuditSink();
    this.now = opts.now ?? (() => new Date().toISOString());
    this.maxRetries = opts.maxRetries ?? 3;
    this.faultInjector = opts.faultInjector;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  submit(ctx: ContributionServiceContext, event: Record<string, unknown>): SubmitResult {
    const eventId = typeof event.eventId === 'string' ? event.eventId : 'unknown';
    this.audit('contribution-received', eventId, null, null, null, null, 'received');
    try {
      this.assertSubmit(ctx);
      validateEventSchema(event);
      const ev = event as unknown as FederationContributionEvent;

      // Attribution: never inferred from the untrusted payload alone.
      if (ev.sourceOperatorId !== ctx.operatorId) throw new ContributionRejected('unauthorised-operator', 'event operator ≠ authenticated operator');
      if (ev.tenantId !== ctx.tenantId) throw new ContributionRejected('tenant-mismatch', 'event tenant ≠ authenticated tenant');
      if (ev.jurisdiction !== ctx.jurisdiction) throw new ContributionRejected('wrong-jurisdiction', 'event jurisdiction ≠ authenticated jurisdiction');

      // Cryptographic version.
      if (ev.hmacAlgorithm !== HMAC_ALGORITHM) throw new ContributionRejected('unsupported-algorithm', 'unsupported HMAC algorithm');
      if (ev.canonicalFormatVersion !== CANONICAL_FORMAT_VERSION) throw new ContributionRejected('unsupported-canonical-format', 'unsupported canonical format');
      if (ev.normalisationVersion !== NORMALISATION_VERSION) throw new ContributionRejected('unsupported-normalisation-version', 'unsupported normalisation version');
      if (ev.contributionSchemaVersion !== CONTRIBUTION_SCHEMA_VERSION) throw new ContributionRejected('unsupported-schema', 'unsupported contribution schema version');
      if (this.isRevokedPepperVersion(ev.jurisdiction, ev.pepperVersion)) throw new ContributionRejected('revoked-pepper-version', 'pepper version revoked');
      if (!this.verifyPepperVersion(ev.jurisdiction, ev.pepperVersion)) throw new ContributionRejected('unknown-pepper-version', 'pepper version not recognised');

      // SB-PLR (Identity Resolution) + attribute policy.
      validateContributionSbPlr(this.resolver, ev, { tenantId: ctx.tenantId!, operatorId: ctx.operatorId!, jurisdiction: ctx.jurisdiction! });
      if (!isAttributeEnabled(ev.jurisdiction, ev.attributeType)) throw new ContributionRejected('unsupported-attribute-type', `attribute '${ev.attributeType}' not enabled in ${ev.jurisdiction}`);
      if (ev.expiryAt && ev.expiryAt <= this.now()) throw new ContributionRejected('expired-contribution', 'contribution already expired');

      // Replay (same eventId) → return the original acceptance, no duplicate evidence.
      if (this.seenEventIds.has(ev.eventId)) {
        this.audit('replay-detected', ev.eventId, ev.jurisdiction, ev.tenantId, ev.sourceOperatorId, ev.sbPlr, 'replayed event id');
        const existing = this.acceptedById.get(ev.eventId);
        if (existing) return { accepted: true, record: existing, duplicate: true };
        throw new ContributionRejected('replay-detected', 'replayed event id with no authoritative acceptance');
      }
      // Content idempotency (same content, new eventId) → one authoritative contribution.
      const ck = contentKeyOf(ev);
      const priorId = this.contentIndex.get(ck);
      if (priorId) {
        this.seenEventIds.add(ev.eventId);
        this.audit('duplicate-detected', ev.eventId, ev.jurisdiction, ev.tenantId, ev.sourceOperatorId, ev.sbPlr, `content duplicate of ${priorId}`);
        return { accepted: true, record: this.acceptedById.get(priorId)!, duplicate: true };
      }

      // Sequence (per operator+tenant).
      this.checkSequence(ev);

      // Persistence (transient faults → dead-letter).
      const fault = this.faultInjector?.(ev.eventId);
      if (fault) throw new TransientProcessingError(fault, `transient ${fault}`);

      const at = this.now();
      const record: AcceptedContributionRecord = deepFreeze({
        eventId: ev.eventId, acceptedAt: at, tenantId: ev.tenantId, sourceOperatorId: ev.sourceOperatorId,
        jurisdiction: ev.jurisdiction, sbPlr: ev.sbPlr, attributeType: ev.attributeType, digest: ev.digest,
        contentKey: ck, pepperVersion: ev.pepperVersion, normalisationVersion: ev.normalisationVersion,
        canonicalFormatVersion: ev.canonicalFormatVersion, contributionSchemaVersion: ev.contributionSchemaVersion,
        sourceSequence: ev.sourceSequence ?? null, idempotencyKey: ev.idempotencyKey, expiryAt: ev.expiryAt ?? null,
        revoked: false, revokedReason: null, supersededByEventId: null,
        provenanceRef: `event:${ev.eventId}`, auditRef: `contrib-audit:${ev.eventId}`,
      });
      this.accepted.push(record);
      this.acceptedById.set(ev.eventId, record);
      this.contentIndex.set(ck, ev.eventId);
      this.seenEventIds.add(ev.eventId);
      this.deadLetters.delete(ev.eventId);                          // resolved if it was retried
      this.audit('contribution-accepted', ev.eventId, ev.jurisdiction, ev.tenantId, ev.sourceOperatorId, ev.sbPlr, 'accepted');
      return { accepted: true, record };
    } catch (e) {
      if (e instanceof ContributionRejected) return { accepted: false, rejection: this.reject(eventId, e, event) };
      if (e instanceof TransientProcessingError) return { accepted: false, deadLetter: this.deadLetter(eventId, e, event) };
      if (e instanceof ContributionAccessError) return { accepted: false, rejection: this.reject(eventId, new ContributionRejected('unauthenticated-source', e.message), event) };
      throw e;
    }
  }

  private checkSequence(ev: FederationContributionEvent): void {
    if (ev.sourceSequence === undefined || ev.sourceSequence === null) return;   // alt idempotency (content key) governs
    const k = `${ev.sourceOperatorId}|${ev.tenantId}`;
    const s = this.seq.get(k) ?? { last: 0, seen: new Set<number>() };
    if (s.seen.has(ev.sourceSequence)) throw new ContributionRejected('invalid-sequence', `duplicate source sequence ${ev.sourceSequence}`);
    if (ev.sourceSequence !== s.last + 1) this.audit('sequence-violation', ev.eventId, ev.jurisdiction, ev.tenantId, ev.sourceOperatorId, ev.sbPlr, `out-of-order/gap: got ${ev.sourceSequence}, last ${s.last}`);
    s.seen.add(ev.sourceSequence);
    s.last = Math.max(s.last, ev.sourceSequence);
    this.seq.set(k, s);
  }

  /** Approved connector-restart sequence reset (audited). */
  resetSequence(ctx: ContributionServiceContext, operatorId: string, tenantId: string): void {
    this.assertSubmit(ctx);
    this.seq.delete(`${operatorId}|${tenantId}`);
    this.audit('sequence-violation', null, ctx.jurisdiction, tenantId, operatorId, null, 'approved sequence reset');
  }

  // ── Revocation / expiry ─────────────────────────────────────────────────────
  revoke(ctx: ContributionServiceContext, eventId: string, reason: string): AcceptedContributionRecord {
    this.assertSubmit(ctx);
    const rec = this.acceptedById.get(eventId);
    if (!rec) throw new ContributionRejected('invalid-sbplr', 'no such accepted contribution');
    this.revocations.set(eventId, { reason, at: this.now() });      // original preserved; revocation appended
    this.audit('contribution-revoked', eventId, rec.jurisdiction, rec.tenantId, rec.sourceOperatorId, rec.sbPlr, reason);
    return rec;
  }

  isRevoked(eventId: string): boolean { return this.revocations.has(eventId); }

  // ── Dead-letter / retry ─────────────────────────────────────────────────────
  private deadLetter(eventId: string, e: TransientProcessingError, ev: Record<string, unknown>): DeadLetterRecord {
    const prior = this.deadLetters.get(eventId);
    const rec: DeadLetterRecord = deepFreeze({
      eventId, classification: e.classification, retryable: true,
      attempts: (prior?.attempts ?? 0) + 1, lastAttemptAt: this.now(), failureReason: e.message,
      jurisdiction: (ev.jurisdiction as JurisdictionCode) ?? null, tenantId: (ev.tenantId as string) ?? null,
      sourceOperatorId: (ev.sourceOperatorId as string) ?? null,
      resolution: ((prior?.attempts ?? 0) + 1) >= this.maxRetries ? 'exhausted' : 'open',
    });
    this.deadLetters.set(eventId, rec);
    this.audit(rec.resolution === 'exhausted' ? 'retry-exhausted' : 'retry-scheduled', eventId, rec.jurisdiction, rec.tenantId, rec.sourceOperatorId, null, `dead-letter ${e.classification}`);
    return rec;
  }

  deadLetterQueue(): DeadLetterRecord[] { return Array.from(this.deadLetters.values()); }

  // ── Reads (regulator/integrity) ─────────────────────────────────────────────
  acceptedContributions(ctx: ContributionServiceContext): AcceptedContributionRecord[] {
    this.assertRead(ctx);
    return this.accepted.map((r) => ({ ...r }));
  }

  auditTrail(): readonly ReturnType<ContributionAuditSink['list']>[number][] { return this.auditSink.list(); }

  // ── internals ───────────────────────────────────────────────────────────────
  private assertSubmit(ctx: ContributionServiceContext): void {
    if (!ctx || ctx.plane !== 'contribution-service') throw new ContributionAccessError(`plane '${ctx?.plane ?? 'none'}' may not submit contributions`);
    if (!ctx.operatorId || !ctx.tenantId || !ctx.jurisdiction) throw new ContributionAccessError('incomplete authenticated context');
  }

  private assertRead(ctx: ContributionServiceContext): void {
    // Deny-by-default: only a regulator or the authorised contribution service may read.
    // Operators / casino-admins / unauthenticated are excluded by this check.
    if (!ctx || (ctx.plane !== 'regulator' && ctx.plane !== 'contribution-service')) throw new ContributionAccessError('federation reads are regulator/service only');
  }

  private reject(eventId: string, e: ContributionRejected, ev: Record<string, unknown>): RejectionRecord {
    const rec: RejectionRecord = deepFreeze({
      eventId, rejectedAt: this.now(), reason: e.reason, permanent: PERMANENT_REJECTIONS.has(e.reason),
      jurisdiction: (ev.jurisdiction as JurisdictionCode) ?? null, tenantId: (ev.tenantId as string) ?? null,
      sourceOperatorId: (ev.sourceOperatorId as string) ?? null, detail: safeDetail(e.reason), auditRef: `contrib-audit:${eventId}`,
    });
    this.audit('contribution-rejected', eventId, rec.jurisdiction, rec.tenantId, rec.sourceOperatorId, null, e.reason);
    return rec;
  }

  private audit(action: ContributionAuditAction, eventId: string | null, jurisdiction: JurisdictionCode | null, tenantId: string | null, operatorId: string | null, sbPlr: string | null, detail: string): void {
    this.auditSink.append(sealContributionAudit({ at: this.now(), action, eventId, jurisdiction, tenantId, sourceOperatorId: operatorId, sbPlr, detail }));
  }
}

/** Safe external-facing detail (never leaks sensitive implementation specifics). */
function safeDetail(reason: RejectionReason): string { return `contribution rejected: ${reason}`; }
