// ─── Digital Twin operational health (Phase 3.4) ─────────────────────────────
//
// Health is INFRASTRUCTURE observability — freshness of the twin relative
// to the projections it observes — never a business judgement.

import type { TwinRegistry } from './registry.ts';

export type TwinLifecycleState = 'created' | 'assembling' | 'live' | 'stale' | 'disposed';

export interface TwinHealth {
  state: TwinLifecycleState;
  assembledAt: string | null;
  lastChangeAt: string | null;
  /** ms between now and the newest projected event visible in the twin. */
  projectionLagMs: number | null;
  realtime: 'observing' | 'not-observing';
  entityCounts: {
    players: number;
    sessions: number;
    machines: number;
    floors: number;
    interventions: number;
  };
}

export function assessHealth(
  registry: TwinRegistry,
  opts: {
    state: TwinLifecycleState;
    assembledAt: string | null;
    lastChangeAt: string | null;
    observing: boolean;
  },
): TwinHealth {
  let newestEventAt: string | null = null;
  registry.players.forEach(p => {
    if (p.lastEventAt && (!newestEventAt || p.lastEventAt > newestEventAt)) newestEventAt = p.lastEventAt;
  });
  return {
    state: opts.state,
    assembledAt: opts.assembledAt,
    lastChangeAt: opts.lastChangeAt,
    projectionLagMs: newestEventAt ? Math.max(0, Date.now() - new Date(newestEventAt).getTime()) : null,
    realtime: opts.observing ? 'observing' : 'not-observing',
    entityCounts: {
      players: registry.players.size,
      sessions: registry.sessions.size,
      machines: registry.machines.size,
      floors: registry.floors.size,
      interventions: registry.interventions.size,
    },
  };
}
