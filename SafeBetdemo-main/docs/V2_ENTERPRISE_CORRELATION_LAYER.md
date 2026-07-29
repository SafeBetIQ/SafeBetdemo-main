# Enterprise Correlation Layer — Technical Documentation & Specifications (v2.0)

**ADR-006 (Accepted, frozen) · Milestone 3.5 · Regulator-plane, read-only.**
Consolidated reference: technical overview, National Player Twin model, correlation
provenance specification, read-only access-control specification, and correlation
integrity specification. Companion to `V2_MILESTONE_3.5_CORRELATION_LAYER_REPORT.md`.

---

## 1. Technical Overview
The Enterprise Correlation Layer is a **regulator-plane, read-only, reference-based**
national intelligence capability. It consumes approved **SB-NAT** identities from the
SB-NAT Registry (3.4) and existing operator information **by reference only**, through
**injected read-only providers**, and **derives** national insights in the regulator
plane. It is never an operational system of record and never mutates operator runtime,
SB-PLR, SB-NAT, registry state, or federation decisions.

**Module layout** (`lib/identityFederation/correlation/`):
- `model.ts` — provider contracts + in-memory reference provider; access model; provenance; domain models; vocabularies.
- `engine.ts` — `EnterpriseCorrelationLayer` + `CORRELATION_ENGINE_VERSION` (`'2.0'`).
- `index.ts` — public API (re-exported from the federation `index.ts`).

**Composition:** `NationalIdentityFederationService.correlationLayer(provider, now?)`
returns a layer bound to the service's registry + feature-flag gate. Providers are
injected at the regulator-plane composition root; tests use `InMemoryCorrelationProvider`.

**Public queries** (all deny-by-default + jurisdiction-bound):
`getNationalPlayerTwin`, `getCrossOperatorTimeline`, `getCrossOperatorIntelligence`,
`getNationalBehaviourAnalytics`, `getNationalSelfExclusionView`, `getOperatorParticipation`,
`createInvestigationView`, `correlationDiagnostics`, `verifyCorrelationIntegrity`.

**Determinism:** no ML, no hidden scoring, no hidden thresholds. All ordering uses
explicit comparators; identical references + clock ⇒ byte-identical output.

---

## 2. Read-Only Data Access Model
Operator data is reached **only** through the `CorrelationDataProvider` contract, keyed by
operator SB-PLR, returning **references** (never PII):

| Method | Returns |
|---|---|
| `operator(operatorId)` | `OperatorReference` (id, jurisdiction) |
| `playerReferences(sbPlr)` | first/last observed, operator, jurisdiction |
| `eventReferences(sbPlr)` | event id, category, timestamp, optional magnitude **band** |
| `riskReferences(sbPlr)` | risk id, tier (`low..critical`), timestamp |
| `interventionReferences(sbPlr)` | intervention id, type, outcome, timestamp |
| `selfExclusionReferences(sbPlr)` | exclusion id, kind, window, status |
| `complianceReferences(sbPlr)` | record id, type, status, timestamp |
| `investigationReferences(sbPlr)` | investigation id, ref, timestamp |
| `twinReferences(sbPlr)` | operator digital-twin id, risk tier, wellbeing ref |

Providers must expose no mutation handle and no PII. The layer depends on the **interface**,
never on operator implementation details. All providers are injected; there is no direct
runtime coupling.

---

## 3. National Player Twin Model
A **read-only derived view** assembled by reference across approved operator records.
It **never** replaces, merges, or mutates operator Digital Twins, and owns **no** SB-NAT
or SB-PLR lifecycle.

Fields: `sbNat`, `jurisdiction`, `participatingOperators[]`, `sbPlrRefs[]`,
`firstObservedAt`, `lastObservedAt`, `activityTimeline[]`, `riskEvolution[]`,
`behaviourEvolution[]`, `interventionHistory[]`, `selfExclusionHistory[]`,
`complianceHistory[]`, `investigationRefs[]`, `wellbeingSummary`, `provenance`,
`dataFreshness`, `limitations[]`, `correlationEngineVersion`, `generatedAt`.

**Wellbeing summary (transparent method):** `currentRiskTier` = latest risk reference;
`riskEscalating` = rank(last tier) > rank(first tier); `activeSelfExclusions` /
`activeCoolingOff` = direct reference tallies; `totalInterventions` = count;
`participatingOperatorCount` = distinct operators. No scoring/ML/thresholds.

**Lifecycle:** the twin is a derived read model — it may be *generated / refreshed /
reconstructed / invalidated / archived*. A refresh yields a **new derived result** (it does
not overwrite evidence in a way that prevents reconstruction). It never alters registry
assignments.

---

