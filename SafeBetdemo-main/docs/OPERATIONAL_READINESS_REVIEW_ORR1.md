# SafeBet IQ — Operational Readiness Review (ORR-1)

**Independent Enterprise Operations Review Board · 2026-07-16**
**Objective:** determine whether SafeBet IQ can be deployed, monitored, backed up, restored, upgraded, secured and supported as a production SaaS platform. Operations focus only — functionality is already certified (CPR-1/UDC-1/UXE-1/v1.5.2) and was not re-audited. This is an assessment; no application code was changed.

---

## 0. Final Operational Certification

# ✅ READY WITH MINOR OPERATIONAL IMPROVEMENTS

SafeBet IQ is **operable today for a controlled commercial pilot**. The recovery model is architecturally superior (event-sourced: every downstream artifact is disposable and deterministically rebuildable from the immutable log), the security posture is strong (full header suite + CSP, Secrets Manager, tenant RLS, verified-JWT), and the operations documentation (Deployment Runbook + Operations Manual) is genuinely production-grade with DR, RTO/RPO, rollback and daily/weekly/monthly checklists. The gaps are **automation and a few production-config specifics** — not architecture: no CI/CD pipeline, three competing deploy targets, a CSP hardcoded to the demo Supabase project, build quality-gates bypassed, and no evidenced HA/auto-scaling or AWS-level alarms. All are bounded and closeable before broad production; none require redesign.

**Topology (evidence-based):** Next.js 13.5.1 app on **AWS Elastic Beanstalk** (Procfile `web: npm start`, nginx reverse proxy, af-south-1/Cape Town) + **Supabase** managed Postgres/Auth/Edge Functions/Realtime/RLS as the data & platform tier. An optional server-side **direct-RDS** path exists (`lib/database.ts` via Secrets Manager + RDS TLS CA) — see A-6.

---

## 1. Operational Readiness Report (summary)
The platform can be deployed (documented EB + Supabase migration/edge deploy sequence), monitored (`sbiq_platform_health` RPC, structured PII-free telemetry, `platform-ops?action=monitor`), backed up (managed Supabase daily), restored (deterministic rebuild + managed backup), upgraded (additive migrations, versioned policy store, edge redeploy), secured (headers/CSP/RLS/JWT/Secrets Manager), and supported (Runbook + Ops Manual + governance). What is missing for *unattended, at-scale* production is **automation and HA**: continuous integration/delivery, a single canonical deploy target, horizontal scaling/multi-AZ, and cloud-native alarms. A different team could operate the pilot from the existing runbooks.

## 2. AWS Infrastructure Assessment
**Current architecture:** EB single-instance web tier (nginx → `next start`), memory-augmented with a 2 GB swapfile (`.ebextensions/00_swap.config`) — indicating a small/memory-constrained instance. Data/auth/edge/RLS on Supabase (managed). Region af-south-1 (data residency for ZA gaming — good). ACM/Route 53/CloudFront/WAF are not represented in the repo (console-managed or not yet provisioned).

| | Assessment |
|---|---|
| **Strengths** | Managed data tier removes most self-managed DB ops; nginx security layer in-repo; region-correct; swap mitigates build memory pressure; immutable-log recovery model. |
| **Weaknesses** | (a) **Three deploy targets committed** — EB (`Procfile`/`.ebextensions`/`.platform`), `amplify.yml`, `netlify.toml` — ambiguous source of truth; (b) 2 GB swap implies an under-provisioned instance (swap-thrash risk under load); (c) no evidenced **Auto Scaling group / load balancer / multi-AZ** → single point of failure; (d) no in-repo **CloudFront/WAF/ACM** definition. |
| **Recommendations** | Pick **one** canonical target (EB) and delete `amplify.yml` + `netlify.toml`; right-size the instance and treat swap as a safety net, not a runtime dependency; enable an EB environment with load balancer + Auto Scaling (min 2, multi-AZ) for production; front with CloudFront + AWS WAF; manage TLS via ACM. Do not add components beyond these standard tiers. |

## 3. Security Assessment
| Control | Status | Evidence |
|---|---|---|
| Encryption in transit | ✅ | nginx HSTS `max-age=31536000; includeSubDomains`; Supabase TLS; RDS path loads af-south-1 CA bundle. |
| Security headers | ✅ | `.platform/nginx/conf.d/security_headers.conf`: HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, Referrer-Policy, Permissions-Policy, **CSP** with `frame-ancestors 'none'`, `base-uri/form-action 'self'`. |
| API authentication / JWT | ✅ | Verified-principal at every edge (ADR-002); anon/tampered → 401 (CPR-1 live-verified). |
| Role enforcement / tenant isolation | ✅ | RLS (`app_visible_casinos()`) + mirrored `principalMayAccessCasino`; cross-tenant/cross-role → 403 (CPR-1 live). |
| Secrets management | ✅ (partial) | `@aws-sdk/client-secrets-manager` wired in `lib/database.ts` (Secrets Manager → env fallback); Supabase keys via env. **Rotation not documented.** |
| Audit logging | ✅ | Immutable `casino_event_log` + append-only `workflow_audit` + `policy_change_log` + structured telemetry. |
| Encryption at rest | ✅ (managed) | Supabase-managed; confirm RDS/EBS encryption if the direct-RDS path is used. |
| **CSP portability** | ⚠ | `connect-src` is **hardcoded to the demo Supabase ref** `uexdjngogzunjxkpxwll` — production would fail to connect until updated to the production project ref. **Must-fix before production go-live.** |
| Admin/IAM least privilege | ⚠ (verify) | `platform-ops` admin-gated (verified); AWS IAM roles for EB/Secrets Manager not in repo — verify least-privilege in the AWS console. |
**Overall:** strong application-layer security; the pre-production must-fix is the CSP project ref, plus verifying AWS IAM least-privilege and documenting secret rotation.

