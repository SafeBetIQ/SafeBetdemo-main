// ─── SafeBet Guardian — Geo Reference Contract (ARCH-V4-C6) ───────────────────
//
// The GOVERNED interface by which OTHER Guardian modules (e.g. Case & Investigation
// Management) obtain a bounded Geo reference — WITHOUT depending on Geo Intelligence's
// persistence implementation or base tables. Parallel to the Domain (C3.1), App (C4)
// and Payment (C5) Reference Contracts.
//
//   Owner:     Geo & Jurisdiction Intelligence (C5)
//   Consumers: Case & Investigation Management (C6), future modules
//   Returns:   ONLY the bounded fields below. Jurisdiction-scoped.
//
// Two aligned implementations: this pure TS function (over the synthetic geo fixtures)
// and the bounded DB view `guardian.geo_reference`. Neither exposes the C5 base tables.

import { SYNTHETIC_GEO_FIXTURES } from './fixtures.ts';
import { normaliseGeo } from './normalise.ts';

export type GeoReferenceMatchState = 'REFERENCED' | 'GEO_REFERENCE_NOT_FOUND';

export interface GeoReferenceQuery { geoReference: string; jurisdiction: string; correlationId?: string }

export interface GeoReference {
  matchState: GeoReferenceMatchState;
  geoReferenceId: string | null;
  subjectType: string;
  jurisdiction: string;
  regionReference: string | null;
  availabilityState: string;
  freshness: 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN';
  referenceStatus: 'REFERENCED' | 'NOT_FOUND';
}

/** Resolve a bounded Geo reference for one service/property reference in one jurisdiction.
 *  Jurisdiction-scoped: a reference known only in another jurisdiction returns
 *  GEO_REFERENCE_NOT_FOUND (never cross-jurisdiction data). NOT_FOUND is a bounded
 *  no-match — it is NOT illegal. */
export function resolveGeoReference(q: GeoReferenceQuery): GeoReference {
  const canonical = normaliseGeo(q.geoReference, '').canonicalReference;
  const known = Object.values(SYNTHETIC_GEO_FIXTURES).find(
    (g) => g.jurisdiction === q.jurisdiction && normaliseGeo(g.geoReference, '').canonicalReference === canonical,
  );
  if (!known) {
    return { matchState: 'GEO_REFERENCE_NOT_FOUND', geoReferenceId: null, subjectType: 'SERVICE', jurisdiction: q.jurisdiction, regionReference: null, availabilityState: 'UNKNOWN', freshness: 'UNKNOWN', referenceStatus: 'NOT_FOUND' };
  }
  return { matchState: 'REFERENCED', geoReferenceId: null, subjectType: known.subjectType, jurisdiction: q.jurisdiction, regionReference: known.region.regionId, availabilityState: known.availabilityState, freshness: 'FRESH', referenceStatus: 'REFERENCED' };
}
