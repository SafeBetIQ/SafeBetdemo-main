// ─── SafeBet Guardian — authorisation-evaluation worker logic (ARCH-V4-C8) ────
// Pure, idempotent. The worker (SYSTEM_SERVICE) may PREPARE a proposed action and evaluate
// the deterministic policy/evidence gates to route it (LEGAL_REVIEW_REQUIRED / blocked with
// reason codes). It CANNOT set final AUTHORISED — that requires a human Authorising Officer
// (enforced by the gate's AUTHORISER_NOT_PERMITTED for SYSTEM_SERVICE, by the DB privilege
// model, and tested). No external provider action ever.

import { evaluatePolicyApplicability } from './policy.ts';
import { evaluateAuthorisation } from './gate.ts';
import { SYNTHETIC_POLICY_VERSIONS, syntheticProposedAction } from './fixtures.ts';
import type { ProposedActionInput, AuthReasonCode } from './types.ts';

export interface AuthorisationEvaluationMessage {
  product: 'GUARDIAN';
  schemaVersion: string;
  eventType: 'guardian.authorisation.evaluate';
  jurisdiction: string;
  correlationId: string;
  idempotencyKey: string;
  occurredAt: string;
  fixtureProposedActionRef: string;   // reference to a SYNTHETIC fixture — never a real action
}

export class AuthorisationPoisonMessageError extends Error {
  constructor(message: string) { super(message); this.name = 'AuthorisationPoisonMessageError'; }
}

export interface PreparedProposedAction {
  proposedAction: ProposedActionInput;
  preparedStatus: 'READY_FOR_LEGAL_REVIEW' | 'LEGAL_REVIEW_REQUIRED' | 'DRAFT';
  gateReasonCodes: AuthReasonCode[];   // non-human gates (policy/evidence/jurisdiction/scope)
  machineAuthorisationBlocked: true;   // ALWAYS — the worker cannot authorise
}

const FIXTURES: Record<string, () => ProposedActionInput> = {
  'PA-VALID': () => syntheticProposedAction(),
  'PA-EXPIRED-POLICY': () => syntheticProposedAction({ policyVersion: SYNTHETIC_POLICY_VERSIONS['POLV-0002-1'] }),
  'PA-SUPERSEDED-POLICY': () => syntheticProposedAction({ policyVersion: SYNTHETIC_POLICY_VERSIONS['POLV-0003-1'] }),
  'PA-EVIDENCE-MISSING': () => syntheticProposedAction({ evidence: [] }),
  'PA-EVIDENCE-TAMPERED': () => syntheticProposedAction({ evidence: [{ evidenceReference: 'EV-REF-0001', integrityStatus: 'INTEGRITY_FAILED', jurisdiction: 'ZA-GP' }] }),
  'PA-ACTION-NOT-PERMITTED': () => syntheticProposedAction({ actionType: 'PAYMENT_REFERRAL', targetType: 'MERCHANT', targetReference: 'MER-REF-0001' }),
  'PA-EXCEPTION-ESCALATION': () => syntheticProposedAction({ policyVersion: SYNTHETIC_POLICY_VERSIONS['POLV-0004-1'] }),
  'PA-WRONG-JUR': () => syntheticProposedAction({ jurisdiction: 'ZA-WC', evidence: [{ evidenceReference: 'EV-REF-0100', integrityStatus: 'VERIFIED', jurisdiction: 'ZA-WC' }], policyVersion: { ...SYNTHETIC_POLICY_VERSIONS['POLV-0001-1'], jurisdiction: 'ZA-WC', versionId: 'POLV-0100-1', policyId: 'POL-SYNTH-0100' } }),
};

export interface AuthWorkerOutput { ok: boolean; duplicate: boolean; idempotencyKey: string; result: PreparedProposedAction | null }

export class GuardianAuthorisationWorker {
  private readonly seen = new Map<string, AuthWorkerOutput>();

  process(msg: AuthorisationEvaluationMessage): AuthWorkerOutput {
    if (msg?.product !== 'GUARDIAN' || msg?.eventType !== 'guardian.authorisation.evaluate') throw new AuthorisationPoisonMessageError('not a Guardian authorisation-evaluation message');
    if (!msg.idempotencyKey || !msg.jurisdiction) throw new AuthorisationPoisonMessageError('missing idempotencyKey/jurisdiction');
    const make = FIXTURES[msg.fixtureProposedActionRef];
    if (!make) throw new AuthorisationPoisonMessageError(`unknown synthetic proposed-action fixture: ${msg.fixtureProposedActionRef}`);
    const pa = { ...make(), proposedActionId: `PA-${msg.idempotencyKey}` };
    if (pa.jurisdiction !== msg.jurisdiction) throw new AuthorisationPoisonMessageError('fixture jurisdiction mismatch');

    const prior = this.seen.get(msg.idempotencyKey);
    if (prior) return { ...prior, duplicate: true };

    // Evaluate as SYSTEM_SERVICE — this ALWAYS yields AUTHORISER_NOT_PERMITTED (machine cannot
    // authorise). We surface only the non-human gate reasons for routing.
    const machine = evaluateAuthorisation(pa, { investigatorId: pa.proposedBy, legalReviewerId: 'unassigned-reviewer', legalReviewOutcome: null, authorisingOfficerId: 'guardian-authorisation-worker', authorisingOfficerRole: 'SYSTEM_SERVICE' });
    const gateReasonCodes = machine.reasonCodes.filter((r) => r !== 'AUTHORISER_NOT_PERMITTED' && r !== 'SOD_VIOLATION' && r !== 'LEGAL_REVIEW_REQUIRED');
    const applicability = evaluatePolicyApplicability(pa.policyVersion, { jurisdiction: pa.jurisdiction, actionType: pa.actionType });
    const preparedStatus: PreparedProposedAction['preparedStatus'] =
      gateReasonCodes.length > 0 ? 'DRAFT' : (applicability === 'REQUIRES_LEGAL_REVIEW' ? 'LEGAL_REVIEW_REQUIRED' : 'READY_FOR_LEGAL_REVIEW');

    const out: AuthWorkerOutput = { ok: true, duplicate: false, idempotencyKey: msg.idempotencyKey, result: { proposedAction: pa, preparedStatus, gateReasonCodes, machineAuthorisationBlocked: true } };
    this.seen.set(msg.idempotencyKey, out);
    return out;
  }

  processedCount(): number { return this.seen.size; }
}

export const GUARDIAN_AUTHORISATION_QUEUE = 'guardian-authorisation-evaluation' as const;
export const GUARDIAN_AUTHORISATION_DLQ = 'guardian-authorisation-evaluation-dlq' as const;
