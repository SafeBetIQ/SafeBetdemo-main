# Version 2.0 — Regulator Acceptance Report (C2-7)

**Milestone 3.8 · 2026-07-16.** Demonstration-acceptance assessment against the regulator
question set. **Scope: demonstration acceptance only** — controlled-pilot and production
acceptance are NOT certified (required live integrations absent).

## 1. Regulator question set — can the system answer it?
| Regulator question | Answered by | Result |
|---|---|---|
| Is this anonymous individual active across multiple operators? | National Player Twin `participatingOperators` | ✅ |
| Which operators are involved? | Twin + operator participation | ✅ |
| Why were these identities linked? | Provenance: federation decision → matching candidate → evidence | ✅ |
| Which matching evidence was used / ignored? | Candidate `evidenceUsed` / `evidenceNotMatched` (via provenance refs) | ✅ |
| What was the confidence score? | Decision `confidenceScore` | ✅ |
| Which policy version applied? | Evaluation nine-part `versions.policyVersion` | ✅ |
| Has the individual self-excluded elsewhere? | National Self-Exclusion View | ✅ |
| Did activity continue during exclusion? | Self-exclusion conflicts (S1) | ✅ |
| Were previous interventions attempted? | Twin intervention history | ✅ |
| Is behaviour escalating nationally? | Cross-operator intelligence `riskEscalating` / `behaviourEscalation` (S2) | ✅ |
| Does the case require regulator review? | Policy `reviewState = pending-review` | ✅ |
| Is there a national investigation recommendation? | Policy outcome + investigation view (S5) | ✅ |
| Can the complete evidence chain be reconstructed? | Provenance + registry historical reconstruction | ✅ |
| Can an incorrect correlation be split? | Registry split (S9) | ✅ |
| Can governed clusters be merged? | Registry merge (S10) | ✅ |
| Can an appeal be recorded? | Policy appeal lifecycle (G09) | ✅ |
| Can an authorised override be recorded? | Policy override, immutable history (G10) | ✅ |
| Can integrity failure be distinguished from a real risk outcome? | `Data Integrity Failure` vs risk outcomes (S12) | ✅ |
| Can a normal low-risk multi-operator player be shown? | Low-risk control (S14) | ✅ |

## 2. Validated properties
- **Regulator-only access** — operator/wrong-jurisdiction/cross-sovereign denied (ADV, E2E-5).
- **Explainability** — every decision/twin/policy outcome carries reasons, evidence, and versions.
- **Provenance** — complete chain on every insight; no insight without provenance.
- **Auditability** — append-only, immutable decision/registry/policy audit.
- **Deterministic repeatability** — two clean-state runs byte-identical (E2E-1).
- **National policy outcomes** — all six families demonstrated with realistic spread.
- **False-positive protection** — S7 rejected, no shared SB-NAT.
- **Low-risk controls** — S14, no inappropriate escalation (credibility).
- **Jurisdiction isolation** — S13, cross-sovereign denied.
- **Demonstration performance** — full run ≈0.4 s.
- **Regulator guide accuracy** — the guide in `NATIONAL_DEMONSTRATION_DATASET_V2.md` matches the generated dataset.

## 3. Acceptance-level determination
| Level | Decision | Basis |
|---|---|---|
| Demonstration acceptance | **CERTIFIED** | full question set answered; synthetic data; deterministic |
| Controlled pilot acceptance | **NOT CERTIFIED** | requires live integration (C1/C5), durable persistence (C2/C3), legal approval (C7) |
| Production acceptance | **NOT CERTIFIED** | all conditions + explicit authorisation |

## 4. Conditions before any real regulator engagement
- **C7** regulator legal + privacy approval (DPA, lawful basis, retention, DSAR, cross-border, authorisation model).
- Demonstrations to an actual regulator must use **synthetic data only** until live integration is separately certified.

**C2-7: PASS for demonstration acceptance; pilot/production acceptance not certified.**
