// ─── AI Intelligence (Phase 3.5) ─────────────────────────────────────────────
//
// Consumes Session, Machine, Behaviour and Risk intelligence for the SAME
// object and produces predictions, recommendations and operational
// insights with confidence levels. Deterministic inference over the
// enriched twin — it recommends; it never performs interventions.

import type { IntelligencePipeline } from '../contracts.ts';
import { clamp, round2 } from '../contracts.ts';

export function aiIntelligence(): IntelligencePipeline {
  return {
    stageId: 'ai',
    consumes: ['session', 'machine', 'behaviour', 'risk'],
    analyse(object, ctx, stages) {
      if (object.kind !== 'player') return undefined;
      const behaviour = stages.behaviour;
      const risk = stages.risk;
      if (!behaviour || !risk) return undefined;

      const dynamic = typeof risk.dynamicRiskScore === 'number' ? risk.dynamicRiskScore : 0;
      const trend = risk.riskTrend;
      // Prediction: extrapolate the current trend one step.
      const predictedRisk = round2(clamp(
        trend === 'rising' ? dynamic + 10 : trend === 'easing' ? dynamic - 5 : dynamic,
        0, 100,
      ));

      const emergingBehaviour: string[] = [];
      const patterns = Array.isArray(behaviour.patterns) ? behaviour.patterns as string[] : [];
      if (patterns.indexOf('rapid_betting') !== -1) emergingBehaviour.push('acceleration');
      if (behaviour.chasingLossIndicator === true) emergingBehaviour.push('loss_chasing');
      if (patterns.indexOf('extended_session') !== -1) emergingBehaviour.push('time_escalation');

      const recommendations: string[] = [];
      if (risk.escalationLevel === 'critical') recommendations.push('immediate_wellbeing_review');
      else if (risk.escalationLevel === 'elevated') recommendations.push('proactive_contact');
      else if (risk.escalationLevel === 'watch') recommendations.push('continue_observation');
      if (behaviour.chasingLossIndicator === true) recommendations.push('suggest_reality_check');

      const operationalInsights: string[] = [];
      const session = stages.session;
      if (session && session.hasActiveSession === true && typeof session.currentLocation === 'string') {
        operationalInsights.push(`active_on:${session.currentLocation}`);
      }
      if (ctx.registry.sessions.size > 0 && ctx.registry.machines.size > 0) {
        operationalInsights.push(`floor_pressure:${round2(ctx.registry.sessions.size / ctx.registry.machines.size)}`);
      }

      const confidence = typeof risk.riskConfidence === 'number' ? risk.riskConfidence : 0.1;

      return { predictedRisk, emergingBehaviour, recommendations, operationalInsights, confidence };
    },
  };
}
