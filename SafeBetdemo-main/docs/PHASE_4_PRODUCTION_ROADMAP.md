# SafeBet IQ — Phase 4 Production Roadmap

**Status: MASTER IMPLEMENTATION PLAN** · Version 1.0 · 2026-07-12
**Governed by:** `SAFEBET_ENTERPRISE_CONSTITUTION.md` (all six constitutions, esp. Constitution 6 — Production Hardening)
**Input:** `architecture-review-certification.md` (APPROVED WITH CONDITIONS, overall 7/10)

---

## 1. Executive Summary

Phase 3 delivered the complete enterprise architecture — one event flow, one runtime model, one intelligence layer, one decision layer, one presentation gateway — live-proven on the demo environment with 115 passing tests. The independent Architecture Review certified it **APPROVED WITH CONDITIONS**: the layering is sound and nothing requires redesign, but the platform is **not production-safe** until tenant isolation, verified authorization, identity entropy, throughput, growth, and observability conditions are met. Phase 4 converts the certified architecture into a production-certifiable platform through five sequenced workstreams (4.1–4.5), each with go/no-go gates. Demo capability is preserved throughout.

## 2. Architecture Review Findings (authoritative list)

| ID | Severity | Finding (evidence in certification §) |
|---|---|---|
| C1 | Critical | No tenant isolation: `using (true)` read policies on `casino_event_log` + projection tables; Realtime inherits (§4.1) |
| C2 | Critical | Gateway authorizes CLAIMED profile/casino/jurisdiction from query params; anon key obtained regulator views live (§4.2–4.3) |
| C3 | Critical | SB-PLR identity is 32-bit → ~50% collision at ~77k players/casino (§5) |
| H1 | High | Out-of-flow producers: `api-ingest` (direct `sessions`/`transactions` writes), `simulate_live_feed`, demo-sync fns (§1) |
| H2 | High | Three parallel risk calculators outside Domain Intelligence: `safeplay-ai-risk-engine`, `bri-risk-score`, `wellbeing-risk-calculator` (§1) |
| H3 | High | No ingestion idempotency; projection apply read-modify-write race under concurrency (§3) |
| H4 | High | No event-log partitioning/retention/archive; per-request twin assembly on the read path (§3, §6, §9) |
| H5 | High | No platform observability: projection lag, ingest failures, rebuild outcomes unalarmed (§9) |
| M1–M7 | Medium | Policy store in code · rebuild ordering tiebreaker · event upcasters · fabricated intervention metadata · per-tab producer bursts · envelope shared-kernel cycle · no E2E/load harness |
| L1–L3 | Low | Twin `stale` state unused · `events_per_min` labeling · dead legacy tables |

## 3. Goals

1. Close every Critical and High condition; close Mediums within their owning workstream.
2. Reach demonstrable throughput of ≥1,000 events/sec sustained on the event path with correct projections.
3. Hard multi-tenant isolation proven by adversarial tests (cross-tenant read attempts fail at the data layer).
4. Identity integrity at ≥10M-player scale (≥64-bit id space) executed while all data is synthetic.
5. Production certification: re-run the Architecture Review checklist and pass with no Critical/High findings.

## 4. Dependencies

- **Sequencing:** 4.1 → 4.2 unlock everything (security identities feed RLS claims). 4.3 depends on 4.2 (identity widening changes event/projection contents → do BEFORE volume features and while data is disposable). 4.4 can largely parallel 4.3. 4.5 is last (certification gates on all prior).
- **External:** Supabase project capabilities (JWT custom claims / auth hooks, partitioned tables, publication config); owner decisions on data retention periods and on scoping H2 (migrate wellbeing/BRI risk into the flow vs. formally out-of-platform); production AWS/Supabase access remains owner-controlled (standing rule: prepare/review only unless explicitly instructed per session).
- **Data:** identity migration (C3) requires disposing/rebuilding synthetic identities + events — trivial now, impossible after real players. This is the hardest deadline in the plan.

## 5. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Identity migration deferred until real data exists | Medium | Severe (regulatory) | 4.2 is gated as a prerequisite for ANY production tenant; ADR required |
| RLS changes break demo dashboards | Medium | Medium | Adversarial + regression suite before deploy; demo soak after each 4.1 step |
| Scope creep from H2 (wellbeing/BRI migration is product work) | High | Medium | Owner decision point at 4.4 start: migrate vs. formally de-scope with documented boundary |
| Throughput work destabilizes proven replay | Low | High | Replay equivalence test (rebuild == live) runs in CI on every 4.3 change |
| Governance fatigue (docs drift from code) | Medium | Medium | Definition of Done §11 enforced per implementation; ADR for any deviation |

## 6. Priority Matrix

| | Urgent | Not urgent |
|---|---|---|
| **Critical path** | C1, C2, C3 | H4 (before volume), H5 (before ops handover) |
| **Important** | H3, H1 | H2 (owner-scoped), M1–M7 |
| **Scheduled** | — | L1–L3, demo excellence |

