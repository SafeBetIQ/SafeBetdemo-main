# SafeBet — Product Boundary Map, Data Ownership & Service Contracts (ARCH-V4-A3)

Read-only classification of the current Demo estate against the v4.0 three-product model,
plus the governed shared-service contracts. **Strangler migration — nothing physically moved
except the first proven extraction (see §5).** No table was dropped or relocated in the DB.

Estate: **330 tables · 24 views · 157 functions** (511 objects) in a single `public` schema;
30 edge functions. Classified read-only 2026-09-04.

## 1. Top-level ownership (object count, approximate)
| Owner | ~Objects | Notes |
|---|---|---|
| **SafeBet IQ** | ~276 | player/session/machine, risk/behaviour/AI, intervention, financial, self-exclusion (+SEN), compliance/case/policy, event/projection/twin, admin/reporting, `transactions_archive_*` partitions |
| **Shared Platform Foundation** | ~163 | identity/security (46), platform-ops (36), audit (25), integration (24), evidence (5), privacy/POPIA (9), commercial/packaging (9), notifications (4), AI-governance (8), regulator-identity (2) |
| **Demo simulation** | 26 | `sbiq_demo_*`, simulator config/flags/run-log/showcase — DEMO ONLY |
| **Legacy (Academy)** | 18 | quiz/training/certificate — excluded from v4 → retire (see legacy-retirement-register.md) |
| **`guardian_*` analytics (RECLASSIFY → IQ)** | 7 | minor-protection RG analytics — NOT the v4 Guardian product (see §4) |
| **GUARDIAN target** | 0 | greenfield — namespace reserved, no business objects |
| **REGULATOR SUITE target** | 0 | greenfield — namespace reserved, no business objects |

Residual genuinely-ambiguous objects (~a handful) are flagged UNKNOWN in the Data Ownership
Register working set and default to their nearest owner pending confirmation; none block A3.

## 2. Data Ownership Register (category summary)
Full per-object working classification is generated read-only from `pg_tables`/`pg_views`/`pg_proc`.
Category → owner → tenant/jurisdiction scope → security model → extraction recommendation:

| Category | Owner | Scope | Security | Recommendation |
|---|---|---|---|---|
| player/session/machine, risk/behaviour/AI, intervention, financial, self-exclusion, compliance/case, event/projection, admin/reporting | **IQ** | casino/tenant (RLS) | RLS + role | Keep; expose cross-product needs via contracts, not raw tables |
| identity/tenancy, roles, `is_*`/`get_*_casino_id`, MFA, auth logs | **Shared** | platform + tenant/jurisdiction | RLS + SECURITY DEFINER (debt) | Extract to Shared Identity contract (A4); least-privilege remediation = A5 |
| audit / audit-chain | **Shared** | per-tenant chain scope | append-only + hash chain | **Extract to `@/lib/platform/audit` (DONE, §5)**; DB audit service = A4 |
| evidence gateway | **Shared** | casino-scoped | JWT-narrow | Extract to Shared Evidence contract (A4) |
| integration/connectors | **Shared** | per-operator feed | service-scoped | Governed adapter contract (A4) |
| privacy/POPIA (consent, DSR, retention) | **Shared** | data-subject | restricted | Shared privacy service (A4/E) |
| commercial/packaging (modules, pricing) | **Shared** | casino | admin | Shared config/commerce contract |
| AI governance (prompt/ai logs) | **Shared** | platform | restricted | 42001 model registry (E) |
| `sbiq_demo_*` simulator | **Demo** | Demo only | service | Never in Prod; gated by env |
| Academy (quiz/training) | **Legacy** | n/a | n/a | Retire (register) |
| `guardian_*` / `guardianlayer_*` | **IQ (reclassify) / Legacy** | casino/province | RLS | Rename off the Guardian namespace (§4) |

## 3. API / Edge Function Ownership Map (30 edge functions)
| Owner | Functions |
|---|---|
| **IQ** | consumer-gateway, projection-platform, intervention-engine, cross-operator-intelligence, digital-twin, bri-risk-score, safeplay-ai-risk-engine, wellbeing-risk-calculator, process-wellbeing-completion, send-wellbeing-invitation, self-exclusion-network, commerce |
| **Shared Foundation** | evidence-gateway, workflow, identity-resolution, connector-ingest, api-ingest, platform-ops, db-maintenance |
| **Integration (Shared)** | integration-altenar-sync, integration-betsoftware-sync, integration-evolution-sync, integration-playtech-sync, integration-softswiss-sync, integration-whatsapp-send, sync-real-casino-data |
| **Demo** | casino-simulator, demo-sync-all-casinos |
| **Shared (admin/ops)** | reset-staff-password |
| **Regulator (IQ-hosted today)** | regulator-portal |
| **GUARDIAN / REGULATOR-SUITE target** | none (greenfield) |
| **Cross-domain to split later** | `consumer-gateway` (IQ live-floor + evidence + explain — evidence path should route via the Shared Evidence contract); `regulator-portal` (regulator views over IQ data — future Regulator Suite boundary) |

