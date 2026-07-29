# SafeBet IQ — v2.0 Migration, Backward Compatibility, Deployment, Rollback, Risk & Implementation Roadmap

**Status: PROPOSED — Phase 1. No migration or code exists yet. Governed by ADR-006.**

## 1. Backward compatibility strategy
- **`SB-PLR` unchanged.** No operator identity is renamed, re-derived, or migrated. Existing events, projections, twins, intelligence, policy and consumer contracts are byte-identical.
- **Additive only.** New event type (`IDENTITY_FEDERATION_ATTRIBUTE`) is appended to the frozen vocabulary; new regulator-plane tables/projection/twin/policy-scope/consumer-views are added; nothing existing is altered (Constitution §9 — additive is the default).
- **Off by default.** With federation disabled, the platform is bit-for-bit today's behaviour (aggregate/cohort cross-operator intelligence). No operator-facing change occurs until a jurisdiction opts in.
- **Coexistence.** The certified per-casino flow and the regulator-plane federation run side by side; the federation only *reads* per-casino projections by reference.

## 2. Migration strategy (per jurisdiction, opt-in)
1. **Provision:** create the per-jurisdiction national pepper in Secrets Manager/HSM; deploy `lib/identityFederation`, the `federation` edge function, the regulator-plane migration (new tables + RLS + append-only audit trigger), and the national policy pack (disabled).
2. **Enable flag:** an administrator/regulator sets the jurisdiction federation flag on (governance-recorded, like a policy activation).
3. **Contribution / backfill:** operators submit hashed attributes for new registrations; a one-time backfill emits `IDENTITY_FEDERATION_ATTRIBUTE` events for existing `SB-PLR`s (operator-side batch, hashes only). Idempotency-keyed (ADR-003) so re-runs are safe.
4. **Resolve:** NIFS clusters hashes → mints/resolves `SB-NAT` → populates the regulator-plane mapping + national twin.
5. **Verify:** regulator national views render; reconciliation and tenant-isolation checks pass (see §6).
No downtime; no operator data touched; no `PROJECTION_VERSION` bump for operator projections (a separate `NATIONAL_PROJECTION_VERSION` governs only the regulator-plane projection).

## 3. Deployment strategy
- **Order:** secrets → DB migration (regulator-plane, additive) → `lib/identityFederation` + `federation` edge deploy → national policy pack seed (inactive) → enable flag (per jurisdiction) → operator contribution/backfill.
- **Environments:** dev → demo → production, each with its own pepper and flag; demo verification before any production jurisdiction (Constitution §11).
- **Zero operator impact:** operators need only add the hashed-attribute submission at their integration edge; until they do, they simply don't contribute (their players remain un-federated, safely).

## 4. Rollback strategy
- **Soft rollback (reversible, seconds):** disable the jurisdiction federation flag → NIFS stops resolving; regulator national-identity views degrade to today's aggregate/cohort views; operators unaffected.
- **Hard rollback:** additionally truncate the regulator-plane store (`national_identity_map`, `projection_national_identity`, `federation_audit`) and drop the national policy pack — **no operator data is touched** (the `IDENTITY_FEDERATION_ATTRIBUTE` events remain in the immutable log, per-tenant, harmless; can be archived). The platform returns exactly to v1.5.2 behaviour.
- **Pepper incident:** rotate the pepper (versioned); re-contribute; old hashes expire with their key version.

## 5. Risk assessment
| ID | Risk | Sev | Likelihood | Mitigation |
|---|---|---|---|---|
| V-R1 | False positive links harm a subject | High | Med | Confidence tiers + manual override + appeal; automated national action only on *Confirmed* + policy (human decides). |
| V-R2 | Pepper mismanagement | High | Low | HSM/Secrets Manager, IAM least-privilege, versioned rotation, alerting. |
| V-R3 | Scope/function creep | Med | Med | Constitution-bound purpose; policy-as-data scope; audited reads; governance review. |
| V-R4 | Operator non-adoption (thin federation) | Med | Med | Value-driven onboarding; backfill tooling; graceful partial coverage (un-federated players simply absent from national views). |
| V-R5 | Regulatory/legal divergence per jurisdiction | Med | Med | Per-jurisdiction config (attribute set, thresholds, retention) as data; signed processing agreement before enablement. |
| V-R6 | Constitution drift (a second runtime reality) | High | Low | National twin references, never duplicates; §2 clarified in the Constitution update; boundary tests in Phase 3. |
| V-R7 | Performance of match/cluster at national scale | Med | Med | Deterministic hash-index matching (O(1) exact-match lookups); async downstream; load-test in the roadmap. |

