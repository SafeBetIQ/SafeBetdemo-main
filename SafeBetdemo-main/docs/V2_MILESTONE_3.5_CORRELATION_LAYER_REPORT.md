# SafeBet IQ — Version 2.0 · Milestone 3.5 Implementation Report

**Enterprise Correlation Layer · 2026-07-16 · ADR-006 (Accepted, frozen)**
**Milestone status: COMPLETE. STOP — awaiting approval before Milestone 3.6.**

## 1. Technical Summary
Implemented the **Enterprise Correlation Layer** — a **regulator-plane, read-only, reference-based** national intelligence capability. It consumes approved **SB-NAT** identities (from the SB-NAT Registry, 3.4) and existing operator information **by reference only**, through **injected read-only providers**, and **derives** national insights in the regulator plane. It delivers the read-only **National Player Twin**, **cross-operator timeline**, **cross-operator intelligence**, **national behaviour analytics**, **national self-exclusion view**, and **regulator investigation services**, plus **correlation diagnostics** and a **correlation integrity verifier**. Every insight carries a **complete, immutable provenance chain** and is **deterministically reproducible** from authoritative source references. It performs **no identity matching, no federation decision, and mints no SB-NAT**; it **modifies no operator runtime, no SB-PLR, no SB-NAT, no registry state, and no decision**. Access is **deny-by-default**, **regulator-plane only**, and **jurisdiction-bound**; **no plaintext PII** enters or leaves the layer; **sovereign separation** is enforced at the data layer.

## 2. Files Added
Under `lib/identityFederation/correlation/`:
- `model.ts` — read-only provider contracts (`CorrelationDataProvider`) + `InMemoryCorrelationProvider`; deny-by-default access (`AccessContext`, `authorise`, `AccessDeniedError`); immutable `CorrelationProvenance`; and all correlation domain models (twin, timeline, intelligence, metrics, self-exclusion view, investigation view, diagnostics, integrity report) + reference vocabularies.
- `engine.ts` — `EnterpriseCorrelationLayer` (all queries + provenance + integrity) and `CORRELATION_ENGINE_VERSION`.
- `index.ts` — the correlation public API.
- `tests/identityFederation.correlation.test.mjs` — 17 tests (added at repo test root).

## 3. Files Modified
- `lib/identityFederation/service.ts` — replaced the (now-built) `correlate()` seam with a `correlationLayer(provider, now?)` factory that binds a read-only `EnterpriseCorrelationLayer` to the service's registry and feature-flag gate; added the next milestone seam `executeNationalPolicy()` (throws for Milestone 3.6).
- `lib/identityFederation/index.ts` — re-exports the correlation public API.
- `tests/identityFederation.{foundation,matching,decision,registry}.test.mjs` — moved the single milestone-boundary assertion from `correlate()` (now implemented) to `executeNationalPolicy()` (the new frontier). No behavioural change.

## 4. Justification for Every File Changed Outside the Correlation Layer
| File | Change | Justification |
|---|---|---|
| `service.ts` | `correlationLayer()` factory + `executeNationalPolicy()` seam | The approved architecture exposes the correlation layer through NIFS; the factory injects the registry + enablement gate and is the sanctioned composition point. No operator path touched. |
| `index.ts` | re-export | Single public entry point for the federation framework (additive). |
| 4 test files | boundary assertion moved `correlate`→`executeNationalPolicy` | The milestone frontier advanced; these assertions track "the next-unbuilt seam". No production/runtime change. |
**No operator application path, no production config, no database migration was changed.**

## 5. Architecture Compliance Report (ADR-006)
| Requirement | Held | Evidence |
|---|---|---|
| Regulator-plane, read-only, reference-based | ✅ | Layer reads Registry + injected providers, derives in-plane; no mutation surface. |
| Sits after the Registry, before national capabilities | ✅ | Consumes `SbNatRegistry`; `executeNationalPolicy()` (3.6) throws. |
| Does not insert into / alter the operator runtime chain | ✅ | No operator-runtime imports (grep-verified); all access via read-only provider contracts. |
| Never an operational system of record | ✅ | Stateless derivations; source data remains authoritative in its platform (stated in every provenance). |
| No identity matching / decision / SB-NAT minting | ✅ | Layer exposes none of `create/mint/generateCandidates/decide/split/merge` (asserted). |
| Deny-by-default, jurisdiction-bound access | ✅ | `authorise()`; operator/admin/unauthenticated/wrong-jurisdiction/cross-sovereign all denied (tested). |
| Complete provenance on every insight | ✅ | `CorrelationProvenance` on twin/timeline/intelligence/self-exclusion/investigation. |
| Reproducible from source references | ✅ | Fixed-clock re-derivation is byte-identical (tested); integrity `reproducible` check. |
| No plaintext PII | ✅ | Reference-only contracts; serialised-output PII scan passes (tested). |
| Jurisdiction sovereignty / data minimisation | ✅ | Out-of-jurisdiction references excluded with reason; no cross-sovereign aggregation. |
| Additive / backward compatible | ✅ | 301/301 tests pass; off by default; no operator surface touched. |

