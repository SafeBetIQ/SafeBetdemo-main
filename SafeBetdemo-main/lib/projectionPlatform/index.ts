// Enterprise Projection Platform — public API (Phase 3.3).
//
// The ONLY producer of runtime state. Consumers (future Shared Domain
// Engines, Casino Digital Twin, dashboards, reports, regulator views) read
// the models in READ_MODEL_CATALOGUE; nobody else writes them.

export {
  PROJECTION_VERSION,
  READ_MODEL_CATALOGUE,
  PLAYER_TABLE,
  SESSION_TABLE,
  MACHINE_TABLE,
  type PlayerState,
  type SessionState,
  type MachineState,
} from './readModels.ts';
export type { ProjectionStoreClient } from './apply.ts';
export type { RebuildResult } from './rebuild.ts';
export { ProjectionPlatform, getProjectionPlatform } from './platform.ts';
