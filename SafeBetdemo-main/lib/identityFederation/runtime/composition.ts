// ─── Deployed Runtime — composition root (Milestone 4.6) ─────────────────────
//
// The composition root that a deployed non-production SafeBet IQ Version 2.0
// service would use: it wires crypto (4.2) + SB-NAT Registry + durable regulator-
// plane persistence (4.1) + contribution Event Platform + projector (4.3) +
// Matching + Decision (3.2/3.3) + Correlation (3.5) + National Policy (3.6) +
// operator connector auth (4.4) + financial Event Platform/Projection/
// Reconciler (4.5), plus feature-flag governance, health checks, and safe version
// metadata. Federation is OFF by default. Runs IN-PROCESS (deployed-service
// topology); a real managed deployment is a documented deployment binding.

import type { JurisdictionCode } from '../types.ts';
import { MATCHING_ENGINE_VERSION, DECISION_ENGINE_VERSION, FEDERATION_ALGORITHM_VERSION, RULE_SET_VERSION } from '../version.ts';
import { FederationCryptoProvider, InMemoryPilotSecretStore, HMAC_ALGORITHM, CANONICAL_FORMAT_VERSION } from '../crypto/index.ts';
import { SbNatRegistry, reconstructSbNatRegistry } from '../registry.ts';
import { RegulatorPlaneStore, InMemoryBackend, PILOT_STORE_SCHEMA_VERSION } from '../persistence/index.ts';
import { IdentityMatchingEngine } from '../matchingEngine.ts';
import { FederationDecisionEngine } from '../decisionEngine.ts';
import { FederationEventPlatform, ContributionProjector, InMemorySbPlrDirectory, EVENT_SCHEMA_VERSION } from '../contribution/index.ts';
import { EnterpriseCorrelationLayer, InMemoryCorrelationProvider, type CorrelationDataProvider, CORRELATION_ENGINE_VERSION } from '../correlation/index.ts';
import { NationalPolicyEngine, NationalPolicyStore, NATIONAL_POLICY_ENGINE_VERSION } from '../policy/index.ts';
import { ConnectorAuthenticator } from '../connector/index.ts';
import { FinancialEventPlatform, FinancialProjectionPlatform, FinancialReconciler, PROJECTION_VERSION, FINANCIAL_EVENT_SCHEMA_VERSION } from '../financial/index.ts';
import {
  FederationFeatureFlags, type FeatureFlagStore, type RuntimeEnvironment,
  type RuntimeHealth, type ComponentHealth, type HealthState, type DeploymentVersion,
} from './model.ts';

export interface FederationRuntimeOptions {
  approvedTestTenants: string[];
  applicationVersion?: string;
  buildId?: string;
  environment?: RuntimeEnvironment;
  now?: () => string;
  flagStore?: FeatureFlagStore;
}

const INTEGRITY_CTX = { plane: 'service' as const, jurisdiction: 'ZA' as JurisdictionCode };

export class FederationRuntime {
  readonly flags: FederationFeatureFlags;
  readonly secretStore: InMemoryPilotSecretStore;
  readonly crypto: FederationCryptoProvider;
  readonly registryStore: RegulatorPlaneStore;
  readonly registry: SbNatRegistry;
  readonly matcher: IdentityMatchingEngine;
  readonly decision: FederationDecisionEngine;
  readonly directory: InMemorySbPlrDirectory;
  readonly contributionPlatform: FederationEventPlatform;
  readonly projector: ContributionProjector;
  readonly policyStore: NationalPolicyStore;
  readonly connectorAuth: ConnectorAuthenticator;
  readonly financialPlatform: FinancialEventPlatform;
  readonly financialProjection: FinancialProjectionPlatform;
  readonly financialReconciler: FinancialReconciler;

  private readonly now: () => string;
  private readonly environment: RuntimeEnvironment;
  private readonly applicationVersion: string;
  private readonly buildId: string;

  constructor(opts: FederationRuntimeOptions) {
    this.now = opts.now ?? (() => new Date().toISOString());
    this.environment = opts.environment ?? 'in-process-composition';
    this.applicationVersion = opts.applicationVersion ?? '2.0.0-nonprod';
    this.buildId = opts.buildId ?? 'local';
    this.flags = new FederationFeatureFlags({ approvedTestTenants: opts.approvedTestTenants, store: opts.flagStore });
    this.secretStore = new InMemoryPilotSecretStore({ jurisdictions: ['ZA', 'NA', 'BW', 'KE'], now: this.now });
    this.crypto = new FederationCryptoProvider({ store: this.secretStore, now: this.now });
    this.registryStore = new RegulatorPlaneStore({ backend: new InMemoryBackend() });
    this.registry = new SbNatRegistry({ now: this.now, persistence: this.registryStore });
    this.matcher = new IdentityMatchingEngine();
    this.decision = new FederationDecisionEngine(this.now);
    this.directory = new InMemorySbPlrDirectory();
    this.contributionPlatform = new FederationEventPlatform({ resolver: this.directory, verifyPepperVersion: (j, v) => this.crypto.verifyVersion(j, v), now: this.now });
    this.projector = new ContributionProjector({ now: this.now });
    this.policyStore = new NationalPolicyStore();
    this.connectorAuth = new ConnectorAuthenticator(this.now);
    this.financialPlatform = new FinancialEventPlatform({ now: this.now });
    this.financialProjection = new FinancialProjectionPlatform(this.now);
    this.financialReconciler = new FinancialReconciler();
  }

