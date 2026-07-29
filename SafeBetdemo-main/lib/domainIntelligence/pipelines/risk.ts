// ─── Risk Intelligence (Phase 3.5) ───────────────────────────────────────────
//
// Consumes Behaviour Intelligence for the SAME player and scores it:
// GRPI (Gambling Risk Propensity Index), dynamic risk score, escalation
// level, trend and confidence. It does NOT trigger interventions —
// Intervention Intelligence consumes this stage downstream.

import type { IntelligencePipeline } from '../contracts.ts';
import { clamp, round2 } from '../contracts.ts';

export function riskIntelligence(): IntelligencePipeline {
  return {
    stageId: 'risk',
    consumes: ['behaviour'],
    analyse(object, _ctx, stages) {
      if (object.kind !== 'player') return undefined;
      const behaviour = stages.behaviour;
      if (!behaviour) return undefined;

      // GRPI: weighted composite of the projected risk score (event fact)
      // and behavioural indicators produced one stage earlier.
      const projected = clamp(object.riskScore, 0, 100);
      const chasing = behaviour.chasingLossIndicator === true ? 100 : 0;
      const frequency = typeof behaviour.betFrequency === 'number'
        ? clamp((behaviour.betFrequency / 8) * 100, 0, 100) : 0;
      const exposure = typeof behaviour.lossRatio === 'number'
        ? clamp(behaviour.lossRatio * 100, 0, 100) : 0;
      const grpi = round2(projected * 0.5 + chasing * 0.25 + frequency * 0.15 + exposure * 0.1);

      const dynamicRiskScore = round2(clamp(Math.max(projected, grpi), 0, 100));
      const escalationLevel =
        dynamicRiskScore >= 80 ? 'critical'
          : dynamicRiskScore >= 60 ? 'elevated'
          : dynamicRiskScore >= 40 ? 'watch'
          : 'none';
      const riskTrend =
        dynamicRiskScore > projected + 5 ? 'rising'
          : dynamicRiskScore < projected - 5 ? 'easing'
          : 'stable';
      // Confidence grows with observed evidence (bet volume), capped at 1.
      const riskConfidence = round2(clamp(object.betCount / 50, 0.1, 1));

      return { grpi, dynamicRiskScore, escalationLevel, riskTrend, riskConfidence };
    },
  };
}
