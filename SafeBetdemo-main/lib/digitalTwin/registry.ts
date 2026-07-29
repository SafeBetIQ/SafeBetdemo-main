// ─── Digital Twin registry — ONE runtime instance per entity (Phase 3.4) ─────
//
// The registry is the identity map of the twin. For any given player,
// session, machine, floor or intervention there is exactly ONE object;
// projection updates MUTATE that object in place, so references held by
// Shared Domain Engines, dashboards and realtime distribution stay valid
// and enrichments survive updates. Nothing here persists — the registry is
// disposable and fully reconstructable from the Projection Platform.

import type { MachineState, PlayerState, SessionState } from '../projectionPlatform/index.ts';
import {
  mapMachine, mapPlayer, mapSession,
  newMachineTwin, newPlayerTwin, newSessionTwin,
  type GamingFloorTwin, type InterventionTwin, type MachineTwin,
  type PlayerTwin, type SessionTwin,
} from './runtimeObjects.ts';

export type TwinObject = PlayerTwin | SessionTwin | MachineTwin | GamingFloorTwin | InterventionTwin;

/** Row shape of the projection_intervention_state view. */
export interface InterventionStateRow {
  casino_id: string;
  safebet_player_id: string;
  intervention_count: number;
  last_intervention_at: string | null;
  risk_score: number;
  last_event_at: string | null;
}

/** Notified whenever a runtime object is created or updated in place. */
export type TwinUpdateListener = (object: TwinObject) => void;

export class TwinRegistry {
  readonly casinoId: string;
  readonly players = new Map<string, PlayerTwin>();
  readonly sessions = new Map<string, SessionTwin>();
  readonly machines = new Map<string, MachineTwin>();
  readonly floors = new Map<string, GamingFloorTwin>();
  readonly interventions = new Map<string, InterventionTwin>();

  private listeners = new Set<TwinUpdateListener>();

  constructor(casinoId: string) {
    this.casinoId = casinoId;
  }

  onUpdate(listener: TwinUpdateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(object: TwinObject): void {
    this.listeners.forEach(l => l(object));
  }

  /** Upsert a player projection row onto the single PlayerTwin instance. */
  upsertPlayer(row: PlayerState): PlayerTwin {
    let twin = this.players.get(row.safebet_player_id);
    if (!twin) {
      twin = newPlayerTwin(row.casino_id, row.safebet_player_id);
      this.players.set(row.safebet_player_id, twin);
    }
    mapPlayer(twin, row);
    this.notify(twin);
    return twin;
  }

  /**
   * Upsert a session projection row. The twin models LIVE state only:
   * ended sessions leave the runtime model (history stays in the event log).
   */
  upsertSession(row: SessionState): SessionTwin | null {
    if (row.status === 'ended') {
      const ended = this.sessions.get(row.session_id);
      if (ended) {
        mapSession(ended, row);
        this.notify(ended);
        this.sessions.delete(row.session_id);
      }
      return null;
    }
    let twin = this.sessions.get(row.session_id);
    if (!twin) {
      twin = newSessionTwin(row.session_id, row.casino_id, row.safebet_player_id);
      this.sessions.set(row.session_id, twin);
    }
    mapSession(twin, row);
    this.notify(twin);
    return twin;
  }

  /** Upsert a machine projection row, maintaining floor membership. */
  upsertMachine(row: MachineState): MachineTwin {
    let twin = this.machines.get(row.machine_id);
    if (!twin) {
      twin = newMachineTwin(row.casino_id, row.machine_id);
      this.machines.set(row.machine_id, twin);
    }
    const previousFloor = twin.floorLocation;
    mapMachine(twin, row);
    if (previousFloor !== twin.floorLocation) {
      if (previousFloor) this.floors.get(previousFloor)?.machines.delete(twin.machineId);
      if (twin.floorLocation) this.floor(twin.floorLocation).machines.set(twin.machineId, twin);
    } else if (twin.floorLocation) {
      this.floor(twin.floorLocation).machines.set(twin.machineId, twin);
    }
    this.notify(twin);
    // A machine change is a floor change: the floor object (same instances,
    // grouped) flows through enrichment in the same pass.
    if (twin.floorLocation) this.notify(this.floor(twin.floorLocation));
    return twin;
  }

  /** The single GamingFloorTwin for a zone — created on first reference. */
  floor(floorLocation: string): GamingFloorTwin {
    let twin = this.floors.get(floorLocation);
    if (!twin) {
      twin = {
        kind: 'floor', casinoId: this.casinoId, floorLocation,
        machines: new Map(), enrichments: {},
      };
      this.floors.set(floorLocation, twin);
    }
    return twin;
  }

  /** Upsert an intervention observation (projection_intervention_state row). */
  upsertIntervention(row: InterventionStateRow): InterventionTwin {
    let twin = this.interventions.get(row.safebet_player_id);
    if (!twin) {
      twin = {
        kind: 'intervention', casinoId: row.casino_id, playerId: row.safebet_player_id,
        interventionCount: 0, lastInterventionAt: null, riskScore: 0,
        lastEventAt: null, enrichments: {},
      };
      this.interventions.set(row.safebet_player_id, twin);
    }
    twin.interventionCount = row.intervention_count;
    twin.lastInterventionAt = row.last_intervention_at;
    twin.riskScore = Number(row.risk_score);
    twin.lastEventAt = row.last_event_at;
    this.notify(twin);
    return twin;
  }

  /**
   * Reconcile after a re-assembly: drop entities the projections no longer
   * contain, WITHOUT recreating the ones that remain — surviving instances
   * keep their references and enrichments.
   */
  reconcile(seen: {
    players: Set<string>; sessions: Set<string>;
    machines: Set<string>; interventions: Set<string>;
  }): void {
    Array.from(this.players.keys()).forEach(id => { if (!seen.players.has(id)) this.players.delete(id); });
    Array.from(this.sessions.keys()).forEach(id => { if (!seen.sessions.has(id)) this.sessions.delete(id); });
    Array.from(this.machines.keys()).forEach(id => {
      if (seen.machines.has(id)) return;
      const machine = this.machines.get(id);
      if (machine?.floorLocation) this.floors.get(machine.floorLocation)?.machines.delete(id);
      this.machines.delete(id);
    });
    Array.from(this.interventions.keys()).forEach(id => { if (!seen.interventions.has(id)) this.interventions.delete(id); });
    Array.from(this.floors.keys()).forEach(zone => {
      if (this.floors.get(zone)!.machines.size === 0) this.floors.delete(zone);
    });
  }

  /** Memory lifecycle: drop everything. The registry is disposable by design. */
  clear(): void {
    this.players.clear();
    this.sessions.clear();
    this.machines.clear();
    this.floors.clear();
    this.interventions.clear();
  }

  dispose(): void {
    this.clear();
    this.listeners.clear();
  }
}
