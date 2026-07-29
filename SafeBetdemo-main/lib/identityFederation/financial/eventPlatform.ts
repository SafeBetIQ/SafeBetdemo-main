// ─── Financial Event Platform (Milestone 4.5) ────────────────────────────────
//
// The certified-boundary-shaped, AUTHORITATIVE financial Event Platform for the
// SANDBOX / PILOT-PATH. It validates session/wager/settlement integrity, currency
// + integer precision, idempotency/replay, and the wager lifecycle, then records
// APPEND-ONLY accepted events (the source of truth for projections). Rejected
// events remain visible (safe, no plaintext). Deny-by-default access. Derived
// totals are NEVER inserted here — they are projected. NON-PRODUCTION only.

import type { JurisdictionCode } from '../types.ts';
import {
  type FinancialEvent, type AcceptedFinancialEvent, type FinRejectionRecord, type FinRejection,
  type FinancialAccessContext, type FinancialAuditSink, type FinAuditAction,
  InMemoryFinancialAuditSink, sealFinancialAudit, FinancialRejected, FinancialAccessError,
  validateFinancialSchema, finContentKey, PERMANENT_FIN_REJECTIONS, canWagerTransition,
  type WagerState, deepFreeze,
} from './model.ts';

interface SessionState { tenantId: string; operatorId: string; sbPlr: string; jurisdiction: JurisdictionCode; currency: string; ended: boolean; }
interface WagerRec { state: WagerState; stakeMinor: number; payoutMinor: number; currency: string; tenantId: string; operatorId: string; sbPlr: string; sessionId: string; }

export interface FinancialSubmitResult {
  accepted: boolean;
  record?: AcceptedFinancialEvent;
  rejection?: FinRejectionRecord;
  duplicate?: boolean;
}

export interface FinancialEventPlatformOptions { auditSink?: FinancialAuditSink; now?: () => string; }

export class FinancialEventPlatform {
  private readonly auditSink: FinancialAuditSink;
  private readonly now: () => string;
  private readonly accepted: AcceptedFinancialEvent[] = [];
  private readonly seenEventIds = new Set<string>();
  private readonly contentIndex = new Map<string, string>();
  private readonly sessions = new Map<string, SessionState>();
  private readonly wagers = new Map<string, WagerRec>();
  private readonly operatorCurrency = new Map<string, string>();
  private readonly seq = new Map<string, Set<number>>();

  constructor(opts: FinancialEventPlatformOptions = {}) {
    this.auditSink = opts.auditSink ?? new InMemoryFinancialAuditSink();
    this.now = opts.now ?? (() => new Date().toISOString());
  }

  submit(ctx: FinancialAccessContext, event: Record<string, unknown>): FinancialSubmitResult {
    const eventId = typeof event.eventId === 'string' ? event.eventId : 'unknown';
    this.audit('event-received', eventId, null, null, null, null, 'received');
    try {
      this.assertSubmit(ctx);
      validateFinancialSchema(event);
      const ev = event as unknown as FinancialEvent;
      if (ev.sourceOperatorId !== ctx.operatorId) throw new FinancialRejected('unauthorised-operator', 'event operator ≠ authenticated');
      if (ev.tenantId !== ctx.tenantId) throw new FinancialRejected('tenant-mismatch', 'event tenant ≠ authenticated');
      if (ev.jurisdiction !== ctx.jurisdiction) throw new FinancialRejected('wrong-jurisdiction', 'event jurisdiction ≠ authenticated');

      // Currency consistency per operator.
      const opCur = this.operatorCurrency.get(ev.sourceOperatorId);
      if (opCur && opCur !== ev.currency) throw new FinancialRejected('currency-mismatch', `operator currency ${opCur} ≠ ${ev.currency}`);

      // Replay + idempotency.
      if (this.seenEventIds.has(ev.eventId)) { this.audit('replay-detected', ev.eventId, ev.tenantId, ev.sourceOperatorId, ev.jurisdiction, ev.eventType, 'replay'); return { accepted: true, record: this.findAccepted(ev.eventId)!, duplicate: true }; }
      const ck = finContentKey(ev);
      if (this.contentIndex.has(ck)) { this.seenEventIds.add(ev.eventId); this.audit('duplicate-detected', ev.eventId, ev.tenantId, ev.sourceOperatorId, ev.jurisdiction, ev.eventType, 'content duplicate'); return { accepted: true, record: this.findAccepted(this.contentIndex.get(ck)!)!, duplicate: true }; }

      // Sequence.
      if (ev.sourceSequence !== undefined) { const k = `${ev.sourceOperatorId}|${ev.tenantId}`; const s = this.seq.get(k) ?? new Set<number>(); if (s.has(ev.sourceSequence)) throw new FinancialRejected('invalid-sequence', 'duplicate source sequence'); s.add(ev.sourceSequence); this.seq.set(k, s); }

      // Domain integrity by type (mutates only after all checks pass).
      this.applyDomain(ev);

      this.operatorCurrency.set(ev.sourceOperatorId, ev.currency);
      const rec: AcceptedFinancialEvent = deepFreeze({
        eventId: ev.eventId, acceptedAt: this.now(), eventType: ev.eventType, tenantId: ev.tenantId,
        sourceOperatorId: ev.sourceOperatorId, jurisdiction: ev.jurisdiction, sbPlr: ev.sbPlr, sessionId: ev.sessionId,
        wagerId: ev.wagerId ?? null, product: ev.product ?? null, channel: ev.channel ?? null, currency: ev.currency,
        amountMinor: ev.amountMinor ?? null, settlementResult: ev.settlementResult ?? null, sourceSequence: ev.sourceSequence ?? null,
        contentKey: ck, provenanceRef: `fin-event:${ev.eventId}`, auditRef: `fin-audit:${ev.eventId}`,
      });
      this.accepted.push(rec); this.seenEventIds.add(ev.eventId); this.contentIndex.set(ck, ev.eventId);
      this.audit('event-accepted', ev.eventId, ev.tenantId, ev.sourceOperatorId, ev.jurisdiction, ev.eventType, 'accepted');
      return { accepted: true, record: rec };
    } catch (e) {
      if (e instanceof FinancialRejected) return { accepted: false, rejection: this.reject(eventId, e, event) };
      if (e instanceof FinancialAccessError) return { accepted: false, rejection: this.reject(eventId, new FinancialRejected('unauthenticated-source', e.message), event) };
      throw e;
    }
  }

