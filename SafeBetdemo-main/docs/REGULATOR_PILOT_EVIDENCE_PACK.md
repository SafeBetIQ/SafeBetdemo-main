# SafeBet IQ — Regulator Pilot-Readiness Evidence Pack

**Environment: SafeBet Demo (non-production evaluation) · Supabase `uexdjngogzunjxkpxwll`.**
**This document does NOT assert production readiness, regulator approval, or full legal compliance.**
Status legend per item: **Implemented / Deployed / Verified / Demonstrated / Planned / Deferred / Unsupported**.

---

## 1. Executive overview
SafeBet IQ is a responsible-gambling compliance platform. Its **operator dashboard, evidence API, and tamper-evident audit chain** are implemented and **verified on the SafeBet Demo (non-production) environment** against synthetic and lightly-seeded data. Five operational reconciliations and a per-tenant SHA-256 audit chain are green and independently verifiable. **It is suitable for a controlled, non-production regulator *evaluation* — not a production pilot handling real player/financial data**, which requires the deployment, integration, and legal controls listed in §29/§25.

## 2–3. Platform scope & current product status
Certified operator dashboard (risk/session/player/machine posture, period GGR), evidence gateway (4 domains), and audit assurance (chains, verification, checkpoints, alerts) are **Deployed+Verified on Demo**. Real casino connectors, complete financial-event lifecycle, machine telemetry, managed cloud deployment, backup/DR, and external audit anchoring are **not present** (Planned/Deferred/Unsupported).

## 4. Architecture diagrams (text)
**Certified operational flow:** casino/simulator → event ingestion (`casino_event_log`, append-only) → identity resolution (SB-PLR) → certified projections → Digital Twin → Consumer Platform (`consumer-gateway`) → dashboard/evidence views. *Verified on Demo.*
**Audit-governance flow:** trusted writer → atomic chained insert (advisory lock + FOR UPDATE) → per-casino chain head → scheduled independent verification (`pg_cron`) → verification checkpoint → Platform Health/Audit Centre → regulator verification view. *Verified/Demonstrated on Demo.*
**Financial posture flow:** financial events → source-capability profile → period projection (`projection_financial_posture`) → reconciliation → Consumer Platform → dashboard → financial evidence endpoint. *Verified on Demo (Partial capability — combined BET_PLACED only).*
**Security scope flow:** verified JWT → role+casino resolution → server-side scope → RLS / security_invoker views → narrow-only evidence filters → authorised results. *Verified on Demo.*

## 5. Environment inventory (truth statement — Phase 12)
| Environment | Exists | Hosting | Data | Production? | Notes |
|---|---|---|---|---|---|
| Local development | Yes | dev machine | synthetic | No | Next.js build/test |
| **SafeBet Demo (Supabase)** | **Yes** | Supabase `uexdjngogzunjxkpxwll` (us-west-2) | synthetic + lightly seeded | **No** | The authorised evaluation backend; all verification here |
| Local independent HTTP process | Yes (session) | `localhost:3000` (`next start`) | Demo Supabase | No | A real independent process — **not** managed cloud |
| AWS production (RDS/Elastic Beanstalk) | Referenced in config only | AWS | — | — | **Not deployed / not touched**; invalid AWS session |
| Production Supabase `ilibvipqbkugqkppzdmh` | Exists | Supabase | — | Yes | **Never touched in any milestone** |

**No local process is a managed cloud deployment. SafeBet Demo is not production. No AWS change was applied.**

## 6. Identity & access model
JWT-derived identity (`verifyPrincipal`): role + casino/jurisdiction from the server-side `users` registry keyed by the verified `auth.uid()` — never a client claim. Operators pinned to one casino; regulators to a jurisdiction; super-admin separate. Query parameters may narrow scope, never expand it. *Verified on Demo (403 on cross-casino, 401 unauthenticated).*

## 7. Tenant-isolation evidence
Certified views run `security_invoker=true` with scope-aware RLS; evidence gateway + chain verifier reject cross-casino/platform access (403 / `unavailable`); cross-casino chain-head read returns `[]`. *Verified live.*

## 8–10. Certified data flow, metric definitions, reconciliations
Five reconciliations verified live: **player-risk** (active = Σ risk bands incl. Unclassified), **session posture** (active+idle+stale = open), **player posture** (active-now+idle+stale = observed), **machine posture** (in-play+stale = allocated), **financial GGR** (GGR = stakes − winnings). Metric definitions are the certified projections; the dashboard only reads/validates.

## 11–14. Evidence API, export security, financial + synthetic disclosure
Four JWT-scoped evidence endpoints (financial/session/player/machine), pagination (aggregates over full set), CSV export (formula-injection-safe, row-limited, audited, chain-referenced). Financial source-capability profile → status **Partial** (voids/reversals unobservable → null, not zero); synthetic vs live disclosed (`dataMode`). *Verified on Demo.*

## 15–18. Audit-chain architecture, verification, scheduled, broken-chain
Per-casino + platform SHA-256 chains; atomic insertion; append-only; SQL+TS **byte-identical** verification; checkpoints distinct from heads; **`pg_cron` incremental (*/15) + full (daily), observed running**; independent `platform_integrity_alert`. **Broken-chain demonstrated (isolated fixture): valid→verified, tamper→broken@first-failing-sequence, checkpoint not advanced, alert would fire, no auto-repair.** *Verified/Demonstrated on Demo.*

## 19. Platform Health evidence
`projection_audit_verification_health` computes genuine per-chain status (Healthy requires a completed verification at the current head within policy; else Warning/Degraded/Unavailable/Broken). 7 chains Healthy. **Internal checkpoints: Active · External anchoring: Not configured.** *Deployed+Verified (dedicated Platform-Health UI widget: Deferred — data/view exist).*

