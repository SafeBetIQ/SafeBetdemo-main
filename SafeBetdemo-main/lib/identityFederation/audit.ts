// ─── National Identity Federation — immutable audit model (v2.0, ADR-006) ────
//
// Phase 3.1 Foundation. Every federation decision is recorded as an append-only,
// deep-frozen audit record capturing everything needed to reproduce the decision
// years later (Design §22) — and NEVER any PII. Foundation ships the model + an
// append-only sink contract + an in-memory reference sink; the durable
// (regulator-plane, RLS) sink is wired in Milestone 3.3/3.4.

import type { FederationDecisionAudit } from './types.ts';

let auditCounter = 0;

/**
 * Seal an audit record: fill defaults, then DEEP-FREEZE so it can never be
 * mutated after creation (immutability at the object level; the durable store
 * adds append-only enforcement, mirroring casino_event_log / workflow_audit).
 */
export function sealAuditRecord(
  input: Omit<FederationDecisionAudit, 'auditId' | 'timestamp'> & Partial<Pick<FederationDecisionAudit, 'auditId' | 'timestamp'>>,
): FederationDecisionAudit {
  const record: FederationDecisionAudit = {
    auditId: input.auditId ?? `fed-audit-${Date.now()}-${++auditCounter}`,
    timestamp: input.timestamp ?? new Date().toISOString(),
    jurisdiction: input.jurisdiction,
    subjectSbNat: input.subjectSbNat ?? null,
    affectedSbPlr: [...(input.affectedSbPlr ?? [])],
    evidenceUsed: [...(input.evidenceUsed ?? [])],
    evidenceIgnored: [...(input.evidenceIgnored ?? [])],
    matchingRules: [...(input.matchingRules ?? [])],
    decisionRule: input.decisionRule,
    confidence: { ...input.confidence },
    versions: { ...input.versions },
    reviewer: input.reviewer,
    overrideHistory: [...(input.overrideHistory ?? [])],
    appealHistory: [...(input.appealHistory ?? [])],
  };
  return deepFreeze(record);
}

/**
 * Append-only audit sink. NOTE the deliberate absence of update/delete — the
 * contract itself forbids mutation (Constitution §5 event-sourcing analogue).
 */
export interface AuditSink {
  append(record: FederationDecisionAudit): void | Promise<void>;
  list(): readonly FederationDecisionAudit[];
  count(): number;
}

/** In-memory reference sink (tests / composition scaffolding). Append-only. */
export class InMemoryAuditSink implements AuditSink {
  private readonly records: FederationDecisionAudit[] = [];
  append(record: FederationDecisionAudit): void {
    this.records.push(deepFreeze(record));
  }
  list(): readonly FederationDecisionAudit[] {
    return Object.freeze(this.records.slice());
  }
  count(): number {
    return this.records.length;
  }
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o as object)) deepFreeze((o as Record<string, unknown>)[k]);
  }
  return o;
}
