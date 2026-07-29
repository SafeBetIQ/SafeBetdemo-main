# SafeBet IQ — Version 2.0 · Milestone 3.7 Implementation Report

**National Demonstration Dataset v2.0 · 2026-07-16 · ADR-006 (Accepted, frozen)**
**Environment: Demo only · Production: UNCHANGED · Federation: off by default outside demo.**
**Milestone status: COMPLETE. STOP — awaiting approval before Milestone 3.8.**

## 1. Technical Summary
Built a **deterministic, fully-synthetic, regulator-ready** National Demonstration Dataset that drives the **real** Version 2.0 pipeline end-to-end — operator contributions (hash-only) → Identity Matching Engine → Federation Decision Engine → SB-NAT Registry → Enterprise Correlation Layer → National Policy Platform → regulator metrics & outcomes. **No cross-operator link is fabricated**: every SB-NAT is minted only through an approved federation decision. Synthetic source attributes exist only long enough inside the generator to produce jurisdiction-isolated hashes and are then **discarded** — only hashes, anonymous identifiers, and regulatory references enter the pipeline. The dataset covers the six existing operators (each with a distinct personality), the 14 flagship scenarios + override/appeal groups, split/merge governance, all six policy families, cross-jurisdiction + tenant isolation, and full operator-to-national reconciliation, and is **reproducible** (fixed dataset version, seed, and demo clock). It lives in the **isolated in-memory demo infrastructure** of the federation library and imports **no** operator/application/Supabase runtime; production is never touched.

## 2. Files Added
- `lib/identityFederation/demo/dataset.ts` — the deterministic generator (`generateNationalDemonstrationDataset`, `resetAndReseedDemonstrationDataset`), six operator profiles, synthetic person catalogue, real-pipeline driver, correlation provider seed, ZA demonstration policies, scenario builder, GGR ledger, metrics, and reconciliation.
- `lib/identityFederation/demo/index.ts` — the demo public API.
- `tests/identityFederation.demo.test.mjs` — 11 tests.

## 3. Files Modified
- `lib/identityFederation/index.ts` — re-exports the demo public API (additive).

## 4. Justification for Files Changed Outside the Demo Dataset Layer
| File | Change | Justification |
|---|---|---|
| `index.ts` | re-export of `./demo` | Single additive public entry point; no behavioural change. |
**No operator application path, no production config, no database migration, no operator-runtime write.** The dataset is generated entirely in-memory through the approved pipeline components; it neither reads nor writes any operator/production system.

## 5. Dataset Version and Seed Details
`DATASET_VERSION = '2.0'`, `SEED_VERSION = 'nddv2-seed-1'`, `DEMO_CLOCK = 2026-07-16T00:00:00.000Z`, jurisdiction **ZA**. Generation is deterministic; `resetAndReseedDemonstrationDataset()` reproduces functionally identical metrics/operators/federation/GGR (verified by test). SB-NAT identifiers are **monotonic** per the Registry mint sequence and reset to a clean deterministic state on regeneration (registry integrity is prioritised over cosmetically neat identifiers).

## 6. Existing Tenant Validation
Uses the six existing demonstration operators — **Prestige, SunBet, Hollywoodbets, Gold Rush, Betway, Royal Palace** — with no duplicate tenants created (verified: 6 distinct operator ids). No tenant is renamed or replaced.

## 7. Operator Profile Summary (distinct, believable)
| Operator | Bias | SB-PLR | Sessions | Interventions | GGR (synthetic) | Channel |
|---|---|---|---|---|---|---|
| Prestige | low | 23 | 138 | 6 | 6,085 | online |
| SunBet | medium | 20 | 185 | 12 | 15,006 | mixed |
| Hollywoodbets | medium | 24 | 277 | 11 | 18,757 | mixed |
| Gold Rush | high | 20 | 262 | 10 | 39,348 | machine |
| Betway | medium | 25 | 251 | 10 | 18,439 | online |
| Royal Palace | high | 16 | 213 | 13 | 26,287 | machine |

Profiles are distinct (GGR, session, intervention totals all differ) and internally consistent — neither cartoonishly bad nor perfect.

## 8. Dataset Volume Summary
- Anonymous operator players (SB-PLR): **128** · federation contributions: **128** (hash-only).
- Matching candidates: **47** → decisions: **40 auto-approved**, **7 manual-review** (**2 approved**, **5 rejected**).
- SB-NAT identities: **31** — **1 single-operator**, **30 multi-operator**, **2 high-interest (4+ operators)**.
- Registry lifecycle: **1 split**, **1 merge**; registry integrity **OK**.
- Policy evaluations: **186** across 8 outcome families; policy conflicts detected: **8**.
- National synthetic GGR: **123,922** (reconciles to Σ operator GGR).

