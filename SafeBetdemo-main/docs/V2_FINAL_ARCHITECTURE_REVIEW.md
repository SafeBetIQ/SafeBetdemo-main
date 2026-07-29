# SafeBet IQ — Final Enterprise Architecture Review (ADR-006, Phase 2)

**SafeBet IQ Enterprise Architecture Review Board · 2026-07-16**
**Implementation status: NOT AUTHORISED.** This is the Phase 2 governance conclusion. No code, migration, service, database or UI change was made. Outcome: a reviewed, refined, recommendation-ready architecture package.

## 1. What Phase 2 changed (strengthened, not redesigned)
ADR-006 and the supporting documents were refined against the ten board-mandated revisions. The solution is unchanged in principle; it is now governed in detail.
| # | Board revision | Where it landed |
|---|---|---|
| 1 | `SB-PLR` = system of record; `SB-NAT` correlation-only | ADR-006 §Phase-2(1); Constitution §12; Glossary; Ref Arch |
| 2 | National Intelligence Plane (formal layer) | Design §12; ADR-006 §Phase-2(2); Ref Arch; Constitution §12; Glossary |
| 3 | Federation governance (thresholds/review/reject/override/appeal/retention/lifecycle) | Design §14 |
| 4 | Jurisdiction profiles (policy-driven matching) | Design §15; Glossary; PIA §5a |
| 5 | Explainability (used/ignored evidence, policy version, reviewer, overrides) | Design §17 |
| 6 | National Player Twin lifecycle (Created→…→Archived) | Design §13 |
| 7 | Policy Platform national scope (`NAT-*`, configurable) | Design §18 |
| 8 | Version 2 certification strategy | `V2_CERTIFICATION_STRATEGY.md` |
| 9 | Multi-country / sovereign readiness (`SB-NAT-<CC>`) | Design §16; ADR-006 §Phase-2(5); Security §4a; PIA §5a |
| 10 | National Demonstration Dataset v2 | `V2_MIGRATION_AND_ROADMAP.md` Stage 5 |

## 2. Final governance checklist (evidence-based)
| Requirement | Status | Evidence |
|---|---|---|
| Enterprise Constitution preserved | ✅ | Additive-only; §7/§2 amendments staged as **proposed** pending ADR acceptance (§10 respected); §1–§9 satisfied by NIFS design. |
| Existing runtime architecture preserved | ✅ | `SB-PLR`/Event/Projection/Twin/Intelligence/Policy/Consumer byte-identical; NIP reads by reference, never mutates (Design §12). |
| Tenant isolation preserved | ✅ | Operators write-only; regulator-only RLS + verified regulator JWT + jurisdiction gate; 403 on federation reads (Security §1, T-1/T-6). |
| Privacy by Design maintained | ✅ | Hash-before-boundary, no PII, pepper in HSM; per-jurisdiction sovereignty; DPIA acceptable-with-mitigations (PIA). |
| Evidence Integrity maintained | ✅ | Every link is Derived Intelligence with confidence + evidence (used **and** ignored) + policy version + provenance + appeal (Design §17, §8). |
| Backward compatibility maintained | ✅ | `SB-PLR` never changes; off by default; reversible (flag + optional regulator-plane truncate); no operator contract change (Migration §1–§4). |
| Regulator-only federation enforced | ✅ | National Intelligence Plane is regulator-only end to end; operators cannot query/search/resolve (Design §11, Security §3). |
| Multi-country scalability designed | ✅ | Sovereign `SB-NAT-<CC>` with isolated pepper/store/profile/policy; new country = config, no redesign (Design §16). |
| Implementation risks understood | ✅ | Risk register V-R1…V-R7 with mitigations; STRIDE T-1…T-12; certification gates C2-1…C2-7 before enablement. |

## 3. Residual concerns (accepted, tracked)
- **Wrongful linkage (V-R1):** mitigated by confidence tiers + governed review/override/appeal + "auto-action only on Confirmed + enabling policy + human decision." Tracked to C2-4/C2-7.
- **Pepper key-management (V-R2):** per-jurisdiction HSM/Secrets Manager + versioned rotation; tracked to C2-2/C2-6 and the go-live checklist.
- **Operator adoption (V-R4):** graceful partial coverage; un-federated players simply absent from national views — no correctness risk.
- **Legal divergence per jurisdiction (V-R5):** jurisdiction profiles as data + signed processing agreement prerequisite (PIA §6).

## 4. Final Recommendation

# ✅ APPROVE ADR-006 WITH MINOR CHANGES

**Basis (objective):** the architecture is additive, constitutionally coherent (system-of-record preserved, isolation *strengthened*, §1–§9 satisfied), privacy-preserving (no PII, sovereign per-jurisdiction, explainable, reversible), backward-compatible (`SB-PLR` untouched, off by default), and multi-country ready by design — with a governed decision model, a defined twin lifecycle, and a full certification plan. The board's residual items are **minor** and are governance/config prerequisites rather than design flaws:
1. Attach the per-jurisdiction **data-processing/regulatory agreement** and **pepper key-management + rotation** procedure as named acceptance prerequisites (already tracked in PIA §6 / Security §5 / Roadmap).
2. Confirm **C2-1 (Architecture)** and **C2-5 (Consumer Platform Regression)** as **hard gates** that block enablement on any operator-facing change or architecture drift (already in `V2_CERTIFICATION_STRATEGY.md`).
3. Record the §7/§2 Constitution amendment as **Accepted** simultaneously with moving ADR-006 Proposed → Accepted (§10).

On completion of these three minor items, ADR-006 moves **Proposed → Accepted**, at which point — and only then — Phase 3 implementation may begin under the approved roadmap and certification gates.

## 5. Implementation gate (unchanged)
**Do NOT implement anything.** No code, migrations, application, database, Consumer/Event/Projection Platform changes. Phase 3 is authorised only after ADR-006 is formally **Accepted** by the owner. Any deviation from the approved design requires an updated ADR and re-approval before coding.

---

### Awaiting owner decision
*Accept ADR-006 (with the three minor items) → authorise Phase 3* · *Accept with further changes* · *Reject*.