## 6. Read-Only Enforcement Report
The layer has **no mutation surface**: it never creates/modifies/deletes operator events, projections, digital twins, SB-PLR records, SB-NAT identifiers, federation decisions, or registry state; it performs no matching, no merge/split, and no interventions. Enforcement evidence: (a) the engine calls only **read** methods on `SbNatRegistry` (`get`, `exists`, `assignmentHistory`, `diagnostics`) and on the **read-only** provider contract; (b) a test snapshots `registry.diagnostics()` and cluster membership **before/after** a full battery of queries and asserts they are **unchanged**; (c) the integrity verifier includes a `no-runtime-mutation` check comparing registry state across derivation; (d) the layer object exposes none of `create/mint/generateCandidates/decide/split/merge` (asserted `undefined`).

## 7. Correlation Provenance Validation Report
Every insight carries the full chain **SB-NAT → Registry record → approved Federation Decision → Matching Candidate → Matching Evidence → mapped SB-PLR → source records/event IDs → operator**, recorded as: `sbNat`, `jurisdiction`, `sbPlrRefs`, `sourceOperators`, `registryAssignmentRefs`, `federationDecisionRefs`, `matchingCandidateRefs` (parsed from decision ids), `matchingEvidenceRefs`, `sourceRecordRefs`, `sourceTimestamps`, `correlationTimestamp`, `correlationEngineVersion`, `policyVersion` (null — policy is 3.6), `dataFreshness`, `excludedSources` (with reasons), and `limitations`. Provenance is **immutable** (deep-frozen) and contains **no PII**. No insight can be produced without it (constructed atomically in each builder).

## 8. National Player Twin Validation Report
The twin is a **read-only derived view** assembled by reference: participating operators, SB-PLR refs, first/last observed, national activity timeline, risk evolution, behaviour evolution, intervention/self-exclusion/compliance histories, investigation refs, a **transparent** wellbeing summary (documented method; no scoring/ML/thresholds), provenance, data freshness, and limitations. Validated: multi-operator assembly, single-operator view with missing-source limitations, deterministic reproduction, correct participation, risk/intervention timelines, data freshness = most-recent source timestamp, and provenance completeness. It **never** replaces, merges, or mutates operator Digital Twins or SB-NAT/SB-PLR lifecycle.

## 9. Cross-Operator Intelligence Validation Report
Deterministic, explainable outputs: participating-operator count, activity frequency, operator switching, risk progression + escalation, repeated-harm indicators (loss references), repeated-intervention patterns, concurrent-activity windows (same-calendar-day, documented), self-exclusion and cooling-off conflicts, intervention effectiveness (by reference), investigation indicators, and behaviour escalation — plus a `NationalBehaviourMetric[]` in which **every metric states** name, definition, source refs, window, method, result, version, timestamp, and limitations. **No hidden scoring, no ML, no thresholds**; **no policy execution and no operator action** is triggered (that is 3.6).

