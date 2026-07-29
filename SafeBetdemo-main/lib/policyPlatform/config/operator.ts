// ─── Casino operator policy pack — CONFIGURATION (Phase 3.6) ─────────────────
//
// Operator operational defaults (VIP handling, machine allocation, session
// management). An individual operator overrides these by supplying rules
// with its own casinoId — same evaluator, zero code changes.

import type { PolicyRule } from '../model.ts';

export const OPERATOR_POLICIES: PolicyRule[] = [
  {
    policyId: 'OP-001',
    scope: 'operator',
    appliesTo: 'machine',
    when: { path: 'intelligence.machine.temperature', op: 'eq', value: 'hot' },
    action: 'OPERATIONAL_RECOMMENDATION',
    priority: 'low',
    reason: 'Machine is running hot relative to the floor — review limits and player rotation.',
    policyReference: 'Operator Ops Manual §4.2 (hot machines)',
    executionRequired: false,
  },
  {
    policyId: 'OP-002',
    scope: 'operator',
    appliesTo: 'machine',
    when: {
      all: [
        { path: 'status', op: 'eq', value: 'idle' },
        { path: 'intelligence.machine.idleMinutes', op: 'gte', value: 240 },
      ],
    },
    action: 'MACHINE_REVIEW_REQUIRED',
    priority: 'medium',
    reason: 'Machine idle beyond four hours — check for faults or floor placement issues.',
    policyReference: 'Operator Ops Manual §4.5 (idle machines)',
    executionRequired: false,
  },
  {
    policyId: 'OP-003',
    scope: 'operator',
    appliesTo: 'floor',
    when: { path: 'intelligence.machine.utilisationRate', op: 'gte', value: 0.9 },
    action: 'OPERATIONAL_RECOMMENDATION',
    priority: 'medium',
    reason: 'Gaming floor is near capacity — consider opening additional positions.',
    policyReference: 'Operator Ops Manual §3.1 (floor capacity)',
    executionRequired: false,
  },
  {
    policyId: 'OP-004',
    scope: 'operator',
    appliesTo: 'player',
    when: {
      all: [
        { path: 'totalWagered', op: 'gte', value: 100_000 },
        { path: 'intelligence.risk.escalationLevel', op: 'in', value: ['none', 'watch'] },
      ],
    },
    action: 'OPERATIONAL_RECOMMENDATION',
    priority: 'low',
    reason: 'High-value player with contained risk — apply VIP handling policy.',
    policyReference: 'Operator VIP Policy §1 (premium players)',
    executionRequired: false,
  },
];