## 4. Backup & Disaster Recovery Report
**Current capability (Operations Manual §5 — strong):** event log is the source of record; managed **Supabase daily backups** cover the event log + policy store; recovery is **deterministic rebuild** (`projection-platform?action=rebuild`, verified identical ×2); twin is in-memory/disposable (self-heals); policy store re-seedable (`policy-seed`). Two red-team cautions are documented: re-ATTACH archived partitions before a full-history rebuild; run rebuild in a quiesced window. **RTO/RPO:** demo RPO = last managed backup, RTO = rebuild seconds; **production targets deferred** to the managed-backup SLA.
| Gap | Recommendation |
|---|---|
| Production RTO/RPO not finalised | Set explicit targets against the Supabase plan (e.g. RPO ≤ 24 h daily / ≤ 5 min with PITR; RTO ≤ 1 h) and enable **Point-in-Time Recovery** on the production Supabase tier. |
| Restore not routinely rehearsed | Ops Manual mandates a monthly restore spot-check — **schedule and evidence** the first production restore drill before go-live. |
| Cross-region/DR copy | Confirm Supabase backup region + consider an off-region backup export for regulatory continuity. |

## 5. Observability Assessment
| Layer | Status |
|---|---|
| Application health | ✅ `sbiq_platform_health` RPC (events_in_log, projection lag, distinct players); `platform-ops?action=monitor` emits PROJECTION_LAG/DRIFT/INGESTION_STALL alerts by operating mode. |
| Structured logging | ✅ PII-free structured telemetry (`lib/observability/telemetry.ts`), redacts refs/emails/payload. |
| Audit trails | ✅ event log + workflow audit + policy change log. |
| **AWS-level observability** | ⚠ No in-repo **CloudWatch dashboards/alarms**, log shipping, or error-reporting (e.g. Sentry) integration. Operators can query app health but have no push alerting on EB CPU/memory/5xx/latency or Supabase saturation. |
**Recommendation:** wire CloudWatch alarms (EB CPU/memory/HTTP 5xx/latency; swap usage), ship nginx/app logs to CloudWatch Logs, add an error-reporting sink, and expose a lightweight `/healthz` for the load balancer. Surface `sbiq_platform_health` on a CloudWatch custom metric so app-lag alarms exist alongside infra alarms.

## 6. Production Support Assessment
**Strong.** `DEPLOYMENT_RUNBOOK.md` (12 sections: pre-deploy checklist, AWS prereqs, migration order, deploy sequence, validation, smoke tests, health checks, go-live sign-off, rollback, emergency rollback, sign-off, timeline) and `OPERATIONS_MANUAL.md` (operating modes, policy runbook, scheduled ops cadence, monitoring/alerting, DR, governance, daily/weekly/monthly checklists, incident response, escalation) mean **a new team can operate the pilot without the original developers.** Governance is least-privilege and audited (`platform-ops` admin-gated; policy changes versioned). Gap: **no CI/CD** (`.github/workflows` absent) — deployments are manual per the runbook; and no incident **on-call rota/paging tool** named. Recommend adding a CI pipeline (build + typecheck + test gate) and naming the on-call/escalation tooling.

## 7. Cost Optimisation Report
| Observation | Opportunity | Impact |
|---|---|---|
| Single small EB instance + 2 GB swap | Right-size to a memory-appropriate instance so swap is a safety net, not runtime; swap-thrash degrades latency and can cost more in retries. | Reliability + predictable latency |
| Managed Supabase | Match the plan to pilot volume; enable PITR only at the tier needed; monitor egress. | Avoid over/under-provisioning |
| Reserved capacity | Once the pilot instance size stabilises, buy **Savings Plans / Reserved Instances** for the steady-state EB + any RDS. | ~30–50% on steady compute |
| Static assets | Serve Next static assets via **CloudFront** (already recommended for security) to cut EB egress and improve TTFB. | Lower egress + faster |
| Logs/backups retention | Set CloudWatch Logs + backup retention to the regulatory minimum (not indefinite). | Storage cost control |
No architectural change required; these are configuration/purchasing decisions.

