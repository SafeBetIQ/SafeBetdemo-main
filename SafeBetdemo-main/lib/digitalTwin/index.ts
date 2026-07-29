// Enterprise Casino Digital Twin — public API (Phase 3.4).
//
// Consumers obtain THE twin via getDigitalTwin(casinoId) and only ever read
// it (dashboards, reports, regulator views) or enrich it (Phase 3.5 Shared
// Domain Engines via registerEngine). The twin exposes no persistence and
// no event ingestion — events enter ONLY through the Enterprise Event
// Platform, state is produced ONLY by the Enterprise Projection Platform.

export {
  type PlayerTwin, type SessionTwin, type MachineTwin,
  type GamingFloorTwin, type InterventionTwin,
  type CasinoAggregates, type TwinEnrichments,
} from './runtimeObjects.ts';
export { TwinRegistry, type TwinObject, type InterventionStateRow } from './registry.ts';
export { type TwinEnrichmentEngine, type EnrichmentContext, getEnrichment } from './extensions.ts';
export { type TwinHealth, type TwinLifecycleState } from './health.ts';
export { type FloorOccupancy, type OperationalAlert } from './queries.ts';
export { OBSERVED_TABLES } from './sync.ts';
export {
  CasinoDigitalTwin, getDigitalTwin, type CasinoTwinSnapshot,
} from './twin.ts';
