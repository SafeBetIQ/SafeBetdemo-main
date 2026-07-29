# National Demonstration Dataset v2.0 — Dataset, Scenarios, Runbook & Reconciliation

**ADR-006 (Accepted, frozen) · Milestone 3.7 · Demo only · Deterministic · Fully synthetic.**
Companion to `V2_MILESTONE_3.7_DEMONSTRATION_DATASET_REPORT.md`.

---

## 1. What this is
A deterministic, fully-synthetic, regulator-ready dataset that drives the **real**
Version 2.0 pipeline (matching → decision → registry → correlation → policy) to
prove that SafeBet IQ can identify and analyse the same anonymous person across
licensed operators **without** exposing plaintext PII or breaking tenant isolation.
Every shared national identity is produced legitimately by federation — **no SB-NAT
mapping is fabricated**. It runs entirely in the isolated in-memory demo
infrastructure; it never touches operator runtime or production.

**Entry points** (`lib/identityFederation/demo`):
`generateNationalDemonstrationDataset(opts?)` → `NationalDemonstrationDataset`;
`resetAndReseedDemonstrationDataset(opts?)` → deterministic clean-state regeneration.

**Fixed parameters:** `DATASET_VERSION='2.0'`, `SEED_VERSION='nddv2-seed-1'`,
`DEMO_CLOCK='2026-07-16T00:00:00.000Z'`, jurisdiction `ZA`.

---

## 2. Operators (six existing tenants, distinct personalities)
Prestige (low-risk online), SunBet (medium mixed), Hollywoodbets (medium mixed),
Gold Rush (high-risk machine), Betway (medium online), Royal Palace (high-risk
machine). Each has distinct player counts, session rates, intervention/self-
exclusion/investigation rates, average stake, and channel — believable and
internally consistent. See the report §7 for the summary table.

## 3. Volumes (deterministic)
128 SB-PLR / contributions · 47 matching candidates · 40 auto-approved + 7 manual-
review (2 approved / 5 rejected) · 31 SB-NAT (30 multi-operator, 2 high-interest 4+,
1 single) · 1 split · 1 merge · 186 policy evaluations across 8 outcome families ·
8 policy conflicts · national synthetic GGR 123,922.

---

## 4. Scenario Catalogue
Each scenario is generated from the real pipeline; every assertion passes.

| ID | Scenario | Demonstrates |
|---|---|---|
| S1 | National self-exclusion conflict | active exclusion + cross-operator activity → self-exclusion/investigation outcome |
| S2 | Cross-operator harm escalation | 3-operator escalating risk + harm → escalation outcome |
| S3 | Repeated unsuccessful interventions | intervention history → intervention review / investigation |
| S4 | Cooling-off conflict | active cooling-off + activity → cooling-off recommendation |
| S5 | National investigation | 4+-operator identity → investigation view + trigger |
| S6 | Insufficient/weak evidence | medium evidence → manual review → governed approval |
| S7 | False-positive protection | shared weak attribute, different strong → **rejected**, no shared SB-NAT |
| S8 | Manual regulator review | manual-review candidate → approved with immutable history |
| S9 | Registry split + reconstruction | member re-assigned, SB-PLR unchanged, mapping reconstructable |
| S10 | Registry merge | two clusters merged via governed workflow, identifier history retained |
| S11 | Policy conflict | conflicting outcomes detected, not silently resolved |
| S12 | Data integrity failure (isolated) | missing source reference → Data Integrity Failure, no national action |
| S13 | Cross-jurisdiction isolation | non-ZA regulator denied; no cross-sovereign SB-NAT |
| S14 | Low-risk control | healthy multi-operator player → no inappropriate escalation |
| G09 | Appeal | open → review → dismissed, full history preserved |
| G10 | Override | authorised override, original outcome preserved, immutable history |

**Identity groups** covered: single-operator (control), two-operator, three-operator,
four-or-more (high-interest), rejected, manual-review, split, merge, appeal, override.

---

## 5. Seed & Reset Runbook (demo only)
- **Generate:** `generateNationalDemonstrationDataset()` — pure, in-memory, no external writes.
- **Reset + reseed:** `resetAndReseedDemonstrationDataset()` — regenerates a clean
  deterministic state; idempotent by construction (no shared mutable store, no
  duplicates on repeat). Repeated runs yield functionally identical metrics/operators/
  federation/GGR; SB-NAT identifiers are monotonic and reset to a clean sequence.
- **Safety:** there is **no** production-compatible destructive command. Because the
  generator writes nothing outside its returned object, there is nothing to roll back;
  a failed generation simply throws and leaves no residue. Production isolation is
  structural (no operator/Supabase imports).

---

## 6. Regulator Demonstration Guide (suggested flow)
1. **National overview** — `dataset.metrics`: operators, anonymous players, SB-NAT
   identities, single vs multi-operator, high-interest, GGR, policy outcomes by category.
2. **Pick a high-interest identity** (S5) — show the National Player Twin, cross-operator
   timeline, risk/behaviour evolution, interventions, and provenance.
3. **Self-exclusion conflict** (S1) — the national self-exclusion view + policy outcome.
4. **Harm escalation** (S2) — cross-operator escalation with full explainability.
5. **Governance** — manual review (S8), override (G10), appeal (G09), split (S9),
   merge (S10) — each with immutable history.
6. **Guardrails** — false-positive protection (S7), cross-jurisdiction isolation (S13),
   data-integrity failure (S12), and the low-risk control (S14) for credibility.
7. **Reconciliation** — `dataset.reconciliation`: operator↔national totals reconcile.

---

## 7. Reconciliation Report (all pass)
- operator SB-PLR ↔ federation contributions
- decisions ↔ matching candidates
- SB-NAT count ↔ active registry
- registry members ↔ twin members
- Σ operator GGR ↔ national GGR
- registry integrity verified
- all SB-NAT are ZA-sovereign (no cross-jurisdiction)

---

## 8. Security & Privacy
Regulator-plane, read-only correlation/policy; deny-by-default access (operator/
wrong-jurisdiction/cross-sovereign denied); no plaintext PII (synthetic attributes are
hashed then discarded; only bands/references enter the pipeline; serialised outputs
scan clean); jurisdiction/tenant isolation preserved; no operator-runtime mutation;
production untouched; federation off by default outside the demo.

---

## 9. Release Notes (v2.0 · Milestone 3.7)
- **Added:** National Demonstration Dataset v2.0 — deterministic, synthetic, driving the
  real 3.2–3.6 pipeline; six distinct operators; 14 flagship scenarios + override/appeal;
  split/merge governance; six policy families with realistic outcome spread; GGR ledger;
  national + operator metrics; structured reconciliation; deterministic reset/reseed.
- **Guarantees:** no fabricated SB-NAT; no PII; tenant + jurisdiction isolation; no
  operator-runtime mutation; production untouched; 334/334 tests pass; `tsc` clean.
- **Boundary:** operator-runtime/live-DB GGR integration is documented as a separate
  runtime task outside this isolated in-memory milestone.