  /** Build a read-only correlation layer over the registry (federation-flag gated). */
  correlationLayer(provider: CorrelationDataProvider): EnterpriseCorrelationLayer {
    return new EnterpriseCorrelationLayer({ registry: this.registry, provider, now: this.now, isEnabled: (j) => this.flags.isEnabled(j) });
  }
  /** Build a national policy engine over a correlation layer. */
  policyEngine(provider: CorrelationDataProvider): NationalPolicyEngine {
    return new NationalPolicyEngine({ correlationLayer: this.correlationLayer(provider), store: this.policyStore, now: this.now });
  }
  emptyCorrelationProvider(): InMemoryCorrelationProvider { return new InMemoryCorrelationProvider({}); }

  /** Restart / recovery: reconstruct the registry from durable persistence. */
  reconstructRegistry(): SbNatRegistry {
    return reconstructSbNatRegistry(this.registryStore.reconstructRegistry(INTEGRITY_CTX).snapshot(), { now: this.now });
  }

  // ── Health ─────────────────────────────────────────────────────────────────
  health(): RuntimeHealth {
    const components: ComponentHealth[] = [];
    const add = (component: string, state: HealthState, detail: string) => components.push({ component, state, detail });
    add('application', 'healthy', 'runtime composed');
    add('registry', this.registry.verifyIntegrity().ok ? 'healthy' : 'degraded', 'SB-NAT registry integrity');
    let persist: HealthState = 'healthy'; let paudit: HealthState = 'healthy';
    try { this.registryStore.diagnostics(INTEGRITY_CTX); } catch { persist = 'unavailable'; }
    try { if (!this.registryStore.verifyAuditChain(INTEGRITY_CTX).ok) paudit = 'degraded'; } catch { paudit = 'unavailable'; }
    add('regulator-plane-persistence', persist, 'durable pilot store');
    add('audit-integrity', paudit, 'hash-chained append-only audit');
    add('event-platform', 'healthy', 'contribution boundary available');
    add('projection-platform', 'healthy', 'contribution projector available');
    add('financial-projector', 'healthy', 'financial projection available');
    add('connector-service', 'healthy', 'connector authenticator available');
    add('feature-flag-service', 'healthy', 'federation flags available');
    const fedOn = this.flags.snapshot().masterEnabled;
    add('enterprise-correlation-layer', fedOn ? 'healthy' : 'disabled', fedOn ? 'federation enabled' : 'federation off by default');
    add('national-policy-platform', fedOn ? 'healthy' : 'disabled', fedOn ? 'federation enabled' : 'federation off by default');
    let secret: HealthState = 'healthy'; try { this.crypto.health(); } catch { secret = 'unavailable'; }
    add('secret-provider', secret, 'pilot pepper store (non-production)');
    const worst = worstState(components.map((c) => c.state));
    return { environment: this.environment, overall: worst, components, checkedAt: this.now() };
  }

  // ── Version (safe; no secrets) ───────────────────────────────────────────────
  version(): DeploymentVersion {
    return {
      applicationVersion: this.applicationVersion, buildId: this.buildId, environment: this.environment,
      architectureVersion: FEDERATION_ALGORITHM_VERSION, adr: 'ADR-006',
      eventSchemaVersions: { contribution: EVENT_SCHEMA_VERSION, financial: FINANCIAL_EVENT_SCHEMA_VERSION, ruleSet: RULE_SET_VERSION },
      projectionVersion: PROJECTION_VERSION,
      matchingEngineVersion: MATCHING_ENGINE_VERSION, decisionEngineVersion: DECISION_ENGINE_VERSION, registryVersion: PILOT_STORE_SCHEMA_VERSION,
      correlationEngineVersion: CORRELATION_ENGINE_VERSION, nationalPolicyEngineVersion: NATIONAL_POLICY_ENGINE_VERSION,
      connectorVersion: '1.0', financialProjectionVersion: PROJECTION_VERSION,
      cryptoAlgorithm: HMAC_ALGORITHM, canonicalFormatVersion: CANONICAL_FORMAT_VERSION,
      featureFlags: this.flags.snapshot(),
    };
  }
}

function worstState(states: HealthState[]): HealthState {
  if (states.includes('unavailable')) return 'unavailable';
  if (states.includes('misconfigured')) return 'misconfigured';
  if (states.includes('degraded')) return 'degraded';
  return 'healthy';
}