## 9. Scenario Catalogue
All 14 flagship scenarios plus the override/appeal identity groups are generated from the **real** pipeline (not hard-coded) and every scenario assertion passes: **S1** self-exclusion conflict · **S2** harm escalation · **S3** repeated interventions · **S4** cooling-off conflict · **S5** national investigation (4+ operators) · **S6** insufficient/weak evidence via governance · **S7** false-positive protection (rejected, no shared SB-NAT) · **S8** manual review → approved · **S9** split + historical reconstruction · **S10** governed merge · **S11** policy conflict · **S12** data-integrity failure (isolated) · **S13** cross-jurisdiction isolation · **S14** low-risk control · **G09** appeal lifecycle · **G10** authorised override.

## 10. Federation Validation
Exercised exact strong matches (national_id → auto-approved), medium-evidence matches (phone → manual-review → approved), and weak/conflicting matches (shared device, different national_id → manual-review → **rejected**). Distribution is realistic (not all auto-approved): 40 auto-approved, 2 manual-approved, 5 manual-rejected. No candidate is force-approved.

## 11. SB-NAT Registry Validation
Creation, active status, split, merge, historical reconstruction, and integrity verification are all exercised. `registry.verifyIntegrity().ok === true`. No monotonic identifier is manipulated for presentation.

## 12. Correlation Layer Validation
Every active SB-NAT yields a National Player Twin, operator participation, timeline, risk/behaviour evolution, intervention/self-exclusion/compliance/investigation references, provenance, and freshness. Every insight is reproducible and provenance-complete (`provenance.federationDecisionRefs.length > 0` for all twins).

## 13. National Player Twin Validation
Twins are populated for single- and multi-operator identities, reproduce deterministically, and carry complete provenance (validated by test).

## 14. National Policy Validation
All six policy families evaluate. Outcome distribution (186 evaluations): *No Action* 75, *Continue Monitoring* 34, *National Investigation Recommended* 33, *Cross-Operator Escalation Required* 13, *Intervention Review Required* 13, *Operator Notification Required* 11, *Data Integrity Failure* 6, *National Cooling-Off Recommended* 1 — a realistic spread with benign outcomes well-represented (no high-risk bias).

## 15–18. Scenario Validations (Self-Exclusion / Cooling-Off / Harm-Escalation / Investigation)
- **Self-exclusion (S1):** active exclusion + cross-operator activity → self-exclusion policy fires (investigation/review). No account is blocked.
- **Cooling-off (S4):** active cooling-off period → *National Cooling-Off Recommended*; no automatic enforcement.
- **Harm-escalation (S2):** 3-operator escalating identity → *Cross-Operator Escalation Required*.
- **Investigation (S5):** 4+-operator high-interest identity → derivable investigation view + investigation trigger outcome.

## 19. Manual Review, Override and Appeal Validation
Manual-review candidates are approved (true links) or rejected (false links) through the governed workflow; **G10** demonstrates an authorised override (original outcome preserved, immutable history), **G09** a full appeal lifecycle (open → review → dismissed, history preserved).

## 20. Split and Merge Validation
**S9**: a 3-operator cluster is split; a member is re-assigned to a new SB-NAT, SB-PLR identifiers are unchanged, and the mapping is reconstructable before/after. **S10**: two approved 2-operator clusters are merged only through the governed Registry workflow; the survivor holds all four members and permanent identifier history is retained.

## 21. Cross-Jurisdiction Isolation Validation
**S13**: a non-ZA regulator querying a ZA identity is **denied**; all SB-NAT are ZA-sovereign; no cross-sovereign correlation occurs (verified).

## 22. False-Positive Protection Validation
**S7**: two different synthetic people sharing one weak attribute (device) but differing on the strong attribute produce a manual-review candidate that is **rejected** — no shared SB-NAT, no incorrect national timeline.

## 23. Provenance Validation
Every twin/insight carries the full provenance chain (federation decision → matching candidate → SB-PLR → source references → operator); `metrics.provenanceComplete === true`.

## 24. Access-Control Validation
Operator, wrong-jurisdiction, and cross-sovereign access are denied; the authorised regulator is allowed. Operators cannot query SB-NAT, the Correlation Layer, or national policy results.

