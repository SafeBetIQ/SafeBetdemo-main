# SafeBet IQ — Version 2.0 · Milestone 3.6 Implementation Report

**National Policy Platform Extension · 2026-07-16 · ADR-006 (Accepted, frozen)**
**Milestone status: COMPLETE. STOP — awaiting approval before Milestone 3.7.**

## 1. Technical Summary
Implemented the **National Policy Platform Extension** — a **regulator-plane, additive, policy-as-DATA** capability that consumes authorised, read-only **Enterprise Correlation Layer** outputs (3.5) and evaluates **jurisdiction-specific** responsible-gambling / regulatory policies into **deterministic, versioned, auditable OUTCOMES**. It separates **definition → evaluation → outcome → approval → (deferred) enforcement**, and implements the first four. It provides the six policy families (national self-exclusion, national cooling-off, cross-operator harm escalation, national investigation trigger, regulator notification, cross-operator intervention threshold), full explainability, manual-review / override / appeal governance, append-only policy audit, a **nine-part** version stamp, deterministic conflict detection, and a structured policy integrity verifier. Policies are **declarative data** (never executable scripts), strictly schema-validated, **immutable once activated**. It performs **no matching, no federation decision, no SB-NAT creation**, does **not** modify the Registry or the Correlation Layer, **never mutates operator runtime**, and does **not** replace the operator Policy Platform. Access is **deny-by-default**, **role-enforced**, and **jurisdiction-bound**; **no plaintext PII** enters the layer.

> **Certification wording:** this milestone contributes *provisional* evidence toward C2-1..C2-5 and C2-7. No certification is finally completed; formal certification remains reserved for Milestone 3.8.

## 2. Files Added
Under `lib/identityFederation/policy/`:
- `model.ts` — policy-as-data definitions + strict schema validation; immutable versioned `NationalPolicyStore`; `PolicyEvaluation` / conflict / integrity / diagnostics models; nine-part `PolicyVersions`; role-based deny-by-default access (`PolicyAccessContext`, `authorisePolicy`); append-only policy audit (`PolicyAuditSink`, `InMemoryPolicyAuditSink`, `sealPolicyAudit`); vocabularies.
- `engine.ts` — deterministic `NationalPolicyEngine` (facts projection, condition evaluation, outcome mapping, review/override/appeal transitions, conflict detection, integrity verifier, diagnostics) + `NATIONAL_POLICY_ENGINE_VERSION`.
- `index.ts` — the policy public API.
- `tests/identityFederation.policy.test.mjs` — 22 tests.

## 3. Files Modified
- `lib/identityFederation/service.ts` — replaced the (now-built) `executeNationalPolicy()` seam with a `nationalPolicyEngine(provider, store, now?, auditSink?)` factory that binds a read-only correlation layer + policy store into a `NationalPolicyEngine`.
- `lib/identityFederation/index.ts` — re-exports the policy public API.
- `tests/identityFederation.{foundation,matching,decision,registry}.test.mjs` — the milestone-boundary assertion (previously "next seam throws") became a positive pipeline check: NIFS now exposes `generateCandidates → decide → registerDecision → correlationLayer → nationalPolicyEngine`.

## 4. Justification for Files Changed Outside the Policy Layer
| File | Change | Justification |
|---|---|---|
| `service.ts` | `nationalPolicyEngine()` factory | The approved architecture exposes national policy through NIFS; the factory injects the read-only correlation layer + store. No operator path touched. |
| `index.ts` | re-export | Single additive public entry point. |
| 4 test files | boundary assertion → positive pipeline check | The 3.2–3.6 pipeline is now fully wired; the assertion tracks that. No production/runtime change. |
**No operator application path, no production config, no database migration, no operator UI / Consumer Platform change.**

## 5. Architecture Compliance Report (ADR-006)
| Requirement | Held | Evidence |
|---|---|---|
| Regulator-plane, additive, consumes ECL read-only outputs | ✅ | Engine reads only correlation outputs; no operator-runtime import (grep-verified). |
| Sits after the Correlation Layer | ✅ | `nationalPolicyEngine` built over `correlationLayer`; input is projected ECL facts. |
| Does not replace the operator Policy Platform | ✅ | Separate national/cross-operator capability; no operator policy touched. |
| No matching / decision / SB-NAT creation / registry mutation | ✅ | Engine exposes none of `generateCandidates/decide/mint/create/split/merge`; registry snapshot unchanged (tested). |
| No operator-runtime mutation; outcomes are recommendations/decisions | ✅ | Outcomes are regulator-plane records; no runtime writes; `no-runtime-mutation` integrity check. |
| Policy-as-data (no hard-coded jurisdiction behaviour) | ✅ | Declarative definitions + conditions; strict validation; engine carries no jurisdiction logic. |
| Jurisdiction-specific / sovereign isolation | ✅ | Store scoped by jurisdiction; engine rejects cross-jurisdiction evaluation (tested). |
| Deterministic, explainable, versioned, auditable | ✅ | No ML/hidden scoring/thresholds; nine-part versions; append-only audit; reproducible. |
| Deny-by-default, role-enforced access | ✅ | `authorisePolicy` (plane + sovereignty + role); operator/wrong-jurisdiction/missing-role denied (tested). |
| No plaintext PII | ✅ | Reference-based facts; serialised-output PII scan passes (tested). |
| Additive / backward compatible | ✅ | 323/323 tests pass; off by default; no operator surface touched. |