## 7. Timeline & Implementation Sequence (indicative, effort-relative)

```
4.1 Security & Tenant Isolation      ██████        (≈2 implementation sessions)
4.2 Identity Integrity & Auth        ████████      (≈2–3 sessions; breaking migration + ADR)
4.3 Performance & Scalability        ██████████    (≈3–4 sessions)
4.4 Policy Externalisation & Ops     ████████      (≈3 sessions; H2 scope owner-dependent)
4.5 Demo Excellence & Certification  ████          (≈1–2 sessions)
Gates:            G1 ────────── G2 ─────────── G3 ─────────── G4 ────────── G5/Go-Live
```

Strict order: **4.1 → 4.2 → 4.3 → 4.4 → 4.5.** No skipping; each gate blocks the next workstream.

---

## 8. Workstreams

### Phase 4.1 — Enterprise Security & Multi-Tenant Isolation
- **Objectives:** every read path tenant-scoped; every request authorized from verified identity, not claims. Closes **C1, C2**.
- **Scope:** casino/tenant claims in JWTs (auth hook or claims table); RLS rewritten from `using (true)` to casino-scoped on `casino_event_log`, `projection_*` tables (views inherit); Realtime channel authorization verified under new RLS; `consumer-gateway` derives profile from the verified JWT role, casino scope from the user's casino, jurisdiction from a casino registry column — query parameters demoted to (validated) view selection only; `digital-twin` fn locked to admin/ops.
- **Dependencies:** none (first).
- **Deliverables:** claims migration + RLS migrations; gateway auth rewrite; casino registry `jurisdiction` column; adversarial test suite (cross-tenant reads, claimed-profile escalation, foreign-casino Realtime subscription — all must fail).
- **Validation / Completion:** all adversarial tests fail-closed live on demo; existing dashboards still function per casino; full suite + build green.
- **Risk:** Medium (RLS/Realtime interplay). **Effort:** ~2 sessions. **Success metrics:** 0 cross-tenant rows readable; 0 endpoints trusting request-claimed identity.

