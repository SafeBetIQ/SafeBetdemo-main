// ─── Digital Twin operational queries (Phase 3.4) ────────────────────────────
//
// "At this exact moment…" answers, WITHOUT recalculating business logic.
// Every function below is pure assembly over the registry: filtering the
// same runtime instances by fields the Projection Platform already
// materialized (status, floor location, monitoring membership, projected
// risk flags) and counting them. No thresholds, no scoring, no derivation
// of business outcomes — those live in the projection catalogue and, from
// Phase 3.5, in the Shared Domain Engines.

import type { TwinRegistry } from './registry.ts';
import type {
  InterventionTwin, MachineTwin, PlayerTwin, SessionTwin,
} from './runtimeObjects.ts';

/** Which players are active right now? */
export function activePlayers(registry: TwinRegistry): PlayerTwin[] {
  return Array.from(registry.players.values()).filter(p => p.status === 'active');
}

/** Which sessions are open right now? (registry holds live sessions only) */
export function openSessions(registry: TwinRegistry): SessionTwin[] {
  return Array.from(registry.sessions.values()).filter(s => s.status === 'active');
}

/** Which machines are occupied right now? */
export function occupiedMachines(registry: TwinRegistry): MachineTwin[] {
  return Array.from(registry.machines.values()).filter(m => m.status === 'active');
}

export interface FloorOccupancy {
  floorLocation: string;
  machineCount: number;
  occupiedCount: number;
  /** Occupied / total — assembly arithmetic over projected statuses. */
  occupancyRate: number;
}

/** Occupancy of every gaming floor, busiest first. */
export function floorOccupancy(registry: TwinRegistry): FloorOccupancy[] {
  return Array.from(registry.floors.values())
    .map(floor => {
      const machines = Array.from(floor.machines.values());
      const occupied = machines.filter(m => m.status === 'active').length;
      return {
        floorLocation: floor.floorLocation,
        machineCount: machines.length,
        occupiedCount: occupied,
        occupancyRate: machines.length === 0 ? 0 : Math.round((occupied / machines.length) * 100) / 100,
      };
    })
    .sort((a, b) => b.occupiedCount - a.occupiedCount || a.floorLocation.localeCompare(b.floorLocation));
}

/** Which gaming floor is busiest right now? */
export function busiestFloor(registry: TwinRegistry): FloorOccupancy | null {
  return floorOccupancy(registry)[0] ?? null;
}

/** Which interventions are current? (projection_intervention_state members) */
export function activeInterventions(registry: TwinRegistry): InterventionTwin[] {
  return Array.from(registry.interventions.values())
    .sort((a, b) => (b.lastInterventionAt ?? '').localeCompare(a.lastInterventionAt ?? ''));
}

/**
 * Which players require monitoring right now? Membership is decided by the
 * projection_compliance_state VIEW — the twin only reads the flag.
 */
export function playersRequiringMonitoring(registry: TwinRegistry): PlayerTwin[] {
  return Array.from(registry.players.values())
    .filter(p => p.requiresMonitoring)
    .sort((a, b) => b.riskScore - a.riskScore);
}

export interface OperationalAlert {
  type: 'RISK_FLAGS_PRESENT' | 'INTERVENTION_ACTIVE' | 'MONITORING_REQUIRED';
  playerId: string;
  /** Facts carried from the projections, verbatim. */
  detail: Record<string, unknown>;
}

/**
 * Which operational alerts exist right now? Alerts are assembled from facts
 * the projections already carry (risk flags recorded on events, intervention
 * observations, compliance-view membership) — never computed here.
 */
export function operationalAlerts(registry: TwinRegistry): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];
  registry.players.forEach(p => {
    if (p.riskFlags.length > 0) {
      alerts.push({ type: 'RISK_FLAGS_PRESENT', playerId: p.playerId, detail: { riskFlags: p.riskFlags, riskScore: p.riskScore } });
    }
    if (p.requiresMonitoring) {
      alerts.push({ type: 'MONITORING_REQUIRED', playerId: p.playerId, detail: { riskScore: p.riskScore } });
    }
  });
  registry.interventions.forEach(i => {
    alerts.push({
      type: 'INTERVENTION_ACTIVE', playerId: i.playerId,
      detail: { interventionCount: i.interventionCount, lastInterventionAt: i.lastInterventionAt },
    });
  });
  return alerts;
}