## 6. Policy Configuration Validation
Policies are declarative data validated by `validatePolicyDefinition` (required fields, known category, known condition operators, ISO dates, outcome-rule references resolve to real conditions, valid outcomes, **no executable values**). The `NationalPolicyStore` stores versioned definitions; `activate` **freezes** the definition and **auto-retires** the prior active version of the same policy (version replacement); re-adding an existing version is rejected; effective/expiry windows and jurisdiction scoping are enforced in `getActive`/`listActive`. Validated: valid load, invalid rejection (bad category/operator/rule reference), immutability, version replacement, effective/expiry windows, jurisdiction isolation.

## 7. National Self-Exclusion Policy Validation
Configurable evaluation over active/expired exclusions, overlapping activity, conflicting operator activity, source completeness, and provenance. Validated: active exclusion + conflicting activity → *National Investigation Recommended* (review required); expired-only → default; missing required input → *Insufficient Evidence*. It **does not** block or suspend any operator account.

## 8. Cooling-Off Policy Validation
Configurable cooling-off evaluation (duration, applicable operators, conflicting activity, jurisdiction rules). Validated: an active national cooling-off period yields *National Cooling-Off Recommended*. It **does not** enforce account restrictions.

## 9. Harm Escalation Policy Validation
Deterministic threshold evaluation across inputs (operator count, risk escalation, repeated-harm/loss indicators, repeated interventions, concurrent activity, behaviour escalation). Validated: full multi-operator + escalating + harm → *Cross-Operator Escalation Required*; calm single-operator → *Continue Monitoring*. The evaluation discloses conditions evaluated/passed/failed, evidence used/excluded, thresholds, and the final outcome.

## 10. Investigation Trigger Validation
Configurable investigation-trigger policies (behaviour escalation, activity during self-exclusion, escalating risk, investigation indicators, data-integrity failure, policy conflict). Validated: behaviour escalation → *National Investigation Recommended*; a data-integrity failure short-circuits to *Data Integrity Failure*. It recommends/requires review — it creates **no enforcement action**.

## 11. Notification Outcome Validation
Notification policies model the required notification **outcome only** (e.g. *Operator Notification Required*). Validated via a high-national-risk policy. **No** email / SMS / webhook / external delivery is implemented.

## 12. Intervention Threshold Validation
Configurable cross-operator intervention thresholds produce monitoring/review outcomes (*Intervention Review Required*). Validated against prior interventions. **No** intervention is executed.

## 13. Explainability Validation
Every evaluation records: policy id/version, jurisdiction, SB-NAT, evaluation id, input references + versions, every condition (passed/failed/skipped with reason), thresholds used, evidence accepted, evidence excluded + reasons, data freshness, integrity status, final outcome + reason, reviewer, timestamp, the **nine-part** version stamp, override/appeal history, and limitations. Validated: complete condition list (passed/failed/skipped), thresholds, nine-part versions, deterministic repeat. No outcome exists without a complete explanation.

## 14. Manual Review Validation
Review workflow states: not-required / pending-review / under-review / approved / rejected / returned / escalated / closed. Each transition produces a **new immutable** evaluation + audit event; the original is never mutated; a *not-required* evaluation cannot be reviewed. Validated including immutability and history preservation.

## 15. Override and Appeal Validation
Override permanently records original + new outcome, reviewer, authority, reason, supporting reference, and prior history — the original evaluation is **preserved** (never deleted/replaced); unauthorised overrides (missing role or policy-disallowed) are rejected. Appeals traverse open / under-review / upheld / dismissed / returned / closed with full history preserved. Both validated.

## 16. Policy Audit Validation
Every policy action (`policy-evaluated`, `review-decision`, `outcome-overridden`, `appeal-opened/updated/concluded`, `integrity-failure`, …) seals an **append-only, deep-frozen** `PolicyAuditRecord` (no update/delete surface) carrying the nine-part versions and **no PII**. Validated: audit is recorded on evaluation and transitions.

## 17. Conflict Detection Validation
Deterministic detection of: duplicate active policy versions for the same case, jurisdiction mismatch, stale/incomplete data (integrity false or missing freshness), and incompatible outcomes (documented incompatibility matrix). Conflicts are **never silently resolved** — each recommends *Policy Conflict Detected*. Validated across incompatible outcomes, duplicate versions, and stale data.

