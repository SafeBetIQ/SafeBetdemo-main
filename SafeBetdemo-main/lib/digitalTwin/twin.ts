// ─── Enterprise Casino Digital Twin (Phase 3.4) ──────────────────────────────
//
// THE live operational model of one casino at this exact moment — the ONLY
// runtime representation. It sits in the enterprise flow strictly AFTER the
// Enterprise Projection Platform:
//
//   … Event Platform → Projection Platform → DIGITAL TWIN → (3.5 engines)
//                                             → Realtime → Dashboards → Reports
//
// The twin ASSEMBLES the projection read models into one shared object
// graph and keeps it current by observing projection changes. It owns NO
// history (events do), NO projections (the Projection Platform does), NO
// business logic (reducers/views/engines do), and NO persistence — it is
// disposable and always reconstructable via projections from the immutable
// event log.
//
// Lifecycle: created → assembling → live → (stale on sync loss) → disposed.

import type { ProjectionStoreClient } from '../projectionPlatform/index.ts';
import { assembleCasinoTwin, type AssemblyResult } from './assembly.ts';
import { ExtensionHost, type TwinEnrichmentEngine } from './extensions.ts';
import { assessHealth, type TwinHealth, type TwinLifecycleState } from './health.ts';
import {
  activeInterventions, activePlayers, busiestFloor, floorOccupancy,
  occupiedMachines, openSessions, operationalAlerts, playersRequiringMonitoring,
  type FloorOccupancy, type OperationalAlert,
} from './queries.ts';
import { TwinRegistry } from './registry.ts';
import { applyProjectionChange, subscribeToProjections, type RealtimeCapableClient } from './sync.ts';
import { emptyAggregates, type CasinoAggregates } from './runtimeObjects.ts';

export interface CasinoTwinSnapshot {
  casinoId: string;
  state: TwinLifecycleState;
  assembledAt: string | null;
  /** Casino aggregates as projected by projection_casino_state. */
  aggregates: CasinoAggregates;
  activePlayers: number;
  openSessions: number;
  occupiedMachines: number;
  floors: FloorOccupancy[];
  busiestFloor: FloorOccupancy | null;
  activeInterventions: number;
  playersRequiringMonitoring: number;
  alerts: OperationalAlert[];
  health: TwinHealth;
}

export class CasinoDigitalTwin {
  readonly casinoId: string;
  readonly registry: TwinRegistry;

  private lifecycle: TwinLifecycleState = 'created';
  private aggregates: CasinoAggregates = emptyAggregates();
  private assembledAt: string | null = null;
  private lastChangeAt: string | null = null;
  private client: ProjectionStoreClient | null = null;
  private unsubscribe: (() => void) | null = null;
  private extensions = new ExtensionHost(() => ({ registry: this.registry }));

  constructor(casinoId: string) {
    this.casinoId = casinoId;
    this.registry = new TwinRegistry(casinoId);
    // Every registry mutation flows through the extension host, so Phase 3.5
    // engines enrich the SAME instances the moment they change.
    this.registry.onUpdate(object => this.extensions.apply(object));
  }

  get state(): TwinLifecycleState { return this.lifecycle; }

  /**
   * Assemble the twin from the Projection Platform's read models and,
   * when the client supports Realtime, start observing projection changes.
   */
  async start(client: ProjectionStoreClient, opts: { observe?: boolean } = {}): Promise<AssemblyResult> {
    if (this.lifecycle === 'disposed') throw new Error('digital twin is disposed — create a new one via getDigitalTwin()');
    this.client = client;
    this.lifecycle = 'assembling';
    const result = await assembleCasinoTwin(client, this.registry);
    this.aggregates = result.aggregates;
    this.assembledAt = result.assembledAt;
    this.lifecycle = 'live';
    this.reenrich(); // enrichment over the complete casino, in dependency order

    if (opts.observe !== false && this.isRealtimeCapable(client) && !this.unsubscribe) {
      this.unsubscribe = subscribeToProjections(client, this.registry, () => {
        this.lastChangeAt = new Date().toISOString();
      });
    }
    return result;
  }

