// ─── Behaviour Intelligence (Phase 3.5) ──────────────────────────────────────
//
// Behavioural pattern analysis on players: betting velocity, frequency,
// loss-chasing indicators, play style. Produces INDICATORS only — it does
// NOT calculate risk (Risk Intelligence consumes this stage and does).

import type { IntelligencePipeline } from '../contracts.ts';
import { minutesSince, round2 } from '../contracts.ts';

export function behaviourIntelligence(now: () => number = Date.now): IntelligencePipeline {
  return {
    stageId: 'behaviour',
    consumes: ['session'],
    analyse(object, ctx) {
      if (object.kind !== 'player') return undefined;

      const session = object.currentSessionId
        ? ctx.registry.sessions.get(object.currentSessionId) ?? null : null;
      const sessionMinutes = session ? minutesSince(session.startedAt, now()) : null;

      const bettingVelocity = session && sessionMinutes && sessionMinutes > 0
        ? round2(session.totalWagered / sessionMinutes) : null;      // currency/min
      const betFrequency = session && sessionMinutes && sessionMinutes > 0
        ? round2(session.betCount / sessionMinutes) : null;          // bets/min

      const lossRatio = object.totalWagered > 0
        ? round2((object.totalWagered - object.totalWon) / object.totalWagered) : 0;

      const flaggedChasing = object.riskFlags.indexOf('loss_chasing') !== -1;
      const inferredChasing = lossRatio >= 0.6 && object.betCount >= 10
        && betFrequency !== null && betFrequency >= 3;
      const patterns: string[] = [];
      if (flaggedChasing) patterns.push('loss_chasing_flagged');
      if (inferredChasing) patterns.push('loss_chasing_inferred');
      if (betFrequency !== null && betFrequency >= 6) patterns.push('rapid_betting');
      if (sessionMinutes !== null && sessionMinutes >= 120) patterns.push('extended_session');

      const avgBetSize = object.betCount > 0 ? round2(object.totalWagered / object.betCount) : 0;
      const playStyle =
        object.betCount === 0 ? 'inactive'
          : betFrequency !== null && betFrequency >= 6 ? 'burst'
          : avgBetSize >= 500 ? 'high_stakes'
          : 'steady';

      return {
        bettingVelocity,
        betFrequency,
        avgBetSize,
        lossRatio,
        netPosition: round2(object.totalWon - object.totalWagered),
        chasingLossIndicator: flaggedChasing || inferredChasing,
        playStyle,
        patterns,
      };
    },
  };
}
