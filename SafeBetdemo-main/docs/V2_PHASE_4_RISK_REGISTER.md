# Version 2.0 — Phase 4 Risk Register

**Phase 4.0 · PLANNING ONLY · 2026-07-16.** Likelihood/Impact: L/M/H. Owner roles are placeholders.

| # | Risk | Likelihood | Impact | Existing controls | Required controls | Owner | Detection | Response | Residual | Pilot consequence |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Live connector failure | M | M | sandbox connector, health checks (planned) | connector monitoring, ret/dead-letter | Ops | health alarm | suspend connector, failover | L | degraded ingestion; pause pilot |
| 2 | Incorrect tenant context | L | H | tenant attribution, RLS (planned) | RLS negatives, per-connector tenant binding | Security | isolation tests, audit | block connector, isolation incident | L | STOP pilot on breach |
| 3 | Hash normalisation mismatch | M | M | `normaliseAttribute` canonicalisation | connector-side normalisation conformance tests | Eng | reconciliation gaps | fix normalisation, re-contribute | L | missed/incorrect links |
| 4 | Pepper compromise | L | H | injected pepper, jurisdiction isolation | HSM/Secrets Manager, least privilege, rotation | Security | access audit, anomaly | emergency disablement, rotate | L–M | suspend jurisdiction |
| 5 | Pepper rotation failure | L | H | versioned `pepperKeyVersion` | dual-pepper transition, recovery drill (C4) | Security | rotation drill | roll back to prior version | L | suspend contribution |
| 6 | Duplicate contribution | M | M | idempotency (planned), registry idempotent create | replay/duplicate protection (C1/4.3) | Eng | dedup metrics | drop duplicate, alert | L | inflated counts |
| 7 | Replay attack | L | M | contribution audit | nonce/timestamp/replay window | Security | replay detection | reject, alert | L | integrity concern |
| 8 | False identity correlation | L | H | deterministic matching, false-positive protection, manual review | precision review, reviewer workflow | Regulator | false-positive rate | split (governed), reject | L | regulator trust |
| 9 | Missed identity correlation | M | M | multi-evidence matching | attribute coverage review | Regulator | precision review | tune jurisdiction profile (data) | M | under-correlation |
| 10 | Registry corruption | L | H | integrity verifier, immutable records | durable store + integrity checks (C2/C6) | Eng | integrity verifier | restore from backup | L | STOP pilot |
| 11 | Audit persistence failure | L | H | append-only sinks | durable append-only store (C3) | Eng | audit health | halt writes, alert | L | STOP pilot (no audit) |
| 12 | Cross-jurisdiction leakage | L | H | sovereign exclusion, deny-by-default | sovereign store separation, negatives | Security | isolation tests | block, incident | L | STOP pilot on breach |
| 13 | Operator exposure to SB-NAT | L | H | operators write-only, no lookup | deployed access-control regression (C8) | Security | access-control tests | revoke access | L | STOP pilot on breach |
| 14 | Operator-runtime regression | L | H | additive, isolated, import-boundary | deployed regression (C8) | Eng | deployed regression | rollback | L | pilot blocked |
| 15 | Event rejection | M | M | Event Platform validation | rejected-event visibility (C1) | Eng | rejection metrics | investigate source | L | reconciliation gaps |
| 16 | GGR reconciliation discrepancy | M | M | reconciliation harness (planned) | live reconciliation (C1/4.5) | Eng | reconciliation report | investigate, no direct-insert | M | pilot data credibility |
| 17 | Monitoring failure | L | M | — | CloudWatch metrics/alarms (C9) | Ops | heartbeat | restore monitoring | L | blind operations |
| 18 | Backup failure | L | H | — | backup schedule (C6) | Ops | backup verification | fix backup, re-run | L | unrecoverable |
| 19 | Restore failure | L | H | — | restore drill + post-restore integrity (C6) | Ops | restore drill | fix restore path | L | STOP pilot |
| 20 | Legal approval delay | M | M | PIA v2 | DPA/lawful-basis/authorisation (C7) | Legal | schedule tracking | synthetic-only fallback | M | no real-data pilot |
| 21 | Regulator acceptance delay | M | M | demonstration acceptance | pilot regulator acceptance (C7/G7) | Regulator | acceptance tracking | extend supervised demo | M | pilot slip |
| 22 | Pilot-support capacity | M | M | — | support model, hours, escalation (C9) | Ops | ticket SLAs | scale support | M | degraded pilot |
| 23 | CERT-L1 runtime encapsulation risk | L | L | TS private, service-boundary controls, approval-gated create | runtime-private state (C10) | Eng | adversarial injection test | apply encapsulation | **RESOLVED** | **CLOSED in Milestone 4.1** (module-closure encapsulation; 7 adversarial runtime tests pass) |