## 6. Validation plan (Phase 3 acceptance)
- Existing architecture preserved (225+ tests still green; operator projections/twin/intelligence/policy/consumer unchanged; `SB-PLR` identical).
- Tenant isolation: operator → federation reads = 403; anon → 401; cross-jurisdiction regulator = 403.
- National identities reconcile: each `SB-NAT` resolves to a consistent set of `SB-PLR`s; national twin aggregates match the underlying per-casino projections.
- Privacy: no PII stored anywhere; pepper never client-exposed; `federation_audit` append-only.
- Explainability: every link has confidence + evidence + provenance + appeal; national policy decisions carry policy reference + confidence (§8).
- Cross-operator intelligence functions for the regulator; operators remain isolated & unaware.

## 7. Implementation roadmap (Phase 3, after approval)
- **Stage 0 — Foundations:** pepper/keyring + hashing helper; `IDENTITY_FEDERATION_ATTRIBUTE` event type + validation; `federation-submit` edge (operator write-only, own tenant).
- **Stage 1 — Federation core:** `lib/identityFederation` (normalise, HMAC, matcher, weighted confidence, `SB-NAT` minting, mapping); regulator-plane migration (tables + RLS + append-only audit); deterministic-match + confidence unit tests.
- **Stage 2 — National twin & policy:** National Player Twin (reference-aggregation); national policy scope (self-exclusion, cooling-off, cross-operator escalation) as data; national analysis composition (risk progression, repeated-harm).
- **Stage 3 — Regulator surface:** Consumer/Regulator Portal national views (`national-player-summary`, `cross-operator-timeline`, `national-self-exclusion`, `national-alerts`) via the `federation` edge; regulator UI pages; grants (regulator-only).
- **Stage 4 — Governance & ops:** merge/split + override + appeal workflow; monitoring; pepper rotation; operational runbook; security pen-test; PIA sign-off.
- **Stage 5 — Demo & certification:** update the **National Demonstration Dataset v2** using the *approved federation* (no fabricated duplicate records): seed hashed attributes for existing demo patrons so NIFS legitimately links them into `SB-NAT` clusters, then demonstrate shared anonymous identities, national self-exclusion, regulator investigations, behaviour escalation across operators, confidence scoring, explainable federation, and national intervention history. Pass the **V2 Certification Strategy** (`V2_CERTIFICATION_STRATEGY.md`, C2-1…C2-7) before enabling any real jurisdiction; C2-1 (Architecture) and C2-5 (Consumer Platform Regression) are hard gates.

## 8. Operational Runbook (national federation)
- **Enable/disable jurisdiction:** set the federation flag (governance-recorded); verify pepper present; confirm views toggle.
- **Provision/rotate pepper:** create/rotate in Secrets Manager/HSM (versioned); trigger re-contribution; monitor dual-version window.
- **Review a proposed link:** open the `SB-NAT` candidate; inspect confidence + evidence (types) + source operators; confirm / reject / override (audited).
- **Merge/split:** merge duplicate `SB-NAT`s (record reason); split an erroneous link (re-mint, record reason); both audited + appealable.
- **Handle an appeal:** log appeal → regulator review → decision recorded in `federation_audit` (+ appeal_history).
- **Rebuild national projection:** deterministic replay of `IDENTITY_FEDERATION_ATTRIBUTE` events through the matcher (like any projection rebuild); regulator-plane only.
- **Incident:** false-link surge → tighten thresholds (config) + review; pepper suspicion → rotate; contribution flood → rate-limit; unauthorised read attempt → audit + investigate (all 403-blocked already).
