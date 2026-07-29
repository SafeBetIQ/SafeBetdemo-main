// ─── Intervention Intelligence (Phase 3.5) ───────────────────────────────────
//
// Consumes AI + Risk intelligence and classifies the intervention posture
// of the SAME player: what is recommended, what is active (projected event
// facts), what is pending, and how effective past interventions look.
// It recommends and observes — it implements NO regulator workflow and
// triggers nothing.

import type { IntelligencePipeline } from '../contracts.ts';

export function interventionIntelligence(): IntelligencePipeline {
  return {
    stageId: 'intervention',
    consumes: ['risk', 'ai'],
    analyse(object, _ctx, stages) {
      if (object.kind !== 'player') return undefined;
      const risk = stages.risk;
      if (!risk) return undefined;

      const recommendedIntervention =
        risk.escalationLevel === 'critical' ? 'care_call'
          : risk.escalationLevel === 'elevated' ? 'session_break'
          : risk.escalationLevel === 'watch' ? 'reality_check'
          : null;

      // Active/past interventions are projected event facts on the player.
      const hasInterventionHistory = object.interventionCount > 0;
      const pendingIntervention = recommendedIntervention !== null && !hasInterventionHistory;

      // Effectiveness: did risk ease after the last intervention?
      const interventionEffectiveness = !hasInterventionHistory ? 'not_applicable'
        : risk.riskTrend === 'easing' ? 'effective'
        : risk.riskTrend === 'rising' ? 'ineffective'
        : 'inconclusive';

      return {
        recommendedIntervention,
        activeInterventions: object.interventionCount,
        lastInterventionAt: object.lastInterventionAt,
        pendingIntervention,
        interventionEffectiveness,
      };
    },
  };
}
