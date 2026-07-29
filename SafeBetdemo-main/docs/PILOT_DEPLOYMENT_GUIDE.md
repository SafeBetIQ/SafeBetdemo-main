# SafeBet IQ — Pilot Deployment Guide (v1.3)

A repeatable process for running a casino operator pilot on the certified SafeBet IQ platform. The Pilot Deployment Centre is a **consumer** of the platform (commercial metadata + certified health) — it introduces no architecture and no runtime state.

Command centre: `/admin/customer-success` → **Pilots** tab.

---

## Pilot lifecycle
`planned → in-progress → ready → live` (with `rolled-back` as the recovery state).

## Pilot checklist (readiness = % complete)
| # | Item | Category | How to satisfy |
|---|---|---|---|
| 1 | Operator onboarded | setup | Onboarding Centre 100% + production activated |
| 2 | Connector certified | setup | `docs/CASINO_INTEGRATION_CERTIFICATION.md` acceptance tests pass |
| 3 | Events flowing end-to-end | validation | `connector-ingest` batch appears in `casino_event_log`; live floor updates |
| 4 | Dashboards verified | validation | operator confirms casino/executive views render from the gateway |
| 5 | Customer acceptance testing signed off | acceptance | operator UAT sign-off recorded |
| 6 | Monitoring & alerting enabled | operations | `platform-ops?action=monitor` green; alert thresholds reviewed |
| 7 | Rollback rehearsed | operations | projection rebuild + policy rollback rehearsed (`OPERATIONS_MANUAL.md`) |
| 8 | Go-live approved | go-live | platform owner sign-off |

**Go-live is recommended only when all eight items are complete** and the pilot is not rolled back.

## Running a pilot
1. **Create/confirm the pilot** — a `pilot_deployments` record exists for the casino (seeded as `planned`).
2. **Onboard the operator** — via the Onboarding Centre (`/casino/onboarding`); mark step 1 complete.
3. **Certify the connector** — run the self-certification acceptance tests; mark step 2.
4. **Validate end-to-end** — send events via `connector-ingest`, confirm dashboards; mark steps 3–4.
5. **UAT** — operator signs off; mark step 5.
6. **Operational readiness** — enable monitoring, rehearse rollback; mark steps 6–7.
7. **Go-live approval** — platform owner approves; mark step 8; set pilot status `live`.
   `POST /commerce?action=pilot-status { casino_id, status: "live" }` records the go-live timestamp.

Update checklist items (operator or admin): `POST /commerce?action=pilot-item { casino_id, item, done }`.
Change pilot status (admin): `POST /commerce?action=pilot-status { casino_id, status }`.

## Customer acceptance testing (CAT)
The operator confirms, against the demonstration or their staging environment:
- Their events enter the certified flow with **anonymous identity** and no raw-reference leakage.
- Live floor, wellbeing, executive, and (if entitled) regulator views render from the gateway.
- Data-quality diagnostics surface bad records with actionable hints.
- Isolation holds (cross-casino requests refused).

## Rollback readiness
Events are the source of truth; recovery never involves data surgery:
- **Projection issues** → `projection-platform?action=rebuild` (deterministic; re-attach archived partitions first for a full-history rebuild — `OPERATIONS_MANUAL.md` §5).
- **Policy issues** → `platform-ops?action=policy-activate&version=<last-good>` (minutes, audited).
- **Release issues** → redeploy the prior app/function bundle (`DEPLOYMENT_RUNBOOK.md` §9–10).
Mark **Rollback rehearsed** only after a successful dry run.

## Go-live readiness & recommendation
The Pilots tab shows each operator's readiness %; the platform recommends go-live when the checklist is complete. Record the go-live and monitor via the Customer Success command centre and `platform-ops?action=monitor`.

## Pilot success metrics
- Onboarding completion %, connector submitted/rejected/failed counts, projection lag, licence status, and readiness score — all visible in the command centre, all composed from certified platform data.