### Phase 4.2 — Identity Integrity & Authentication
- **Objectives:** collision-safe identity at target scale; authenticated producer surface. Closes **C3** (+ producer auth from H1's edge).
- **Scope:** ADR-001 (breaking change, §9 Constitution): widen SB-PLR to ≥64 bits (16 hex) via new provider `sha256-v2`; regenerate synthetic identity map; dispose + replay events/projections under new ids (or reseed — data is synthetic); update pinned test vectors, id regex constraints, and formats; producer authentication (simulator/API producers use scoped credentials, not anon).
- **Dependencies:** 4.1 (claims infrastructure).
- **Deliverables:** ADR-001; provider v2 + config switch; migration + rebuild evidence; updated tests (identity suite currently pins 8-hex vectors).
- **Validation / Completion:** collision headroom documented (birthday bound at 10M players); replay produces consistent state under v2 ids; suite green.
- **Risk:** Medium (breaking, but synthetic data). **Effort:** ~2–3 sessions. **Success metrics:** id space ≥2⁶⁴; zero 8-hex ids remain in demo data.

### Phase 4.3 — Performance & Scalability
- **Objectives:** correct under concurrency; ≥1,000 ev/s sustained; bounded growth. Closes **H3, H4**, M2, M3 (+ read-path caching).
- **Scope:** producer idempotency keys with store-level dedupe; batch identity resolution (eliminate per-event RPC loop in enrichment); optimistic concurrency (row version) or per-casino serialization on projection apply; event-log partitioning (by casino/time) + retention/archive policy; rebuild ordering tiebreaker `(occurred_at, event_id)`; event upcaster registry scaffold (`schemaVersion` honored on replay); read-path: persistent/cached twin tier or gateway response cache with staleness bounds; load-test harness (M7 partial).
- **Dependencies:** 4.2 (do volume work after identity widening).
- **Deliverables:** migrations (idempotency, partitioning); platform changes with replay-equivalence tests; load-test results at 100/1,000 ev/s with projection-consistency verification.
- **Validation / Completion:** duplicate-retry test inserts once; concurrent-batch test loses no updates; 1,000 ev/s sustained with lag alarmed under threshold; rebuild == live state at volume.
- **Risk:** High (touches the proven core). **Effort:** ~3–4 sessions. **Success metrics:** measured ev/s; zero lost updates under concurrency test; partition + retention policies active.

### Phase 4.4 — Policy Externalisation & Operational Hardening
- **Objectives:** policy as governed data; one flow product-wide; operable platform. Closes **M1, H1, H2 (per owner scoping), H5**, M5, M6, M7 (remainder).
- **Scope:** DB-backed versioned policy store (audited changes, per-tenant/jurisdiction sets) with `configure()` loading from it; retire/convert out-of-flow producers (`api-ingest` → Event Platform producer with idempotency + auth; `simulate_live_feed` and demo-sync fns retired or converted); **owner decision:** fold `safeplay-ai-risk-engine`/`bri-risk-score`/`wellbeing-risk-calculator` into Domain Intelligence stages or formally de-scope those products outside the certified platform (documented boundary either way); observability (projection-lag metric + alert, ingest-failure alert, rebuild audit log, runbooks); server-side producer scheduling (cron) replacing per-browser bursts; shared kernel extraction (envelope type + table name) breaking the eventPlatform⇄projectionPlatform module cycle; E2E test harness for edge functions.
- **Dependencies:** 4.1 (auth for producers), 4.3 (idempotent ingestion for converted producers).
- **Deliverables:** policy store schema + admin path; producer conversions/retirements with evidence; monitoring + runbooks; E2E suite.
- **Validation / Completion:** a policy threshold change happens with zero deploy; repo sweep shows no direct store writes outside the Event/Projection platforms (or documented de-scope boundary); alarms fire in a forced-failure drill.
- **Risk:** Medium (H2 scope is the variable). **Effort:** ~3 sessions + owner decision. **Success metrics:** 0 out-of-flow producers in certified scope; policy change lead time = minutes; MTTD for projection stall < alarm threshold.

### Phase 4.5 — Demonstration Excellence & Production Certification
- **Objectives:** regulator-grade evidence integrity; a demo that sells; final certification. Closes **M4, L1–L3** + gates.
- **Scope:** Evidence Integrity sweep (Constitution §8): intervention views present recorded facts only, demo data tagged end-to-end, evidence classification surfaced in regulator views; demo polish (bet-rich seed bursts, live ZA↔BW jurisdiction switch script, live rebuild-reconstructs-twin showpiece, GGR non-zero on fresh casinos); wire twin `stale` state; correct `events_per_min` labeling; drop dead legacy tables after soak; **re-run the full Architecture Review checklist** and produce the certification addendum.
- **Dependencies:** all prior workstreams.
- **Deliverables:** evidence-classification changes; demo script + seeded scenario; final certification report with re-scored scorecard.
- **Validation / Completion:** review re-run yields no Critical/High findings; demo dry-run executed end-to-end.
- **Risk:** Low. **Effort:** ~1–2 sessions. **Success metrics:** Security score ≥8; Overall ≥8.5; zero fabricated evidence fields.

---

## 9. Go / No-Go Gates

- **G1 (exit 4.1):** adversarial isolation suite passes fail-closed; no request-claimed identity anywhere. *No-go = stop all workstreams.*
- **G2 (exit 4.2):** ADR-001 accepted; v2 identities live on demo; replay consistent. *Hard gate for any production tenant — non-negotiable.*
- **G3 (exit 4.3):** 1,000 ev/s sustained; concurrency + idempotency tests green; partitioning active.
- **G4 (exit 4.4):** zero out-of-flow producers in certified scope; policy store live; alarms drilled.
- **G5 (exit 4.5 / Go-Live):** certification re-run — no Critical/High; owner sign-off; production deployment remains owner-executed per standing constraints.

## 10. Rollback Principles

Events are truth: any projection/read-side change rolls back by disposal + rebuild — never by data surgery. Schema changes ship additive-first (new columns/tables before switching readers); destructive cleanup only after soak. Identity v2 is forward-only once real players exist — hence G2's placement. Every migration lands with its reversal noted or its irreversibility declared in the ADR. Demo environment is the blast radius; production changes are owner-executed with prepared artifacts.

## 11. Validation & Testing Strategy

- **Per-change (Definition of Done §11):** full unit suite (`node --test`), `tsc`, `next build`, live demo verification with captured evidence.
- **New in Phase 4:** adversarial security suite (4.1), replay-equivalence tests in every 4.3 change, load harness (100/1,000 ev/s) with projection-consistency assertions, E2E edge-function suite (4.4), forced-failure observability drills (4.4), evidence-classification audit (4.5).
- **Regression floor:** the Phase 3 suite (115 tests) may never regress; constitution-guarantee tests (purity, single-instance, untouched-twin, decisions-only) are permanent.

## 12. Readiness Definitions

- **Operational:** dashboards + alarms for projection lag, ingest failure, rebuild outcomes; runbooks for rebuild, policy change, producer onboarding, incident triage; server-side scheduling; on-call handover pack. (Achieved in 4.4.)
- **Security:** G1+G2 passed; secrets management reviewed; producer credentials scoped; pen-style adversarial suite in CI. (4.1–4.2.)
- **Regulator:** immutable log + replay demonstrable on request; evidence classification visible; jurisdiction packs configurable via the policy store; audit trail for policy changes; anonymous-by-design confirmed. (4.4–4.5.)
- **Casino Operator:** live floor, wellbeing, machine performance and executive views under tenant isolation; per-operator policy sets; onboarding = configuration (registry row + jurisdiction + policy set + producer credentials), zero code. (4.1+4.4.)

---

*This roadmap is the master plan. Deviations require an ADR. Each workstream begins by re-reading the Constitution and ends against the Definition of Done.*