## 4. Guardian naming collision (resolution)
The 7 `guardian_*` tables (`guardian_device_intelligence`, `guardian_identity_drift`,
`guardian_intervention_signals`, `guardian_minor_risk_scores`, `guardian_operator_risk_summary`,
`guardian_province_risk_summary`, `guardian_school_hour_flags`) and the `guardianlayer_*`
migrations are **minor-protection / responsible-gambling analytics — NOT** the v4 Guardian
illegal-gambling product.
- **Classification:** RECLASSIFY → SafeBet IQ (RG/minor-protection). `guardianlayer_*` = LEGACY.
- **Namespace rule:** the v4 **Guardian product SHALL use a distinct namespace** (e.g. `sbg_*` /
  `guardian_ops_*` schema) and SHALL NOT reuse `guardian_*` table names. Reserved now.
- **Action (deferred, reversible):** rename `guardian_*` → `iq_rg_*` (or `minor_protection_*`) in a
  later milestone via views/synonyms (strangler) so the Guardian namespace is free. **Not renamed
  in A3** (no destructive change); recorded in the Legacy/Retirement Register.

## 5. First safe extraction (strangler pattern — IMPLEMENTED)
**Shared audit-chain primitive → Shared Platform Foundation.**
- New governed home: **`lib/platform/audit`** (owner: Shared Foundation; consumers: IQ now,
  Guardian/Regulator later; pure verification primitive, injected SHA-256, per-scope chain).
- `lib/consumerPlatform/auditChain.ts` → **deprecated re-export shim** (existing consumers/tests
  unbroken).
- Consumer migrated: `lib/consumerPlatform/index.ts` now imports the governed path.
- Proof: `tests/platformAuditContract.test.mjs` — byte-parity across governed/deprecated/facade
  paths + DB-identical hashes; full suite **707/707**, typecheck + build green. **Behaviour
  unchanged** (pure relocation) → no runtime deploy required; deploys with the next release.
- Why this candidate: the audit chain is already pure and product-agnostic (mislocated under IQ),
  so relocation is the lowest-risk way to prove the pattern and to give Guardian/Regulator a
  governed audit contract **without depending on IQ business tables** (Authority §10).

## 6. Boundary decisions
- **Evidence reuse:** becomes a Shared service; Guardian/Regulator consume `@/lib/platform/evidence`
  (A4), never IQ evidence internals or `audit_events`/domain tables directly. **REQUIRES EXTRACTION** (A4).
- **Audit reuse:** **DONE for the verification primitive** (§5); the DB audit-write/verify service
  becomes Shared in A4. Guardian can reuse audit **without** IQ business tables. **YES.**
- **Identity boundary:** define a product-aware principal contract (product + tenant/jurisdiction +
  role + attributes + purpose + delegation + SoD) — roles for Guardian Investigator/Legal
  Reviewer/Authorising Officer, Regulator Suite User, External Provider, Inter-Regulator Recipient
  are **GREENFIELD**; SoD not yet enforceable. **Define in A4, implement later.**
- **Reporting boundary:** product-scoped reporting contracts (IQ / Guardian / Regulator Suite);
  no universal unrestricted query layer. **Define in A4.**
- **Event/projection boundary:** `casino_event_log`, projections, digital twin are **IQ-owned**;
  Guardian and Regulator Suite SHALL NOT depend on IQ casino event tables — they get their own
  event/evidence stores. Shared primitives (envelope/outbox conventions) may be reused via contract.
- **Cross-operator minimisation:** `cross_operator_alerts`, `cross_operator_signal_log`,
  `cross-operator-intelligence`, `identityFederation` remain **off**; target surface =
  privacy-minimised signal → match → permitted **alert**; operators never receive raw competitor
  GGR/deposits/losses/behaviour. Enforcement design = B4.

## 7. Database boundary strategy (recommended combination)
- **Now (A3):** Option A — **logical ownership registry** (this document) + Option C — **governed
  contract facades** for shared capabilities (audit done; evidence/identity next).
- **A4+:** Option B — **new bounded schemas for NEW code only** (Guardian/Regulator Suite +
  extracted Shared services); Option D — selected safe extraction of low-risk shared objects.
- **Not done:** no bulk relocation of the 330 tables; no new cross-context joins; the target is to
  progressively stop uncontrolled cross-context joins via contracts.