## 25. PII Leakage Validation
A serialised scan of twins, policy evaluations, scenarios, and SB-NAT summaries finds **no** email-like patterns, **no** long digit runs, and **none** of the synthetic attribute tokens (`NID-`, `PH-`) — the raw synthetic values never leave the generator.

## 26. Wager and GGR Validation
Valid synthetic sessions/wagers are generated per operator; GGR is non-zero and meaningful (national **123,922**). Raw monetary values live only in the demonstration ledger; only coarse magnitude **bands** enter the correlation pipeline. Totals are computed from source events (not inserted directly) and reconcile.

## 27. Operator-to-National Reconciliation
Structured reconciliation report — **all checks pass**: operator SB-PLR ↔ contributions; decisions ↔ candidates; SB-NAT count ↔ active registry; registry members ↔ twin members; Σ operator GGR ↔ national GGR; registry integrity; no cross-jurisdiction SB-NAT.

## 28. Dataset Integrity Report
Registry integrity **OK**; correlation reproducible; policy deterministic; reconciliation **OK**; controlled data-integrity-failure scenario is isolated and does not corrupt the main dataset.

## 29. Performance Notes
Full generation (128 contributions → matching → decisions → registry → 31 twins → 186 policy evaluations → reconciliation) completes in well under a second; the dataset is bounded and demonstration-appropriate. No production-scale load testing performed (out of scope).

## 30. Reset and Reseed Validation
`resetAndReseedDemonstrationDataset()` regenerates a clean deterministic state in-memory with no external writes and no duplicates (idempotent by construction); a repeat produces functionally identical metrics/operators/federation/GGR (verified by test). There is no destructive production-compatible command.

## 31. Milestone Test Results
`node --test tests/identityFederation.demo.test.mjs` → **11 pass, 0 fail**: determinism/reset; six distinct populated operators; legitimate SB-NAT + realistic outcome spread; split+merge; twins + provenance; six policy families + outcome variety + conflict + integrity failure; full scenario catalogue (14 + override/appeal); false-positive protection; cross-jurisdiction + tenant isolation + access; no-PII; reconciliation + GGR.

## 32. Full Regression Results
Full suite → **334 pass, 0 fail** (323 prior + 11 new).

## 33. TypeScript Validation
`npx tsc --noEmit` → **clean**.

## 34. Technical Debt Check
**None.** No fabricated SB-NAT mappings, no direct Registry insertion bypass, no direct projection/GGR totals (all computed from generated source events), no unsupported event injection, no plaintext PII, no hard-coded production identifiers, no duplicated tenants, no hidden policy outcomes, no unresolved seed failures, no incomplete reconciliation, no operator access-control bypass, no production enablement, no TODO/stub markers (grep-verified).

## 35. Risks and Limitations (documented; none violate ADR-006)
- **Operator-runtime GGR/projection reconciliation** is modelled in the isolated in-memory demo ledger, not the live operator Event Platform/DB — the federation library is deliberately not wired to operator runtime (ADR-006 isolation). Wiring the generator into the operator demo database (the previously-noted zero-GGR fix) is a **runtime integration** task outside this isolated milestone and is documented as such rather than bypassing the Event Platform.
- **Single-operator control group** is represented at the SB-PLR level (the majority of the 128 SB-PLR never correlate), proving not every SB-PLR becomes a national identity; only 1 single-operator *SB-NAT* exists (the split-out cluster), which is correct.
- **Data-integrity-failure** scenario is intentionally isolated (one cluster) and excluded from harming main reconciliation.

## 36. Provisional Certification Evidence (no final claim)
Provisional evidence toward **C2-1** (architecture: real pipeline, additive, deterministic), **C2-2** (security: isolation + access), **C2-3** (privacy: no PII, synthetic only), **C2-4** (cross-operator intelligence: twins + provenance + reconciliation), **C2-5** (consumer/operator regression: runtime untouched, 334/334 green), **C2-6** (operational readiness: reset/reseed + reconciliation), **C2-7** (regulator acceptance: scenario catalogue + governance). No final certification is claimed; formal certification remains reserved for Milestone 3.8.

## 37. Go / No-Go
**GO for Milestone 3.8 (Enterprise Certification)** — the National Demonstration Dataset v2.0 is complete, deterministic, reconciled, isolated, privacy-preserving, and constitutionally compliant, exercising the full 3.2–3.6 pipeline with all required scenarios. Milestone 3.8 will perform the formal C2-1..C2-7 enterprise certification.

---
**Milestone 3.7 Complete – Awaiting Approval for Milestone 3.8 (Enterprise Certification).**
