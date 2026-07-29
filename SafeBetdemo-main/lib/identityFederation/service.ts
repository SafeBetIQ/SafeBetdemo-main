// ─── National Identity Federation Service (NIFS) — shell (v2.0, ADR-006) ─────
//
// Phase 3.1 Foundation. The NIFS composition shell + dependency-injection seams.
// It wires config (feature flags), jurisdiction profiles, the version framework,
// the immutable audit model and the security scaffolding. It deliberately does
// NOT match, decide, or mint SB-NAT — those are Milestones 3.2 (Identity
// Matching Engine), 3.3 (Federation Decision Engine) and 3.4 (SB-NAT Registry).
// The seams throw a clear "not implemented in this milestone" error so the
// boundary is explicit and testable.

import type { AttributeType, AttributeHash, JurisdictionCode, SbNatId, FederationVersionStamp, FederationDecisionAudit, FederationContribution, MatchingResult, FederationCandidate, FederationDecision, DecisionDiagnostics, DecisionOutcome } from './types.ts';
import { type FederationConfig, resolveFederationConfig, isFederationEnabled } from './config.ts';
import { getJurisdictionProfile, isAttributeEnabled, type JurisdictionProfile } from './jurisdictionProfiles.ts';
import { buildVersionStamp } from './version.ts';
import { type AuditSink, InMemoryAuditSink, sealAuditRecord } from './audit.ts';
import type { AttributeHasher } from './security.ts';
import { IdentityMatchingEngine } from './matchingEngine.ts';
import { FederationDecisionEngine } from './decisionEngine.ts';
import { SbNatRegistry, type SbNatRecord, type IntegrityReport, type RegistryDiagnostics } from './registry.ts';
import { jurisdictionOfSbNat } from './identifiers.ts';
import { EnterpriseCorrelationLayer, type CorrelationDataProvider } from './correlation/index.ts';
import { NationalPolicyEngine, NationalPolicyStore, type PolicyAuditSink } from './policy/index.ts';

export class FederationNotEnabledError extends Error {
  readonly code = 'federation-not-enabled';
  constructor(j: JurisdictionCode) { super(`federation is not enabled for jurisdiction '${j}'`); this.name = 'FederationNotEnabledError'; }
}
export class MilestoneNotImplementedError extends Error {
  readonly code = 'milestone-not-implemented';
  constructor(what: string, milestone: string) { super(`${what} is implemented in Milestone ${milestone}, not the 3.1 Foundation`); this.name = 'MilestoneNotImplementedError'; }
}

export interface FederationDependencies {
  config: FederationConfig;
  auditSink: AuditSink;
  /** Optional in foundation; required before any hashing. Injected at the composition root. */
  hasher?: AttributeHasher;
  /** Deterministic Identity Matching Engine (Milestone 3.2). Defaulted by the factory. */
  matchingEngine?: IdentityMatchingEngine;
  /** Federation Decision Engine (Milestone 3.3). Defaulted by the factory. */
  decisionEngine?: FederationDecisionEngine;
  /** SB-NAT Registry (Milestone 3.4). Defaulted by the factory (bound to auditSink). */
  registry?: SbNatRegistry;
}

/**
 * The National Identity Federation Service. Foundation surface only:
 * enablement, profile access, version stamps, attribute hashing (security
 * scaffolding), and immutable audit recording. Correlation logic is added by
 * later milestones through the same injected dependencies.
 */
export class NationalIdentityFederationService {
  private readonly deps: FederationDependencies;
  constructor(deps: FederationDependencies) {
    this.deps = deps;
  }

  /** Feature-flag gate: federation is denied by default (Constitution §7 amended). */
  isEnabled(j: JurisdictionCode): boolean {
    return isFederationEnabled(this.deps.config, j);
  }

  /** The frozen, policy-driven jurisdiction profile (data, not code). */
  profile(j: JurisdictionCode): JurisdictionProfile {
    return getJurisdictionProfile(j);
  }

  /** The immutable five-part version stamp for decisions in this jurisdiction. */
  versionStamp(j: JurisdictionCode): FederationVersionStamp {
    return buildVersionStamp(getJurisdictionProfile(j));
  }

  /**
   * Security scaffolding: produce a salted, non-reversible attribute hash.
   * Guarded — only for an enabled jurisdiction and an attribute the jurisdiction
   * profile approves. Requires an injected hasher (composition root). Produces a
   * hash only; it performs NO comparison/matching.
   */
  hashAttribute(j: JurisdictionCode, type: AttributeType, value: string): AttributeHash {
    if (!this.isEnabled(j)) throw new FederationNotEnabledError(j);
    if (!isAttributeEnabled(j, type)) throw new Error(`attribute '${type}' is not enabled in jurisdiction '${j}'`);
    if (!this.deps.hasher) throw new Error('no AttributeHasher injected — the composition root must provide a Digest + PepperProvider');
    return this.deps.hasher.hash(j, type, value);
  }

