// ─── SafeBet Guardian — Geo & Jurisdiction Intelligence engine (ARCH-V4-C5) ───
//
// SYNTHETIC geo fixture → normalise region/reference → deterministic signals →
// resolve operator/brand/licence via the C1 GOVERNED CONTRACT (resolveLegalReference)
// → governed domain/app/payment links via the C2 Domain Reference Contract + C3 App
// Reference Contract + C4 Payment Reference Contract (never raw base tables) → compare
// expected legal jurisdiction vs observed region → structured NON-LEGAL, NON-
// ENFORCEMENT result.
//
// SERVICE OBSERVED IN REGION != ILLEGAL. LICENCE JURISDICTION MISMATCH != FINAL LEGAL
// FINDING. UNKNOWN GEO SIGNAL != ILLEGAL. HIGH PRIORITY != ENFORCEMENT. No AI. No geo
// block / no service block / no provider referral. No person-level location is read.

import type { RegistrySnapshot } from '../registry/types.ts';
import { resolveLegalReference } from '../registry/resolve.ts';
import { resolveDomainReference } from '../domain/contract.ts';
import { resolveAppReference } from '../app/contract.ts';
import { resolvePaymentReference } from '../payment/contract.ts';
import { normaliseGeo } from './normalise.ts';
import { geoSignals } from './signals.ts';
import type { GeoFixture, GeoIntelligenceResult, GeoReasonCode, GeoReferenceLink } from './types.ts';
import type { ReviewPriority } from '../domain/types.ts';

function licenceJurisdiction(registry: RegistrySnapshot, licenceReference?: string | null): string | null {
  if (!licenceReference) return null;
  const lic = registry.licences.find((l) => l.licenceReference === licenceReference);
  return lic ? lic.jurisdiction : null;
}

export function analyseGeo(
  registry: RegistrySnapshot,
  fx: GeoFixture,
  opts: { observationId: string; now?: Date },
): GeoIntelligenceResult {
  const now = opts.now ?? new Date();
  const norm = normaliseGeo(fx.geoReference, fx.region.regionCode);
  const geoSubjectId = `GEO-${norm.canonicalReference}`;
  geoSignals(fx); // deterministic signal derivation (region/service level only)

  const subject = { jurisdiction: fx.jurisdiction, legalName: fx.declaredOperatorName ?? undefined, brandName: fx.declaredBrand ?? undefined, licenceReference: fx.declaredLicenceReference ?? undefined };
  const resolution = resolveLegalReference(registry, subject, now);
  const licJur = licenceJurisdiction(registry, fx.declaredLicenceReference);
  const expectedRegulatoryJurisdiction = licJur ?? (resolution.resolvedOperatorId ? fx.region.jurisdiction : null);

  const reasons: GeoReasonCode[] = [];
  if (resolution.matchState === 'NO_MATCH') reasons.push('NO_AUTHORITATIVE_REGISTRY_MATCH');
  if (resolution.freshness === 'STALE') reasons.push('REGISTRY_REFERENCE_STALE');
  if (resolution.resolutionState === 'SOURCE_CONFLICT' || resolution.resolutionState === 'REQUIRES_REVIEW') reasons.push('SOURCE_CONFLICT');

  // Region / jurisdiction consistency (deterministic, explainable). A service licensed
  // in one jurisdiction that DECLARES it serves another, or is OBSERVED available in a
  // region outside its licence scope, is a NON-LEGAL review signal (never a finding).
  if (licJur && fx.declaredServiceJurisdiction && licJur !== fx.declaredServiceJurisdiction) reasons.push('LICENCE_JURISDICTION_MISMATCH');
  if (fx.declaredServiceJurisdiction && fx.declaredServiceJurisdiction !== fx.region.regionCode) reasons.push('DECLARED_REGION_MISMATCH');
  if (expectedRegulatoryJurisdiction && expectedRegulatoryJurisdiction !== fx.region.regionCode && resolution.matchState !== 'NO_MATCH') reasons.push('SERVICE_REGION_MISMATCH');
  if (fx.availabilityState === 'UNKNOWN' && resolution.matchState === 'NO_MATCH') reasons.push('UNKNOWN_REGION_REFERENCE');
  if (fx.availabilityState === 'INCONSISTENT') reasons.push('REGIONAL_AVAILABILITY_CHANGED');

  // Governed cross-module reference links (contracts only — never base tables).
  const referenceLinks: GeoReferenceLink[] = [];
  if (resolution.resolvedOperatorId) referenceLinks.push({ linkType: 'OPERATOR', targetReference: resolution.resolvedOperatorId, referenceMatchState: resolution.resolutionState, confidence: 'MEDIUM' });
  if (fx.declaredLicenceReference && resolution.licenceId) referenceLinks.push({ linkType: 'LICENCE', targetReference: fx.declaredLicenceReference, referenceMatchState: resolution.resolutionState, confidence: 'MEDIUM' });
  let domainReferenceState: string | null = null;
  let appReferenceState: string | null = null;
  let paymentReferenceState: string | null = null;
  if (fx.declaredWebsite) {
    const dref = resolveDomainReference({ hostname: fx.declaredWebsite, jurisdiction: fx.jurisdiction });
    domainReferenceState = dref.matchState;
    referenceLinks.push({ linkType: 'DOMAIN', targetReference: dref.canonicalHostname, referenceMatchState: dref.matchState, confidence: dref.matchState === 'REFERENCED' ? 'MEDIUM' : 'LOW' });
    if (dref.matchState !== 'REFERENCED') reasons.push('DOMAIN_REGION_INCONSISTENCY');
  }
  if (fx.declaredAppIdentifier) {
    const aref = resolveAppReference({ appIdentifier: fx.declaredAppIdentifier, jurisdiction: fx.jurisdiction });
    appReferenceState = aref.matchState;
    referenceLinks.push({ linkType: 'APP', targetReference: aref.canonicalAppIdentifier, referenceMatchState: aref.matchState, confidence: aref.matchState === 'REFERENCED' ? 'MEDIUM' : 'LOW' });
    if (aref.matchState !== 'REFERENCED') reasons.push('APP_REGION_INCONSISTENCY');
  }
  if (fx.declaredMerchantReference) {
    const pref = resolvePaymentReference({ merchantReference: fx.declaredMerchantReference, jurisdiction: fx.jurisdiction });
    paymentReferenceState = pref.matchState;
    referenceLinks.push({ linkType: 'PAYMENT', targetReference: fx.declaredMerchantReference, referenceMatchState: pref.matchState, confidence: pref.matchState === 'REFERENCED' ? 'MEDIUM' : 'LOW' });
    if (pref.matchState !== 'REFERENCED') reasons.push('PAYMENT_REGION_INCONSISTENCY');
  }

  const dedupedReasons = dedupe(reasons);
  const { reviewPriority, reviewRequired } = derivePriority(resolution, dedupedReasons);
  const classification = classify(resolution, dedupedReasons, reviewRequired);
  const registryLastVerified = registry.licences.find((l) => l.licenceReference === fx.declaredLicenceReference)?.lastVerifiedAt ?? null;

  return {
    product: 'GUARDIAN', jurisdiction: fx.jurisdiction, geoSubjectId, observationId: opts.observationId,
    subjectType: fx.subjectType, region: fx.region, expectedRegulatoryJurisdiction,
    observedAvailabilityState: fx.availabilityState,
    registryMatchState: resolution.matchState as GeoIntelligenceResult['registryMatchState'], resolutionState: resolution.resolutionState,
    candidateOperatorId: resolution.resolvedOperatorId, licenceReference: fx.declaredLicenceReference ?? null, licenceJurisdiction: licJur,
    domainReferenceState, appReferenceState, paymentReferenceState, registryFreshness: resolution.freshness,
    referenceLinks, reviewPriority, reviewRequired, reasonCodes: dedupedReasons,
    provenance: { evidenceReferences: [fx.evidenceReference], sourceRecordIds: resolution.provenance.sourceRecordIds },
    freshness: { geoObservedAt: now.toISOString(), sourceAsOf: fx.sourceAsOf ?? null, registryLastVerified },
    isIllegalDetermination: false, isEnforcementAuthorised: false, classification,
    note: 'Synthetic geo/jurisdiction intelligence — NOT a determination of illegality and NOT an enforcement authorisation. Regional availability and jurisdiction mismatch are non-legal review signals. No individual is tracked.',
  };
}

