# SafeBet IQ — Version 2.0 · Milestone 3.4 Implementation Report

**SB-NAT Registry · 2026-07-16 · ADR-006 (Accepted, frozen)**
**Milestone status: COMPLETE. STOP — awaiting approval before Milestone 3.5.**

## 1. Technical Summary
Implemented the **SB-NAT Registry** — the **first** component authorised to create an **Enterprise Correlation Identity (SB-NAT)**. It is a **regulator-plane registry** that records approved Enterprise Correlation Identities; it is **not** an operational identity store and it is **not** the Enterprise Correlation Layer (Milestone 3.5). SB-NAT is minted **only** from an **approved, non-superseded** Federation Decision; the identifier is **permanent** (never changes/reused/recycled/renumbered/reassigned); the full lifecycle (Created → Active → Re-evaluated → Split → Merged → Retired → Archived) occurs **around** the identity; **split and merge never modify SB-PLR** — only the SB-PLR↔SB-NAT relationship changes, and every historical mapping is **reconstructable** by replaying an append-only assignment log. Every record permanently stores the immutable six-part version stamp, every action emits an immutable audit event, integrity is verifiable, and **no PII is ever stored** (identifiers + version metadata only). SB-PLR remains the canonical operational identity, unchanged.

## 2. Files Added
- `lib/identityFederation/registry.ts` — `SbNatRegistry` (create / reEvaluate / split / merge / retire / archive / get / findBySbPlr / list / reconstructMappingAt / assignmentHistory / verifyIntegrity / diagnostics) + registry types (`SbNatRecord`, `RegistryHistoryEvent`, `AssignmentEvent`, `IntegrityReport`, `RegistryDiagnostics`, `REGISTRY_STATES`, `REGISTRY_ACTIONS`).
- `tests/identityFederation.registry.test.mjs` — 21 tests.