  /** Record an immutable federation decision audit (sealed + appended). */
  recordDecisionAudit(input: Omit<FederationDecisionAudit, 'auditId' | 'timestamp'> & Partial<Pick<FederationDecisionAudit, 'auditId' | 'timestamp'>>): FederationDecisionAudit {
    const sealed = sealAuditRecord(input);
    this.deps.auditSink.append(sealed);
    return sealed;
  }

  auditTrail(): readonly FederationDecisionAudit[] {
    return this.deps.auditSink.list();
  }

  /**
   * Identity Matching Engine (Milestone 3.2) — produces deterministic CANDIDATE
   * matches only, with confidence score + explainable evidence. It NEVER
   * decides, applies thresholds, creates SB-NAT, or merges. Gated by enablement.
   */
  generateCandidates(jurisdiction: JurisdictionCode, contributions: FederationContribution[]): MatchingResult {
    if (!this.isEnabled(jurisdiction)) throw new FederationNotEnabledError(jurisdiction);
    const engine = this.deps.matchingEngine ?? new IdentityMatchingEngine();
    return engine.generateCandidates(getJurisdictionProfile(jurisdiction), contributions);
  }

  /**
   * Federation Decision Engine (Milestone 3.3) — the governance authority.
   * Decides each candidate by configurable policy (auto-approved / manual-review
   * / rejected), records immutable, explainable, versioned decisions + audit.
   * It does NOT create SB-NAT or merge identities (that is the Registry, 3.4).
   */
  decide(jurisdiction: JurisdictionCode, candidates: FederationCandidate[]): { decisions: FederationDecision[]; diagnostics: DecisionDiagnostics } {
    if (!this.isEnabled(jurisdiction)) throw new FederationNotEnabledError(jurisdiction);
    const engine = this.deps.decisionEngine ?? new FederationDecisionEngine();
    const profile = getJurisdictionProfile(jurisdiction);
    const decisions = candidates.map((c) => {
      const r = engine.decide(profile, c);
      this.deps.auditSink.append(r.audit);
      return r.decision;
    });
    return { decisions, diagnostics: engine.diagnose(jurisdiction, decisions) };
  }

  /** Manual-review transition on a decision (governance object only). Appends audit. */
  reviewDecision(decision: FederationDecision, action: 'approve' | 'reject' | 'return' | 'escalate', reviewer: string, reason: string): FederationDecision {
    const engine = this.deps.decisionEngine ?? new FederationDecisionEngine();
    const r = engine.applyReview(decision, action, reviewer, reason);
    this.deps.auditSink.append(r.audit);
    return r.decision;
  }

  /** Regulator override (never deletes history). Appends audit. */
  overrideDecision(decision: FederationDecision, newOutcome: DecisionOutcome, reviewer: string, justification: string): FederationDecision {
    const engine = this.deps.decisionEngine ?? new FederationDecisionEngine();
    const r = engine.applyOverride(decision, newOutcome, reviewer, justification);
    this.deps.auditSink.append(r.audit);
    return r.decision;
  }

  /** Open / progress an appeal (governance object only). Appends audit. */
  appealDecision(decision: FederationDecision, action: 'open' | 'review' | 'uphold' | 'dismiss' | 'close', reviewer: string, reason: string): FederationDecision {
    const engine = this.deps.decisionEngine ?? new FederationDecisionEngine();
    const r = action === 'open' ? engine.openAppeal(decision, reviewer, reason) : engine.progressAppeal(decision, action, reviewer, reason);
    this.deps.auditSink.append(r.audit);
    return r.decision;
  }

  // ── SB-NAT Registry (Milestone 3.4) ─────────────────────────────────────────
  // The FIRST authority that creates an Enterprise Correlation Identity. It only
  // records approved decisions; it is NOT the Enterprise Correlation Layer (3.5).

  /** The shared, stateful registry (bound to this service's regulator-plane audit sink). */
  private registryInstance?: SbNatRegistry;
  private registry(): SbNatRegistry {
    return this.deps.registry ?? (this.registryInstance ??= new SbNatRegistry({ auditSink: this.deps.auditSink }));
  }

  private assertSbNatEnabled(sbNat: SbNatId): JurisdictionCode {
    const j = jurisdictionOfSbNat(sbNat);
    if (!j) throw new Error(`malformed SB-NAT identifier '${sbNat}'`);
    if (!this.isEnabled(j)) throw new FederationNotEnabledError(j);
    return j;
  }

  /**
   * Create/extend an Enterprise Correlation Identity from an APPROVED decision.
   * The ONLY minting path. Rejects any non-approved / superseded decision.
   */
  registerDecision(decision: FederationDecision, actor = 'system', reason?: string): SbNatRecord {
    if (!this.isEnabled(decision.jurisdiction)) throw new FederationNotEnabledError(decision.jurisdiction);
    return this.registry().create(decision, actor, reason);
  }

  /** Split members out of an SB-NAT into a new SB-NAT (never modifies SB-PLR). */
  splitSbNat(sbNat: SbNatId, membersToExtract: string[], actor: string, reason: string, decisionId?: string): { source: SbNatRecord; created: SbNatRecord } {
    this.assertSbNatEnabled(sbNat);
    return this.registry().split(sbNat, membersToExtract, actor, reason, decisionId);
  }