  private applyDomain(ev: FinancialEvent): void {
    switch (ev.eventType) {
      case 'session-started': {
        this.sessions.set(ev.sessionId, { tenantId: ev.tenantId, operatorId: ev.sourceOperatorId, sbPlr: ev.sbPlr, jurisdiction: ev.jurisdiction, currency: ev.currency, ended: false });
        break;
      }
      case 'session-ended': { const s = this.requireSession(ev); s.ended = true; break; }
      case 'wager-placed': {
        this.requireOpenSession(ev);
        if (!ev.wagerId) throw new FinancialRejected('invalid-wager', 'wager-placed requires wagerId');
        if (this.wagers.has(ev.wagerId)) throw new FinancialRejected('duplicate-wager', 'wager already exists');
        if (ev.amountMinor === undefined || ev.amountMinor === null || ev.amountMinor <= 0) throw new FinancialRejected('invalid-amount', 'wager stake must be a positive integer');
        this.wagers.set(ev.wagerId, { state: 'placed', stakeMinor: ev.amountMinor, payoutMinor: 0, currency: ev.currency, tenantId: ev.tenantId, operatorId: ev.sourceOperatorId, sbPlr: ev.sbPlr, sessionId: ev.sessionId });
        break;
      }
      case 'wager-settled': {
        const w = this.requireWager(ev);
        if (!ev.settlementResult) throw new FinancialRejected('invalid-transition', 'settlement requires a result');
        if (!canWagerTransition(w.state, ev.settlementResult)) throw new FinancialRejected(w.state === 'won' || w.state === 'lost' ? 'double-settlement' : 'invalid-transition', `cannot settle a ${w.state} wager`);
        if (ev.settlementResult === 'won') { if (ev.amountMinor === undefined || ev.amountMinor === null || ev.amountMinor < 0) throw new FinancialRejected('invalid-amount', 'won settlement requires a payout ≥ 0'); w.payoutMinor = ev.amountMinor; }
        w.state = ev.settlementResult;
        break;
      }
      case 'wager-voided': { const w = this.requireWager(ev); if (!canWagerTransition(w.state, 'voided')) throw new FinancialRejected('invalid-transition', `cannot void a ${w.state} wager`); w.state = 'voided'; break; }
      case 'refund-recorded': {
        const w = this.requireWager(ev);
        if (!canWagerTransition(w.state, 'refunded')) throw new FinancialRejected('invalid-transition', `cannot refund a ${w.state} wager`);
        if (ev.amountMinor === undefined || ev.amountMinor === null) throw new FinancialRejected('invalid-amount', 'refund requires an amount');
        if (ev.amountMinor > w.stakeMinor) throw new FinancialRejected('refund-exceeds-eligible', 'refund exceeds stake');
        w.state = 'refunded';
        break;
      }
      case 'financial-correction': {
        if (!ev.correctionOfEventId || !this.findAccepted(ev.correctionOfEventId)) throw new FinancialRejected('invalid-transition', 'correction must reference an accepted event');
        if (ev.wagerId) { const w = this.requireWager(ev); if (!canWagerTransition(w.state, 'corrected')) throw new FinancialRejected('invalid-transition', `cannot correct a ${w.state} wager`); w.state = 'corrected'; }
        break;
      }
    }
  }

