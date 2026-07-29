# Version 2.0 Certification — Test Results

**Milestone 3.8 · 2026-07-16.** Independently executed; not sourced from milestone reports.

## 1. Headline
- **Full regression:** 354 pass / 0 fail / 0 skipped.
- **TypeScript:** `tsc --noEmit` clean.
- **Federation certification suites:** 129 pass / 0 fail (incl. 12 adversarial + 8 end-to-end).
- **Import-boundary:** federation isolated in both directions.

## 2. Per-suite results (federation)
| Suite | Pass | Fail |
|---|---|---|
| foundation | 14 | 0 |
| matching | 11 | 0 |
| decision | 13 | 0 |
| registry | 21 | 0 |
| correlation | 17 | 0 |
| policy | 22 | 0 |
| demo | 11 | 0 |
| certification.adversarial | 12 | 0 |
| certification.e2e | 8 | 0 |
| **Federation total** | **129** | **0** |

## 3. Domain-by-domain certification outcomes
| Domain | Outcome | Scope |
|---|---|---|
| C2-1 Architecture (HARD GATE) | **PASS** | domain + demonstration; live integration NOT certified |
| C2-2 Security | **PASS WITH CONDITIONS** | prod HSM/secrets, durable audit, CERT-L1 |
| C2-3 Privacy | **PASS WITH CONDITIONS** | prod DPA/lawful basis/retention/rotation |
| C2-4 Cross-Operator Intelligence | **PASS** | domain + demonstration; live ingestion NOT certified |
| C2-5 Consumer Platform Regression (HARD GATE) | **PASS (scoped)** | library + import-boundary; deployed-runtime = condition |
| C2-6 Operational Readiness | **PASS (demo) / conditions (pilot+prod)** | isolated demo only |
| C2-7 Regulator Acceptance | **PASS (demonstration acceptance)** | pilot/prod acceptance NOT certified |

## 4. End-to-end execution (two clean states)
Byte-identical across metrics, operators, federation, SB-NAT set, policy summary, ledger,
reconciliation, and scenarios. Counts and outcomes: see the evidence register §7.

## 5. Performance (demonstration scale — NOT production load)
| Operation | Observed |
|---|---|
| Full dataset generation (end-to-end) | ≈0.38–0.46 s per clean-state run |
| Matching (128 contributions) | sub-second |
| 31 twins + 186 policy evaluations | sub-second (within full generation) |
| Reconciliation + integrity | sub-second |
This is **not** production-scale load certification (explicit limitation).

## 6. Failures / defects surfaced during certification
| ID | Where | Resolution |
|---|---|---|
| CERT-L1 (LOW) | registry internal-state runtime privacy | recorded as condition; NOT silently fixed (an out-of-scope global TS-target change was reverted); adversarial test asserts the true architectural guarantee |
| DOC-M1 (Medium) | certification wording / limitation prominence | corrected in the certification report (not an appendix) |
No failure was hidden; no test was weakened to obtain a pass.

## 7. Regression integrity statement
All previously passing tests still pass (354/354). The only source edits during certification were:
(a) reverted CERT-L1 hardening (registry unchanged from its certified 3.4 behaviour), (b) a
clarifying comment, (c) two additive certification test harnesses. No architecture, matching,
decision, SB-NAT lifecycle, analytics, or policy behaviour was changed.