## Milestone 4.1 update (2026-07-16)
- **Risk #23 (CERT-L1): RESOLVED** — C10 CLOSED via module-closure runtime encapsulation; residual removed at the current build target.
- **Risks #2, #10, #11, #12 (tenant/registry/audit/cross-jurisdiction):** compensating controls added — durable persistence, application-enforced deny-by-default RLS (tested matrix), SHA-256-chained append-only audit with tamper detection, and reconstruction/integrity verification. Residual for #10/#11 lowered; native RDS RLS + WORM audit remain deployment bindings (C2/C3).
- **Risks #18, #19 (backup/restore):** backup foundation + post-restore integrity implemented and tested; full operational drill (RPO/RTO) remains at Phase 4.7.
- New residuals recorded: C2 (native Postgres RLS on managed RDS) and C3 (DB-permission WORM immutability) remain **OPEN** deployment bindings.

## Milestone 4.2 update (2026-07-16)
- **Risks #4, #5 (pepper compromise / rotation failure):** compensating controls added — jurisdiction-isolated peppers, governed lifecycle + dual-version rotation with versioned continuity, controlled compromise workflow (material destroyed, jurisdiction disabled, approved reactivation), fail-closed behaviour, least-privilege roles, secret-free audit. Residual lowered; managed HSM/Secrets Manager binding + KMS at-rest remain **OPEN (C4)**.
- **Risk #3 (hash normalisation mismatch):** mitigated by the versioned collision-safe canonical input (`cf-1`, length-prefixed, NFC) + versioned normalisation; cross-operator normalisation conformance still verified in 4.3/4.4.
- **New finding CRYPTO-F1 (fixed in-milestone):** a TS-`private` `store.raw()` method was runtime-reachable and returned the raw pepper map (secret-leak class, same as CERT-L1) → corrected to a non-exported module accessor; `store.raw` no longer exists at runtime (tested). No residual.
- **C4 status:** PARTIALLY CLOSED — provider/rotation/recovery/compromise/fail-closed implemented + tested; managed secret-store binding OPEN. C2/C3 unchanged.

## Milestone 4.3 update (2026-07-16)
- **Risks #2, #6, #7, #13, #14 (tenant context / duplicate / replay / operator SB-NAT exposure / operator-runtime regression):** compensating controls added — authenticated-context attribution (not payload-inferred), content-key idempotency, replay/duplicate protection (cross-operator evidence preserved), deny-by-default access (operators denied submit + federation reads), Event-Platform-authoritative flow with **no downstream insertion bypass**, hash-only boundary with runtime PII rejection. Residuals lowered.
- **Risk #3 (hash normalisation mismatch):** further mitigated — the contribution boundary validates crypto versions (algorithm/canonical-format/normalisation/pepper) and segregates incompatible versions (different digest → no cross-match).
- **Risk #15 (event rejection) / #16 (GGR reconciliation):** rejected-event visibility + safe rejection records implemented; **live wager/GGR reconciliation remains OPEN (C1/4.5)**.
- **New residuals:** live operator connector (4.4), live Event Platform transport + wager/GGR reconciliation (4.5), managed durable persistence/RLS (C2/C3) — all OPEN.
- **C1 status:** PARTIALLY CLOSED (contribution & Event-Platform wiring done + tested end-to-end; live connector + live reconciliation OPEN). C2/C3/C4 unchanged; C10 CLOSED.

## Milestone 4.4 update (2026-07-16)
- **Risks #1, #2, #13 (connector failure / incorrect tenant context / operator SB-NAT exposure):** compensating controls added — one operator/tenant/jurisdiction auth binding (no tenant switch), cross-tenant SB-PLR rejection, connector **write-only w.r.t. federation** (no Registry/Correlation/Policy handle → cannot read SB-NAT/decisions/policy), governed suspension/revocation, circuit-breaker backpressure, bounded idempotent retries, reconciliation with no silent loss. Residuals lowered.
- **Risks #3, #6, #7 (normalisation mismatch / duplicate / replay):** connector uses deterministic event ids + hash-before-boundary + Event Platform idempotency/replay → no duplicate evidence across restart.
- **Risk #18/#19 (backup/restore) analogue:** connector checkpoint survives restart (in-memory pilot; durable store = C2 binding).
- **C5 status:** PARTIALLY CLOSED — connector implemented + integration-tested vs a controlled in-process sandbox (hash-only ingestion + isolation negatives pass); **external-vendor + deployed-runtime evidence OPEN**. C1/C2/C3/C4 unchanged; C10 CLOSED.

