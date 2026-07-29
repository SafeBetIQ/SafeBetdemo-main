# SafeBet IQ — Milestone 4.5 Implementation Report

**Wagering & GGR Reconciliation (SANDBOX / PILOT-PATH) · 2026-07-16 · ADR-006 (Accepted, frozen).**
**Environment: Demo/pilot branch, non-production, in-process · Production: UNCHANGED · Federation: OFF by default · Deployment: NOT AUTHORISED.**
**Milestone status: COMPLETE. STOP — awaiting approval before Milestone 4.6.**

## 1. Executive Summary
Implemented and independently validated the **sandbox / pilot-path** wagering + GGR reconciliation flow
through a **certified-boundary-shaped, authoritative** financial Event Platform → a deterministic,
**rebuildable** Projection Platform → **four separate reconciliation levels** + a structured integrity
verifier. All money is **integer minor units** (no floating-point). GGR uses a **documented formula**.
Sessions/wagers/settlements are integrity-validated; the wager lifecycle (won/lost/void/refund/correction)
is enforced; idempotency/replay prevent double financial impact; **no derived total is ever inserted**
(projections replay accepted events); tenant isolation holds (operators read only their own tenant;
national is regulator-only); every total is provenance-traceable; **no plaintext PII**. Full regression
**422 pass**, `tsc` clean, isolated. **Applicable C1 (live wagering/GGR reconciliation portion):
PARTIALLY CLOSED** — proven on an **in-process sandbox**; **external-operator, deployed-runtime, and
production evidence remain OPEN**. **C1(contribution)/C2/C3/C4/C5 unchanged; C10 CLOSED.**

## 2. Exact Applicable C1 Wording (verbatim from `V2_CERTIFICATION_RISK_AND_CONDITIONS.md` §4)
- **C1 — "Live Event Platform contribution wiring + live reconciliation."**
- **Test of satisfaction:** *"Live wager/GGR events flow → certified projections; live operator↔national reconciliation report passes."*
- Phase 4.5 addresses the **wagering + GGR + operator↔national reconciliation** portion, on the **sandbox pilot-path**.

## 3. Files Added
Under `lib/identityFederation/financial/`:
- `model.ts` — financial event contract; integer-minor-unit money; currency; wager/settlement lifecycle; rejection taxonomy; idempotency; PII/amount-safe audit; **documented GGR formula**; deny-by-default access.
- `eventPlatform.ts` — authoritative `FinancialEventPlatform` (validation pipeline; append-only accepted log; rejected records; idempotency/replay/sequence; session/wager/settlement integrity; currency/precision).
- `projection.ts` — `FinancialProjectionPlatform` (derives operator + national totals by **replaying accepted events**; deterministic rebuild; no direct insertion).
- `reconciliation.ts` — `FinancialReconciler` (4-level reconciliation + equation + integrity verifier).
- `index.ts` — public API.
- `tests/identityFederation.financial.test.mjs` — 11 tests.

## 4. Files Modified
- `lib/identityFederation/index.ts` — re-exports the financial API (additive).
**Certified + prior-milestone components unchanged.**

## 5. Justification for Files Changed Outside the Financial Integration Layer
| File | Change | Justification |
|---|---|---|
| `index.ts` | additive re-export | single federation public entry point |
**No operator path, no production config/credential/endpoint, no direct total insertion.**

## 6. Tested Environment Classification
**Sandbox / pilot-path**: an **in-process** certified-boundary-shaped Event Platform + Projection Platform
over **deterministic synthetic** financial activity (single currency ZAR). **NOT** production-live, **NOT**
certified external-operator, **NOT** deployed operator integration, **NOT** real-money reconciliation.

## 7. Source Data Model
Synthetic session/wager/settlement/void/refund/correction events with integer-minor-unit amounts,
anonymous SB-PLR references, ISO-4217 currency, source sequence, idempotency key, source-system ref. No
real player/financial data.

