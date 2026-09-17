// ─── SafeBet Guardian — deterministic re-entry relationship classification (ARCH-V4-C10 §10/§11/§12/§15) ─
//
// Explainable, deterministic correlation ONLY. A relationship label is NOT a legal finding and
// NOT a same-entity assertion. SIMILAR TARGET != SAME OPERATOR; SHARED INFRASTRUCTURE != SAME
// ENTITY. Weak/single signals never assert ENTITY_RELATIONSHIP — they surface for human review.
// There is NO probability / re-enforcement / enforcement score — only a REVIEW PRIORITY (LOW/MEDIUM/HIGH).

import type {
  ReentrySignal, ReentryRelationshipType, ReentryReasonCode, ReviewPriority,
} from './types.ts';

export interface RelationshipClassification {
  relationshipType: ReentryRelationshipType;
  reasonCodes: ReentryReasonCode[];
  reviewPriority: ReviewPriority;
  correlationSource: 'OPERATOR' | 'BRAND' | 'DOMAIN' | 'APP' | 'PAYMENT' | 'GEO' | 'PREVIOUS_ORCHESTRATION' | 'INFRASTRUCTURE' | 'OTHER';
}

// Deterministic mapping from a synthetic signal to a correlation label + reason codes. Review
// priority reflects how directly the signal ties to the ORIGINAL target — never legal severity.
const SIGNAL_MAP: Record<ReentrySignal['signalType'], Omit<RelationshipClassification, 'reasonCodes'> & { reason: ReentryReasonCode }> = {
  ORIGINAL_TARGET_REAPPEARED: { relationshipType: 'SAME_TARGET_REAPPEARED', reviewPriority: 'HIGH', correlationSource: 'PREVIOUS_ORCHESTRATION', reason: 'ORIGINAL_TARGET_REAPPEARED' },
  ALIAS:          { relationshipType: 'KNOWN_ALIAS', reviewPriority: 'MEDIUM', correlationSource: 'DOMAIN', reason: 'KNOWN_ALIAS_OBSERVED' },
  MIRROR:         { relationshipType: 'MIRROR_REFERENCE', reviewPriority: 'MEDIUM', correlationSource: 'DOMAIN', reason: 'MIRROR_TARGET_OBSERVED' },
  REDIRECT:       { relationshipType: 'REDIRECT_RELATIONSHIP', reviewPriority: 'MEDIUM', correlationSource: 'DOMAIN', reason: 'REDIRECT_RELATIONSHIP_OBSERVED' },
  BRAND:          { relationshipType: 'BRAND_RELATIONSHIP', reviewPriority: 'LOW', correlationSource: 'BRAND', reason: 'COMMON_BRAND_REFERENCE' },
  OPERATOR:       { relationshipType: 'ENTITY_RELATIONSHIP', reviewPriority: 'MEDIUM', correlationSource: 'OPERATOR', reason: 'COMMON_OPERATOR_REFERENCE' },
  INFRASTRUCTURE: { relationshipType: 'INFRASTRUCTURE_REUSE', reviewPriority: 'LOW', correlationSource: 'INFRASTRUCTURE', reason: 'COMMON_INFRASTRUCTURE_REFERENCE' },
  APP_RELISTING:  { relationshipType: 'APP_RELISTING', reviewPriority: 'MEDIUM', correlationSource: 'APP', reason: 'COMMON_APP_REFERENCE' },
  PAYMENT_REUSE:  { relationshipType: 'PAYMENT_REFERENCE_REUSE', reviewPriority: 'MEDIUM', correlationSource: 'PAYMENT', reason: 'COMMON_PAYMENT_REFERENCE' },
  GEO_CHANGE:     { relationshipType: 'GEO_AVAILABILITY_CHANGE', reviewPriority: 'LOW', correlationSource: 'GEO', reason: 'GEO_AVAILABILITY_CHANGED' },
  NONE:           { relationshipType: 'UNKNOWN_RELATIONSHIP', reviewPriority: 'LOW', correlationSource: 'OTHER', reason: 'INSUFFICIENT_EVIDENCE' },
};

/** Count the distinct shared governed references presented with the signal. A single weak signal
 *  must never be enough to assert SAME entity — that requires human confirmation (§15). */
function sharedReferenceCount(signal: ReentrySignal): number {
  return Object.values(signal.sharedReferences ?? {}).filter(Boolean).length;
}

export function classifyRelationship(signal: ReentrySignal): RelationshipClassification {
  const base = SIGNAL_MAP[signal.signalType] ?? SIGNAL_MAP.NONE;
  const reasonCodes: ReentryReasonCode[] = [base.reason, 'PRIOR_VERIFIED_ACTION_EXISTS'];
  const shared = sharedReferenceCount(signal);

  // Append additional correlation reason codes for each distinct shared reference (explainable).
  const r = signal.sharedReferences ?? {};
  if (r.operator) reasonCodes.push('COMMON_OPERATOR_REFERENCE');
  if (r.brand) reasonCodes.push('COMMON_BRAND_REFERENCE');
  if (r.payment) reasonCodes.push('COMMON_PAYMENT_REFERENCE');
  if (r.app) reasonCodes.push('COMMON_APP_REFERENCE');
  if (r.infrastructure) reasonCodes.push('COMMON_INFRASTRUCTURE_REFERENCE');

  // ENTITY_RELATIONSHIP (same-entity) is only asserted when the signal itself is an operator
  // signal AND at least two independent shared references corroborate it — otherwise it stays a
  // weaker correlation label pending human confirmation. This encodes SIMILAR != SAME.
  let relationshipType = base.relationshipType;
  if (relationshipType === 'ENTITY_RELATIONSHIP' && shared < 2) {
    relationshipType = 'UNKNOWN_RELATIONSHIP';
  }

  // De-duplicate reason codes deterministically (stable order).
  const seen = new Set<ReentryReasonCode>();
  const deduped = reasonCodes.filter((c) => (seen.has(c) ? false : (seen.add(c), true)));
  return { relationshipType, reasonCodes: deduped, reviewPriority: base.reviewPriority, correlationSource: base.correlationSource };
}