  /** Merge one SB-NAT into another (absorbed id retained forever; never modifies SB-PLR). */
  mergeSbNat(sourceSbNat: SbNatId, targetSbNat: SbNatId, actor: string, reason: string, decisionId?: string): { survivor: SbNatRecord; absorbed: SbNatRecord } {
    this.assertSbNatEnabled(sourceSbNat);
    this.assertSbNatEnabled(targetSbNat);
    return this.registry().merge(sourceSbNat, targetSbNat, actor, reason, decisionId);
  }

  /** Re-evaluate an SB-NAT (immutable event; membership unchanged). */
  reEvaluateSbNat(sbNat: SbNatId, actor: string, reason: string): SbNatRecord {
    this.assertSbNatEnabled(sbNat);
    return this.registry().reEvaluate(sbNat, actor, reason);
  }

  /** Retire an SB-NAT (inactive, permanently retained + auditable). */
  retireSbNat(sbNat: SbNatId, actor: string, reason: string): SbNatRecord {
    this.assertSbNatEnabled(sbNat);
    return this.registry().retire(sbNat, actor, reason);
  }

  /** Archive an SB-NAT (cold retention, permanently retained + auditable). */
  archiveSbNat(sbNat: SbNatId, actor: string, reason: string): SbNatRecord {
    this.assertSbNatEnabled(sbNat);
    return this.registry().archive(sbNat, actor, reason);
  }

  /** Registry lookups (regulator-plane, read-only). */
  lookupSbNat(sbNat: SbNatId): SbNatRecord | undefined { return this.registry().get(sbNat); }
  lookupSbNatBySbPlr(sbPlr: string): SbNatRecord | undefined { return this.registry().findBySbPlr(sbPlr); }
  listSbNat(jurisdiction?: JurisdictionCode): SbNatRecord[] { return this.registry().list(jurisdiction); }

  /** Reconstruct the SB-PLR→SB-NAT mapping as of a timestamp (historical reconstruction). */
  reconstructMapping(at: string): Map<string, SbNatId> { return this.registry().reconstructMappingAt(at); }

  /** Verify registry integrity (corruption is detectable). */
  verifyRegistryIntegrity(): IntegrityReport { return this.registry().verifyIntegrity(); }

  /** Registry diagnostics (counts only; no PII). */
  registryDiagnostics(jurisdiction?: JurisdictionCode): RegistryDiagnostics { return this.registry().diagnostics(jurisdiction); }

  // ── Enterprise Correlation Layer (Milestone 3.5) ────────────────────────────
  // Regulator-plane, READ-ONLY national intelligence over the registry, consuming
  // operator data by reference through injected read-only providers. Creates no
  // identity, performs no matching/decision, and modifies no operator runtime.

  /**
   * Build a read-only Enterprise Correlation Layer bound to this service's
   * registry and feature-flag gate. Data providers are injected (regulator-plane,
   * read-only). Every query it exposes is deny-by-default and jurisdiction-bound.
   */
  correlationLayer(provider: CorrelationDataProvider, now?: () => string): EnterpriseCorrelationLayer {
    return new EnterpriseCorrelationLayer({
      registry: this.registry(),
      provider,
      now,
      isEnabled: (j) => this.isEnabled(j),
    });
  }

  // ── National Policy Platform Extension (Milestone 3.6) ──────────────────────
  // Regulator-plane, additive, policy-as-DATA. Consumes read-only Correlation
  // Layer outputs and evaluates jurisdiction-specific policies into deterministic,
  // versioned, auditable outcomes. Modifies no operator runtime and does NOT
  // replace the operator Policy Platform.

  /**
   * Build a National Policy Engine bound to a read-only correlation layer (over
   * the injected provider) and a policy store. Every action is deny-by-default,
   * role-enforced, and jurisdiction-bound.
   */
  nationalPolicyEngine(provider: CorrelationDataProvider, store: NationalPolicyStore, now?: () => string, auditSink?: PolicyAuditSink): NationalPolicyEngine {
    return new NationalPolicyEngine({
      correlationLayer: this.correlationLayer(provider, now),
      store, auditSink, now,
    });
  }
}

// ── Dependency-injection factory (resettable singleton) ───────────────────────
let singleton: NationalIdentityFederationService | null = null;

export function getFederationService(overrides: Partial<FederationDependencies> = {}): NationalIdentityFederationService {
  if (singleton && Object.keys(overrides).length === 0) return singleton;
  const auditSink = overrides.auditSink ?? new InMemoryAuditSink();
  const deps: FederationDependencies = {
    config: overrides.config ?? resolveFederationConfig({}),
    auditSink,
    hasher: overrides.hasher,
    matchingEngine: overrides.matchingEngine ?? new IdentityMatchingEngine(),
    decisionEngine: overrides.decisionEngine ?? new FederationDecisionEngine(),
    registry: overrides.registry ?? new SbNatRegistry({ auditSink }),
  };
  const svc = new NationalIdentityFederationService(deps);
  if (Object.keys(overrides).length === 0) singleton = svc;
  return svc;
}

/** Test/composition helper: reset the DI singleton. */
export function __resetFederationService(): void { singleton = null; }
