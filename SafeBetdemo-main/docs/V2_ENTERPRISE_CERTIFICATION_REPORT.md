# SafeBet IQ — Version 2.0 Enterprise Certification Report

**Milestone 3.8 · 2026-07-16 · ADR-006 (Accepted, frozen)**
**Environment: Demo branch + isolated demonstration · Production: UNCHANGED · Deployment: NOT AUTHORISED**

> **VERDICT: Version 2.0 Enterprise Certification — PASS WITH CONDITIONS.**
> Scope: **Version 2.0 domain/architecture implementation** and **isolated demonstration capability**.
> **Live runtime / operator integration and production deployment are NOT certified** (see §3, §24).

Companion reports: `V2_CERTIFICATION_EVIDENCE_REGISTER.md`, `V2_CERTIFICATION_TEST_RESULTS.md`,
`V2_CERTIFICATION_RISK_AND_CONDITIONS.md`, `V2_REGULATOR_ACCEPTANCE_REPORT.md`,
`V2_DEPLOYMENT_READINESS_DECISION.md`, `V2_FINAL_RELEASE_NOTES.md`.

---

## 1. Executive Certification Summary
Version 2.0 (National Identity Federation & Cross-Operator Intelligence) was independently
certified against ADR-006, the Enterprise Constitution, the Reference Architecture, the
National Identity Federation Design, the Privacy Impact Assessment, the Security
Architecture & Threat Model, and the Milestone 3.1–3.7 evidence. Certification **re-ran
and independently re-validated** the controls (129 federation certification tests including
12 adversarial and 8 end-to-end, within a 354-test full regression) rather than accepting
milestone reports as proof.

**Result: PASS WITH CONDITIONS.** Both hard gates pass within a clearly stated scope
(**C2-1 Architecture: PASS**; **C2-5 Consumer Platform Regression: PASS within library +
import-boundary scope**). The domain/architecture implementation and the isolated
demonstration are certified. **Live operator-database ingestion, production Event Platform
integration (wagering/GGR), durable regulator-plane persistence, and production deployment
are explicitly NOT certified** — the demonstration used an isolated, deterministic, in-memory
ledger. One LOW defect (CERT-L1) and a set of production conditions are recorded.

## 2. Certified Scope
1. **Version 2.0 domain & architecture implementation** — the `lib/identityFederation`
   library: matching, decision, SB-NAT registry, correlation layer, national policy platform,
   demonstration generator; their contracts, isolation, determinism, explainability, audit,
   integrity, and access controls.
2. **Isolated demonstration capability** — National Demonstration Dataset v2.0 driving the
   real 3.2–3.6 pipeline deterministically in-memory.

## 3. Excluded Scope (NOT certified)
- **Live operator-database ingestion** and **production Event Platform integration** for
  wagering/GGR (the demo used an in-memory ledger — synthetic GGR reconciliation is **not**
  live Event Platform reconciliation).
- **Durable regulator-plane persistence + RLS**, **durable append-only audit storage**.
- **Production HSM / Secrets Manager pepper management + rotation**.
- **Deployed Consumer Platform runtime regression** (only library-level regression + import
  boundary were executed — no deployed application was exercised).
- **Production deployment readiness** and **controlled-pilot readiness**.
These are certification **conditions**, not claimed passes.

## 4. Evidence Reviewed
ADR-006; Enterprise Constitution; Reference Architecture; Glossary; National Identity
Federation Design; PIA v2; Security Architecture & Threat Model v2; V2 Certification Strategy;
Architecture Freeze Report; Milestone 3.1–3.7 reports; Enterprise Correlation Layer & National
Policy Platform specifications; National Demonstration Dataset v2.0; the source of all 20
`lib/identityFederation` modules; the 9 federation test suites. Milestone claims were treated
as inputs, not proof, and independently re-executed.

## 5. Independent Tests Executed
- **Full regression:** 354 pass / 0 fail (`node --test "tests/**/*.test.mjs"`).
- **TypeScript:** `tsc --noEmit` clean.
- **Adversarial harness (C2-2):** 12 pass — `tests/identityFederation.certification.adversarial.test.mjs`.
- **End-to-end harness (C2-4/6/7):** 8 pass — `tests/identityFederation.certification.e2e.test.mjs` (two clean-state runs, byte-identical).
- **Import-boundary scans:** federation imported by no operator/UI/edge path; federation lib imports no operator/app/Supabase path.
See `V2_CERTIFICATION_TEST_RESULTS.md` for the full matrix.

## 6. C2-1 — Architecture Certification (HARD GATE) → **PASS** (domain + demonstration)
- **Static import analysis:** `grep` confirms `lib/identityFederation` is imported by **no**
  `app/`, `components/`, or `supabase/functions` path; and the federation lib imports **no**
  operator/app/Supabase path. Isolation holds in both directions.
