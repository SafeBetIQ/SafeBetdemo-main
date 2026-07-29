# SafeBet IQ — Final Architecture Freeze Report (Version 2.0)

**SafeBet IQ Enterprise Architecture Review Board · Phase 2.1 · 2026-07-16**
**ADR-006: ACCEPTED. Constitution §12 amendment: ACCEPTED. Architecture: FROZEN. Implementation: authorised for Phase 3 under controlled governance. No code, migration, service, database or UI change has been made.**

## 1. Purpose
Record the final governance freeze of the Version 2.0 National Identity Federation architecture after the Phase 2.1 refinements. After this report, the architecture is permanent for v2.0; Phase 3 must implement it exactly; any change requires a new ADR.

## 2. Frozen architecture chain
```
Identity Resolution (SB-PLR — system of record, unchanged)
  → National Identity Federation Service (NIFS)
      → Identity Matching Engine     (deterministic: CANDIDATE matches + evidence + confidence; never decides)
      → Federation Decision Engine   (governance: policies, auto/manual thresholds, approval, appeals,
                                        overrides, explainability, audit, decision history, version tracking)
  → SB-NAT Registry                  (Enterprise Correlation Identity + immutable version stamp)
  → Enterprise Correlation Layer     (READ-ONLY: correlation, aggregation, federation, national
                                        intelligence, regulator analytics — regulator-only)
  → [reads by reference] Event Platform → Projection Platform → Digital Twin → Domain Intelligence
       → Policy Platform → Consumer Platform → UI     (operator plane — unchanged, authoritative)
```

## 3. The eight Phase 2.1 refinements — confirmed frozen
| # | Refinement | Status |
|---|---|---|
| 1 | Matching separated from decision (Identity Matching Engine → Federation Decision Engine; matching never accepts) | ✅ ADR-006 §Phase-2.1(1); Design §19 |
| 2 | Federation versioning immutable per `SB-NAT` (Algorithm/Matching-Policy/Jurisdiction/Decision-Engine/Rule-Set) | ✅ Design §20 |
| 3 | `SB-NAT` = **Enterprise Correlation Identity** (not customer/operator/casino/system-of-record/runtime) | ✅ ADR-006; Constitution §12; Glossary; Ref Arch; Design §21 |
| 4 | National Intelligence Plane = **Enterprise Correlation Layer** (read-only; never modifies operational systems) | ✅ Constitution §12; Ref Arch; Design §21 |
| 5 | Audit architecture expanded & immutable (evidence used/ignored, rules, confidence, 5 versions, reviewer, timestamp, overrides, appeals — reproducible) | ✅ Design §22; Security §4b; PIA §5b |
| 6 | Constitutional guarantees (9) made explicit | ✅ Constitution §12 |
| 7 | Implementation governance (every change → ADR-006; every PR → section + certification + milestone) | ✅ §5 below; ADR-006 §Phase-2.1(7) |
| 8 | Certification mapping per component | ✅ `V2_CERTIFICATION_STRATEGY.md` §Component mapping |

## 4. Final governance validation
| Requirement | Confirmed |
|---|---|
| Constitution preserved | ✅ §12 amendment ratified via accepted ADR (§10); §1–§9 intact |
| Existing runtime architecture unchanged | ✅ operator plane byte-identical; Correlation Layer read-only, by reference |
| `SB-PLR` remains canonical | ✅ system of record; never replaced |
| `SB-NAT` is Enterprise Correlation Identity only | ✅ purpose-bound; not customer/operator/casino/SoR/runtime |
| Federation Decision Engine documented | ✅ Design §19; all decisions governed & versioned |
| Enterprise Correlation Layer documented | ✅ read-only correlation/aggregation |
| Explainability strengthened | ✅ evidence used **and** ignored, policy/engine versions, reviewer, overrides (Design §17, §22) |
| Audit strengthened | ✅ immutable, versioned, reproducible-years-later (Design §22) |
| Privacy strengthened | ✅ no PII; sovereign per-jurisdiction; purpose-bound (PIA §5a/§5b) |
| Multi-country readiness preserved | ✅ `SB-NAT-<CC>`, isolated pepper/store/profile/policy (Design §16) |
| Backward compatibility preserved | ✅ `SB-PLR` untouched; off by default; reversible (Migration) |
| Certification mapping completed | ✅ component→certification table |
| Implementation governance completed | ✅ §5 |

## 5. Implementation governance (Phase 3 rules)
- Every implementation change **must reference ADR-006** and build only the approved architecture.
- Every pull request **must reference**: the affected architectural section (ADR-006 / Design §), the certification requirement it satisfies (`V2_CERTIFICATION_STRATEGY.md` C2-x / component map), and the implementation milestone (Roadmap Stage 0–5).
- No implementation outside the approved architecture. Any deviation requires a **new ADR** and re-approval before coding.
- Hard gates: **C2-1 Architecture** and **C2-5 Consumer Platform Regression** — any operator-facing change or architecture drift fails v2.0.

## 6. Executive statement
The SafeBet IQ Enterprise Architecture Review Board confirms that the Version 2.0 National Identity Federation architecture is **complete, coherent, and constitutionally ratified**. It delivers the platform's flagship differentiator — national, cross-operator Responsible Gambling intelligence — as an **additive, read-only Enterprise Correlation Layer** that preserves the certified operator runtime unchanged, keeps `SB-PLR` as the system of record, treats `SB-NAT` strictly as an anonymous Enterprise Correlation Identity, enforces regulator-only access with no PII, separates deterministic matching from governed decision-making, and makes every identity decision explainable, versioned, auditable and reproducible. ADR-006 and the §12 Constitution amendment are **Accepted**. The architecture is **frozen** for Version 2.0. Phase 3 is authorised to implement **exactly** this design under the certification gates; any future architectural change requires a new ADR.

---

**Architecture Frozen – Version 2.0 Approved for Controlled Implementation.**