## 3. Files Modified (additive, within `lib/identityFederation/`)
- `service.ts` — added the registry to `FederationDependencies` (factory-defaulted, **bound to the service's regulator-plane audit sink**); implemented `registerDecision` / `splitSbNat` / `mergeSbNat` / `reEvaluateSbNat` / `retireSbNat` / `archiveSbNat` (all enablement-gated) + read-only `lookupSbNat` / `lookupSbNatBySbPlr` / `listSbNat` / `reconstructMapping` / `verifyRegistryIntegrity` / `registryDiagnostics`. Replaced the `mintSbNat()` seam (now implemented) with a new `correlate()` seam for the Enterprise Correlation Layer (Milestone 3.5).
- `index.ts` — exported the registry surface.
- `tests/identityFederation.{foundation,matching,decision}.test.mjs` — moved the milestone-boundary assertion from `mintSbNat()` (now built) to `correlate()` (the new frontier).
**No file outside `lib/identityFederation/` + tests was modified.** No Enterprise Correlation Layer, National Player Twin, Behaviour/Cross-Operator Analytics, Policy/Consumer/Operator integration, UI, external API, or DB migration.

## 4. Architecture Compliance Report (ADR-006)
| Requirement | Held | Evidence |
|---|---|---|
| Registry position: after the Decision Engine, before the Correlation Layer | ✅ | `create()` consumes a `FederationDecision`; `correlate()` throws `MilestoneNotImplementedError('…Correlation Layer','3.5')`. |
| SB-NAT created **only** from an approved decision | ✅ | `assertCreatable` requires `isApprovedDecision`; rejects unapproved / upheld-appeal / overridden-away / self-pair (tested). |
| Registry is **not** operational / **not** the Correlation Layer | ✅ | Regulator-plane class, off any operator path; no cross-operator analytics; correlation seam explicit. |
| SB-PLR unchanged | ✅ | Registry only stores SB-PLR **identifiers** and their assignment; split/merge change relationship, never the SB-PLR (tested). |
| Immutable identifier (never reused/recycled/renumbered) | ✅ | Monotonic per-jurisdiction mint + `mintedIds` guard; retired/merged ids retained forever, never re-handed (tested). |
| Full lifecycle, every transition audited, no history deleted | ✅ | created/active/re-evaluated/split/merged/retired/archived; append-only `history` + audit per action (tested). |
| Split/merge governance, historical reconstruction | ✅ | Append-only `AssignmentEvent` log; `reconstructMappingAt(t)` rebuilds the mapping as of any time (tested). |
| Version governance (six-part, immutable) | ✅ | Every record stores the decision's `DecisionVersions`; deep-frozen (tested). |
| Registry integrity detectable | ✅ | `verifyIntegrity()` → unique-identifiers, immutable-identifiers, referential-integrity, version-consistency, historical-consistency (tested). |
| Security: regulator-plane, no PII, jurisdiction/sovereign isolation | ✅ | No attribute values/hashes stored; ids namespaced `SB-NAT-<CC>`; cross-jurisdiction merge rejected (tested). |
| Additive / backward compatible | ✅ | 284/284 tests pass; off by default; no operator surface touched. |

## 5. Registry Integrity Report
`verifyIntegrity()` runs five deterministic checks and returns `{ ok, checks[] }`:
1. **unique-identifiers** — no duplicate ids; every id well-formed (`isSbNat`), jurisdiction-consistent, and present in the minted set.
2. **immutable-identifiers** — every record has a creation genesis event; identifiers/creation-time are never patched (`write()` throws on any attempt).
3. **referential-integrity** — no SB-PLR belongs to two active-state SB-NATs.
4. **version-consistency** — every record carries a complete six-part version stamp.
5. **historical-consistency** — replaying the append-only assignment log reproduces current membership exactly.
Corruption in any dimension flips `ok` to `false` with a specific `detail`. Verified `ok: true` after a create/link/split/merge/retire sequence (test: *integrity verification passes on a healthy registry after many operations*).

## 6. Lifecycle Validation Report
- **Created → Active:** `create()` mints (or links into) an SB-NAT; genesis history action `created`, resting state `active`.
- **Re-evaluated:** `reEvaluate()` records an immutable `re-evaluated` event; membership unchanged.
- **Split:** `split()` extracts members into a **new** SB-NAT (`split-out`); the source keeps its identifier and stays active (`split-source`) with reduced membership. Guards: empty / non-member / whole-cluster splits rejected.
- **Merged:** `merge()` folds a source into a target; the target gains members (`merged-in`, stays active), the source becomes terminal `merged` with empty membership (`merged-out`) but is **retained forever**. Guards: self-merge and cross-jurisdiction merge rejected.
- **Retired / Archived:** terminal resting states; the identity is retained and fully auditable; re-retiring an archived identity and double-archiving are rejected.
Every transition appends to the record's `history` and emits an audit event; **no lifecycle action deletes history** (tested: *history only grows*).

## 7. Test Results (Milestone 3.4)
`node --test tests/identityFederation.registry.test.mjs` → **21 pass, 0 fail**: create-from-approved (+ immutability + audit); unapproved/upheld-appeal/overridden cannot create; manual-review→approved can create; idempotent duplicate; link-into-existing; different-clusters→merge-required; identifiers never reused after retirement; split (+ SB-PLR untouched, + validation guards); merge (+ SB-PLR untouched, absorbed retained, + self/cross-jurisdiction guards); retire+archive (history never deleted); re-evaluate; historical reconstruction across create/link/split; integrity verification; jurisdiction isolation + sovereign namespacing; no-PII; service integration (enablement gate, lookups, integrity, audit flow) + lifecycle gating.

## 8. Regression Results
Full suite → **284 pass, 0 fail** (263 prior + 21 new). `tsc --noEmit` clean. Isolation confirmed: `lib/identityFederation/` is imported by **no** app / component / edge path. The three milestone-boundary assertions were moved from `mintSbNat()` (now implemented) to the new `correlate()` seam — no behavioural regression.

## 9. Security Validation
Regulator-plane only (registry class not exposed to any operator path; enablement gated per jurisdiction in the service). **No plaintext PII and no attribute values/hashes are stored** — records hold SB-NAT / SB-PLR identifiers + version metadata only (test asserts a secret attribute value never appears in a serialised record). No operator access; records + audit deep-frozen (immutable); jurisdiction isolation and sovereign separation enforced (`SB-NAT-<CC>` namespacing; cross-jurisdiction merge rejected). No sensitive logging.

## 10. Audit Validation
Every registry action (`created`, `linked`, `split-out`, `split-source`, `merged-in`, `merged-out`, `retired`, `archived`, `re-evaluated`) seals an **append-only, deep-frozen** `FederationDecisionAudit` (subject SB-NAT, affected SB-PLR, six-part-derived version stamp, actor) to the **same regulator-plane sink** the service exposes — so the decision trail (3.3) and the registry trail (3.4) form one immutable log. The sink has no update/delete surface. Each record additionally carries its own append-only `history`.

## 11. Risks / Issues
None blocking. **No technical debt** — no TODOs, no temporary logic, no stubbed lifecycle behaviour, no incomplete validation, no deferred integrity checks (grep-verified). Design note (not debt): `create()` deliberately clusters only within one approved pair and **refuses** to merge two distinct existing clusters — a cross-cluster union must be an explicit, separately-audited `merge()`. This is intentional governance, not a limitation.

## 12. Certification Status
- **Architecture (C2-1):** PASS — registry sits exactly where ADR-006 places it; additive; deterministic.
- **Integrity / Audit (toward C2-4):** PASS — verifiable integrity, immutable append-only audit + history.
- **Security (C2-2) / Privacy (C2-3) foundations:** PASS — no PII, regulator-plane, jurisdiction/sovereign isolation.
- Full C2-x certification runs at Milestone 3.8; nothing enabled in any jurisdiction.

## 13. Go / No-Go
**GO for Milestone 3.5 (Enterprise Correlation Layer)** — the SB-NAT Registry is complete, compiling, tested (21 + 284 regression), isolated, integrity-verifiable, and constitutionally compliant. Milestone 3.5 will implement the **read-only** Enterprise Correlation Layer over the registry (authorised regulator correlation across per-operator SB-PLRs by reference), creating no new identities and modifying no SB-PLR.

---
**Milestone 3.4 Complete – Awaiting Approval for Milestone 3.5 (Enterprise Correlation Layer).**