- **ADR-to-code mapping:** every component maps to an approved architecture section — SB-PLR
  unchanged (operational system of record); SB-NAT is an Enterprise Correlation Identity only;
  Matching Engine produces candidates only; Decision Engine is the sole decision authority;
  Registry creates identities only from approved decisions; Correlation Layer is read-only;
  Policy Platform produces regulator-plane outcomes and enforces nothing on operator runtime.
- **Mutation-surface inspection:** correlation/policy expose no operator-runtime mutation;
  registry state is TS-`private` and only `create()` (approval-gated) produces records
  (ADV-4/ADV-5). Event sourcing (append-only audit + assignment log) is authoritative.
- **Negative paths (adversarial):** no hidden mint path on the public surface; unapproved/
  superseded decisions cannot register; cross-sovereign merge rejected; duplicate is idempotent.
- **Demonstration boundary:** architecture certification applies to the **domain library** and
  **demonstration execution**. It does **NOT** certify live Event Platform integration or
  production deployment (unimplemented — not certified).
- **Finding:** CERT-L1 (LOW) — TS `private` is compile-time only; internal registry state is
  not runtime-private at the current build target. Architecture is unaffected (no approved
  path fabricates an SB-NAT); recorded as a production-hardening condition.
**C2-1: PASS** (hard gate satisfied for the certified scope).

## 7. C2-2 — Security Certification → **PASS WITH CONDITIONS**
Deny-by-default access (regulator-plane only); operator / casino-admin / unauthenticated /
wrong-jurisdiction / cross-sovereign all denied (ADV-1, ADV-2, ADV-10); role separation
enforced at the boundary (evaluator/reviewer/override-authority/appeal-reviewer); tenant +
jurisdiction + sovereign isolation; hash-only federation boundary with no plaintext PII;
immutable decision/registry/policy audit (append-only sinks, deep-frozen records, ADV-6);
policy is declarative data with strict schema validation and no executable code (ADV-7);
malformed/unsupported/duplicate contributions handled safely (ADV-8, ADV-9); integrity
verifiers resist malformed input (ADV-11); serialised-output PII scans clean (ADV-12).
**Conditions:** production HSM/Secrets Manager pepper storage + rotation; durable append-only
audit storage; runtime-private internal state (CERT-L1). The reference hasher/pepper are
demonstration scaffolding, not production-connected controls.
**C2-2: PASS WITH CONDITIONS.**

## 8. C2-3 — Privacy Certification → **PASS WITH CONDITIONS**
No plaintext PII enters federation services; synthetic source attributes are discarded after
hashing; SB-NAT is never a customer-facing identity; data minimisation is enforced (jurisdiction
profiles gate permitted attributes; out-of-jurisdiction references excluded); national outputs,
provenance, split/merge history, appeal/override records, and policy outputs contain anonymous
references only; demonstration data is fully synthetic; reset does not expose synthetic tokens;
serialised outputs scan clean (E2E-6, ADV-12). Reviewed against PIA v2 — implementation is
consistent. **Conditions (production prerequisites):** jurisdiction data-processing agreement;
lawful processing basis; retention schedule; data-subject-rights procedure; pepper key
management + rotation; cross-border processing restrictions; regulator authorisation model.
**C2-3: PASS WITH CONDITIONS.**

## 9. C2-4 — Cross-Operator Intelligence Certification → **PASS** (domain + demonstration)
Independently re-ran the demonstration end-to-end (twice, byte-identical). The same anonymous
person is correlated across operators **only** through the approved pipeline; no SB-NAT is
fabricated; false-positive protection works (S7 rejected, no shared SB-NAT); weak matches do
not auto-create identities (manual review → reject); split/merge + historical reconstruction
work (S9/S10); National Player Twins are deterministic and provenance-complete; timelines are
deterministic; analytics are explainable; self-exclusion/cooling-off conflicts and investigation
summaries are represented and reconstructable; integrity verification detects missing evidence
(S12); benign multi-operator behaviour does not auto-escalate (S14); tenant isolation holds.
**Separation:** cross-operator **domain** + **demonstration** certified; **live operator
ingestion is NOT certified** (no live integration evidence).
**C2-4: PASS** (for the certified scope).

## 10. C2-5 — Consumer Platform Regression (HARD GATE) → **PASS within defined scope**
Full automated regression: **354 pass / 0 fail**; TypeScript clean; import-boundary scan shows
**no new federation import in any prohibited path** — the federation library is additive and
imported by no operator/UI/edge code, so existing routes, consumer contracts, operator
dashboards, SB-PLR behaviour, Digital Twin / Event / Projection / Policy platforms, UI and APIs
are architecturally unaffected. SB-NAT and national policy outcomes are not exposed to operators.
**Scope statement:** this is a **library-level + import-boundary** regression result. **No
deployed application runtime smoke test was performed**; deployed-runtime Consumer Platform
regression is a condition (§24). Within the stated scope the hard gate is satisfied.
**C2-5: PASS (scoped).**

