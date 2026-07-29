# SafeBet IQ — Version 2.0 · Milestone 3.2 Implementation Report

**Identity Matching Engine · 2026-07-16 · ADR-006 (Accepted, frozen)**
**Milestone status: COMPLETE. STOP — awaiting approval before Milestone 3.3.**

## 1. Technical Summary
Implemented the **deterministic Identity Matching Engine**: it finds *potential* identity correlations across operators within a single jurisdiction and returns **candidates with a confidence SCORE + full explainable evidence**. It performs deterministic hash comparison via a hash index, evaluates the jurisdiction's attribute rules in profile order, computes a confidence score (sum of matched weights), and emits evidence (used, not-matched, rules evaluated/skipped/order) plus diagnostics. It **never** makes a federation decision, applies thresholds, interprets the score into a tier, creates an `SB-NAT`, merges identities, or mutates anything. The engine is wired behind the NIFS `generateCandidates` seam (gated by enablement, injected via DI); `decide()` and `mintSbNat()` remain unimplemented.

## 2. Files Added
- `lib/identityFederation/matchingEngine.ts` — `IdentityMatchingEngine` (pure, deterministic; hash-index candidate generation, rule evaluation, confidence scoring, evidence, diagnostics).
- `tests/identityFederation.matching.test.mjs` — 11 tests.

## 3. Files Modified (all additive, within `lib/identityFederation/`)
- `types.ts` — `FederationCandidate` aligned to the 3.2 contract (**confidence score only, no tier**; evidenceUsed / evidenceNotMatched / matchingRulesApplied / rulesEvaluated / rulesSkipped / ruleEvaluationOrder / versions); added `SkippedRule`, `MatchingVersions`, `MatchingDiagnostics`, `MatchingResult`.
- `service.ts` — implemented `generateCandidates(jurisdiction, contributions)` (gated + DI); added `matchingEngine` dependency (factory-defaulted); `decide()`/`mintSbNat()` unchanged (still throw).
- `index.ts` — exported `IdentityMatchingEngine` + new types.
- `tests/identityFederation.foundation.test.mjs` — updated the milestone-boundary test (matching now implemented; decision + minting remain unimplemented).
**No file outside `lib/identityFederation/` + tests was modified.** No Consumer Platform, Operator UI, Event/Projection/Policy Platform, Digital Twin, API, migration, or schema change.

## 4. Architecture Compliance Report (ADR-006)
| Requirement | Held | Evidence |
|---|---|---|
| Matching produces **candidates only** (no decision) | ✅ | Returns score + evidence; no tier/accept/reject; `suggestedTier`/`sbNat` absent (tested). |
| **No SB-NAT creation / no merge** | ✅ | Engine has no minting/merge; `decide()`/`mintSbNat()` still throw `MilestoneNotImplementedError` (tested). |
| **Deterministic** (no AI/probabilistic) | ✅ | Sorted indices/pairs; identical output regardless of input order (tested). |
| Policy-driven rules (no hardcoding) | ✅ | Rules + weights + order come from the jurisdiction profile; NA has no device rule → device ignored (tested). |
| Cross-jurisdiction isolation | ✅ | Only same-jurisdiction contributions considered; a shared hash across jurisdictions never links (tested). |
| Explainability complete | ✅ | evidenceUsed, evidenceNotMatched (with reason), rulesEvaluated, rulesSkipped (with reason), ruleEvaluationOrder, versions. |
| No PII / immutable evidence | ✅ | Only attribute *types* + hashes; candidates + evidence deep-frozen (tested). |
| Tenant isolation preserved | ✅ | Lib imported by no app/component/edge path (grep-verified). |
| Additive / backward compatible | ✅ | 250/250 tests pass; off by default; no operator surface touched. |

## 5. Test Results (Milestone 3.2)
`node --test tests/identityFederation.matching.test.mjs` → **11 pass, 0 fail**: exact strong match (score 1.0), partial medium match (0.6, one-sided evidence), no-match, three-player multiple candidates (deterministic ordering), cross-jurisdiction isolation, policy-driven rule loading (NA device ignored), determinism (input-order independence), evidence immutability, empty/malformed input, performance sanity, service gating + no-decision/no-mint boundary.

## 6. Regression Results
Full suite → **250 pass, 0 fail** (239 prior + 11 new − 0; the one 3.1 boundary test was updated to the current milestone). `tsc --noEmit` clean.

## 7. Performance Notes
Candidate generation is **hash-indexed**, not O(n²) pairwise: only players co-occurring in a `(type,hash)` bucket are paired, with a dedup set to avoid duplicate evaluation and deterministic sorting for stable order. Perf sanity: 604 contributions with one 4-player cluster → 6 candidates in < 1 s. Horizontally scalable (per-jurisdiction, stateless engine; the index can be partitioned by attribute bucket). Determinism is never traded for optimisation.

## 8. Security Validation
No plaintext PII anywhere (only hashes in, attribute *types* + weights out); no logging of sensitive values; evidence + candidates immutable (frozen); jurisdiction isolation enforced (never match across jurisdictions); hashing/enablement gating unchanged from 3.1. TSC target compatibility fixed (`Array.from` for Map/Set iteration).

## 9. Risks / Issues
None blocking. The engine consumes `FederationContribution`s (hashed attributes); the durable contribution path (`IDENTITY_FEDERATION_ATTRIBUTE` event → regulator-plane store) is Milestone 3.3/3.4. Confidence *score* is intentionally uninterpreted — thresholds/tiers/accept-reject are the Decision Engine's job (3.3). No architectural issue found; no new ADR required.

## 10. Certification Status
- **Architecture (C2-1) foundations:** PASS — additive, deterministic, isolated, candidates-only.
- **Security (C2-2) / Privacy (C2-3) foundations:** PASS — no PII, immutable evidence, jurisdiction isolation.
- Full C2-x certification runs at Milestone 3.8; nothing enabled in any jurisdiction.

## 11. Go / No-Go
**GO for Milestone 3.3 (Federation Decision Engine)** — the deterministic matcher is complete, compiling, tested, isolated, and constitutionally compliant. Milestone 3.3 will implement the governance component that consumes these candidates: policy evaluation, auto/manual thresholds, regulator approval, appeals, overrides, decision history, version tracking, explainability, immutable audit — and it becomes the **only** component authorised to create `SB-NAT` identities.

---
**Milestone 3.2 Complete – Awaiting Approval for Milestone 3.3 (Federation Decision Engine).**