## 8. Event Contract Validation
Strict allowed-field schema (unknown field rejected), required fields, schema version, ISO-4217 currency,
**integer amountMinor (non-negative)**, and a PII scan (email) on reference fields. Fails closed. Tested.

## 9. Session Integrity Validation
Wagers must reference a valid session owned by the same tenant/operator/SB-PLR/jurisdiction and **not
ended**. Invalid/legacy session → `invalid-session`; cross-tenant → `cross-tenant-session`; wrong player →
`session-player-mismatch`; post-end → `session-ended`. Tested. (Directly addresses the earlier demo issue
where wagers referenced unresolvable sessions.)

## 10. Wager Integrity Validation
Wager-placed requires a positive integer stake + unique wagerId + open session; every settlement/void/
refund must match the wager's tenant/SB-PLR/currency/session (no reassignment). Tested.

## 11. Settlement Lifecycle Validation
`placed → won/lost → voided/corrected`; `placed → voided/refunded`. Rejected: settling an unknown wager
(`settle-unknown-wager`), double settlement (`double-settlement`), voiding a final wager improperly, refund
exceeding stake (`refund-exceeds-eligible`), reassigning tenant/SB-PLR/currency/session (`reassign-denied`
/ `currency-mismatch`). Tested.

## 12. Currency and Precision Validation
One currency per operator (mismatch → `currency-mismatch`); ISO-4217 validated; amounts are **integer
minor units** — non-integers → `precision-error`, negatives → `negative-amount`. **No floating-point money
arithmetic** anywhere (summation is exact integer). Single-currency sandbox limitation stated. Tested.

## 13. Idempotency Validation
Server-derived content key (`tenant ␟ eventType ␟ session ␟ wager ␟ result`) → the same event produces one
authoritative financial effect; duplicates reference the original. Tested (GGR unchanged by duplicate).

## 14. Replay Protection Validation
Replayed eventIds return the original acceptance — **no** double turnover/GGR/win/loss/refund/void, no
inflated totals. Tested (GGR unchanged).

## 15. Event Ordering Validation
Duplicate source sequence → `invalid-sequence`; settlement-before-wager rejected (`settle-unknown-wager`)
until the wager exists; correction references an accepted event. Inconsistent sequences are not silently
accepted.

## 16. Accepted and Rejected Event Validation
Every event yields a traceable outcome; rejected events produce a **safe** structured record (reason,
permanence, operator/tenant/jurisdiction, safe detail, audit ref) with **no plaintext PII**. Rejected
events remain visible (not hidden, not treated as accepted). Tested.

## 17. Projection Platform Validation
Operator + national totals are **derived by replaying accepted events** — sessions, wagers, turnover,
wins, losses, voids, refunds, GGR, per-product. **No direct insertion surface** exists (`insert`/`setGgr`/
`writeGgr`/`update` are `undefined`). Tested.

## 18. Projection Rebuild Validation
`operatorProjections()` is a pure function of the accepted log — re-running yields **byte-identical**
output (deterministic rebuild). Tested.

## 19. GGR Formula Documentation
`GGR = Σ stake(settled non-void/refund wagers) − Σ payout(won settlements)`, integer minor units. Turnover =
Σ stake over `{won, lost}` wagers; WinsPaid = Σ payout over `won`; voids/refunds reverse the wager entirely
(excluded). Single currency per operator (not summed across currencies). Each metric states formula,
included/excluded event types, currency, window, projection version, source-event count, adjustment
treatment, and rounding (n/a — integer). Documented in `V2_GGR_CALCULATION_SPECIFICATION.md`.

