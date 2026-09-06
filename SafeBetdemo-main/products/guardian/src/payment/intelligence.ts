// ─── SafeBet Guardian — Payment Intelligence engine (ARCH-V4-C4) ──────────────
//
// SYNTHETIC payment/merchant fixture → normalise → deterministic signals → resolve
// operator/brand/licence via the C1 GOVERNED CONTRACT (resolveLegalReference) → governed
// domain/app links via the C2 Domain Reference Contract + C3 App Reference Contract (never
// raw base tables) → structured NON-LEGAL, NON-ENFORCEMENT result.
//
// NO_MATCH != ILLEGAL. HIGH PRIORITY != ENFORCEMENT. No AI. No payment action.

import type { RegistrySnapshot } from '../registry/types.ts';
import { resolveLegalReference } from '../registry/resolve.ts';
import { resolveDomainReference } from '../domain/contract.ts';
import { resolveAppReference } from '../app/contract.ts';
import { normaliseMerchant } from './normalise.ts';
import { paymentSignals } from './signals.ts';
import type { PaymentFixture, PaymentIntelligenceResult, PaymentReasonCode, PaymentReferenceLink } from './types.ts';
import type { ReviewPriority } from '../domain/types.ts';

export function analysePayment(
  registry: RegistrySnapshot,
  fx: PaymentFixture,
  opts: { observationId: string; now?: Date },
): PaymentIntelligenceResult {
  const now = opts.now ?? new Date();
  const norm = normaliseMerchant(fx.merchantReference, fx.merchantDescriptor);
  const merchantSubjectId = `MER-${norm.canonicalReference}`;
  const paymentSubjectId = `PAY-${norm.canonicalReference}`;
  const signals = paymentSignals(fx);

  const subject = { jurisdiction: fx.jurisdiction, legalName: fx.declaredOperatorName ?? undefined, brandName: fx.declaredBrand ?? undefined, licenceReference: fx.declaredLicenceReference ?? undefined };
  const resolution = resolveLegalReference(registry, subject, now);

  const reasons: PaymentReasonCode[] = [];
  if (resolution.matchState === 'NO_MATCH') reasons.push('NO_AUTHORITATIVE_REGISTRY_MATCH');
  if (resolution.freshness === 'STALE') reasons.push('LICENCE_RECORD_STALE');
  if (resolution.resolutionState === 'SOURCE_CONFLICT' || resolution.resolutionState === 'REQUIRES_REVIEW') reasons.push('SOURCE_CONFLICT');
  if (resolution.resolutionState === 'MULTIPLE_MATCHES') reasons.push('UNKNOWN_PROVIDER_REFERENCE');
  if (!fx.providerReference) reasons.push('UNKNOWN_PROVIDER_REFERENCE');
  if (!fx.declaredOperatorName && !fx.declaredBrand && !fx.declaredLicenceReference) reasons.push('UNVERIFIED_PAYMENT_REFERENCE');

  // merchant/operator or brand/licence mismatch (deterministic).
  if (fx.declaredBrand && fx.declaredLicenceReference) {
    const brandRes = resolveLegalReference(registry, { jurisdiction: fx.jurisdiction, brandName: fx.declaredBrand }, now);
    const licRes = resolveLegalReference(registry, { jurisdiction: fx.jurisdiction, licenceReference: fx.declaredLicenceReference }, now);
    if (brandRes.resolvedOperatorId && licRes.resolvedOperatorId && brandRes.resolvedOperatorId !== licRes.resolvedOperatorId) {
      reasons.push('MERCHANT_BRAND_MISMATCH');
      reasons.push('MERCHANT_OPERATOR_MISMATCH');
    }
  }

  // Governed cross-module reference links (contracts only — never base tables).
  const referenceLinks: PaymentReferenceLink[] = [];
  if (resolution.resolvedOperatorId) referenceLinks.push({ linkType: 'OPERATOR', targetReference: resolution.resolvedOperatorId, referenceMatchState: resolution.resolutionState, confidence: 'MEDIUM' });
  if (fx.declaredLicenceReference && resolution.licenceId) referenceLinks.push({ linkType: 'LICENCE', targetReference: fx.declaredLicenceReference, referenceMatchState: resolution.resolutionState, confidence: 'MEDIUM' });
  if (fx.declaredWebsite) {
    const dref = resolveDomainReference({ hostname: fx.declaredWebsite, jurisdiction: fx.jurisdiction });
    referenceLinks.push({ linkType: 'DOMAIN', targetReference: dref.canonicalHostname, referenceMatchState: dref.matchState, confidence: dref.matchState === 'REFERENCED' ? 'MEDIUM' : 'LOW' });
    if (dref.matchState !== 'REFERENCED' && fx.declaredWebsite) reasons.push('DOMAIN_REFERENCE_MISMATCH');
  }
  if (fx.declaredAppIdentifier) {
    const aref = resolveAppReference({ appIdentifier: fx.declaredAppIdentifier, jurisdiction: fx.jurisdiction });
    referenceLinks.push({ linkType: 'APP', targetReference: aref.canonicalAppIdentifier, referenceMatchState: aref.matchState, confidence: aref.matchState === 'REFERENCED' ? 'MEDIUM' : 'LOW' });
    if (aref.matchState !== 'REFERENCED') reasons.push('APP_REFERENCE_MISMATCH');
  }

  const { reviewPriority, reviewRequired } = derivePriority(resolution, reasons);
  const classification = classify(resolution, reasons, reviewRequired);

  return {
    product: 'GUARDIAN', jurisdiction: fx.jurisdiction, paymentSubjectId, merchantSubjectId, observationId: opts.observationId,
    channel: fx.channel, providerType: fx.providerType, providerReferenceCategory: fx.providerReference ? 'DECLARED' : 'UNKNOWN',
    registryMatchState: resolution.matchState as PaymentIntelligenceResult['registryMatchState'], resolutionState: resolution.resolutionState,
    candidateOperatorId: resolution.resolvedOperatorId, candidateBrandId: null,
    licenceReference: fx.declaredLicenceReference ?? null, licenceVerificationState: resolution.legalStanding, registryFreshness: resolution.freshness,
    referenceLinks, reviewPriority, reviewRequired, reasonCodes: dedupe(reasons),
    provenance: { evidenceReferences: [fx.evidenceReference], sourceRecordIds: resolution.provenance.sourceRecordIds },
    isIllegalDetermination: false, isEnforcementAuthorised: false, classification,
    note: 'Synthetic payment/merchant intelligence — NOT a determination of illegality and NOT an enforcement authorisation. Provider association and NO_MATCH are non-legal.',
  };
}