## 8. Production Go-Live Checklist (reusable for every deployment)
- [ ] **DNS** — Route 53 record → EB/CloudFront; TTL sane; staging vs prod hosts separated.
- [ ] **SSL** — ACM cert issued + attached to the load balancer/CloudFront; HTTPS-only redirect; HSTS confirmed.
- [ ] **CSP / config** — `security_headers.conf` `connect-src` updated to the **production** Supabase project ref; `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` set to production; **service-role key server-side only**.
- [ ] **Secrets** — production secrets in AWS Secrets Manager (DB) + EB env (Supabase); rotation policy set; no secrets in git (`.env.local` is local-only).
- [ ] **Backups** — Supabase managed backups enabled; **PITR** on; first **restore drill** evidenced; backup region confirmed.
- [ ] **Monitoring** — CloudWatch alarms (CPU/mem/5xx/latency/swap); `sbiq_platform_health` scheduled; `platform-ops monitor` = ok.
- [ ] **Alerting** — alarm → on-call (SNS/PagerDuty); escalation path (operator → SRE → owner) live.
- [ ] **Logging** — nginx/app → CloudWatch Logs; error-reporting sink; audit trails confirmed append-only.
- [ ] **Security validation** — headers/CSP live; anon→401, cross-tenant→403 spot-checked in prod; IAM least-privilege reviewed; WAF rules on.
- [ ] **Migrations** — applied in documented order (Runbook §3); `PROJECTION_VERSION` current; rebuild verified on a copy.
- [ ] **Rollback plan** — prior EB app version retained; emergency policy rollback (`policy-activate` last-good) rehearsed; DB restore path documented.
- [ ] **HA** — EB load-balanced, Auto Scaling min ≥ 2, multi-AZ (for production SLA).
- [ ] **Deploy hygiene** — single canonical target (EB); `amplify.yml`/`netlify.toml` removed; build gates (typecheck+test) pass in CI.
- [ ] **Support contacts** — on-call rota, platform owner, Supabase/AWS support tier recorded.
- [ ] **Production approval** — owner sign-off recorded (Constitution §11 Definition of Done; demo verified before production).

## 9. Risk Register
| ID | Finding | Severity | Recommendation |
|---|---|---|---|
| R-1 | CSP `connect-src` hardcoded to **demo** Supabase ref — production connectivity breaks until changed | **High** | Parameterise per environment; update to prod ref in go-live checklist (must-fix before prod). |
| R-2 | **No CI/CD** (`.github/workflows` absent); manual deploys | **High** | Add pipeline: `install → typecheck → test → build → deploy`; block on red. |
| R-3 | **No evidenced HA/Auto-Scaling** — single EB instance = SPOF | **High** | Load-balanced EB, Auto Scaling min ≥ 2, multi-AZ for production. |
| R-4 | Three competing deploy targets (EB + Amplify + Netlify) | Medium | Keep EB; delete `amplify.yml` + `netlify.toml`. |
| R-5 | Build quality-gates bypassed (`eslint.ignoreDuringBuilds: true`; typecheck not in `build`) | Medium | Enforce typecheck+lint+test in CI (keep build fast, gate in pipeline). |
| R-6 | No AWS-level alarms/log-shipping/error-reporting | Medium | CloudWatch alarms + Logs + error sink (§5). |
| R-7 | Production RTO/RPO not finalised; restore not rehearsed | Medium | Set targets + enable PITR + evidence a restore drill. |
| R-8 | Under-provisioned instance (2 GB swap dependency) | Medium | Right-size; swap as safety net only. |
| R-9 | Secret rotation not documented; AWS IAM least-privilege unverified in repo | Medium | Document rotation; review EB/Secrets Manager IAM roles. |
| R-10 | Optional direct-RDS path (`lib/database.ts`) is a second data backend | Low/Info | Confirm whether production uses Supabase-only or RDS; if unused, keep dormant + documented; if used, encrypt-at-rest + backup it too. |
| R-11 | No WAF/CloudFront in repo | Low | Add WAF + CloudFront (also cost/perf benefit). |
| R-12 | No on-call/paging tool named | Low | Name the tool + rota in the Ops Manual escalation section. |

## 10. Certification
**READY WITH MINOR OPERATIONAL IMPROVEMENTS.** Evidence: recovery is event-sourced and deterministic (verified rebuild ×2); managed backups exist; security headers/CSP/RLS/JWT/Secrets Manager are in place and CPR-1-verified; the Deployment Runbook + Operations Manual let a fresh team operate the pilot with documented DR, rollback, and checklists. The open items (R-1…R-3 High; the rest Medium/Low) are **operational hardening and automation, not architecture or functionality** — closeable via the go-live checklist without any change to the certified platform. **For a controlled, supervised commercial pilot: proceed.** **For unattended, at-scale production:** close R-1 (CSP), R-2 (CI/CD), R-3 (HA), and R-6/R-7 (alarms + DR drill) first.

*No application code, business logic, architecture, Consumer Platform contract, Edge Function, or database schema was changed by this review — assessment only.*
