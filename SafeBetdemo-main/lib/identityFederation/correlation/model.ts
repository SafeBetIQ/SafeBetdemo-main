// ─── Enterprise Correlation Layer — model, providers, access (v2.0, ADR-006 · Milestone 3.5)
//
// The Enterprise Correlation Layer is a REGULATOR-PLANE, READ-ONLY, reference-
// based national intelligence capability. It consumes approved SB-NAT identities
// (from the SB-NAT Registry, 3.4) and existing operator information BY REFERENCE
// ONLY. It is NEVER an operational system of record and NEVER modifies operator
// runtime data, SB-PLR records, SB-NAT identifiers, or federation decisions.
//
// This file defines: (a) the read-only provider CONTRACTS the layer depends on
// (all injected; operator implementation details stay behind these interfaces),
// (b) an in-memory reference provider for tests, (c) the deny-by-default access
// boundary, and (d) the immutable correlation domain models + provenance.
//
// PRIVACY: no plaintext PII may cross these interfaces — only approved anonymous
// identifiers, regulatory references and authorised behavioural REFERENCES.

import type { JurisdictionCode, SbNatId } from '../types.ts';

// ── Reference vocabularies (deterministic, closed sets) ──────────────────────

export const EVENT_CATEGORIES = [
  'session', 'deposit', 'wager', 'loss', 'risk-change', 'behaviour',
  'intervention', 'cooling-off', 'self-exclusion', 'compliance',
  'investigation', 'operator-transition',
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

/** National risk tiers (ordinal; used for deterministic progression/escalation). */
export const RISK_TIERS = ['low', 'medium', 'high', 'critical'] as const;
export type RiskTier = (typeof RISK_TIERS)[number];
export function riskRank(t: RiskTier): number { return RISK_TIERS.indexOf(t); }

export const SELF_EXCLUSION_STATUSES = ['active', 'expired', 'lifted'] as const;
export type SelfExclusionStatus = (typeof SELF_EXCLUSION_STATUSES)[number];
export const EXCLUSION_KINDS = ['self-exclusion', 'cooling-off'] as const;
export type ExclusionKind = (typeof EXCLUSION_KINDS)[number];

// ── Read-only operator references (NO PII — identifiers + references only) ────

export interface OperatorReference { operatorId: string; jurisdiction: JurisdictionCode; displayRef?: string; }

export interface PlayerReference {
  sbPlr: string; operatorId: string; jurisdiction: JurisdictionCode;
  firstObservedAt: string; lastObservedAt: string;
}

export interface EventReference {
  eventId: string; sbPlr: string; operatorId: string;
  category: EventCategory; at: string;
  /** Optional coarse magnitude BUCKET (e.g. 'low'|'medium'|'high') — never a raw money value. */
  magnitudeBand?: string;
}

export interface RiskReference {
  riskId: string; sbPlr: string; operatorId: string; at: string; tier: RiskTier;
}

export interface InterventionReference {
  interventionId: string; sbPlr: string; operatorId: string; at: string;
  type: string; outcome: string;
}

export interface SelfExclusionReference {
  exclusionId: string; sbPlr: string; operatorId: string; jurisdiction: JurisdictionCode;
  kind: ExclusionKind; startAt: string; endAt: string | null; status: SelfExclusionStatus;
}

export interface ComplianceReference {
  recordId: string; sbPlr: string; operatorId: string; at: string; type: string; status: string;
}

export interface InvestigationReference {
  investigationId: string; sbPlr: string; operatorId: string; at: string; ref: string;
}

export interface TwinReference {
  twinId: string; sbPlr: string; operatorId: string; at: string;
  riskTier: RiskTier; wellbeingRef: string;
}

/**
 * The read-only data access contract to the operator runtime. Every method is
 * keyed by an operator SB-PLR and returns REFERENCES only. Implementations must
 * never expose PII and the layer must never obtain a mutation handle through it.
 */
export interface CorrelationDataProvider {
  operator(operatorId: string): OperatorReference | undefined;
  playerReferences(sbPlr: string): PlayerReference[];
  eventReferences(sbPlr: string): EventReference[];
  riskReferences(sbPlr: string): RiskReference[];
  interventionReferences(sbPlr: string): InterventionReference[];
  selfExclusionReferences(sbPlr: string): SelfExclusionReference[];
  complianceReferences(sbPlr: string): ComplianceReference[];
  investigationReferences(sbPlr: string): InvestigationReference[];
  twinReferences(sbPlr: string): TwinReference[];
}

// ── In-memory reference provider (tests / controlled composition) ────────────
// Deterministic, read-only. Holds only anonymous references — never PII.

interface ProviderSeed {
  operators?: OperatorReference[];
  players?: PlayerReference[];
  events?: EventReference[];
  risks?: RiskReference[];
  interventions?: InterventionReference[];
  selfExclusions?: SelfExclusionReference[];
  compliance?: ComplianceReference[];
  investigations?: InvestigationReference[];
  twins?: TwinReference[];
}

export class InMemoryCorrelationProvider implements CorrelationDataProvider {
  private readonly operators = new Map<string, OperatorReference>();
  private readonly players: PlayerReference[] = [];
  private readonly events: EventReference[] = [];
  private readonly risks: RiskReference[] = [];
  private readonly interventions: InterventionReference[] = [];
  private readonly selfExclusions: SelfExclusionReference[] = [];
  private readonly compliance: ComplianceReference[] = [];
  private readonly investigations: InvestigationReference[] = [];
  private readonly twins: TwinReference[] = [];

  constructor(seed: ProviderSeed = {}) {
    for (const o of seed.operators ?? []) this.operators.set(o.operatorId, Object.freeze({ ...o }));
    this.players.push(...(seed.players ?? []).map((r) => Object.freeze({ ...r })));
    this.events.push(...(seed.events ?? []).map((r) => Object.freeze({ ...r })));
    this.risks.push(...(seed.risks ?? []).map((r) => Object.freeze({ ...r })));
    this.interventions.push(...(seed.interventions ?? []).map((r) => Object.freeze({ ...r })));
    this.selfExclusions.push(...(seed.selfExclusions ?? []).map((r) => Object.freeze({ ...r })));
    this.compliance.push(...(seed.compliance ?? []).map((r) => Object.freeze({ ...r })));
    this.investigations.push(...(seed.investigations ?? []).map((r) => Object.freeze({ ...r })));
    this.twins.push(...(seed.twins ?? []).map((r) => Object.freeze({ ...r })));
  }

  operator(operatorId: string): OperatorReference | undefined { return this.operators.get(operatorId); }
  playerReferences(sbPlr: string): PlayerReference[] { return this.players.filter((r) => r.sbPlr === sbPlr).map((r) => ({ ...r })); }
  eventReferences(sbPlr: string): EventReference[] { return this.events.filter((r) => r.sbPlr === sbPlr).map((r) => ({ ...r })); }
  riskReferences(sbPlr: string): RiskReference[] { return this.risks.filter((r) => r.sbPlr === sbPlr).map((r) => ({ ...r })); }
  interventionReferences(sbPlr: string): InterventionReference[] { return this.interventions.filter((r) => r.sbPlr === sbPlr).map((r) => ({ ...r })); }
  selfExclusionReferences(sbPlr: string): SelfExclusionReference[] { return this.selfExclusions.filter((r) => r.sbPlr === sbPlr).map((r) => ({ ...r })); }
  complianceReferences(sbPlr: string): ComplianceReference[] { return this.compliance.filter((r) => r.sbPlr === sbPlr).map((r) => ({ ...r })); }
  investigationReferences(sbPlr: string): InvestigationReference[] { return this.investigations.filter((r) => r.sbPlr === sbPlr).map((r) => ({ ...r })); }
  twinReferences(sbPlr: string): TwinReference[] { return this.twins.filter((r) => r.sbPlr === sbPlr).map((r) => ({ ...r })); }
}

// ── Access control (deny-by-default, service-boundary enforced) ──────────────

export const ACCESS_PLANES = ['regulator', 'operator', 'casino-admin', 'unauthenticated'] as const;
export type AccessPlane = (typeof ACCESS_PLANES)[number];

/**
 * The authorisation context presented to every correlation query. Only a
 * regulator plane whose sovereign authorisation covers the target jurisdiction
 * may proceed. Everything else is denied by default.
 */
export interface AccessContext {
  plane: AccessPlane;
  /** The regulator's home sovereign jurisdiction (null for non-regulator planes). */
  jurisdiction: JurisdictionCode | null;
  /** Jurisdictions this context is explicitly sovereign-authorised for (default: [home]). */
  sovereignJurisdictions?: JurisdictionCode[];
}

export class AccessDeniedError extends Error {
  readonly code = 'access-denied';
  constructor(reason: string) { super(`access denied: ${reason}`); this.name = 'AccessDeniedError'; }
}

/**
 * Enforce the regulator-plane, jurisdiction-bound boundary. Returns the set of
 * sovereign jurisdictions the context may read; throws AccessDeniedError otherwise.
 * Deny-by-default: any non-regulator plane, or a target outside the authorised
 * sovereign set, is denied. No cross-sovereign access unless explicitly configured.
 */
export function authorise(ctx: AccessContext | undefined, targetJurisdiction: JurisdictionCode): void {
  if (!ctx) throw new AccessDeniedError('no access context supplied');
  if (ctx.plane !== 'regulator') throw new AccessDeniedError(`plane '${ctx?.plane ?? 'unknown'}' is not permitted (regulator-plane only)`);
  const allowed = ctx.sovereignJurisdictions ?? (ctx.jurisdiction ? [ctx.jurisdiction] : []);
  if (!allowed.includes(targetJurisdiction)) {
    throw new AccessDeniedError(`regulator for [${allowed.join(',') || 'none'}] is not sovereign-authorised for '${targetJurisdiction}'`);
  }
}

// ── Immutable correlation provenance (every insight carries this) ────────────

export interface ExcludedSource { ref: string; reason: string; }

/**
 * Complete, immutable evidence chain for a national insight:
 *   SB-NAT → Registry record → approved Federation Decision → Matching Candidate
 *   → Matching Evidence → mapped SB-PLR → source records/event IDs → operator.
 * No national insight may exist without provenance. Contains NO plaintext PII.
 */
export interface CorrelationProvenance {
  sbNat: SbNatId;
  jurisdiction: JurisdictionCode;
  sbPlrRefs: string[];
  sourceOperators: string[];
  registryAssignmentRefs: string[];
  federationDecisionRefs: string[];
  matchingCandidateRefs: string[];
  matchingEvidenceRefs: string[];
  sourceRecordRefs: string[];
  sourceTimestamps: string[];
  correlationTimestamp: string;
  correlationEngineVersion: string;
  policyVersion: string | null;
  dataFreshness: string | null;
  excludedSources: ExcludedSource[];
  limitations: string[];
}

// ── Correlation domain models (all deep-frozen when produced) ────────────────

export interface TimelineEntry {
  at: string;
  operatorId: string;
  sbPlr: string;
  category: EventCategory;
  sourceRef: string;
  magnitudeBand?: string;
}

export interface CrossOperatorTimeline {
  sbNat: SbNatId;
  jurisdiction: JurisdictionCode;
  entries: TimelineEntry[];
  provenance: CorrelationProvenance;
  correlationEngineVersion: string;
  generatedAt: string;
}

export interface OperatorParticipation { operatorId: string; sbPlr: string; events: number; firstAt: string | null; lastAt: string | null; }

export interface RiskEvolutionEntry { at: string; operatorId: string; tier: RiskTier; }
export interface InterventionEntry { at: string; operatorId: string; interventionId: string; type: string; outcome: string; }
export interface SelfExclusionEntry {
  exclusionId: string; operatorId: string; kind: ExclusionKind;
  startAt: string; endAt: string | null; status: SelfExclusionStatus;
}
export interface ComplianceEntry { at: string; operatorId: string; recordId: string; type: string; status: string; }

/** Deterministic, explainable wellbeing summary (no hidden scoring, no ML). */
export interface NationalWellbeingSummary {
  currentRiskTier: RiskTier | null;
  riskEscalating: boolean;
  activeSelfExclusions: number;
  activeCoolingOff: number;
  totalInterventions: number;
  participatingOperatorCount: number;
  method: string;
}

export interface NationalPlayerTwin {
  sbNat: SbNatId;
  jurisdiction: JurisdictionCode;
  participatingOperators: string[];
  sbPlrRefs: string[];
  firstObservedAt: string | null;
  lastObservedAt: string | null;
  activityTimeline: TimelineEntry[];
  riskEvolution: RiskEvolutionEntry[];
  behaviourEvolution: TimelineEntry[];
  interventionHistory: InterventionEntry[];
  selfExclusionHistory: SelfExclusionEntry[];
  complianceHistory: ComplianceEntry[];
  investigationRefs: string[];
  wellbeingSummary: NationalWellbeingSummary;
  provenance: CorrelationProvenance;
  dataFreshness: string | null;
  limitations: string[];
  correlationEngineVersion: string;
  generatedAt: string;
}

/** One transparent, deterministic analytical metric (fully explainable). */
export interface NationalBehaviourMetric {
  name: string;
  definition: string;
  sourceRefs: string[];
  window: { from: string | null; to: string | null };
  method: string;
  result: number | string | boolean;
  version: string;
  timestamp: string;
  limitations: string[];
}

export interface OperatorSwitch { from: string; to: string; at: string; }

export interface CrossOperatorIntelligence {
  sbNat: SbNatId;
  jurisdiction: JurisdictionCode;
  participatingOperatorCount: number;
  participatingOperators: string[];
  activityFrequency: number;
  operatorSwitches: OperatorSwitch[];
  riskProgression: RiskEvolutionEntry[];
  riskEscalating: boolean;
  repeatedHarmIndicators: number;
  repeatedInterventionPatterns: number;
  concurrentActivityWindows: { at: string; operators: string[] }[];
  selfExclusionConflicts: { exclusionId: string; operatorId: string; conflictRef: string; at: string }[];
  coolingOffConflicts: { exclusionId: string; operatorId: string; conflictRef: string; at: string }[];
  interventionEffectiveness: { interventionId: string; operatorId: string; at: string; outcome: string }[];
  investigationIndicators: number;
  behaviourEscalation: boolean;
  metrics: NationalBehaviourMetric[];
  provenance: CorrelationProvenance;
  correlationEngineVersion: string;
  generatedAt: string;
}

export interface NationalSelfExclusionView {
  sbNat: SbNatId;
  jurisdiction: JurisdictionCode;
  activeExclusions: SelfExclusionEntry[];
  historicalExclusions: SelfExclusionEntry[];
  coolingOffPeriods: SelfExclusionEntry[];
  conflictingActivity: { exclusionId: string; operatorId: string; conflictRef: string; at: string }[];
  provenance: CorrelationProvenance;
  correlationEngineVersion: string;
  generatedAt: string;
}

export interface InvestigationView {
  investigationRef: string;
  sbNat: SbNatId;
  jurisdiction: JurisdictionCode;
  linkedSbPlr: string[];
  linkedOperators: string[];
  timeline: TimelineEntry[];
  findings: { at: string; note: string }[];
  observations: string[];
  summary: string;
  provenance: CorrelationProvenance;
  correlationEngineVersion: string;
  generatedAt: string;
}

export interface CorrelationDiagnostics {
  sbNat: SbNatId;
  jurisdiction: JurisdictionCode;
  sbPlrCorrelated: number;
  operatorsRepresented: number;
  sourceReferencesEvaluated: number;
  recordsIncluded: number;
  recordsExcluded: number;
  exclusionReasons: ExcludedSource[];
  missingSources: string[];
  staleSources: string[];
  provenanceComplete: boolean;
  integrityOk: boolean;
  processingMs: number;
}

export interface CorrelationIntegrityCheck { name: string; passed: boolean; detail: string; }
export interface CorrelationIntegrityReport {
  sbNat: SbNatId;
  jurisdiction: JurisdictionCode;
  ok: boolean;
  checks: CorrelationIntegrityCheck[];
  reproducible: boolean;
}