## 4. Correlation Provenance Specification
Every national insight carries an **immutable** `CorrelationProvenance` (no insight may
exist without it). The minimum evidence chain is:

```
SB-NAT → Registry record → approved Federation Decision → Matching Candidate
       → Matching Evidence → mapped SB-PLR → source records / event IDs → operator
```

Recorded fields: `sbNat`, `jurisdiction`, `sbPlrRefs[]`, `sourceOperators[]`,
`registryAssignmentRefs[]`, `federationDecisionRefs[]`, `matchingCandidateRefs[]`
(parsed from `dec:<candidate>:<ver>`), `matchingEvidenceRefs[]` (resolved via the candidate),
`sourceRecordRefs[]`, `sourceTimestamps[]`, `correlationTimestamp`,
`correlationEngineVersion`, `policyVersion` (**null** until 3.6), `dataFreshness`
(most-recent source timestamp), `excludedSources[]` (ref + reason), `limitations[]`.
Provenance is deep-frozen and contains **no plaintext PII**.

---

## 5. Read-Only Access-Control Specification
**Deny-by-default**, enforced at the **service boundary** (never by UI hiding).

`AccessContext = { plane: 'regulator'|'operator'|'casino-admin'|'unauthenticated',
jurisdiction, sovereignJurisdictions? }`.

`authorise(ctx, targetJurisdiction)`:
1. No context ⇒ **denied**.
2. `plane !== 'regulator'` ⇒ **denied** (operator / casino-admin / unauthenticated).
3. Allowed set = `sovereignJurisdictions ?? [jurisdiction]`; target not in set ⇒ **denied**.

Consequences: operators cannot query SB-NAT or cross-operator data; a regulator is bound
to its own jurisdiction; **no cross-sovereign access** unless explicitly authorised by
approved `sovereignJurisdictions` configuration. When the layer is built via NIFS, the
jurisdiction's **federation feature-flag** must also be enabled, else access is denied.

---

## 6. Correlation Integrity Specification
`verifyCorrelationIntegrity(ctx, sbNat, { freshnessHorizonMs?, asOf? })` returns
`{ sbNat, jurisdiction, ok, checks[], reproducible }`. Checks:

| Check | Validates |
|---|---|
| `sbnat-exists-and-eligible` | SB-NAT is registered and resolvable |
| `registry-assignments-valid` | every member is assigned to this SB-NAT |
| `referenced-sbplr-exist` | each member resolves to a player reference |
| `jurisdictions-match` | record jurisdiction == query jurisdiction |
| `operators-distinct` | each member maps to a single operator |
| `federation-decision-provenance` | ≥1 decision reference exists |
| `matching-provenance` | every decision yields a matching-candidate reference |
| `source-references-resolvable` | included + excluded fully accounted for |
| `timeline-ordering-deterministic` | repeated ordering is stable |
| `no-plaintext-pii` | no email/long-digit patterns in output |
| `reproducible` | two fixed-clock builds are byte-identical |
| `no-runtime-mutation` | registry state unchanged across derivation |
| `within-freshness-horizon` *(optional)* | no source older than the **caller-supplied** horizon |

The freshness horizon is always caller-supplied — the layer defines **no** hidden
regulatory threshold (thresholds belong to Milestone 3.6).

---

## 7. Certification Evidence Mapping (provisional, milestone-level)
| Certification | Evidence in this milestone |
|---|---|
| C2-1 Architecture | Correct position; additive; deterministic; read-only enforcement report |
| C2-2 Security | Deny-by-default access, boundary-enforced, isolation tests |
| C2-3 Privacy | No-PII provider contracts + serialised-output scan + data minimisation |
| C2-4 Cross-Operator Intelligence | Explainable metrics + complete provenance + reproducibility |
| C2-5 Consumer Platform Regression | Operator/consumer runtime untouched; 301/301 regression green |

Full C2-x certification completes at Milestone 3.8; nothing is enabled in any jurisdiction.

---

## 8. Release Notes (v2.0 · Milestone 3.5)
- **Added:** Enterprise Correlation Layer (regulator-plane, read-only) — National Player
  Twin, cross-operator timeline, cross-operator intelligence, national behaviour analytics,
  national self-exclusion view, regulator investigation services, correlation diagnostics,
  and a correlation integrity verifier; all with complete immutable provenance and
  deterministic reproducibility.
- **Security/Privacy:** deny-by-default regulator-plane access, jurisdiction sovereignty,
  data minimisation, no plaintext PII.
- **Compatibility:** fully additive; federation OFF by default; no operator runtime, SB-PLR,
  SB-NAT, registry, or decision behaviour changed; 301/301 tests pass; `tsc` clean.
- **Not included (by design):** national policy/threshold execution, operator/consumer/UI
  integration, external APIs, DB migrations — deferred to later milestones.
