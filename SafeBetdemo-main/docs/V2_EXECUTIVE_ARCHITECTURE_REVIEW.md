# SafeBet IQ — Executive Architecture Review Report (v2.0 National Identity Federation)

**Superseded status (Phase 2.1):** ADR-006 is now **Accepted — Architecture Frozen**. This report captured the Phase-1/2 review; the final frozen conclusion, executive statement, and certification/component mapping are in `V2_ARCHITECTURE_FREEZE_REPORT.md`. No code, schema, migration, or service has been created.

## 1. Purpose
Present the complete v2.0 architecture package for review and a go/no-go decision on proceeding to Phase 3 (implementation). v2.0 introduces the platform's flagship differentiator — **national cross-operator Responsible Gambling intelligence** — via a **National Identity Federation Service (NIFS)** and a second, regulator-plane anonymous identity `SB-NAT`.

## 2. The capability in one paragraph
Authorised regulators (only) will be able to determine that several per-operator anonymous players (`SB-PLR`) are the same anonymous individual (`SB-NAT`) — to see national self-exclusion, escalating harm, and prior interventions across operators — **without any operator seeing another operator's data and without any plaintext PII ever entering the platform.** Operators contribute only salted, non-reversible hashes of matching attributes; NIFS clusters them into national identities with explainable confidence and a full audit/appeal trail; the correlation lives in a regulator-only plane behind the existing verified-identity + RLS controls.

## 3. Why extend, not replace (Constitution alignment)
Every certified platform is untouched: Event Platform, Projection Platform, Digital Twin, Domain Intelligence, Policy Platform, Consumer Platform, operator UI, and the `SB-PLR` identity are unchanged. NIFS rides the certified flow (hashed-attribute events through the Event Platform → a downstream federation projection/engine → the Consumer/Regulator Platform), reuses the identity-provider abstraction (ADR-001, which explicitly reserved this additive-federation path), policy-as-data (§4), and the verified-identity/RLS matrix (ADR-002). The result *strengthens* the constitution rather than bending it — this is precisely the additive evolution ADR-001 anticipated.

## 4. Package contents (Phase 1 deliverables)
| # | Deliverable | Document |
|---|---|---|
| 1 | Architecture Decision Record | `ARCHITECTURE_DECISION_RECORD.md` → **ADR-006** |
| 2 | Enterprise Constitution update (proposed amendment) | `SAFEBET_ENTERPRISE_CONSTITUTION.md` §12 |
| 3 | Enterprise Reference Architecture update | `ENTERPRISE_REFERENCE_ARCHITECTURE.md` → National Identity Federation section |
| 4 | National Identity Federation Design (service, matching, confidence, SB-NAT, national twin, DFDs, sequence diagrams, trust boundaries, operational model) | `NATIONAL_IDENTITY_FEDERATION_DESIGN.md` |
| 5 | Privacy Impact Assessment | `PRIVACY_IMPACT_ASSESSMENT_v2.md` |
| 6 | Security Architecture & Threat Model | `SECURITY_ARCHITECTURE_THREAT_MODEL_v2.md` |
| 7 | Migration, Backward-Compat, Deployment, Rollback, Risk, Roadmap, Runbook | `V2_MIGRATION_AND_ROADMAP.md` |
| 8 | Enterprise Glossary update | `ENTERPRISE_GLOSSARY.md` → National Identity Federation terms |
| 9 | Executive Architecture Review Report | this document |

## 5. Key architectural decisions (with rationale)
1. **Two-tier identity (`SB-PLR` + `SB-NAT`)** rather than one federated id — required to keep operators isolated (a single cross-operator id would leak linkage into operator-visible logs). Trade-off: a new id namespace + mapping to maintain.
2. **Hash-before-boundary, no PII** — HMAC-SHA256 with a per-jurisdiction pepper; the platform is structurally incapable of holding plaintext PII. Trade-off: pepper key-management (HSM/Secrets Manager, rotation).
3. **Operator write-only, regulator read-only** — operators contribute hashes; only regulators correlate. Preserves the 403 matrix; no operator query path.
4. **Deterministic, explainable matching + confidence tiers** (not ML first) — satisfies Evidence Integrity (§8); every link is explainable/auditable/appealable. Trade-off: less fuzzy recall than ML (deferred to a future ADR).
5. **National Player Twin by reference** — no duplicate runtime state (§2 preserved). 
6. **Off by default, per-jurisdiction opt-in, reversible** — clean enablement/rollback; zero operator impact until adopted.

## 6. Risk & impact summary
- **Privacy:** DPIA outcome *acceptable with mitigations* — no PII, pseudonymous, regulator-only, explainable, reversible (see PIA).
- **Security:** additive controls on the certified model; residual risks (false links, pepper handling, insider misuse) mitigated by confidence tiers + manual override + appeal, HSM + rotation, and audited purpose-bound access (see Threat Model).
- **Backward compatibility:** total — `SB-PLR` and the operator flow are byte-identical; additive only; rollback is a flag + optional regulator-plane truncation.
- **Highest residual risks:** V-R1 wrongful linkage (mitigated: tiers + human + appeal; automated national action only on *Confirmed*), V-R2 pepper mismanagement (mitigated: HSM + rotation), V-R6 constitutional drift (mitigated: reference-only twin + boundary tests).

## 7. Review checklist for approvers
- [ ] Two-tier identity model accepted (SB-PLR unchanged; SB-NAT regulator-plane).
- [ ] Privacy model accepted (hash-before-boundary, no PII, pepper in HSM).
- [ ] Isolation model accepted (operator write-only; regulator read-only; 403 preserved).
- [ ] Matching + confidence model accepted (deterministic, explainable, jurisdiction-configurable).
- [ ] Constitution §7/§2 proposed amendment accepted (ADR-006 → Accepted).
- [ ] Migration/rollback + roadmap accepted.
- [ ] Per-jurisdiction legal/processing agreement + pepper key-management named as go-live prerequisites.

## 8. Recommendation
The design is **constitutionally coherent, privacy-preserving, isolation-strengthening, backward-compatible, and reversible**, and it delivers the platform's flagship differentiator. The board's recommendation is to **APPROVE ADR-006 (move it Proposed → Accepted) and authorise Phase 3 implementation per the roadmap**, with the two named go-live prerequisites (per-jurisdiction processing agreement + pepper key-management/rotation) tracked to the security/PIA sign-off.

---

## ⏸ PHASE 2 GATE — STOP

**Phase 1 is complete. No production code, application change, database change, migration, or service has been created.** Per the mandatory stage-gate, implementation (Phase 3) will begin **only after explicit approval** of this architecture. Any deviation from the approved design will require an updated ADR and re-approval before coding.

**Awaiting your decision:** *Approve and proceed to Phase 3* · *Approve with changes* · *Reject / revise the architecture*.
