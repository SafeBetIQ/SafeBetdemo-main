# V2 — Federation Pipeline Validation (Milestone 4.6)

**Full identity-federation pipeline exercised end-to-end through the composition's actual boundaries (in-process, synthetic).**

## 1. Path Exercised
```
Synthetic operator source → OperatorConnector (authenticated, hash-before-boundary)
  → FederationEventPlatform (IDENTITY_FEDERATION_ATTRIBUTE, hash-only)
  → ContributionProjector → IdentityMatchingEngine (candidates)
  → FederationDecisionEngine (deterministic, explainable)
  → SbNatRegistry (mint SB-NAT from approved decision)
  → Enterprise Correlation Layer (National Player Twin)
```

## 2. Result (deployed smoke)
- Two operators (op-a/t-a, op-b/t-b) contribute the same synthetic person (hashed `national_id`).
- Matching → exactly **1 candidate**; Decision → **auto-approved**; Registry → **SB-NAT minted**
  (`SB-NAT-ZA-<hex>`), both SB-PLR members linked.
- Correlation → National Player Twin with **2 participating operators** and federation decision provenance.

## 3. Guarantees Verified
- **No PII** crosses the boundary — salted-HMAC hashes only (raw `national_id` value never leaves the
  connector; scan confirms no raw attribute in outputs).
- **Tenant + jurisdiction isolation**; no operator federation read; **no direct SB-NAT insertion** (only via
  approved decision); **deterministic**; full provenance; **restart-durable** (registry reconstructs).

## 4. Limitation
Ran **in-process**, not as a deployed service, and the connector is an **in-process component** (not an
external/deployed connector). No new deployed-runtime evidence toward **C1** or **C5** →
both remain **PARTIALLY CLOSED**.