  /** Re-assemble from projections (aggregates + view memberships refresh too). */
  async refresh(): Promise<AssemblyResult> {
    if (!this.client) throw new Error('digital twin has not been started');
    const result = await assembleCasinoTwin(this.client, this.registry);
    this.aggregates = result.aggregates;
    this.assembledAt = result.assembledAt;
    if (this.lifecycle !== 'disposed') this.lifecycle = 'live';
    this.reenrich();
    return result;
  }

  /** Direct entry for projection-change payloads (used by hosts and tests). */
  applyProjectionChange(table: string, row: Record<string, unknown>): boolean {
    const applied = applyProjectionChange(this.registry, table, row);
    if (applied) this.lastChangeAt = new Date().toISOString();
    return applied;
  }

  // ── Extension points (Phase 3.5 Shared Domain Engines) ────────────────────
  registerEngine(engine: TwinEnrichmentEngine): void { this.extensions.register(engine); }
  unregisterEngine(engineId: string): void { this.extensions.unregister(engineId); }
  get registeredEngineIds(): string[] { return this.extensions.registeredEngineIds; }

  /**
   * Run every registered engine over every runtime object. Called after
   * assembly (so enrichment always sees the COMPLETE casino, not a
   * half-loaded one) and by engines attaching to an already-live twin.
   */
  reenrich(): void {
    this.registry.players.forEach(o => this.extensions.apply(o));
    this.registry.sessions.forEach(o => this.extensions.apply(o));
    this.registry.machines.forEach(o => this.extensions.apply(o));
    this.registry.floors.forEach(o => this.extensions.apply(o));
    this.registry.interventions.forEach(o => this.extensions.apply(o));
  }

  // ── Operational questions — assembly only, no business logic ──────────────
  activePlayers() { return activePlayers(this.registry); }
  openSessions() { return openSessions(this.registry); }
  occupiedMachines() { return occupiedMachines(this.registry); }
  floorOccupancy() { return floorOccupancy(this.registry); }
  busiestFloor() { return busiestFloor(this.registry); }
  activeInterventions() { return activeInterventions(this.registry); }
  playersRequiringMonitoring() { return playersRequiringMonitoring(this.registry); }
  operationalAlerts() { return operationalAlerts(this.registry); }
  casinoAggregates(): CasinoAggregates { return { ...this.aggregates }; }

  health(): TwinHealth {
    return assessHealth(this.registry, {
      state: this.lifecycle,
      assembledAt: this.assembledAt,
      lastChangeAt: this.lastChangeAt,
      observing: this.unsubscribe !== null,
    });
  }

  /** One coherent "casino at this exact moment" view. */
  snapshot(): CasinoTwinSnapshot {
    return {
      casinoId: this.casinoId,
      state: this.lifecycle,
      assembledAt: this.assembledAt,
      aggregates: this.casinoAggregates(),
      activePlayers: this.activePlayers().length,
      openSessions: this.openSessions().length,
      occupiedMachines: this.occupiedMachines().length,
      floors: this.floorOccupancy(),
      busiestFloor: this.busiestFloor(),
      activeInterventions: this.activeInterventions().length,
      playersRequiringMonitoring: this.playersRequiringMonitoring().length,
      alerts: this.operationalAlerts(),
      health: this.health(),
    };
  }

  /** Memory lifecycle: release observation, engines and every runtime object. */
  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.extensions.dispose();
    this.registry.dispose();
    this.client = null;
    this.lifecycle = 'disposed';
  }

  private isRealtimeCapable(client: ProjectionStoreClient): client is ProjectionStoreClient & RealtimeCapableClient {
    const c = client as Partial<RealtimeCapableClient>;
    return typeof c.channel === 'function' && typeof c.removeChannel === 'function';
  }
}

// ─── ONE twin per casino per process ─────────────────────────────────────────

const twins = new Map<string, CasinoDigitalTwin>();

/**
 * The single Enterprise Casino Digital Twin for a casino. Calling this twice
 * for the same casino returns the SAME instance — a second runtime model
 * cannot exist through this API.
 */
export function getDigitalTwin(casinoId: string): CasinoDigitalTwin {
  let twin = twins.get(casinoId);
  if (!twin || twin.state === 'disposed') {
    twin = new CasinoDigitalTwin(casinoId);
    twins.set(casinoId, twin);
  }
  return twin;
}
