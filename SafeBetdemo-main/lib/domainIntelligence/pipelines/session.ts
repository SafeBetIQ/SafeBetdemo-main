// ─── Session Intelligence (Phase 3.5) ────────────────────────────────────────
//
// Operational session analysis: lifecycle, duration, concurrency, player
// movement. No risk logic, no intervention logic.

import type { IntelligencePipeline } from '../contracts.ts';
import { minutesSince, round2 } from '../contracts.ts';

export function sessionIntelligence(now: () => number = Date.now): IntelligencePipeline {
  return {
    stageId: 'session',
    consumes: [],
    analyse(object, ctx) {
      if (object.kind === 'session') {
        const durationMinutes = minutesSince(object.startedAt, now());
        return {
          lifecycle: object.status === 'active' ? 'open' : 'closed',
          durationMinutes,
          betsPerMinute: durationMinutes && durationMinutes > 0
            ? round2(object.betCount / durationMinutes) : null,
          avgBetSize: object.betCount > 0 ? round2(object.totalWagered / object.betCount) : null,
          concurrentSessions: ctx.registry.sessions.size,
          machineId: object.machineId,
        };
      }
      if (object.kind === 'player') {
        return {
          hasActiveSession: object.currentSessionId !== null,
          currentSessionId: object.currentSessionId,
          lifetimeSessions: object.sessionCount,
          // Player movement: where the player is right now, if anywhere.
          currentLocation: object.currentMachineId
            ? ctx.registry.machines.get(object.currentMachineId)?.floorLocation ?? null
            : null,
          minutesSinceLastEvent: minutesSince(object.lastEventAt, now()),
        };
      }
      return undefined;
    },
  };
}