## 20–24. Reconciliation (Player / Session / Product / Operator / National)
Operator projection exposes per-product GGR; player/session are derivable from the same replay. **Four
separate levels** (never merged): **L1** operator source ↔ connector; **L2** connector ↔ Event Platform
(`submitted = accepted + rejected + duplicates + deferred + dead-lettered`); **L3** Event Platform ↔
projection (`accepted = projected inputs`); **L4** operator ↔ national (`Σ eligible operator GGR =
national`). All balance in the sandbox run; each difference (if any) is quantified, classified, explained,
and traceable. Tested.

## 25–27. Void / Refund / Correction Validation
Voids and refunds **reverse** the wager (excluded from turnover/GGR) while **preserving** the original
accepted event (append-only; never deleted). Corrections reference the original event and preserve history.
Tested (turnover/GGR go to 0 for a voided + refunded pair; original preserved; over-refund rejected).

## 28. Bonus Treatment
No bonus/promotional GGR treatment is invented. Bonus/promotional categories are **not** implemented and
are **explicitly excluded** (documented), not silently treated as cash wagering.

## 29. Cross-Operator Aggregation Validation
National aggregation preserves operator separation (per-operator projections summed for the regulator);
operators cannot view another operator's totals or the national aggregate. Tested.

## 30. Tenant-Isolation Validation
Operator A cannot read Operator B's events/projections/national aggregate, cannot submit for B, cannot
reference B's session/SB-PLR; a regulator reads only its authorised jurisdiction. Tested.

## 31. Provenance Validation
Every operator projection lists its contributing accepted event ids (`sourceEventIds.length ===
eventCount`); national references included operators. No derived total exists without source provenance.
Tested (integrity `provenance-complete`).

## 32. Integrity-Verifier Results
`verifyIntegrity` → **ok**: source/status/projection reconcile; operator GGR = turnover − winsPaid;
national reconciles; duplicates/replays no effect; currency consistent; **integer precision**; deterministic
rebuild; provenance complete; **no direct total insertion**; no plaintext PII. Tested.

## 33. Data-Freshness Validation
Operator + national results carry `dataFreshness` (latest accepted timestamp) + window; stale totals are
not presented as current without the watermark.

## 34. Failure-Mode Validation
Invalid session/wager/amount/currency, duplicate/replay, out-of-order settlement, refund over-eligible, and
cross-tenant references are handled (fail closed) without silent financial inaccuracy. Tested
(representative).

## 35. External Sandbox Evidence or Limitation
**No external operator sandbox** was used — a controlled in-process simulator only. External-vendor
reconciliation is **unproven** (C1 residual).

## 36. Deployed-Runtime Evidence or Limitation
Execution was **in-process** — the Event/Projection Platform were not deployed non-production services.
Deployed-runtime reconciliation is **not claimed** (maps to Phase 4.6 + deployment).

## 37. Security Validation
Cross-tenant financial submission/session/SB-PLR denied; operator national-aggregate + competitor-data
access denied; unauthenticated/casino-admin denied; amount/precision/currency tampering rejected;
sequence manipulation + replay handled; **no projection write / direct total insertion surface**; audit
immutable; no PII/financial leakage.

## 38. Privacy Validation
Financial events use anonymous SB-PLR references; no real names/IDs/passports/emails/phones/payment/bank
details; synthetic only. A serialised scan of accepted events + projections + audit is clean. Tested.

## 39. Performance Notes (pilot-scale)
Session/wager/settlement ingestion, projection, rebuild, and reconciliation complete sub-millisecond-to-low-
millisecond on synthetic volumes (2 operators, 1 session each, 2 wagers each, ZAR). Not production
throughput certification.

## 40. Milestone Test Results
`identityFederation.financial` → **11 pass**: invalid/legacy session rejected; cross-tenant/wrong-player/
session-ended; integer precision; double-settlement/unknown-wager; GGR + deterministic rebuild; void/refund
reversal + over-refund rejection; idempotency/replay (no double effect); 4-level reconciliation + integrity;
tenant isolation + security; no-PII + no-direct-insertion; end-to-end.

