// ─── SafeBet Guardian — re-entry detection engine (ARCH-V4-C10 §1–§4/§9/§26) ──
//
// Deterministic. Ties a follow-up verification observation + a synthetic re-entry signal to a
// re-entry CANDIDATE (intelligence + routing only). It NEVER: determines illegality, applies
// existing authority, dispatches enforcement, sets provider states, or rewrites historic
// verification. A candidate always routes to HUMAN REVIEW — never to automatic block/referral.

import { buildVerificationObservation, indicatesReentry } from './observation.ts';
import { classifyRelationship } from './relationship.ts';
import { assessCoverage } from './coverage.ts';
import type { ReentryDetectionInput, ReentryDecision } from './types.ts';

const NOTE = 'Synthetic re-entry intelligence — a re-entry candidate is a correlation/verification observation for HUMAN REVIEW, never an illegality determination, authority application, or enforcement. No real crawling/provider query; C10 cannot dispatch C9 enforcement.';

/** Detect a possible re-entry after a prior C9 orchestration. Returns a decision that either
 *  creates a candidate (routed to human review) or records "no re-entry" (expected state holds). */
export function detectReentry(inp: ReentryDetectionInput): ReentryDecision {
  const o = inp.orchestration;
  const verification = buildVerificationObservation(o, inp.signal, 'FOLLOWUP');

  const noCandidate = (): ReentryDecision => ({
    product: 'GUARDIAN', jurisdiction: inp.jurisdiction, reentryCandidateId: null,
    originalOrchestrationReference: o.orchestrationReference, originalTargetType: o.targetType, originalTargetReference: o.targetReference,
    candidateTargetType: null, candidateTargetReference: null, candidateCreated: false, candidateState: null,
    relationshipType: null, reasonCodes: [], reviewPriority: 'LOW', coverageState: 'COVERAGE_UNCLEAR', humanReviewState: 'PENDING_REVIEW',
    verification, isIllegalityDetermined: false, isAuthorityApplied: false, isEnforcementDispatched: false,
    isRealObservationSource: false, isExternalNetworkCall: false, note: NOTE,
  });

  // Reference not resolvable → no candidate (nothing to correlate against).
  if (o.referenceStatus === 'REFERENCE_NOT_FOUND') return noCandidate();

  // No re-entry signal, or the enforced/expected state still holds → no candidate (§45 scenario 1).
  if (inp.signal.signalType === 'NONE' || !indicatesReentry(verification)) return noCandidate();

  // A re-entry signal is present → build the candidate (correlation + coverage) for human review.
  const rel = classifyRelationship(inp.signal);
  const coverage = assessCoverage({
    coverage: inp.coverage, candidateTargetReference: inp.signal.candidateTargetReference,
    relationshipType: rel.relationshipType, jurisdiction: inp.jurisdiction,
  });

  // Reason codes: relationship + coverage (deduped, stable order). Candidate always requires
  // human review before any routing — NEVER auto-advanced to an authority/enforcement path.
  const seen = new Set<string>();
  const reasonCodes = [...rel.reasonCodes, ...coverage.reasonCodes].filter((c) => (seen.has(c) ? false : (seen.add(c), true)));

  return {
    product: 'GUARDIAN', jurisdiction: inp.jurisdiction, reentryCandidateId: null,
    originalOrchestrationReference: o.orchestrationReference, originalTargetType: o.targetType, originalTargetReference: o.targetReference,
    candidateTargetType: inp.signal.candidateTargetType, candidateTargetReference: inp.signal.candidateTargetReference,
    candidateCreated: true, candidateState: 'DETECTED', relationshipType: rel.relationshipType,
    reasonCodes: reasonCodes as ReentryDecision['reasonCodes'], reviewPriority: rel.reviewPriority,
    coverageState: coverage.coverageState, humanReviewState: 'PENDING_REVIEW',
    verification, isIllegalityDetermined: false, isAuthorityApplied: false, isEnforcementDispatched: false,
    isRealObservationSource: false, isExternalNetworkCall: false, note: NOTE,
  };
}