## 20. Role & access matrix (server-enforced)
| Capability | Super Admin | Casino/Operator | National Regulator | Prohibited for |
|---|---|---|---|---|
| Operator Dashboard | ✓ | ✓ (own casino) | via regulator views | anon |
| Evidence API (fin/session/player/machine) | ✓ | ✓ (own casino, narrow-only) | jurisdiction | cross-casino (403) |
| Evidence CSV export | ✓ | ✓ (own, audited) | jurisdiction | cross-casino |
| Audit chain head / verification | ✓ (all) | own casino only | jurisdiction casinos | cross-casino ([]/unavailable) |
| Platform chain | ✓ | ✗ (unavailable) | ✗ (not exposed) | operators/regulators |
| Config policies (capability/shift/lifecycle) | ✓ (service/definer) | ✗ | ✗ | authenticated writes |
| audit_events update/delete | ✗ (append-only) | ✗ (revoked → 403) | ✗ | everyone (append-only) |
*Verified via direct DB/RPC/API calls, not menu visibility.*

## 21. Privacy & data classification
Evidence/audit records use **resolved SB-PLR ids** (no raw PII); no auth tokens/secrets in events, exports, or hash metadata; financial evidence role-restricted; audit metadata holds references not full payloads; synthetic records flagged; regulator exports jurisdiction-scoped. **Classification:** SB-PLR/risk-band = Internal; financial aggregates = Confidential (role-gated); chain hashes = Public-safe (no secrets); platform chain = Restricted. **Gap:** a formal field-by-field DPIA and data-retention policy are **Deferred**.

## 22. Test results
Full regression **484/484**; audit-chain suite **10/10**; SQL↔TS parity proven; tsc clean; build clean; five reconciliations green; broken-chain + concurrency demonstrated live.

## 23. Deployment evidence
All migrations applied to Demo only; `evidence-gateway`/`consumer-gateway` deployed; `pg_cron` scheduled run observed; concurrency stress (60 parallel writers → contiguous unique sequences, verified) run in isolation and cleaned up. Production untouched.

## 24. Known limitations
See §29 production gaps + the per-milestone deferrals (machine telemetry states; complete financial lifecycle/void/reversal/bonus; external anchoring; managed cloud deployment; backup/DR; monitoring/alert routing; pen test; DPIA/retention; real connector).

## 25–26. Pilot risks & controls
**Risks:** synthetic/seeded data ≠ real behaviour; Partial financial capability; no managed HA/backup; no external anchoring; free-tier Demo backend can pause. **Controls:** non-production isolation; synthetic disclosure; append-only + independent verification; scope-aware access; honest status surfaces.

## 27–28. Pilot entry & exit criteria — see `PILOT_READINESS_SCORECARD.md` §Entry/§Exit.

## 29. Production gaps (must precede a real-data production pilot)
Managed non-production/production cloud deployment; backup + restore proof; DR procedures; monitoring/alert routing; incident response; real casino connector; complete financial event lifecycle; machine telemetry; external audit-checkpoint anchoring; load testing; support model; data-processing agreements; jurisdiction legal requirements; data-retention policy; penetration test; vuln management; key/secret rotation; change management; production release process.

## 30. Formal readiness recommendation
**Proceed with conditions — to a controlled, NON-PRODUCTION, SYNTHETIC-DATA regulator EVALUATION only.** SafeBet IQ's certified dashboard, evidence API, and tamper-evident audit chain are implemented and verified on the Demo environment and are suitable for demonstrating integrity, reconciliation, and oversight to a regulator using synthetic data. **It is NOT ready for a production or real-data pilot**: the operational, deployment, integration, and legal requirements in §29 are outstanding and several are hard blockers (see scorecard). No production environment was touched; no demo capability is represented as production.

## 31. Production-scale synthetic demonstration (2026-07-31)
A production-scale synthetic six-casino dataset was generated additively through the certified event-log → projection pipeline (three gated stages; every hard gate green).

**Population scale:** 101,898 registered synthetic players · 9,637 active-now · 22,318 daily-active · 10,044 open sessions · 236,322 certified synthetic events · six casinos (Hollywoodbets 28,064 · Betway 22,035 · Prestige 18,152 · SunBet 14,567 · Gold Rush 10,546 · Royal Palace 8,534). Five reconciliations green for all six casinos; seven audit chains verified; six-tenant isolation (each account reaches only its casino, cross-tenant 0); regulator aggregate = sum of the six casinos; ZAR / Africa-Johannesburg; financial status Partial; synthetic disclosed; voids/reversals unavailable (null).

**Population scale ≠ throughput.** Throughput was validated separately with temporary, producer-tagged, cleaned-up test evidence: ~5,860 certified events/sec sustained (single connection), audit-chain insert ~61 ms, projection lag synchronous, evidence API ~0.3 s, operator dashboard ~0.7–1.0 s, regulator aggregate ~4.3 s @ 101k, DB connections 8 stable, error rate 0%, recovery to baseline immediate. The 236,322-event dataset is NOT a claim of production transaction throughput.

**Machines vs endpoints.** The "machines" metric spans physical gaming machines AND online/simulated endpoints; the dashboard label reads "Gaming machines & endpoints".

Supported claim: *SafeBet IQ demonstrates certified monitoring, evidence and audit workflows against a production-scale synthetic six-casino dataset in a managed non-production environment.* Not production-ready, not real casino traffic, not regulator-approved.
