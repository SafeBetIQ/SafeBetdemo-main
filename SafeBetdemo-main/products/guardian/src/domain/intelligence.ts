// ─── SafeBet Guardian — Domain Intelligence engine (ARCH-V4-C2) ───────────────
//
// Given a SYNTHETIC website fixture: normalise → signals → derive candidate refs →
// compare against the Legal Operator Registry via the C1 GOVERNED CONTRACT
// (resolveLegalReference — never raw tables) → structured NON-LEGAL result with
// explainable reason codes + investigation priority.
//
//   NO_MATCH != ILLEGAL. HIGH-RISK SIGNAL != LEGAL FINDING. No AI. No enforcement.

import type { RegistrySnapshot } from '../registry/types.ts';
import { resolveLegalReference } from '../registry/resolve.ts';
import { normaliseHostname } from './normalise.ts';
import { technicalSignals, contentSignals, extractLicenceReference } from './signals.ts';
import type { WebsiteFixture, DomainIntelligenceResult, ReasonCode, ReviewPriority } from './types.ts';

export interface DomainIdFactory { (canonicalHostname: string, jurisdiction: string): string }

/** Compute a domain intelligence result. Deterministic + pure (registry snapshot injected). */
export function analyseDomain(
  registry: RegistrySnapshot,
  fx: WebsiteFixture,
  opts: { observationId: string; domainId?: string; now?: Date } ,
): DomainIntelligenceResult {
  const now = opts.now ?? new Date();
  const norm = normaliseHostname(fx.hostname);
  const domainId = opts.domainId ?? `DOM-${norm.canonical}`;
  const tech = technicalSignals(fx);
  const content = contentSignals(fx);
  const gambling = content.find((c) => c.signalType === 'GAMBLING_TERMINOLOGY')?.present ?? false;

  // Derive candidate references from synthetic page evidence + explicit metadata.
  const licenceReference = extractLicenceReference(fx);
  const subject = {
    jurisdiction: fx.jurisdiction,
    legalName: fx.claimedOperatorName ?? undefined,
    brandName: fx.claimedBrand ?? undefined,
    licenceReference: licenceReference ?? undefined,
  };

  // Compare via the C1 governed contract.
  const resolution = resolveLegalReference(registry, subject, now);

  const reasons: ReasonCode[] = [];
  if (resolution.matchState === 'NO_MATCH') reasons.push('NO_AUTHORITATIVE_REGISTRY_MATCH');
  if (gambling) reasons.push('CONTENT_GAMBLING_SIGNAL');
  if (resolution.freshness === 'STALE') reasons.push('LICENCE_RECORD_STALE');
  if (resolution.resolutionState === 'SOURCE_CONFLICT' || resolution.resolutionState === 'REQUIRES_REVIEW') reasons.push('SOURCE_CONFLICT');
  if (resolution.resolutionState === 'MULTIPLE_MATCHES') reasons.push('UNKNOWN_OPERATOR_REFERENCE');

  // Brand vs operator / licence-reference mismatch (deterministic): a licence claimed
  // in page text that resolves to a DIFFERENT operator than a claimed brand.
  if (fx.claimedBrand && licenceReference) {
    const brandRes = resolveLegalReference(registry, { jurisdiction: fx.jurisdiction, brandName: fx.claimedBrand }, now);
    const licRes = resolveLegalReference(registry, { jurisdiction: fx.jurisdiction, licenceReference }, now);
    if (brandRes.resolvedOperatorId && licRes.resolvedOperatorId && brandRes.resolvedOperatorId !== licRes.resolvedOperatorId) {
      reasons.push('BRAND_OPERATOR_MISMATCH');
      reasons.push('LICENCE_REFERENCE_MISMATCH');
    }
  }

  const { reviewPriority, reviewRequired } = derivePriority(resolution, reasons);
  const classification = classify(resolution, reasons, reviewRequired);

  return {
    product: 'GUARDIAN',
    jurisdiction: fx.jurisdiction,
    domainId,
    canonicalHostname: norm.canonical,
    observationId: opts.observationId,
    registryMatchState: resolution.matchState as DomainIntelligenceResult['registryMatchState'],
    resolutionState: resolution.resolutionState,
    candidateOperatorId: resolution.resolvedOperatorId,
    candidateBrandId: null,
    licenceReference: resolution.licenceId ? licenceReference : (licenceReference ?? null),
    licenceVerificationState: resolution.legalStanding,
    registryFreshness: resolution.freshness,
    technicalSignals: tech,
    contentSignals: content,
    reviewPriority,
    reviewRequired,
    reasonCodes: dedupe(reasons),
    provenance: { evidenceReferences: [fx.evidenceReference], sourceRecordIds: resolution.provenance.sourceRecordIds },
    isIllegalDetermination: false,
    classification,
    note: 'Synthetic domain intelligence — NOT a determination of illegality. Signals and NO_MATCH are non-legal.',
  };
}

/** Explainable investigation priority from transparent reason codes (NOT legal probability). */
function derivePriority(resolution: { resolutionState: string }, reasons: ReasonCode[]): { reviewPriority: ReviewPriority; reviewRequired: boolean } {
  const mismatchOrConflict = reasons.filter((r) =>
    r === 'BRAND_OPERATOR_MISMATCH' || r === 'LICENCE_REFERENCE_MISMATCH' || r === 'SOURCE_CONFLICT' || r === 'NO_AUTHORITATIVE_REGISTRY_MATCH');
  // HIGH when multiple independent mismatch/conflict indicators, or NO_MATCH + gambling content.
  const noMatchWithGambling = reasons.includes('NO_AUTHORITATIVE_REGISTRY_MATCH') && reasons.includes('CONTENT_GAMBLING_SIGNAL');
  if (mismatchOrConflict.length >= 2 || noMatchWithGambling) return { reviewPriority: 'HIGH_REVIEW_PRIORITY', reviewRequired: true };
  if (reasons.includes('LICENCE_RECORD_STALE') || reasons.includes('SOURCE_CONFLICT') || mismatchOrConflict.length === 1) {
    return { reviewPriority: 'MEDIUM_REVIEW_PRIORITY', reviewRequired: true };
  }
  if (resolution.resolutionState === 'MATCHED_AUTHORITATIVE') return { reviewPriority: 'LOW_REVIEW_PRIORITY', reviewRequired: false };
  return { reviewPriority: 'LOW_REVIEW_PRIORITY', reviewRequired: false };
}

function classify(resolution: { resolutionState: string; matchState: string }, reasons: ReasonCode[], reviewRequired: boolean): DomainIntelligenceResult['classification'] {
  if (resolution.resolutionState === 'MATCHED_AUTHORITATIVE' && !reviewRequired) return 'REFERENCE_MATCHED';
  if (resolution.matchState === 'NO_MATCH') {
    return reasons.includes('CONTENT_GAMBLING_SIGNAL') ? 'POTENTIALLY_UNAUTHORISED_REQUIRES_VERIFICATION' : 'INSUFFICIENT_DATA';
  }
  return 'REQUIRES_HUMAN_REVIEW';
}

function dedupe<T>(a: T[]): T[] { return a.filter((v, i) => a.indexOf(v) === i); }