function derivePriority(resolution: { resolutionState: string }, reasons: GeoReasonCode[]): { reviewPriority: ReviewPriority; reviewRequired: boolean } {
  const strong = reasons.filter((r) => r === 'LICENCE_JURISDICTION_MISMATCH' || r === 'SERVICE_REGION_MISMATCH' || r === 'SOURCE_CONFLICT' || r === 'NO_AUTHORITATIVE_REGISTRY_MATCH' || r === 'DOMAIN_REGION_INCONSISTENCY' || r === 'APP_REGION_INCONSISTENCY' || r === 'PAYMENT_REGION_INCONSISTENCY');
  if (strong.length >= 2 || reasons.includes('NO_AUTHORITATIVE_REGISTRY_MATCH')) return { reviewPriority: 'HIGH_REVIEW_PRIORITY', reviewRequired: true };
  if (reasons.includes('REGISTRY_REFERENCE_STALE') || reasons.includes('SOURCE_CONFLICT') || reasons.includes('DECLARED_REGION_MISMATCH') || reasons.includes('REGIONAL_AVAILABILITY_CHANGED') || strong.length === 1) return { reviewPriority: 'MEDIUM_REVIEW_PRIORITY', reviewRequired: true };
  if (resolution.resolutionState === 'MATCHED_AUTHORITATIVE') return { reviewPriority: 'LOW_REVIEW_PRIORITY', reviewRequired: false };
  return { reviewPriority: 'LOW_REVIEW_PRIORITY', reviewRequired: false };
}

function classify(resolution: { resolutionState: string; matchState: string }, reasons: GeoReasonCode[], reviewRequired: boolean): GeoIntelligenceResult['classification'] {
  if (resolution.resolutionState === 'MATCHED_AUTHORITATIVE' && !reviewRequired) return 'REGION_REFERENCE_MATCHED';
  if (resolution.matchState === 'NO_MATCH') return 'REGIONAL_INCONSISTENCY_REQUIRES_REVIEW';
  return reviewRequired ? 'REQUIRES_HUMAN_REVIEW' : 'INSUFFICIENT_DATA';
}

function dedupe<T>(a: T[]): T[] { return a.filter((v, i) => a.indexOf(v) === i); }