## Milestone 4.5 update (2026-07-16)
- **Risks #15, #16 (event rejection / GGR reconciliation discrepancy):** compensating controls added — authoritative financial Event Platform with rejected-event visibility, derived-by-replay projection (no direct total insertion), **integer-minor-unit money (no float)**, idempotency/replay (no double financial effect), and a **4-level reconciliation + integrity verifier** (all balanced; no unexplained difference). The earlier zero-GGR / unresolvable-session issue is directly addressed by session integrity + rejection. Residual lowered.
- **Risk #2/#13 (tenant context / competitor exposure):** operator reads scoped to own tenant; national aggregate regulator-only; cross-tenant submission/session/SB-PLR rejected.
- **New residuals:** external-operator sandbox, deployed-runtime Event/Projection Platform, production-live reconciliation, multi-currency conversion, bonus/promotional treatment — all OPEN.
- **C1 status:** PARTIALLY CLOSED — sandbox/pilot-path wager/GGR + operator↔national reconciliation proven + tested; **live/deployed/external reconciliation OPEN**. C2/C3/C4/C5 unchanged; C10 CLOSED.

## Residual-risk posture
With the required controls implemented per C1–C10, all High-impact risks reduce to Low residual
except #9, #16, #20, #21, #22 (Medium — precision tuning, reconciliation credibility, and
schedule/capacity). No risk is accepted at High residual for pilot go. #23 (CERT-L1) is the only
knowingly-accepted Low residual if C10 is deferred, mitigated by service-boundary controls and the
approval-gated creation path (no public mint).

## Addendum — Phase 4.6 (Deployed Runtime & Consumer Platform Regression · 2026-07-16)
In-process composition milestone; no deployment authorised. Risk-register movement:
- **#13 (Operator exposure to SB-NAT)** — *further mitigated*: the import boundary now proves Version 2.0 is
  imported by **no** operator/app/edge path (0 offenders), and the deployed-runtime access-control regression
  denies operators the SB-NAT twin / national correlation / national GGR. Residual **L**. **Open control:**
  deployed API-level negative tests (C8) — still required.
- **#14 (Operator-runtime regression)** — *partially mitigated*: **428/428** library regression green + import
  boundary → architectural non-impact. Residual **L**. **Open control:** deployed application regression with
  V2 present (**C8 residual**) — NOT yet executed; risk remains until deployed evidence exists.
- **New risk #24 — "Environment misclassification / premature deployment claim."** L / H. Control: every
  health/version output carries the `in-process-composition` label; docs state no real deployment occurred.
  Detection: certification review. Response: reject any status closure lacking deployed evidence. Residual **L**.
- **Condition status confirmed:** C8 **PARTIALLY CLOSED**; C1 & C5 **no new deployed evidence** (remain
  PARTIALLY CLOSED); C2/C3/C4 PARTIALLY CLOSED unchanged; C10 CLOSED. No High-residual risk accepted for
  deployed scope — the deployed-app regression is the gating open control.

## Addendum — Phase 4.6B (Actual Non-Production Deployment · 2026-07-16)
Corrective gate; a genuine **local independent-process** deployment ran, but managed cloud deployment did not.
- **#14 (Operator-runtime regression)** — *further mitigated*: deployed HTTP smoke on a real independent
  process served **43/43** routes with **0 × 5xx**, **0** leakage, **0** federation surface; no regression.
  Residual **L**. **Open control:** managed cloud deployment + deployed **server-side** auth/isolation (C8).
- **#13 (Operator exposure to SB-NAT)** — *further mitigated*: verified on the live server that all federation
  routes return **404** (no HTTP surface) and no response leaks SB-NAT/national data. Residual **L**. Open:
  deployed server-side per-route negatives (client-side gating in this build).
- **New risk #25 — "Deployment-evidence gap misread as closure."** L / H. Control: 4.6B outcome line and all
  docs state managed deployment was NOT executed and C8 is not closed; environment labelled
  `local-independent-process`. Detection: certification review. Response: block C8 closure and Phase 4.7 until
  a managed deployment + server-side isolation suite pass. Residual **L**.
- **New risk #26 — "No valid AWS session / managed infra unavailable."** M (environmental) / M. Effect: C2/C3/
  C4 managed-infra evidence and CloudWatch monitoring unobtainable here. Control: keep those conditions
  PARTIALLY CLOSED; schedule as owner-executed managed-deployment activity. Residual **M** (schedule/capacity).
- **Confirmed:** C8 PARTIALLY CLOSED; C1/C5 no new deployed evidence; C2/C3/C4 unchanged; C10 CLOSED. Phase 4.6
  remains partially complete.
