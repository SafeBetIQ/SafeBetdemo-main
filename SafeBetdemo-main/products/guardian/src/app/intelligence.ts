// ─── SafeBet Guardian — Mobile App Intelligence engine (ARCH-V4-C3) ───────────
//
// SYNTHETIC app fixture → normalise identity → deterministic signals → resolve
// operator/brand/licence via the C1 GOVERNED CONTRACT (resolveLegalReference — not raw
// tables) → governed app→domain link (via the C2 domain fixtures, not raw domain tables)
// → structured NON-LEGAL result. NO_MATCH != ILLEGAL. No AI. No enforcement.

import type { RegistrySnapshot } from '../registry/types.ts';
import { resolveLegalReference } from '../registry/resolve.ts';
import { SYNTHETIC_DOMAIN_FIXTURES } from '../domain/fixtures.ts';
import { normaliseHostname } from '../domain/normalise.ts';
import { normaliseAppIdentifier } from './normalise.ts';
import { appContentSignals, appTechnicalSignals, extractAppLicenceReference } from './signals.ts';
import type { AppFixture, AppIntelligenceResult, AppReasonCode, AppDomainRef } from './types.ts';
import type { ReviewPriority } from '../domain/types.ts';

/** Governed app→domain link: resolve a declared website to a KNOWN C2 domain (by the
 *  domain fixtures — a governed contract, not raw domain-table coupling). Unknown
 *  declared domains are recorded as a reference with no match (no illegality inferred). */
export function resolveAppDomainLinks(fx: AppFixture): AppDomainRef[] {
  const refs: AppDomainRef[] = [];
  const add = (linkType: AppDomainRef['linkType'], declared: string | null | undefined) => {
    if (!declared) return;
    const canonical = normaliseHostname(declared).canonical;
    const known = Object.values(SYNTHETIC_DOMAIN_FIXTURES).find((d) => d.jurisdiction === fx.jurisdiction && normaliseHostname(d.hostname).canonical === canonical);
    refs.push({ linkType, declaredDomain: canonical, matchedDomainId: known ? `DOM-${canonical}` : null, confidence: known ? 'MEDIUM' : 'LOW' });
  };
  add('APP_DECLARED_WEBSITE', fx.declaredWebsite);
  add('APP_SUPPORT_DOMAIN', fx.supportReference);
  add('APP_PRIVACY_DOMAIN', fx.privacyReference);
  return refs;
}