## 11. C2-6 — Operational Readiness → **PASS for isolated demo, WITH CONDITIONS for pilot/production**
Feature flags off by default; jurisdiction activation controlled; demo reset/reseed safe and
deterministic (idempotent, no external writes, no destructive command); audit/registry/
correlation/policy integrity all independently checkable; diagnostics safe; version metadata
present; certification evidence reproducible; performance within demonstration bounds; no
production configuration changed; production untouched. **Production prerequisites NOT met (conditions):**
durable regulator-plane DB + RLS; durable append-only audit storage; Event Platform contribution
wiring; live operator connectors; HSM/Secrets Manager pepper + rotation; backup/restore testing;
monitoring/alarms; HA/scaling; incident response; support runbook; deployment pipeline; rollback.
**C2-6: PASS for isolated demo operations; conditions apply to pilot/production runtime.**

## 11a. C2-7 — Regulator Acceptance → **PASS for demonstration acceptance** (see `V2_REGULATOR_ACCEPTANCE_REPORT.md`)
The system credibly answers the regulator question set (multi-operator activity, involved
operators, linkage evidence + ignored evidence + confidence, applied policy version, self-
exclusion elsewhere, activity-during-exclusion, prior interventions, national escalation,
review/investigation recommendation, full evidence-chain reconstruction, split/merge, appeal,
override, integrity-vs-risk distinction, low-risk control). Regulator-only access, explainability,
provenance, auditability, deterministic repeatability, and the regulator guide are validated.
**Demonstration acceptance certified; controlled-pilot / production acceptance NOT certified**
(required live integrations absent). **C2-7: PASS for demonstration acceptance.**

## 12. Consumer Platform Regression Result
See §10. PASS within library + import-boundary scope; deployed-runtime regression is a condition.

## 13. Hard-Gate Status
- **C2-1 Architecture — PASS** (hard gate met).
- **C2-5 Consumer Platform Regression — PASS within defined scope** (hard gate met, scoped).
No hard gate failed. Final certification is therefore permissible as **PASS WITH CONDITIONS**.

## 14. End-to-End Test Results
Two clean-state executions of the full pipeline are **byte-identical** across metrics, operators,
federation, SB-NAT set, policy summary, ledger, reconciliation, and scenarios (E2E-1). Counts:
128 contributions → 47 candidates → 40 auto-approved + 7 manual-review (2 approved / 5 rejected)
→ 31 SB-NAT (30 multi-operator, 2 high-interest 4+, 1 single) → 1 split + 1 merge (registry
integrity OK) → 31 twins → 186 policy evaluations across 8 outcome families → 8 conflicts →
national synthetic GGR 123,922. Generation ≈0.4s per run. All 16 scenarios re-assert green.

## 15. Independent Reconciliation Results
Recomputed independently (not read from flags): operator SB-PLR ↔ contributions (128=128);
decisions ↔ candidates (47=47); Σ operator GGR ↔ national GGR (123,922); registry integrity OK;
every twin has members + provenance; all SB-NAT ZA-sovereign. **Reconciliation category:** this is
**demonstration-ledger reconciliation** — **certified operator-runtime reconciliation is NOT
available** and is not merged into this result.

## 16. Access-Control Results
Regulator authorised; operator, casino-admin, unauthenticated, wrong-jurisdiction, and
cross-sovereign denied (ADV-1/2/10, E2E-5). Enforced at the service boundary, not UI.

## 17. PII Leakage Results
Serialised twins, policy evaluations, scenarios, SB-NAT summaries, and correlation outputs scan
clean for email-like and long-digit patterns; synthetic attribute tokens never leak (E2E-6, ADV-12).

## 18. Integrity Verification Results
Registry integrity, correlation integrity (incl. `no-runtime-mutation`, `reproducible`,
`no-plaintext-pii`), and policy integrity verifiers all pass on valid inputs and correctly fail
on missing evidence / missing policy / integrity failure (S12; ADV-11).

## 19. Performance Results
Demonstration-scale only (explicitly **not** production load certification): full end-to-end
generation ≈0.4s; matching/decision/registry/correlation/policy/reconciliation all sub-second at
the approved volumes. Timings recorded in `V2_CERTIFICATION_TEST_RESULTS.md`.