## 41. Full Regression Results
**422 pass / 0 fail** (411 prior + 11 new). No prior test affected (additive).

## 42. TypeScript Validation
`npx tsc --noEmit` → clean.

## 43. Import-Boundary Validation
Federation imported by no operator/UI/edge path; the financial layer imports only `../types` + internal —
**no** operator-runtime/app/Supabase import and **no** direct downstream insertion into certified components.

## 44. Technical Debt Check
**None.** No direct financial-total/GGR insertion; no projection/Event-Platform bypass; no invalid-session
workaround; no hidden rejected events; no duplicate/replay financial effects; **no floating-point money**;
no silent currency conversion; no unexplained reconciliation difference; no operator access to competitor/
national data; no production casino/credential/endpoint/config; no false live-integration claim; no TODO/
stub/temporary formula; no weakened tests; no architecture deviation.

## 45. Risks and Limitations (explicit, mapped)
- **External-operator + deployed-runtime + production** reconciliation → OPEN (C1 residual; deployment).
- **Single currency** (ZAR) in the sandbox — multi-currency conversion not implemented (stated).
- **Bonus/promotional treatment** excluded (documented).
- **Certified operator Projection Platform binding** — the pilot uses a certified-boundary-shaped sandbox
  projection; the live operator Projection Platform binding is a deployment activity.

## 46. C1 Closure Assessment → **PARTIALLY CLOSED**
- **Source/connector/Event-Platform/projection environment:** in-process sandbox (certified-boundary-shaped).
- **Session/wager/settlement/rejected-event/GGR/operator-reconciliation/national-reconciliation/provenance/
  security/privacy evidence:** present + tested; **operator↔national reconciliation report passes** (balanced).
- **External sandbox evidence:** MISSING. **Deployed-runtime evidence:** MISSING. **Production evidence:** MISSING (and prohibited).
- **Residual:** live wager/GGR flow through the **deployed** certified Event/Projection Platform with an
  **external** operator, and the **live** operator↔national reconciliation report.
- **Retest to fully close C1:** run the reconciliation against a deployed non-production environment with an
  external/approved operator sandbox; verify the live reconciliation report passes.
- **Status: PARTIALLY CLOSED** (sandbox pilot-path proven; live/deployed/external not claimed, per the milestone's scope wording).

## 47. Confirmation of Existing Condition Status
- **C1** PARTIALLY CLOSED (advanced with sandbox wager/GGR evidence; live/deployed/external residual open).
- **C2** PARTIALLY CLOSED · **C3** PARTIALLY CLOSED · **C4** PARTIALLY CLOSED · **C5** PARTIALLY CLOSED ·
  **C10** CLOSED. No status altered without new evidence; native RLS, DB append-only, managed Secrets
  Manager/HSM, external connector, and deployed evidence remain open.

## 48. Provisional Certification Evidence (no final claim)
Contributes provisional evidence toward **C2-1 Architecture** (Event-Platform + Projection-Platform
authoritative; no bypass; no direct insertion), **C2-2 Security** (tenant isolation, deny-by-default),
**C2-3 Privacy** (anonymous references, no PII), **C2-4 Cross-Operator Intelligence** (operator↔national
reconciliation). No pilot readiness claimed.

## 49. Go / No-Go Recommendation for Phase 4.6
**GO to plan-approve Phase 4.6 (Deployed Runtime & Consumer Platform Regression)** — the sandbox wager/GGR
pipeline (Event Platform, projection rebuild, 4-level reconciliation, integrity, tenant isolation,
provenance) is complete and tested. Phase 4.6 will exercise the **deployed** application runtime + Consumer
Platform regression (condition C8), which also provides the deployed-runtime evidence C1/C5 need. C1 remains
PARTIALLY CLOSED with a clear external + deployed + live residual.

---
**Phase 4.5 Complete — Awaiting Approval for Phase 4.6 Deployed Runtime and Consumer Platform Regression.**