export function analyseApp(
  registry: RegistrySnapshot,
  fx: AppFixture,
  opts: { observationId: string; now?: Date },
): AppIntelligenceResult {
  const now = opts.now ?? new Date();
  const norm = normaliseAppIdentifier(fx.appIdentifier);
  const appSubjectId = `APP-${norm.canonical}`;
  const content = appContentSignals(fx);
  const tech = appTechnicalSignals(fx);
  const gambling = content.find((c) => c.signalType === 'GAMBLING_TERMINOLOGY')?.present ?? false;

  const licenceReference = extractAppLicenceReference(fx);
  const subject = { jurisdiction: fx.jurisdiction, legalName: fx.declaredOperatorName ?? undefined, brandName: fx.declaredBrand ?? undefined, licenceReference: licenceReference ?? undefined };
  const resolution = resolveLegalReference(registry, subject, now);

  const reasons: AppReasonCode[] = [];
  if (resolution.matchState === 'NO_MATCH') reasons.push('NO_AUTHORITATIVE_REGISTRY_MATCH');
  if (gambling) reasons.push('GAMBLING_CONTENT_SIGNAL');
  if (resolution.freshness === 'STALE') reasons.push('LICENCE_RECORD_STALE');
  if (resolution.resolutionState === 'SOURCE_CONFLICT' || resolution.resolutionState === 'REQUIRES_REVIEW') reasons.push('SOURCE_CONFLICT');
  if (resolution.resolutionState === 'MULTIPLE_MATCHES') reasons.push('UNKNOWN_PUBLISHER_REFERENCE');
  if (!fx.declaredOperatorName && !fx.declaredBrand && !licenceReference) reasons.push('UNKNOWN_PUBLISHER_REFERENCE');

  // Declared-licence/operator/brand mismatch (deterministic).
  if (fx.declaredBrand && licenceReference) {
    const brandRes = resolveLegalReference(registry, { jurisdiction: fx.jurisdiction, brandName: fx.declaredBrand }, now);
    const licRes = resolveLegalReference(registry, { jurisdiction: fx.jurisdiction, licenceReference }, now);
    if (brandRes.resolvedOperatorId && licRes.resolvedOperatorId && brandRes.resolvedOperatorId !== licRes.resolvedOperatorId) {
      reasons.push('DECLARED_BRAND_MISMATCH');
      reasons.push('DECLARED_LICENCE_MISMATCH');
    }
  }

  const domainReferences = resolveAppDomainLinks(fx);
  const { reviewPriority, reviewRequired } = derivePriority(resolution, reasons);
  const classification = classify(resolution, reasons, reviewRequired);

  return {
    product: 'GUARDIAN', jurisdiction: fx.jurisdiction, appSubjectId, canonicalAppIdentifier: norm.canonical, observationId: opts.observationId,
    platformType: fx.platformType,
    registryMatchState: resolution.matchState as AppIntelligenceResult['registryMatchState'], resolutionState: resolution.resolutionState,
    candidateOperatorId: resolution.resolvedOperatorId, candidateBrandId: null,
    licenceReference: licenceReference ?? null, licenceVerificationState: resolution.legalStanding, registryFreshness: resolution.freshness,
    contentSignals: content, technicalSignals: tech, domainReferences,
    reviewPriority, reviewRequired, reasonCodes: dedupe(reasons),
    provenance: { evidenceReferences: [fx.evidenceReference], sourceRecordIds: resolution.provenance.sourceRecordIds },
    isIllegalDetermination: false, classification,
    note: 'Synthetic mobile-app intelligence — NOT a determination of illegality. Signals, NO_MATCH and platform presence/absence are non-legal.',
  };
}

function derivePriority(resolution: { resolutionState: string }, reasons: AppReasonCode[]): { reviewPriority: ReviewPriority; reviewRequired: boolean } {
  const strong = reasons.filter((r) => r === 'DECLARED_BRAND_MISMATCH' || r === 'DECLARED_LICENCE_MISMATCH' || r === 'DECLARED_OPERATOR_MISMATCH' || r === 'SOURCE_CONFLICT' || r === 'NO_AUTHORITATIVE_REGISTRY_MATCH');
  const noMatchGambling = reasons.includes('NO_AUTHORITATIVE_REGISTRY_MATCH') && reasons.includes('GAMBLING_CONTENT_SIGNAL');
  if (strong.length >= 2 || noMatchGambling) return { reviewPriority: 'HIGH_REVIEW_PRIORITY', reviewRequired: true };
  if (reasons.includes('LICENCE_RECORD_STALE') || reasons.includes('SOURCE_CONFLICT') || strong.length === 1) return { reviewPriority: 'MEDIUM_REVIEW_PRIORITY', reviewRequired: true };
  if (resolution.resolutionState === 'MATCHED_AUTHORITATIVE') return { reviewPriority: 'LOW_REVIEW_PRIORITY', reviewRequired: false };
  return { reviewPriority: 'LOW_REVIEW_PRIORITY', reviewRequired: false };
}

function classify(resolution: { resolutionState: string; matchState: string }, reasons: AppReasonCode[], reviewRequired: boolean): AppIntelligenceResult['classification'] {
  if (resolution.resolutionState === 'MATCHED_AUTHORITATIVE' && !reviewRequired) return 'REFERENCE_MATCHED';
  if (resolution.matchState === 'NO_MATCH') return reasons.includes('GAMBLING_CONTENT_SIGNAL') ? 'POTENTIALLY_UNAUTHORISED_REQUIRES_VERIFICATION' : 'INSUFFICIENT_DATA';
  return 'REQUIRES_HUMAN_REVIEW';
}

function dedupe<T>(a: T[]): T[] { return a.filter((v, i) => a.indexOf(v) === i); }