function derivePriority(resolution: { resolutionState: string }, reasons: PaymentReasonCode[]): { reviewPriority: ReviewPriority; reviewRequired: boolean } {
  const strong = reasons.filter((r) => r === 'MERCHANT_BRAND_MISMATCH' || r === 'MERCHANT_OPERATOR_MISMATCH' || r === 'SOURCE_CONFLICT' || r === 'NO_AUTHORITATIVE_REGISTRY_MATCH' || r === 'DOMAIN_REFERENCE_MISMATCH' || r === 'APP_REFERENCE_MISMATCH');
  if (strong.length >= 2 || reasons.includes('NO_AUTHORITATIVE_REGISTRY_MATCH')) return { reviewPriority: 'HIGH_REVIEW_PRIORITY', reviewRequired: true };
  if (reasons.includes('LICENCE_RECORD_STALE') || reasons.includes('SOURCE_CONFLICT') || strong.length === 1) return { reviewPriority: 'MEDIUM_REVIEW_PRIORITY', reviewRequired: true };
  if (resolution.resolutionState === 'MATCHED_AUTHORITATIVE') return { reviewPriority: 'LOW_REVIEW_PRIORITY', reviewRequired: false };
  return { reviewPriority: 'LOW_REVIEW_PRIORITY', reviewRequired: false };
}

function classify(resolution: { resolutionState: string; matchState: string }, reasons: PaymentReasonCode[], reviewRequired: boolean): PaymentIntelligenceResult['classification'] {
  if (resolution.resolutionState === 'MATCHED_AUTHORITATIVE' && !reviewRequired) return 'REFERENCE_MATCHED';
  if (resolution.matchState === 'NO_MATCH') return 'POTENTIALLY_UNVERIFIED_REQUIRES_REVIEW';
  return reviewRequired ? 'REQUIRES_HUMAN_REVIEW' : 'INSUFFICIENT_DATA';
}

function dedupe<T>(a: T[]): T[] { return a.filter((v, i) => a.indexOf(v) === i); }
