// ─── Machine Intelligence (Phase 3.5) ────────────────────────────────────────
//
// Operational machine and floor analysis: occupancy, availability, idle
// duration, hot/cold classification, utilisation. Classification is relative
// to the casino's own machines (peer comparison) — operational intelligence
// only, no wellbeing logic.

import type { MachineTwin } from '../../digitalTwin/index.ts';
import type { IntelligencePipeline } from '../contracts.ts';
import { minutesSince, round2 } from '../contracts.ts';

function averageWagered(machines: MachineTwin[]): number {
  const active = machines.filter(m => m.sessionWagered > 0);
  if (active.length === 0) return 0;
  return active.reduce((s, m) => s + m.sessionWagered, 0) / active.length;
}

export function machineIntelligence(now: () => number = Date.now): IntelligencePipeline {
  return {
    stageId: 'machine',
    consumes: [],
    analyse(object, ctx) {
      if (object.kind === 'machine') {
        const peers = Array.from(ctx.registry.machines.values());
        const avg = averageWagered(peers);
        const temperature =
          object.status !== 'active' || object.sessionWagered === 0 ? 'cold'
            : avg > 0 && object.sessionWagered >= avg * 1.5 ? 'hot'
            : 'warm';
        return {
          occupied: object.status === 'active',
          available: object.status === 'idle',
          idleMinutes: object.status === 'idle' ? minutesSince(object.lastEventAt, now()) : 0,
          temperature,
          sessionWagered: object.sessionWagered,
          casinoAvgSessionWagered: round2(avg),
        };
      }
      if (object.kind === 'floor') {
        const machines = Array.from(object.machines.values());
        const occupied = machines.filter(m => m.status === 'active').length;
        return {
          machineCount: machines.length,
          occupiedCount: occupied,
          availableCount: machines.length - occupied,
          utilisationRate: machines.length === 0 ? 0 : round2(occupied / machines.length),
        };
      }
      return undefined;
    },
  };
}
