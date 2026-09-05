// ─── SafeBet Guardian — audit context (ARCH-V4-C0) ───────────────────────────
//
// Guardian consumes the SHARED audit contract (../../../lib/platform/audit/index.ts) but stamps
// every event with product=GUARDIAN and its own chain scope. Guardian must NEVER
// write events masquerading as SafeBet IQ — the product tag + a guardian: scope
// prefix keep the two apart. Pure/deterministic (SHA injected), no DB here.

import { auditEventHash, verifyChain, type AuditEventFields, type Sha256Hex, type ChainVerifyResult } from '../../../lib/platform/audit/index.ts';
import { GUARDIAN_PRODUCT } from './product.ts';

/** Guardian audit chain scope: always product-prefixed + jurisdiction-bound so it
 *  can never collide with a SafeBet IQ tenant chain scope. */
export function guardianChainScope(jurisdiction: string): string {
  return `guardian:${jurisdiction}`;
}

export interface GuardianAuditContext {
  product: typeof GUARDIAN_PRODUCT;
  actorPrincipalId: string;
  actorRole: string;
  jurisdiction: string;
  eventType: string;
  correlationId: string;
  occurredAt: string;
  caseReference?: string | null;
  evidenceReference?: string | null;
}

/** Build the shared-contract event fields from a Guardian audit context. The
 *  product tag is carried in metadata AND encoded in the chain scope; user_role
 *  carries the Guardian role. This shape feeds the shared verifier unchanged. */
export function toAuditEventFields(ctx: GuardianAuditContext, seq: number, previousHash: string, eventId: string): AuditEventFields {
  if (ctx.product !== GUARDIAN_PRODUCT) throw new Error('Guardian audit context must carry product=GUARDIAN');
  return {
    chain_scope: guardianChainScope(ctx.jurisdiction),
    chain_sequence: seq,
    previous_hash: previousHash,
    event_id: eventId,
    event_type: ctx.eventType,
    user_id: ctx.actorPrincipalId,
    user_role: ctx.actorRole,
    casino_id: null,                         // Guardian has no casino context
    resource_type: ctx.caseReference ? 'guardian_case' : (ctx.evidenceReference ? 'guardian_evidence' : null),
    resource_id: ctx.caseReference ?? ctx.evidenceReference ?? null,
    outcome: 'recorded',
    created_at: ctx.occurredAt,
    correlation_id: ctx.correlationId,
    metadata: { product: GUARDIAN_PRODUCT, jurisdiction: ctx.jurisdiction, synthetic: true },
  };
}

export function hashGuardianEvent(ctx: GuardianAuditContext, seq: number, previousHash: string, eventId: string, sha256: Sha256Hex): string {
  return auditEventHash(toAuditEventFields(ctx, seq, previousHash, eventId), sha256);
}

/** Verify a Guardian chain via the shared verifier. Guards that every event is a
 *  Guardian-scoped event (no IQ event smuggled into a Guardian chain). */
export function verifyGuardianChain(jurisdiction: string, events: AuditEventFields[], sha256: Sha256Hex, expectedHead?: string): ChainVerifyResult {
  const scope = guardianChainScope(jurisdiction);
  for (const e of events) {
    if (e.chain_scope !== scope) {
      return { scope, status: 'broken', eventsChecked: 0, reason: `event not in Guardian scope (${e.chain_scope})` };
    }
  }
  return verifyChain(scope, events, sha256, expectedHead);
}
