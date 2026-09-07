// ─── SafeBet Guardian — geo/region normalisation (ARCH-V4-C5) ─────────────────
// Deterministic, property/service/region level only. NO person-level location.
export interface GeoNormalisation { canonicalReference: string; canonicalRegionCode: string }
export function normaliseGeo(reference: string, regionCode: string): GeoNormalisation {
  const canonicalReference = reference.trim().toLowerCase().replace(/\s+/g, '');
  const canonicalRegionCode = regionCode.trim().toUpperCase().replace(/\s+/g, '');
  return { canonicalReference, canonicalRegionCode };
}
