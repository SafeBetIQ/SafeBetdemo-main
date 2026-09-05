// ─── SafeBet Guardian — product identity (ARCH-V4-C0) ────────────────────────
//
// SafeBet Guardian is a STANDALONE commercial product: a National Illegal
// Gambling Intelligence & Multi-Channel Enforcement-Orchestration platform. It is
// NOT part of SafeBet IQ, NOT a SafeBet IQ module, NOT the Regulator Suite, and
// NOT an operator responsible-gambling module. It MAY consume governed Shared
// Platform Foundation services, but it MUST NOT depend on SafeBet IQ business data.
//
// C0 = FOUNDATION ONLY. No business detection/enforcement. Synthetic data only.
// No real regulator/bank/PSP/ISP/registrar/hosting/mobile-platform integration.

export const GUARDIAN_PRODUCT = 'GUARDIAN' as const;
export type ProductTag = typeof GUARDIAN_PRODUCT;

/** Foundation schema/contract version for Guardian envelopes and objects. */
export const GUARDIAN_SCHEMA_VERSION = 'c0' as const;

/** The data-ownership boundary. C0 uses a dedicated Postgres schema (interim
 *  strangler); the final target is a separate database/project. Guardian NEVER
 *  reads the SafeBet IQ business tables listed below. */
export const GUARDIAN_DB_SCHEMA = 'guardian' as const;

/** SafeBet IQ business tables Guardian must NOT read at C0 (hard independence).
 *  Enforced by review + the boundary lint helper; no Guardian code references them. */
export const FORBIDDEN_IQ_TABLES: readonly string[] = [
  'casino_event_log',
  'players',
  'projection_financial_posture',
  'sbiq_financial_rollup_hourly',
  'intervention_state',
  'projection_intervention_state',
  'behavioural_events',
  'machines',
  'self_exclusions',
];

/** Legacy namespaces that are NOT Guardian v4 and must not be reused for new
 *  Guardian business data (guardian_* = IQ minor-protection analytics;
 *  guardianlayer_* = legacy). C0 creates a clean `guardian` schema instead. */
export const LEGACY_COLLISION_PREFIXES: readonly string[] = ['guardian_', 'guardianlayer_'];

/** Guardian is enforcement-ORCHESTRATION. It never itself performs the acts
 *  below — those are executed by external authorised providers, only after human
 *  legal authorisation. Encoded so downstream milestones cannot silently cross it. */
export const GUARDIAN_MUST_NOT_SELF_EXECUTE: readonly string[] = [
  'freeze-bank-account',
  'block-bank-transaction',
  'terminate-merchant',
  'remove-mobile-app',
  'suspend-domain',
  'compel-isp',
  'issue-legal-determination',
];

/** Architectural invariants encoded for tests/consumers. */
export const GUARDIAN_INVARIANTS = {
  automatedSignalIsNotLegalFinding: true,
  detectionIsNotEnforcementAuthorisation: true,
  noAutomaticBlocking: true,
  mfaRequiredForRealPrivilegedUse: true,
  syntheticDataOnly: true,
  noLiveExternalIntegration: true,
} as const;
