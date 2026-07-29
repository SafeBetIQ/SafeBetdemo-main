// ─── Enterprise Projection Platform (Phase 3.3) ──────────────────────────────
//
// THE enterprise read side. The ONLY producer of runtime state.
//
// Responsibilities: projection generation, rebuilding, consistency,
// publishing (Realtime on the projection tables), replay (rebuild from the
// immutable log), versioning (PROJECTION_VERSION), invalidation
// (dispose + rebuild). NOTHING else — no business logic; reducers
// materialize event facts exactly as recorded.
//
// In-flow position: invoked by the Enterprise Event Platform immediately
// after event persistence. The SAME envelopes continue through here — no
// second pipeline, no re-reading, no event copies.
//
// Future consumers (Shared Domain Engines 3.6, Casino Digital Twin 3.5,
// dashboards 3.7) read the models in readModels.READ_MODEL_CATALOGUE.

import type { CasinoEventEnvelope } from '../eventPlatform/index.ts';
import { loadStates, reduceEnvelopes, writeStatesVersioned, type ProjectionStoreClient } from './apply.ts';
import { rebuildCasinoProjections, type RebuildResult } from './rebuild.ts';
import { PROJECTION_VERSION } from './readModels.ts';
import { emit, increment } from '../observability/telemetry.ts';

/** Bounded retries for optimistic-concurrency version conflicts. */
const MAX_APPLY_ATTEMPTS = 5;

export class ProjectionPlatform {
  readonly version = PROJECTION_VERSION;

  /**
   * Apply a batch of just-persisted envelopes to the read models
   * (load → reduce with the pure reducers → upsert). The legacy
   * machine_activity / live_kpi_snapshots mirrors were retired in Phase
   * 3.7 — the read-model catalogue is the ONLY runtime state.
   */
  async applyEnvelopes(client: ProjectionStoreClient, envelopes: CasinoEventEnvelope[]): Promise<void> {
    if (envelopes.length === 0) return;
    const casinoId = envelopes[0].casinoId;

    // Optimistic concurrency: load → reduce → versioned write; on a version
    // conflict (a concurrent writer committed first) reload fresh state and
    // re-reduce. Reduction is deterministic, so retries converge. Each event
    // is unique at this point (idempotent ingestion), so re-reduction never
    // double-applies.
    for (let attempt = 1; attempt <= MAX_APPLY_ATTEMPTS; attempt++) {
      const states = await loadStates(client, casinoId, envelopes);
      reduceEnvelopes(states, envelopes);
      const committed = await writeStatesVersioned(client, casinoId, states);
      if (committed) {
        increment('projection.applied');
        if (attempt > 1) increment('projection.retried', attempt - 1);
        return;
      }
      increment('projection.occ_conflict');
      emit('warn', 'projectionPlatform.apply', 'occ_conflict', { casinoId, attempt });
    }
    throw new Error(`projection apply exhausted ${MAX_APPLY_ATTEMPTS} optimistic-concurrency attempts for casino ${casinoId}`);
  }

  /**
   * Replay: dispose a casino's projections and rebuild them entirely from
   * the immutable event log, through the same reducers as the live path.
   */
  rebuild(client: ProjectionStoreClient, casinoId: string): Promise<RebuildResult> {
    return rebuildCasinoProjections(client, casinoId);
  }
}

let defaultPlatform: ProjectionPlatform | undefined;

/** Application-wide Enterprise Projection Platform instance. */
export function getProjectionPlatform(): ProjectionPlatform {
  if (!defaultPlatform) defaultPlatform = new ProjectionPlatform();
  return defaultPlatform;
}
