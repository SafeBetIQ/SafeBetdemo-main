// ─── SafeBet Guardian — synthetic geo fixtures (ARCH-V4-C5) ───────────────────
// Property / service / region references only. SYNTHETIC. NO person-level location,
// NO ISP subscriber history, NO individual browsing/bank geography.

import type { GeoFixture, GeoRegionRef } from './types.ts';

const RGP: GeoRegionRef = { regionId: 'RGN-ZA-GP', regionCode: 'ZA-GP', regionType: 'REGULATORY_JURISDICTION', country: 'ZA', jurisdiction: 'ZA-GP' };
const RWC: GeoRegionRef = { regionId: 'RGN-ZA-WC', regionCode: 'ZA-WC', regionType: 'REGULATORY_JURISDICTION', country: 'ZA', jurisdiction: 'ZA-WC' };

export const SYNTHETIC_GEO_FIXTURES: Record<string, GeoFixture> = {
  // Scenario 1/6/7/8: licensed service, observed in matching jurisdiction, with KNOWN
  // domain + app + payment governed references. Low review.
  'licensed-example-003.test': {
    geoReference: 'licensed-example-003.test', subjectType: 'SERVICE', jurisdiction: 'ZA-GP', region: RGP,
    observationType: 'REGIONAL_AVAILABILITY', availabilityState: 'AVAILABLE', signalClass: 'DOMAIN_REGIONAL_AVAILABILITY',
    declaredServiceJurisdiction: 'ZA-GP', declaredOperatorName: null, declaredBrand: 'Safe Example Betting', declaredLicenceReference: 'LIC-ZA-GP-TEST-0001',
    declaredWebsite: 'licensed-example-003.test', declaredAppIdentifier: 'com.safebet.synthetic.bet003', declaredMerchantReference: 'MER-REF-0001',
    aggregateVisibilityMetric: null, sourceAsOf: '2026-09-01T00:00:00Z', contentHash: '1'.repeat(64), evidenceReference: 'evref:gobs-0001-a',
  },
  // Scenario 2: service licensed in ZA-GP but DECLARES it serves ZA-WC → region/licence
  // jurisdiction mismatch → human review → NOT illegal.
  'mismatch-region-005.test': {
    geoReference: 'mismatch-region-005.test', subjectType: 'SERVICE', jurisdiction: 'ZA-GP', region: RGP,
    observationType: 'REGIONAL_AVAILABILITY', availabilityState: 'AVAILABLE', signalClass: 'DECLARED_SERVICE_JURISDICTION',
    declaredServiceJurisdiction: 'ZA-WC', declaredOperatorName: null, declaredBrand: 'Safe Example Betting', declaredLicenceReference: 'LIC-ZA-GP-TEST-0001',
    declaredWebsite: null, declaredAppIdentifier: null, declaredMerchantReference: null,
    aggregateVisibilityMetric: null, sourceAsOf: '2026-09-01T00:00:00Z', contentHash: '5'.repeat(64), evidenceReference: 'evref:gobs-0005-a',
  },
  // Scenario 3: unknown synthetic service, no registry reference → NO_MATCH → review (non-legal).
  'unknown-region-004.test': {
    geoReference: 'unknown-region-004.test', subjectType: 'SERVICE', jurisdiction: 'ZA-GP', region: RGP,
    observationType: 'REGIONAL_AVAILABILITY', availabilityState: 'UNKNOWN', signalClass: 'REGULATOR_AGGREGATE_REGIONAL_OBSERVATION',
    declaredServiceJurisdiction: null, declaredOperatorName: null, declaredBrand: null, declaredLicenceReference: null,
    declaredWebsite: null, declaredAppIdentifier: null, declaredMerchantReference: null,
    aggregateVisibilityMetric: null, sourceAsOf: '2026-09-01T00:00:00Z', contentHash: '3'.repeat(64), evidenceReference: 'evref:gobs-0003-a',
  },
  // Scenario 4: stale licence reference → stale reason → review.
  'lapsed-region-009.test': {
    geoReference: 'lapsed-region-009.test', subjectType: 'SERVICE', jurisdiction: 'ZA-GP', region: RGP,
    observationType: 'REGIONAL_AVAILABILITY', availabilityState: 'AVAILABLE', signalClass: 'LICENCE_JURISDICTION',
    declaredServiceJurisdiction: 'ZA-GP', declaredOperatorName: 'Lapsed Play Synthetic Ltd', declaredBrand: null, declaredLicenceReference: null,
    declaredWebsite: null, declaredAppIdentifier: null, declaredMerchantReference: null,
    aggregateVisibilityMetric: null, sourceAsOf: '2024-01-15T00:00:00Z', contentHash: '9'.repeat(64), evidenceReference: 'evref:gobs-0009-a',
  },
  // Scenario 5: conflicting registry source → human review.
  'conflict-region-002.test': {
    geoReference: 'conflict-region-002.test', subjectType: 'SERVICE', jurisdiction: 'ZA-GP', region: RGP,
    observationType: 'REGIONAL_AVAILABILITY', availabilityState: 'AVAILABLE', signalClass: 'LICENCE_JURISDICTION',
    declaredServiceJurisdiction: 'ZA-GP', declaredOperatorName: 'Conflicted Operator Synthetic (Pty) Ltd', declaredBrand: null, declaredLicenceReference: null,
    declaredWebsite: null, declaredAppIdentifier: null, declaredMerchantReference: null,
    aggregateVisibilityMetric: null, sourceAsOf: '2026-08-02T00:00:00Z', contentHash: '2'.repeat(64), evidenceReference: 'evref:gobs-0002-a',
  },
  // Scenario 9: wrong-jurisdiction (ZA-WC) service — a ZA-GP worker must DENY.
  'western-region-100.test': {
    geoReference: 'western-region-100.test', subjectType: 'SERVICE', jurisdiction: 'ZA-WC', region: RWC,
    observationType: 'REGIONAL_AVAILABILITY', availabilityState: 'AVAILABLE', signalClass: 'DECLARED_SERVICE_JURISDICTION',
    declaredServiceJurisdiction: 'ZA-WC', declaredOperatorName: 'Western Synthetic Betting (Pty) Ltd', declaredBrand: null, declaredLicenceReference: null,
    declaredWebsite: null, declaredAppIdentifier: null, declaredMerchantReference: null,
    aggregateVisibilityMetric: null, sourceAsOf: '2026-09-01T00:00:00Z', contentHash: 'c'.repeat(64), evidenceReference: 'evref:gobs-0100-a',
  },
  // Scenario 12: regional availability changed → INCONSISTENT → append history (prior preserved).
  'changed-region-012.test': {
    geoReference: 'changed-region-012.test', subjectType: 'SERVICE', jurisdiction: 'ZA-GP', region: RGP,
    observationType: 'REGIONAL_AVAILABILITY', availabilityState: 'INCONSISTENT', signalClass: 'DOMAIN_REGIONAL_AVAILABILITY',
    declaredServiceJurisdiction: 'ZA-GP', declaredOperatorName: null, declaredBrand: 'Safe Example Betting', declaredLicenceReference: 'LIC-ZA-GP-TEST-0001',
    declaredWebsite: 'licensed-example-003.test', declaredAppIdentifier: null, declaredMerchantReference: null,
    aggregateVisibilityMetric: null, sourceAsOf: '2026-09-05T00:00:00Z', contentHash: 'd'.repeat(64), evidenceReference: 'evref:gobs-0012-a',
  },
  // Scenario 13: synthetic AGGREGATE regional visibility signal (region-level, not person-level) → accepted.
  'aggregate-region-013.test': {
    geoReference: 'aggregate-region-013.test', subjectType: 'SERVICE', jurisdiction: 'ZA-GP', region: RGP,
    observationType: 'AGGREGATE_REGION_VISIBILITY', availabilityState: 'AVAILABLE', signalClass: 'AGGREGATE_REGION_VISIBILITY_METRIC',
    declaredServiceJurisdiction: 'ZA-GP', declaredOperatorName: null, declaredBrand: 'Safe Example Betting', declaredLicenceReference: 'LIC-ZA-GP-TEST-0001',
    declaredWebsite: null, declaredAppIdentifier: null, declaredMerchantReference: null,
    aggregateVisibilityMetric: 42, sourceAsOf: '2026-09-06T00:00:00Z', contentHash: 'a'.repeat(64), evidenceReference: 'evref:gobs-0013-a',
  },
};