## 20. Documentation Consistency Review
Reviewed the V2 document set (ADR-006, Constitution, Reference Architecture, Glossary, Federation
Design, PIA v2, Security/Threat Model v2, Certification Strategy, Freeze Report, Milestone 3.1–3.7
reports, Correlation & Policy specs, Demonstration Dataset v2). **Findings:** milestone reports
consistently use **provisional** certification wording and end with the mandated await-approval
line; the demonstration boundary is stated in the 3.7 report. **DOC-M1 (Medium, corrected here):**
certification wording is finalised in this report (provisional → this milestone's conclusions) and
the live-integration limitation is stated prominently (§3, §24) rather than in an appendix. No
architectural document was changed. No contradictions requiring an ADR were found.

## 21. Defect Register (summary; full register in `V2_CERTIFICATION_RISK_AND_CONDITIONS.md`)
| ID | Severity | Summary | Affected | Status |
|---|---|---|---|---|
| CERT-L1 | LOW | TS `private` is compile-time only; registry internal state not runtime-private at current TS target | C2-1/C2-2 | Recorded; production-hardening condition (raise target to ES2015+ for `#private`, or closure capture). No approved path fabricates an SB-NAT. |
| DOC-M1 | Medium | Certification wording + live-integration limitation must be prominent (not appendix) | C2-1/4/6/7 | Corrected in this report. |
No Critical or High defects found. No constitutional violation, tenant breach, PII exposure,
false SB-NAT creation, unauthorised access, audit mutation, or hard-gate failure.

## 22. Residual Risk Register (summary)
- **R1 (High if productionised without conditions):** live Event Platform / operator-DB ingestion
  is uncertified — synthetic GGR reconciliation ≠ live reconciliation.
- **R2 (Medium):** durable regulator-plane persistence + RLS + durable audit storage not implemented.
- **R3 (Medium):** production pepper management (HSM/Secrets Manager) + rotation not implemented.
- **R4 (Low):** CERT-L1 runtime privacy of internal state.
- **R5 (Low):** deployed-runtime Consumer Platform regression not executed.

## 23. Certification Conditions (each testable; see risk report)
C1 live Event Platform contribution wiring + live reconciliation test · C2 durable regulator-plane
DB + RLS · C3 durable append-only audit storage · C4 production HSM/Secrets Manager pepper +
rotation exercise · C5 live operator connector validation · C6 backup/restore test · C7 regulator
legal + privacy approval (DPA, lawful basis, retention, DSAR, cross-border) · C8 deployed Consumer
Platform runtime regression · C9 pilot operational-readiness review (monitoring/alarms/HA/incident/
runbook/rollback) · C10 runtime-private internal state (CERT-L1).

## 24. Live Runtime Integration Limitation (prominent)
**Milestone 3.7 used an isolated, deterministic, in-memory demonstration ledger. The demonstration
did NOT prove live operator-database ingestion or production Event Platform integration for wagering
and GGR.** Accordingly, this certification does **not** claim that live operator integration is
certified, that production wagering ingestion is certified, or that the platform is production-ready
from the demonstration ledger. Synthetic GGR reconciliation is **not** live Event Platform
reconciliation. This limitation is a first-class certification result, reflected in C2-1, C2-4, C2-6,
C2-7, the risk register, and the deployment decisions.

## 25. Demonstration Readiness Decision → **APPROVED** (isolated + supervised regulator demo)
The isolated demonstration and a supervised regulator demonstration (synthetic data only) are
**APPROVED**; supervised regulator demonstration is **APPROVED WITH CONDITIONS** (C7 regulator
legal/privacy sign-off before showing to an actual regulator; synthetic data only).

## 26. Controlled Pilot Readiness Decision → **NOT APPROVED**
Requires C1–C9 (live integration, durable persistence, HSM, legal approval, deployed regression,
operational readiness). Not met.

## 27. Production Readiness Decision → **NOT APPROVED**
Production deployment remains prohibited; requires all conditions plus explicit post-certification
authorisation. Not met.

## 28. Final Go / No-Go Recommendation
**GO** to (a) finalise Version 2.0 **domain/architecture** certification and (b) proceed to
**supervised regulator demonstration** (synthetic-only, with C7). **NO-GO** for controlled pilot and
production until the conditions are met and separately authorised.

---

## Final Verdict
**Version 2.0 Enterprise Certification: PASS WITH CONDITIONS.**

Separate readiness decisions:
- **Isolated demonstration:** APPROVED.
- **Supervised regulator demonstration:** APPROVED WITH CONDITIONS (C7; synthetic data only).
- **Controlled pilot:** NOT APPROVED (conditions C1–C9 outstanding).
- **Production deployment:** NOT APPROVED (all conditions + explicit authorisation outstanding).

Production remains untouched; federation remains off by default; ADR-006 remains fully compliant.