  private requireSession(ev: FinancialEvent): SessionState {
    const s = this.sessions.get(ev.sessionId);
    if (!s) throw new FinancialRejected('invalid-session', 'unknown session');
    if (s.tenantId !== ev.tenantId) throw new FinancialRejected('cross-tenant-session', 'session belongs to another tenant');
    if (s.operatorId !== ev.sourceOperatorId) throw new FinancialRejected('reassign-denied', 'session belongs to another operator');
    if (s.sbPlr !== ev.sbPlr) throw new FinancialRejected('session-player-mismatch', 'session belongs to another SB-PLR');
    if (s.jurisdiction !== ev.jurisdiction) throw new FinancialRejected('wrong-jurisdiction', 'session jurisdiction mismatch');
    return s;
  }
  private requireOpenSession(ev: FinancialEvent): SessionState { const s = this.requireSession(ev); if (s.ended) throw new FinancialRejected('session-ended', 'session already ended'); return s; }
  private requireWager(ev: FinancialEvent): WagerRec {
    if (!ev.wagerId) throw new FinancialRejected('invalid-wager', 'wagerId required');
    const w = this.wagers.get(ev.wagerId);
    if (!w) throw new FinancialRejected('settle-unknown-wager', 'unknown wager');
    if (w.tenantId !== ev.tenantId) throw new FinancialRejected('reassign-denied', 'wager tenant mismatch');
    if (w.sbPlr !== ev.sbPlr) throw new FinancialRejected('reassign-denied', 'wager SB-PLR mismatch');
    if (w.currency !== ev.currency) throw new FinancialRejected('currency-mismatch', 'wager currency mismatch');
    if (w.sessionId !== ev.sessionId) throw new FinancialRejected('reassign-denied', 'wager session mismatch');
    return w;
  }

  // ── Reads (regulator / authorised service; operators scoped to own tenant) ──
  acceptedEvents(ctx: FinancialAccessContext, tenantId?: string): AcceptedFinancialEvent[] {
    this.assertRead(ctx, tenantId);
    const scope = ctx.plane === 'operator' ? ctx.tenantId : tenantId;
    return this.accepted.filter((r) => !scope || r.tenantId === scope).map((r) => ({ ...r }));
  }
  auditTrail(): readonly ReturnType<FinancialAuditSink['list']>[number][] { return this.auditSink.list(); }
  findAccepted(eventId: string): AcceptedFinancialEvent | undefined { return this.accepted.find((r) => r.eventId === eventId); }

  private assertSubmit(ctx: FinancialAccessContext): void {
    if (!ctx || ctx.plane !== 'financial-service') throw new FinancialAccessError(`plane '${ctx?.plane ?? 'none'}' may not submit financial events`);
    if (!ctx.operatorId || !ctx.tenantId || !ctx.jurisdiction) throw new FinancialAccessError('incomplete authenticated context');
  }
  private assertRead(ctx: FinancialAccessContext, tenantId?: string): void {
    if (!ctx || ctx.plane === 'unauthenticated' || ctx.plane === 'casino-admin') throw new FinancialAccessError('unauthorised read');
    if (ctx.plane === 'operator') { if (tenantId && tenantId !== ctx.tenantId) throw new FinancialAccessError('operators may only read their own tenant'); }
  }
  private reject(eventId: string, e: FinancialRejected, ev: Record<string, unknown>): FinRejectionRecord {
    const rec: FinRejectionRecord = deepFreeze({ eventId, rejectedAt: this.now(), reason: e.reason, permanent: PERMANENT_FIN_REJECTIONS.has(e.reason), tenantId: (ev.tenantId as string) ?? null, sourceOperatorId: (ev.sourceOperatorId as string) ?? null, jurisdiction: (ev.jurisdiction as JurisdictionCode) ?? null, eventType: (ev.eventType as string) ?? null, detail: `financial event rejected: ${e.reason}`, auditRef: `fin-audit:${eventId}` });
    this.audit('event-rejected', eventId, rec.tenantId, rec.sourceOperatorId, rec.jurisdiction, rec.eventType, e.reason);
    return rec;
  }
  private audit(action: FinAuditAction, eventId: string | null, tenantId: string | null, operatorId: string | null, jurisdiction: JurisdictionCode | null, eventType: string | null, detail: string): void {
    this.auditSink.append(sealFinancialAudit({ at: this.now(), action, eventId, tenantId, sourceOperatorId: operatorId, jurisdiction, eventType, detail }));
  }
}