## 18. Policy Integrity Report
`verifyPolicyIntegrity` returns a structured report over: policy-exists, policy-active-for-date, policy-jurisdiction-matches-sbnat, required-inputs-exist, input-integrity-passed, provenance-complete, policy-version-valid, rule-set-version-valid, outcome-allowed, no-plaintext-pii, audit-record-exists, deterministic, no-runtime-mutation, historical-reproduction. Validated: a valid evaluation passes all checks and is reproducible; a missing policy fails `policy-exists`.

## 19. Security and Privacy Validation
Regulator-plane only; **deny-by-default** with **role enforcement at the service boundary**: operators, casino-admins, unauthenticated callers, wrong-jurisdiction regulators, and role-less regulators are all denied. Cross-sovereign access requires explicit `sovereignJurisdictions`. **No plaintext PII**: facts are projected from reference-only correlation outputs; serialised-evaluation PII scan passes. Policies are **declarative data** — no arbitrary/executable policy code; strict schema validation; bounded execution; safe error messages (codes + non-sensitive text); immutable results + append-only audit; no sensitive logging.

## 20. Performance Notes
Deterministic, stateless evaluation with indexed policy lookup, jurisdiction/category-scoped `listActive`, bounded per-policy evaluation, and pagination-ready arrays. Batch-evaluating **50 active policies** over a correlated SB-NAT completes in a few ms (test bound <2s) and repeated execution is identical. No premature distributed infrastructure; determinism/explainability never traded for speed.

## 21. Milestone Test Results
`node --test tests/identityFederation.policy.test.mjs` → **22 pass, 0 fail** across: architecture boundaries; policy configuration (valid/invalid/immutable/version-replacement/effective-expiry/jurisdiction isolation); self-exclusion (active/expired/insufficient-evidence); cooling-off; harm escalation (threshold outcomes + calm case); investigation trigger + notification + intervention; data-integrity short-circuit; explainability + nine-part versions + determinism; review workflow (+ not-required guard) + reviewer-role enforcement; override (+ unauthorised) + appeal lifecycle; conflict detection; security/deny-by-default + no-PII + audit; policy integrity (valid + missing policy); performance (batch, deterministic).

## 22. Full Regression Results
Full suite → **323 pass, 0 fail** (301 prior + 22 new). The four milestone-boundary assertions were advanced to positive pipeline checks; no behavioural regression.

## 23. TypeScript Validation
`npx tsc --noEmit` → **clean** (no parameter-properties; `Array.from` for all Map/Set iteration).

## 24. Technical Debt Check
**None.** Grep across the policy layer finds no TODO/FIXME/placeholder/stub/temporary/hard-coded markers. No temporary policy logic, no hard-coded demo identities (all test data lives in explicit in-memory test providers/policies), no fabricated policy evidence, no hidden thresholds (all thresholds are policy data, surfaced in `thresholdsUsed`), no incomplete workflows, no stubbed audit, no arbitrary script execution, no operator-runtime writes, no unfinished integrity controls, no undocumented security exceptions, no production enablement.

## 25. Risks and Limitations (documented; none violate ADR-006)
- **Enforcement is out of scope** by design: outcomes are regulator-plane recommendations/decisions; no operator enforcement integration exists (per the milestone's definition/evaluation/outcome/approval separation).
- **Incompatibility matrix** for conflict detection is a small, documented, jurisdiction-agnostic set; it can be extended as policy data matures without architectural change.
- **Facts projection** is intentionally a fixed, transparent set of correlation-derived facts; adding facts is additive and does not change engine behaviour.
- **PII detection** is defence-in-depth (email + long-digit heuristics) atop the structural guarantee that inputs carry no PII.

## 26. Provisional Certification Evidence (no final claim)
- **C2-1 Architecture:** provisional PASS — correct position, additive, deterministic, policy-as-data.
- **C2-2 Security:** provisional PASS — deny-by-default + role enforcement at the boundary.
- **C2-3 Privacy:** provisional PASS — no PII, reference-based facts.
- **C2-4 Cross-Operator Intelligence:** provisional PASS — explainable, provenance-carrying, reproducible policy outcomes.
- **C2-5 Consumer Platform Regression:** provisional PASS — operator/consumer runtime untouched; full regression green.
- **C2-7 Regulator Acceptance Testing:** provisional evidence — governed review/override/appeal + integrity + audit.
- Final certification is reserved for Milestone 3.8; nothing is enabled in any jurisdiction.

## 27. Go / No-Go
**GO for Milestone 3.7 (National Demonstration Dataset Version 2)** — the National Policy Platform Extension is complete, compiling, tested (22 + 323 regression), isolated, integrity-verifiable, reproducible, privacy-preserving, and constitutionally compliant. Milestone 3.7 will build the national demonstration dataset (data only) exercising the full 3.2–3.6 pipeline end-to-end.

---
**Milestone 3.6 Complete – Awaiting Approval for Milestone 3.7 (National Demonstration Dataset Version 2).**
