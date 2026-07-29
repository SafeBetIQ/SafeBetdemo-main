// ─── Compliance Intelligence (Phase 3.5) ─────────────────────────────────────
//
// The last stage: consumes the FULLY enriched player (behaviour, risk,
// intervention) and classifies compliance posture — readiness, obligations,
// outstanding actions, audit readiness, Responsible Gambling evidence.
// Observational only; regulator workflows arrive with the Rules Engine,
// which will consume this stage rather than replace it.

import type { IntelligencePipeline } from '../contracts.ts';

export function complianceIntelligence(): IntelligencePipeline {
  return {
    stageId: 'compliance',
    consumes: ['behaviour', 'risk', 'intervention'],
    analyse(object, _ctx, stages) {
      if (object.kind !== 'player') return undefined;
      const risk = stages.risk;
      const intervention = stages.intervention;
      if (!risk || !intervention) return undefined;

      const regulatoryObligations: string[] = [];
      if (object.requiresMonitoring) regulatoryObligations.push('enhanced_monitoring');
      if (risk.escalationLevel === 'critical' || risk.escalationLevel === 'elevated') {
        regulatoryObligations.push('documented_risk_review');
      }
      if (object.interventionCount > 0) regulatoryObligations.push('intervention_record_keeping');

      const outstandingActions: string[] = [];
      if (intervention.pendingIntervention === true) outstandingActions.push('act_on_recommended_intervention');
      if (intervention.interventionEffectiveness === 'ineffective') outstandingActions.push('escalate_intervention_strategy');

      // Audit readiness: the journey is reconstructable (events) and observed
      // (twin freshness) — evidence completeness, not a business judgement.
      const auditReady = object.lastEventAt !== null;

      return {
        complianceReadiness: outstandingActions.length === 0 ? 'ready' : 'attention_required',
        regulatoryObligations,
        outstandingActions,
        auditReady,
        responsibleGamblingEvidence: {
          monitored: object.requiresMonitoring,
          riskFlagsRecorded: object.riskFlags.length,
          interventionsRecorded: object.interventionCount,
          lastInterventionAt: object.lastInterventionAt,
        },
      };
    },
  };
}
