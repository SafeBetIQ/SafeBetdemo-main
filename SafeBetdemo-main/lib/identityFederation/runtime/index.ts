// ─── Deployed Runtime — public API (Milestone 4.6) ───────────────────────────
//
// Deployed-runtime composition root + feature-flag governance + health + version
// + a deployed smoke harness that drives the full Version 2.0 pipeline through
// the actual service boundaries. Runs IN-PROCESS (deployed-service topology); a
// real managed deployment is a documented deployment binding. NON-PRODUCTION.

export {
  RUNTIME_ENVIRONMENTS, HEALTH_STATES, RuntimeError,
  FederationFeatureFlags, InMemoryFeatureFlagStore,
  type RuntimeEnvironment, type FeatureFlagStore, type FeatureFlagSnapshot,
  type HealthState, type ComponentHealth, type RuntimeHealth, type DeploymentVersion,
} from './model.ts';

export { FederationRuntime, type FederationRuntimeOptions } from './composition.ts';
export { DeployedSmokeHarness, type SmokeStep, type SmokeReport } from './smoke.ts';
