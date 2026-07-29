# V2 — Non-Production Deployment Architecture (Milestone 4.6)

**Classification: IN-PROCESS composition (deployed-service topology). NOT a real deployment. Production UNCHANGED.**

## 1. Purpose
Describe the deployed-runtime **composition** realised this milestone and how it maps onto a future
**deployed** non-production service on the approved platform. This milestone realises the composition +
smoke **in-process**; the managed-platform binding is a residual deployment activity (not performed).

## 2. Composition Root
`FederationRuntime` (`lib/identityFederation/runtime/composition.ts`) is the single composition root. It wires:

| Layer | Component | Milestone |
|---|---|---|
| Crypto | `FederationCryptoProvider` + `InMemoryPilotSecretStore` | 4.2 |
| Registry | `SbNatRegistry` (module-closure encapsulated) | 3.4 / 4.1 |
| Persistence | `RegulatorPlaneStore` + `InMemoryBackend` (`DurableFileBackend` available) + `HashChainedAudit` | 4.1 |
| Contribution | `FederationEventPlatform` + `ContributionProjector` | 4.3 |
| Matching / Decision | `IdentityMatchingEngine` / `FederationDecisionEngine` | 3.2 / 3.3 |
| Correlation | correlation layer factory (federation-gated) | 3.5 |
| Policy | `NationalPolicyEngine` factory | 3.6 |
| Connector | `ConnectorAuthenticator` (+ `OperatorConnector` at edge) | 4.4 |
| Financial | `FinancialEventPlatform` / `FinancialProjectionPlatform` / `FinancialReconciler` | 4.5 |
| Governance | `FederationFeatureFlags` + `FeatureFlagStore` | 4.6 |

## 3. Runtime Environment Classification
`RuntimeEnvironment = 'in-process-composition'` (default here). Other declared values (`deployed-non-production`,
`production`) are **not** used and **not** authorised. Every health/version output carries the environment
label so no result can be mistaken for a real deployment.

## 4. Target Deployment Binding (residual — NOT performed)
The composition maps 1:1 onto a deployed Node/Next.js service:

```
[NGINX + security headers] → [Next.js/Node service : FederationRuntime]
     ├── RDS PostgreSQL (regulator plane)  → native RLS (C2), append-only/WORM (C3)
     ├── Secrets Manager / HSM             → pepper store (C4)
     ├── CloudWatch                        → health/metrics/alarms (Phase 4.7)
     └── External operator connector svc   → replaces in-process connector (C5)
```
Binding these managed services is a deployment activity that requires an authorised non-production target and
is **out of scope** for this milestone. Until then C2/C3/C4/C5 remain PARTIALLY CLOSED and C8 remains
PARTIALLY CLOSED.

## 5. Isolation
- Federation library imports no operator/app/edge path; imported by none (grep-verified).
- No production DB/secret/endpoint/IAM/topic/queue used.
- Feature flags default OFF; only approved synthetic test tenants can activate.

## 6. What This Milestone Did / Did Not Do
- **Did:** assemble the composition; run the full pipeline through actual boundaries in-process; health/
  version/feature-flags/restart/rollback; Consumer non-impact via import boundary; 428-test regression.
- **Did NOT:** deploy to Elastic Beanstalk/RDS/Secrets Manager; run a deployed Consumer regression; bind
  managed RLS/WORM/HSM; run an external connector service; process production/real data.
