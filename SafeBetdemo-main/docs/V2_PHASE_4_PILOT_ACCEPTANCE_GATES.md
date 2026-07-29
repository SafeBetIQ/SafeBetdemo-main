# Version 2.0 — Phase 4 Pilot Acceptance Gates

**Phase 4.0 · PLANNING ONLY · 2026-07-16.** Formal gates for controlled-pilot acceptance
(Milestone 4.8). Hard gates marked **[HARD]** — failure of any hard gate fails pilot certification.

## 1. Gate register
| Gate | Description | Hard? | Closure conditions | Failure consequence |
|---|---|---|---|---|
| G1 Architecture compliance | ADR-006 conformance, isolation both directions, no domain redesign, no bypass | **[HARD]** | C2-1 re-validated against pilot wiring; static import + mutation-surface analysis clean | Pilot certification FAILS |
| G2 Security | deny-by-default, RLS, roles, hash-only boundary, immutable audit, no PII, connector authn/authz | **[HARD]** | C2, C3, C4, C5 closed; adversarial suite passes on the live store/connector | Pilot FAILS |
| G3 Privacy | data minimisation, no plaintext PII, sovereign separation, retention, DSAR | **[HARD]** | C7 legal/privacy closed; PII scans clean on live/sandbox | Pilot FAILS |
| G4 Cross-operator intelligence | legitimate correlation, false-positive protection, provenance, integrity, reproducibility | **[HARD]** | C1, C5 closed; scenario re-run + integrity on live/sandbox | Pilot FAILS |
| G5 Consumer Platform regression | deployed routes/contracts/dashboards/APIs unaffected; SB-NAT/policy non-exposure | **[HARD]** | **C8 closed** (deployed regression) | Pilot FAILS (carries C2-5 hard gate) |
| G6 Operational readiness | monitoring/alarms, incident, runbook, pipeline, rollback, backup/restore | **[HARD]** | C6, C9 closed; drills exercised | Pilot FAILS |
| G7 Regulator acceptance | regulator question set answered on pilot data; regulator sign-off | **[HARD]** | C7 + pilot regulator acceptance | Pilot FAILS |
| G8 Live integration | live/sandbox contribution + wagering ingestion + reconciliation | **[HARD]** | C1 closed (live reconciliation) | Pilot FAILS |
| G9 Persistence & recovery | durable persistence, RLS, append-only audit, restore | **[HARD]** | C2, C3, C6 closed | Pilot FAILS |
| G10 Legal approval | signed DPA, lawful basis, authorisation | **[HARD]** | C7 closed | Pilot FAILS (real data) |
| G11 Pilot support readiness | support hours, escalation, change control | Soft | C9 support model present | Conditional pilot with mitigations |

## 2. Hard-gate summary
**[HARD] gates:** G1, G2, G3, G4, G5, G6, G7, G8, G9, G10. **Soft:** G11.
No controlled-pilot go decision may be issued if any hard gate is unmet. G5 preserves the
Version 2.0 **C2-5 hard gate** in the deployed-runtime scope (closing the certification's scoped
condition C8).

## 3. Gate → condition traceability
| Gate | Conditions |
|---|---|
| G1 | (architecture; re-validate C2-1) |
| G2 | C2, C3, C4, C5, C10 |
| G3 | C7 |
| G4 | C1, C5 |
| G5 | C8 |
| G6 | C6, C9 |
| G7 | C7 |
| G8 | C1 |
| G9 | C2, C3, C6 |
| G10 | C7 |

## 4. Gate evaluation rules
- Gates are evaluated **independently** with objective evidence at Milestone 4.8.
- Any Critical or High defect discovered during gate evaluation fails the relevant hard gate.
- A gate may be **PASS WITH CONDITIONS** only for **soft** gates (G11); hard gates are PASS/FAIL.
- Passing all pilot hard gates authorises **controlled pilot scope only** — **never** production.
- Production requires a separate production-readiness assessment and explicit authorisation.