## 10. National Self-Exclusion View Validation
Aggregates active/historical self-exclusions, cooling-off periods, and **conflicting activity** (activity at any operator during an active exclusion window), each with provenance. Validated across single/multiple/overlapping exclusions, expired exclusions, and cross-operator conflicts. It **represents approved source information only** — it does **not** enforce or propagate self-exclusion (national policy execution is Milestone 3.6; stated in the view's provenance limitations).

## 11. Investigation Services Validation
`createInvestigationView` produces a **read-only derived** investigation view: linked SB-PLR + operators (by reference), a reconstructed national timeline, findings derived from investigation references, pass-through analyst observations, an explainable summary, and provenance. Validated: summary/linkage/timeline/findings/observations correctness and **no operator/registry mutation** (before/after registry snapshot equal). No case-management UI, no enforcement actions, no modification of operator investigation records.

## 12. Correlation Integrity Report
`verifyCorrelationIntegrity` returns a structured report over: `sbnat-exists-and-eligible`, `registry-assignments-valid`, `referenced-sbplr-exist`, `jurisdictions-match`, `operators-distinct`, `federation-decision-provenance`, `matching-provenance`, `source-references-resolvable`, `timeline-ordering-deterministic`, `no-plaintext-pii`, `reproducible`, `no-runtime-mutation`, and an optional caller-supplied `within-freshness-horizon` (never a hidden threshold). Validated: a healthy correlation passes all checks and is reproducible; a missing referenced SB-PLR fails `referenced-sbplr-exist`; a caller freshness horizon correctly flags stale sources.

## 13. Security and Privacy Validation
Regulator-plane only, **deny-by-default**: operator, casino-admin, unauthenticated, wrong-jurisdiction, and cross-sovereign regulators are all denied at the **service boundary** (not UI hiding). Cross-jurisdiction access requires explicit `sovereignJurisdictions` authorisation. **No plaintext PII**: provider contracts return references only; a serialised-output scan (email + long-digit heuristics) passes on twin, timeline, intelligence, and investigation outputs. Sovereign/tenant isolation: out-of-jurisdiction references are excluded with a recorded reason; no cross-sovereign aggregation. Outputs are deep-frozen (immutable); errors are safe (codes + non-sensitive messages); no sensitive logging.

## 14. Performance Notes
Deterministic, stateless derivations with indexed/mapped access, `Set`/`Map` grouping by SB-NAT, explicit deterministic sorting, and reference-only payloads. A 5-operator cluster with **2,000 event references** builds a full cross-operator timeline in well under the test bound (<2s; typically a few ms) and repeated execution is byte-identical. No premature distributed infrastructure; explainability/determinism never traded for speed. Pagination-ready result shapes (arrays with stable ordering) are in place for future bounded queries.

## 15. Milestone Test Results
`node --test tests/identityFederation.correlation.test.mjs` → **17 pass, 0 fail**, covering: architecture boundaries (no mutation, no matching/decision/mint surface); National Player Twin (multi-operator, single-operator + missing source, reproducibility, provenance); cross-operator timeline (chronological + same-timestamp deterministic ordering, excluded sources); cross-operator intelligence + national behaviour analytics (explainable metrics); national self-exclusion view (active/historical/cooling-off/conflicts, no enforcement); investigation services (derived, read-only); security (regulator authorised; operator/admin/unauthenticated/wrong-jurisdiction/cross-sovereign denied; no-PII in serialised output); integrity (valid, missing-SB-PLR, stale-horizon); and performance (2,000 refs, deterministic).

## 16. Full Regression Results
Full suite → **301 pass, 0 fail** (284 prior + 17 new). The single milestone-boundary assertion in the 3.1–3.4 test files was advanced from `correlate()` to `executeNationalPolicy()` — no behavioural regression.

## 17. TypeScript Validation
`npx tsc --noEmit` → **clean**. (No parameter-properties; `Array.from` used for all Map/Set iteration per the project's type-strip/target constraints.)

## 18. Technical Debt Check
**None.** Grep across the whole federation lib and the correlation directory finds **no** TODO/FIXME/placeholder/stub/temporary/hard-coded markers. No temporary correlation logic, no stubbed analytical services, no hard-coded demo identities, no fabricated source events (all test data is in explicit in-memory test providers, never in the layer), no incomplete provenance, no hidden thresholds, no direct operator-runtime writes, no deferred read-only controls, no undocumented security exceptions.

## 19. Risks and Limitations (documented; none violate ADR-006)
- **Matching-evidence granularity:** provenance references matching **evidence via its candidate id** (the evidence detail resolves through the Matching Engine, 3.2). This is a reference-based chain by design, stated in every provenance's `limitations`. Not debt.
- **Concurrency definition:** "concurrent activity" is defined as **same-calendar-day** activity at ≥2 operators — a deterministic, documented heuristic, surfaced in the metric's method. A finer window can be introduced later without architectural change.
- **PII detection** is a defence-in-depth heuristic (email + long-digit patterns) on top of the structural guarantee that providers carry no PII; it is not the primary control.
- **Freshness/staleness** is only evaluated against a **caller-supplied** horizon to avoid introducing a hidden regulatory threshold (thresholds belong to 3.6).

## 20. Certification Status (provisional milestone evidence only)
- **C2-1 Architecture:** PASS (milestone) — correct position, additive, deterministic, read-only.
- **C2-2 Security:** PASS (milestone) — deny-by-default, boundary-enforced, isolated.
- **C2-3 Privacy:** PASS (milestone) — no PII, data minimisation, sovereign separation.
- **C2-4 Cross-Operator Intelligence:** PASS (milestone) — explainable, provenance-complete, reproducible.
- **C2-5 Consumer Platform Regression:** PASS (milestone) — operator/consumer runtime untouched; full regression green.
- No full certification is claimed; C2-x completes at Milestone 3.8. Nothing is enabled in any jurisdiction.

## 21. Go / No-Go
**GO for Milestone 3.6 (Policy Platform Extension)** — the Enterprise Correlation Layer is complete, compiling, tested (17 + 301 regression), isolated, integrity-verifiable, reproducible, privacy-preserving, and constitutionally compliant. Milestone 3.6 will extend the Policy Platform to **execute** national policy/thresholds over this correlated intelligence (the first point at which the layer's read-only outputs inform an action).

---
**Milestone 3.5 Complete – Awaiting Approval for Milestone 3.6 (Policy Platform Extension).**
