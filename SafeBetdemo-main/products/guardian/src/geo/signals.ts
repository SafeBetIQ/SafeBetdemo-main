// ─── SafeBet Guardian — deterministic geo signals (ARCH-V4-C5) ────────────────
// Region/property/service-level ONLY. No person-level location signal is ever built.
import type { GeoFixture } from './types.ts';
export interface GeoSignal { signalType: string; value: string }
export function geoSignals(fx: GeoFixture): GeoSignal[] {
  const s: GeoSignal[] = [
    { signalType: 'GEO_REFERENCE', value: fx.geoReference },
    { signalType: 'SUBJECT_TYPE', value: fx.subjectType },
    { signalType: 'REGION_CODE', value: fx.region.regionCode },
    { signalType: 'SIGNAL_CLASS', value: fx.signalClass },
    { signalType: 'AVAILABILITY_STATE', value: fx.availabilityState },
    { signalType: 'CONTENT_FINGERPRINT', value: fx.contentHash },
  ];
  if (fx.declaredServiceJurisdiction) s.push({ signalType: 'DECLARED_SERVICE_JURISDICTION', value: fx.declaredServiceJurisdiction });
  if (typeof fx.aggregateVisibilityMetric === 'number') s.push({ signalType: 'AGGREGATE_REGION_VISIBILITY_METRIC', value: String(fx.aggregateVisibilityMetric) });
  return s;
}
