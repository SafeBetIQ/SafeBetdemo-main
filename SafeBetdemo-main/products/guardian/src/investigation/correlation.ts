// ─── SafeBet Guardian — Case correlation / recommendation engine (ARCH-V4-C6) ─
//
// Deterministic, explainable. Combines governed intelligence REFERENCES (C1–C5) into a
// synthetic investigation-case recommendation. Multi-signal correlation is EVIDENCE, not
// automatic illegality. NO black-box score. NO AI. NO enforcement.
//
// NO_MATCH / mismatch / source conflict → INVESTIGATION REQUIRED (never ILLEGAL).

import type {
  CaseIntakeFixture, CaseRecommendationResult, CaseReasonCode, CaseType, CasePriority,
  CaseSubjectRef, CaseRecommendation, CaseSourceDomain, CaseSubjectType, CaseIntelligenceReference,
} from './types.ts';

const DOMAIN_TO_SUBJECT: Record<CaseSourceDomain, CaseSubjectType> = {
  C1_REGISTRY: 'OPERATOR', C2_DOMAIN: 'DOMAIN', C3_APP: 'MOBILE_APP', C4_PAYMENT: 'MERCHANT', C5_GEO: 'GEO_SERVICE_REFERENCE',
};

const NON_REFERENCED = (s: string) => s !== 'REFERENCED' && s !== 'EXACT_MATCH' && s !== 'MATCHED_AUTHORITATIVE' && s !== 'AVAILABLE';

function reasonFor(ref: CaseIntelligenceReference): CaseReasonCode | null {
  const s = ref.referenceState;
  switch (ref.sourceDomain) {
    case 'C1_REGISTRY':
      if (s === 'NO_MATCH') return 'NO_AUTHORITATIVE_REGISTRY_MATCH';
      if (s === 'SOURCE_CONFLICT' || s === 'REQUIRES_REVIEW') return 'REGISTRY_SOURCE_CONFLICT';
      return null;
    case 'C2_DOMAIN': return NON_REFERENCED(s) ? 'DOMAIN_REFERENCE_INCONSISTENCY' : null;
    case 'C3_APP': return NON_REFERENCED(s) ? 'APP_REFERENCE_INCONSISTENCY' : null;
    case 'C4_PAYMENT': return NON_REFERENCED(s) ? 'PAYMENT_REFERENCE_INCONSISTENCY' : null;
    case 'C5_GEO': return (s === 'INCONSISTENT' || s === 'NO_MATCH' || NON_REFERENCED(s)) ? 'GEO_JURISDICTION_INCONSISTENCY' : null;
    default: return null;
  }
}

export function analyseCaseIntake(fx: CaseIntakeFixture): CaseRecommendationResult {
  const reasons: CaseReasonCode[] = [];
  const subjects: CaseSubjectRef[] = [];
  const domains = new Set<CaseSourceDomain>();

  for (const ref of fx.intelligenceReferences) {
    domains.add(ref.sourceDomain);
    subjects.push({ subjectType: DOMAIN_TO_SUBJECT[ref.sourceDomain], subjectReference: ref.sourceReference, sourceDomain: ref.sourceDomain });
    const r = reasonFor(ref);
    if (r) reasons.push(r);
  }

  const multiSignal = domains.size >= 2;
  if (multiSignal) reasons.push('MULTI_SIGNAL_CORRELATION');
  if (reasons.length > 0 && !reasons.includes('INVESTIGATION_REQUIRED')) reasons.push('INVESTIGATION_REQUIRED');

  const caseType = deriveType(domains, multiSignal);
  const priority = derivePriority(reasons);
  const { recommendation, reviewRequired } = deriveRecommendation(reasons, multiSignal);

  return {
    product: 'GUARDIAN', jurisdiction: fx.jurisdiction, caseReference: fx.intakeReference, title: fx.title,
    caseType, priority, recommendation, reviewRequired, reasonCodes: dedupe(reasons), subjects,
    intelligenceReferences: fx.intelligenceReferences,
    provenance: { evidenceReferences: fx.evidenceReference ? [fx.evidenceReference] : [], sourceReferences: fx.intelligenceReferences.map((r) => r.sourceReference) },
    isLegalDetermination: false, isEnforcementAuthorised: false,
    note: 'Synthetic investigation-case recommendation — NOT a legal finding and NOT an enforcement authorisation. NO_MATCH/mismatch/conflict mean INVESTIGATION REQUIRED, not illegality. Human review governs the case.',
  };
}

function deriveType(domains: Set<CaseSourceDomain>, multiSignal: boolean): CaseType {
  if (multiSignal) return 'MULTI_SIGNAL_INVESTIGATION';
  if (domains.has('C2_DOMAIN')) return 'DOMAIN_REVIEW';
  if (domains.has('C3_APP')) return 'MOBILE_APP_REVIEW';
  if (domains.has('C4_PAYMENT')) return 'PAYMENT_CHANNEL_REVIEW';
  if (domains.has('C5_GEO')) return 'GEO_JURISDICTION_REVIEW';
  if (domains.has('C1_REGISTRY')) return 'UNAUTHORISED_OPERATION_REVIEW';
  return 'OTHER';
}

function derivePriority(reasons: CaseReasonCode[]): CasePriority {
  const strong = reasons.filter((r) => r === 'NO_AUTHORITATIVE_REGISTRY_MATCH' || r === 'REGISTRY_SOURCE_CONFLICT' || r === 'DOMAIN_REFERENCE_INCONSISTENCY' || r === 'APP_REFERENCE_INCONSISTENCY' || r === 'PAYMENT_REFERENCE_INCONSISTENCY' || r === 'GEO_JURISDICTION_INCONSISTENCY');
  if (reasons.includes('NO_AUTHORITATIVE_REGISTRY_MATCH') && reasons.includes('MULTI_SIGNAL_CORRELATION')) return 'HIGH';
  if (strong.length >= 2) return 'HIGH';
  if (strong.length === 1) return 'MEDIUM';
  if (reasons.includes('MULTI_SIGNAL_CORRELATION')) return 'MEDIUM';
  return 'LOW';
}

function deriveRecommendation(reasons: CaseReasonCode[], multiSignal: boolean): { recommendation: CaseRecommendation; reviewRequired: boolean } {
  const strong = reasons.some((r) => r === 'NO_AUTHORITATIVE_REGISTRY_MATCH' || r === 'REGISTRY_SOURCE_CONFLICT');
  if (strong && multiSignal) return { recommendation: 'ESCALATION_REVIEW_RECOMMENDED', reviewRequired: true }; // still NOT enforcement
  if (reasons.some((r) => r !== 'MULTI_SIGNAL_CORRELATION')) return { recommendation: 'CASE_REVIEW_RECOMMENDED', reviewRequired: true };
  return { recommendation: 'NO_CASE_RECOMMENDED', reviewRequired: false };
}

function dedupe<T>(a: T[]): T[] { return a.filter((v, i) => a.indexOf(v) === i); }
