// ─── Platform policy pack — CONFIGURATION (Phase 3.6) ────────────────────────
//
// SafeBet IQ platform configuration policies: AI recommendation controls,
// feature governance, tenant behaviour. Identity/cross-casino federation
// remains governed by the Identity Policy layer (Phase 3.1B) — the platform
// pack does not duplicate it.

import type { PolicyRule } from '../model.ts';

export const PLATFORM_POLICIES: PolicyRule[] = [
  {
    policyId: 'PLT-001',
    scope: 'platform',
    appliesTo: 'player',
    when: {
      all: [
        { path: 'intelligence.ai.confidence', op: 'lte', value: 0.2 },
        { path: 'intelligence.risk.escalationLevel', op: 'in', value: ['elevated', 'critical'] },
      ],
    },
    action: 'OPERATIONAL_RECOMMENDATION',
    priority: 'medium',
    reason: 'AI confidence is low for a significant escalation — require human review before acting on AI recommendations.',
    policyReference: 'SafeBet IQ Platform Policy §5.2 (AI recommendation control)',
    executionRequired: true,
  },
  {
    policyId: 'PLT-002',
    scope: 'platform',
    appliesTo: 'casino',
    when: { path: 'lastEventAt', op: 'exists' },
    action: 'OPERATIONAL_RECOMMENDATION',
    priority: 'low',
    reason: 'Casino telemetry is flowing — enterprise observability confirmed for this tenant.',
    policyReference: 'SafeBet IQ Platform Policy §1.1 (tenant telemetry)',
    executionRequired: false,
    enabled: false, // example of configuration-level enablement control
  },
];
