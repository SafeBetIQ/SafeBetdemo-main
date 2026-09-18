# SafeBet Guardian — Runbook (ARCH-V4-C0)

## Build / test / run (independent lifecycle)
- **Typecheck (monorepo, includes Guardian):** `npm run typecheck`
- **Guardian package typecheck (isolated):** `cd products/guardian && npx tsc --noEmit -p tsconfig.json`
- **Guardian tests:** `node --test tests/guardian/` (also part of the full `node --test`)
- **Run standalone foundation service:** `npx tsx products/guardian/bin/guardian-service.ts`
- **Guardian endpoints (when the Next app is up):** `GET /api/guardian/{health,version,foundation}`

Guardian source/test/doc changes do **not** require a SafeBet IQ business release. In the
current monorepo the build boundary is proven by the isolated package typecheck + the boundary
tests; a separate deployable service is the C1+ target.

## Deployment (C0.1) — independent Lambda runtime
Guardian runs on its **own** AWS Lambda + Function URL (ADR-0007), separate from the SafeBet IQ
runtime/release/version. Build + deploy:
```
node scripts/guardian/build-guardian-lambda.mjs          # esbuild bundle; bakes exact Git SHA
aws lambda update-function-code --function-name safebet-guardian-demo \
  --zip-file fileb://products/guardian/dist/guardian-lambda.zip --region eu-west-1
```
- Function: `safebet-guardian-demo` (nodejs20.x, x86_64, handler `index.handler`).
- Role: `safebet-guardian-demo-lambda-role` (CloudWatch Logs only — least privilege; the
  foundation endpoints are pure synthetic compute, no DB/secrets).
- Endpoint: the Lambda **Function URL** (dedicated Guardian endpoint; the intended future
  hostname is `guardian-demo.safebetiq.com` once DNS is authorised).
- Log group: `/aws/lambda/safebet-guardian-demo`.
- **Provenance:** the artifact bakes the exact source SHA; prove **Git = build = deploy =
  live `/version`** on every deploy. Never report the SafeBet IQ runtime SHA as Guardian's.

### C1 registry (data)
Migration `20260905170000_arch_v4_c1_guardian_legal_operator_registry.sql` adds 14 registry
tables to the `guardian` schema (RLS, effective-dating, append-only history, provenance,
staging→authoritative, synthetic seed; 0 functions; no anon/public). **Data rollback:** drop
the 14 C1 tables (`drop table ... cascade` — see the migration's table list) + remove the
ledger row `20260905170000`; the 7 C0 tables and all SafeBet IQ objects are untouched. This
is separate from the runtime rollback below.

### C3 Mobile App Intelligence (data + async infra + app worker principal)
- Migrations `20260905200000` (10 mobile_app_* tables, RLS, illegality-CHECK, seed; 0 functions)
  + `20260905210000` (role `guardian_app_worker`, no password, grants + RLS). Data rollback:
  drop the 10 C3 tables + remove both ledger rows; `revoke`+`drop role guardian_app_worker`.
- **Async infra:** SQS `guardian-app-observation` + DLQ `guardian-app-observation-dlq` + worker
  Lambda `safebet-guardian-app-worker` (role `safebet-guardian-app-worker-role`: logs + SQS +
  `GetSecretValue` on `safebet-guardian/app-worker-db`) + event source mapping (batch 5,
  `ReportBatchItemFailures`, maxReceiveCount 2) + CloudWatch alarm `guardian-app-observation-dlq-not-empty`.
  Build: `node scripts/guardian/build-guardian-app-worker.mjs`; deploy via `update-function-code`.
- **Secret rotate:** `alter role guardian_app_worker password '<new>'` + `put-secret-value` +
  bounce the worker. **Infra rollback:** delete mapping, worker Lambda, both queues, worker role,
  secret. Independent of the domain worker; SafeBet IQ + C0/C1/C2 unaffected.

### C2.1 Domain worker persistence (least-privilege DB role)
- **DB principal:** dedicated role `guardian_domain_worker` (LOGIN, no BYPASSRLS, not owner).
  Grants: USAGE on `guardian` + SELECT/INSERT on the 10 C2 domain tables + `audit_context` only;
  **no grants on public/IQ**. Migration `20260905190000` creates the role (no password) + grants +
  RLS policies. **Password is set out-of-band and stored ONLY in Secrets Manager** — never committed.
- **Secret:** `safebet-guardian/domain-worker-db` (host/port/user/password/database for the Supabase
  pooler `aws-0-us-west-2.pooler.supabase.com:5432`). Worker IAM inline policy
  `guardian-domain-worker-secret-read` grants `secretsmanager:GetSecretValue` on that ARN only.
- **Rotate:** `alter role guardian_domain_worker password '<new>'` then
  `aws secretsmanager put-secret-value --secret-id safebet-guardian/domain-worker-db …`; bounce the
  worker (config update) to drop the cached connection.
- **Persistence:** worker uses `pg` via the pooler through the bounded `DomainObservationRepository`
  (fixed parameterised inserts; no generic SQL); one transaction; idempotent (deterministic ids +
  `on conflict do nothing`); jurisdiction GUC enforces RLS. Fail-before-commit → rollback (no partial
  state) → SQS retry → DLQ.
- **DLQ alarm:** CloudWatch `guardian-domain-observation-dlq-not-empty` (alarm-only; no SNS recipient).
- **Rollback (separately):** worker code via `update-function-code`/alias; IAM via
  `delete-role-policy guardian-domain-worker-secret-read`; secret via `delete-secret`; DB via
  `revoke … ; drop role guardian_domain_worker` + drop the `gw_*` policies (migration `20260905190000`).
  None of these require dropping the guardian schema; SafeBet IQ is unaffected.

### C2 Domain Intelligence (data + async infra)
- Migration `20260905180000_arch_v4_c2_guardian_domain_intelligence.sql` adds 10 domain tables
  (RLS, append-only history, illegality-CHECK, synthetic seed; 0 functions; no anon/public).
  **Data rollback:** drop the 10 C2 tables (cascade) + remove ledger `20260905180000`.
- **Durable async path:** SQS `guardian-domain-observation` + DLQ `guardian-domain-observation-dlq`
  + worker Lambda `safebet-guardian-domain-worker` (role `safebet-guardian-domain-worker-role`,
  logs + SQS consume; **no DB/secrets**) + event source mapping (batch 5, `ReportBatchItemFailures`,
  redrive maxReceiveCount 2). Build: `node scripts/guardian/build-guardian-domain-worker.mjs` →
  `products/guardian/dist-worker/guardian-domain-worker.zip`; deploy via `aws lambda update-function-code`.
  **Infra rollback:** delete the event source mapping, the worker Lambda, the two queues, and the
  worker role. SafeBet IQ + the C0/C1 Guardian runtime are unaffected.

### C4 Payment Intelligence (data + async infra + payment worker principal)
- Migrations `20260905230000` (9 payment tables, RLS, illegality+enforcement CHECK, seed) +
  `20260905240000` (App Reference Contract view + role `guardian_payment_worker`, no password, grants +
  RLS). Data rollback: drop the 9 C4 tables + `app_reference` view + both ledger rows + drop role.
- **Async infra:** SQS `guardian-payment-observation` + DLQ + worker Lambda `safebet-guardian-payment-worker`
  (role `safebet-guardian-payment-worker-role`: logs + SQS + `GetSecretValue` on `safebet-guardian/payment-worker-db`)
  + event source mapping (batch 5, ReportBatchItemFailures, maxReceiveCount 2) + CloudWatch DLQ alarm.
  Build: `node scripts/guardian/build-guardian-payment-worker.mjs`; deploy via `update-function-code`.
- **Rotate/rollback:** as per the app/domain workers; independent; SafeBet IQ + C2/C3 unaffected.

### C5 Geo & Jurisdiction Intelligence (data + async infra + geo worker principal + Payment Reference Contract)
- Migrations `20260906010000` (10 geo tables, RLS, append-only triggers, illegality+enforcement CHECK,
  trigger-guard PUBLIC-EXECUTE revoke, seed) + `20260906020000` (Payment Reference Contract view
  `guardian.payment_reference` + role `guardian_geo_worker`, no password, grants + RLS). Data rollback:
  drop the 10 C5 tables + `geo_block_mutation()` + `payment_reference` view + both ledger rows + drop role.
- **Async infra:** SQS `guardian-geo-observation` + DLQ `guardian-geo-observation-dlq` + worker Lambda
  `safebet-guardian-geo-worker` (role `safebet-guardian-geo-worker-role`: logs + SQS + `GetSecretValue`
  on `safebet-guardian/geo-worker-db`) + event source mapping (batch 5, ReportBatchItemFailures,
  maxReceiveCount 2) + CloudWatch DLQ alarm `guardian-geo-observation-dlq-not-empty`.
  Build: `node scripts/guardian/build-guardian-geo-worker.mjs`; deploy via `update-function-code`.
- **Privacy gate:** the worker rejects any message carrying a person-level field (`PROHIBITED_PERSON_FIELDS`)
  → DLQ, 0 writes. No real location/ISP/bank/device access.
- **Rotate/rollback:** as per the other workers; independent; SafeBet IQ + C1–C4 unaffected.

### C6 Case & Investigation Management (data + async infra + case worker principal + Geo Reference Contract)
- Migrations `20260907010000` (12 case tables, RLS, append-only triggers, legal+enforcement CHECK,
  trigger-guard PUBLIC-EXECUTE revoke, seed) + `20260907020000` (Geo Reference Contract view
  `guardian.geo_reference` + role `guardian_case_worker`, no password, grants + RLS). Data rollback: drop
  the 12 C6 tables + `case_block_mutation()` + `geo_reference` view + both ledger rows + drop role.
- **Async infra:** SQS `guardian-case-intake` + DLQ `guardian-case-intake-dlq` + worker Lambda
  `safebet-guardian-case-worker` (role `safebet-guardian-case-worker-role`: logs + SQS + `GetSecretValue`
  on `safebet-guardian/case-worker-db`) + event source mapping (batch 5, ReportBatchItemFailures,
  maxReceiveCount 2) + CloudWatch DLQ alarm `guardian-case-intake-dlq-not-empty`.
- **Boundary:** investigation only — no `/enforce`/`/block`/`/takedown`/`/referral`; no provider response
  lifecycle. Subject references resolved via the four governed reference views only (no base tables).
- **Rotate/rollback:** as per the other workers; independent; SafeBet IQ + C1–C5 unaffected.

### C7 Digital Evidence Vault (data + private S3 + async infra + evidence worker principal + Case Reference Contract)
- Migrations `20260908010000` (9 evidence tables, RLS, append-only custody/access/integrity triggers,
  legal+enforcement CHECK, trigger-guard PUBLIC-EXECUTE revoke, seed) + `20260908020000` (Case Reference
  Contract view `guardian.case_reference` + role `guardian_evidence_worker`, no password, grants + RLS).
  Data rollback: drop the 9 C7 tables + `evidence_block_mutation()` + `case_reference` view + both ledger
  rows + drop role. **Never delete S3 objects on a code rollback.**
- **Private S3 vault:** `safebet-guardian-evidence-demo` (eu-west-1) — block-public-access ALL, SSE-AES256,
  versioning, TLS-only deny bucket policy. Storage rollback is SEPARATE from runtime/schema rollback; objects
  are retained (evidence must not be destroyed because code is rolled back).
- **Async infra:** SQS `guardian-evidence-processing` + DLQ `guardian-evidence-processing-dlq` + worker Lambda
  `safebet-guardian-evidence-worker` (role `safebet-guardian-evidence-worker-role`: logs + SQS + `GetSecretValue`
  on `safebet-guardian/evidence-worker-db` + `s3:PutObject` on `evidence/*` only) + event source mapping
  (batch 5, ReportBatchItemFailures, maxReceiveCount 2) + CloudWatch DLQ alarm
  `guardian-evidence-processing-dlq-not-empty`. Two-phase: store (deterministic key -> idempotent/orphan-safe)
  then metadata+custody commit. Build: `node scripts/guardian/build-guardian-evidence-worker.mjs`.
- **Rotate/rollback:** as per the other workers; independent; SafeBet IQ + C1–C6 unaffected.

### C8 Enforcement Policy Registry & Authorisation (data + async infra + policy worker principal + Evidence Reference Contract)
- Migrations `20260911010000` (12 C8 tables, RLS, append-only history/review triggers, execute/notify CHECKs,
  trigger-guard PUBLIC-EXECUTE revoke, seed) + `20260911020000` (Evidence Reference Contract view
  `guardian.evidence_reference` + role `guardian_policy_worker`, no password, grants + RLS). Data rollback: drop
  the 12 C8 tables + `policy_block_mutation()` + `evidence_reference` view + both ledger rows + drop role.
- **Async infra:** SQS `guardian-authorisation-evaluation` + DLQ + worker Lambda
  `safebet-guardian-authorisation-worker` (role `safebet-guardian-authorisation-worker-role`: logs + SQS +
  `GetSecretValue` on `safebet-guardian/policy-worker-db` — NO external/provider permission) + event source
  mapping (batch 5, ReportBatchItemFailures, maxReceiveCount 2) + CloudWatch DLQ alarm
  `guardian-authorisation-evaluation-dlq-not-empty`.
- **Boundary:** the worker PREPARES a proposed_action only; it CANNOT insert legal_review or
  action_authorisation (machine authorisation impossible). No `/execute`/`/block`/`/referral`; no external call.
- **Rotate/rollback:** as per the other workers; independent; SafeBet IQ + C1–C7 unaffected.

### C9 Multi-Channel Enforcement Orchestration (data + async infra + enforcement worker principal + Authorised-Action Contract)
- Migrations `20260912010000` (8 C9 tables, RLS, append-only triggers, real-provider/external-call CHECKs,
  trigger-guard PUBLIC-EXECUTE revoke, synthetic provider-channel seed) + `20260912020000` (Authorised-Action
  Contract view `guardian.authorised_action` + role `guardian_enforcement_worker`, no password, grants + RLS).
  Data rollback: drop the 8 C9 tables + `orchestration_block_mutation()` + `authorised_action` view + both ledger
  rows + drop role. **Runtime rollback must not delete orchestration history.**
- **Async infra:** SQS `guardian-enforcement-orchestration` + DLQ + worker Lambda
  `safebet-guardian-enforcement-worker` (role `safebet-guardian-enforcement-worker-role`: logs + SQS +
  `GetSecretValue` on `safebet-guardian/enforcement-worker-db` — NO external/provider/network permission) + event
  source mapping (batch 5, ReportBatchItemFailures, maxReceiveCount 2) + CloudWatch DLQ alarm
  `guardian-enforcement-orchestration-dlq-not-empty`.
- **Boundary:** SYNTHETIC providers only; Guardian orchestrates/refers, never performs the provider action;
  verification is a separate step (ACTIONED != VERIFIED). Consumes only the `authorised_action` contract view.
- **Rotate/rollback:** as per the other workers; independent; SafeBet IQ + C1–C8 unaffected.

### C10 Re-entry Intelligence & Continuous Verification (data + async infra + re-entry worker principal + C9 Orchestration Reference Contract)
- Migrations `20260915010000` (7 C10 tables, RLS, append-only triggers, illegality/authority/legal-determination/
  dispatch CHECKs, trigger-guard PUBLIC-EXECUTE revoke) + `20260915020000` (C9 Orchestration Reference Contract
  view `guardian.orchestration_reference` + role `guardian_reentry_worker`, no password, grants + RLS).
  Data rollback: drop the 7 C10 tables + `reentry_block_mutation()` + `orchestration_reference` view + drop role.
  **Runtime rollback must not delete re-entry history/data** (runtime target stays C9 `08e99c7`).
- **Async infra:** SQS `guardian-reentry-intelligence` + DLQ + worker Lambda `safebet-guardian-reentry-worker`
  (role `safebet-guardian-reentry-worker-role`: logs + SQS Receive/Delete/GetQueueAttributes on the reentry
  queue+DLQ + `GetSecretValue` on `safebet-guardian/reentry-worker-db` — **NO `sqs:SendMessage`**, so it
  cannot enqueue C9 enforcement; NO external/provider/network permission) + immutable-alias ESM (targets
  `…:safebet-guardian-reentry-worker:demo`, never `$LATEST`) + CloudWatch DLQ alarm
  `guardian-reentry-intelligence-dlq-not-empty`.
- **Boundary:** intelligence + continuous verification + routing only; SYNTHETIC sources; RE-ENTRY != ILLEGALITY,
  SIMILAR != SAME ENTITY; human review required; routes to C6/C8 only; C10 never dispatches C9 or applies
  authority; historic VERIFIED immutable. Consumes only the `orchestration_reference` contract view.
- **Rotate/rollback:** as per the other workers; independent; SafeBet IQ + C1–C9 unaffected.

### PR1 Privileged Identity, MFA & Authentication Assurance (production-readiness; DEMO/test identities only)
- **Migration** `20260918010000` (`guardian.identity_entitlement` + append-only `identity_entitlement_history`
  via `identity_block_mutation` SECURITY INVOKER + PUBLIC revoked; RLS; least-privilege resolver role
  `guardian_identity_resolver` = SELECT `identity_entitlement` + INSERT `audit_context` only). No new SECURITY DEFINER.
- **Identity provider:** AWS Cognito User Pool `eu-west-1_2Hfe3vYk5` — **MfaConfiguration=ON, software-token TOTP
  required**, admin-create-only, RS256 tokens, rotating JWKS. App client `3rbeba55nie1ugn3olvudnnhsn` (no secret).
  **Verified pool property** (recorded here so `GUARDIAN_JWT_ISSUER_ENFORCES_MFA=true` is honest): the pool
  enforces MFA, so any valid token evidences a completed MFA challenge (Cognito omits `amr`).
- **API env (jwt mode):** `GUARDIAN_AUTH_MODE=jwt`, `GUARDIAN_JWT_USER_POOL_ID`, `GUARDIAN_JWT_ISSUER`,
  `GUARDIAN_JWT_AUDIENCE`(=client id), `GUARDIAN_JWT_TOKEN_USE=access`, `GUARDIAN_JWT_ISSUER_ENFORCES_MFA=true`,
  `GUARDIAN_IDENTITY_DB_SECRET_ID=safebet-guardian/identity-resolver-db`. IAM: API exec role gains
  `GetSecretValue` on the identity-resolver secret only.
- **Boundary:** role + jurisdiction from the governed entitlement only (never request body/token custom claim);
  no synthetic fallback in jwt mode; human vs service distinct; C8 `AUTHORISATION_GRANTED` = HUMAN
  AUTHORISING_OFFICER + MFA. Authentication must NEVER be disabled in a Production config.
- **Test identities (NON-PRODUCTION):** TEST_INVESTIGATOR_ZAGP, TEST_LEGAL_REVIEWER_ZAGP,
  TEST_AUTHORISING_OFFICER_ZAGP, TEST_POLICY_ADMIN_ZAGP, TEST_INVESTIGATOR_ZAWC (TOTP-enrolled; entitlements ACTIVE).
- **Rollback:** runtime target stays C10 `94355f4`; `GUARDIAN_AUTH_MODE` flags the path but must not disable auth;
  no identity/audit history deleted on rollback. Revocation: SUSPEND/DISABLE the entitlement (deny next request)
  and/or `admin-user-global-sign-out` (access tokens expire ≤60 min).

#### C9.1 immutable-runtime & DB-identity close-out (infra/provenance only; no C9 behaviour change)
- **Durable invocation is immutable:** the SQS event-source mapping (`563d2102-1088-4934-88b8-ba75f6ff5971`)
  targets the **qualified alias ARN** `…:function:safebet-guardian-enforcement-worker:demo` (NOT the mutable
  unqualified `$LATEST`). `demo` alias → immutable published **v2**; v2 `CodeSha256 czfK/cluCfgiG5HshpsIGkRNta7CUxuq3AXaITwujiU=`
  == `$LATEST` at publish time. v2 artifact bakes `__GUARDIAN_GIT_COMMIT__ = 08e99c72…` and live queue logs
  emit `sourceSha 08e99c72…` while resolving `Version: 2` — canonical source proven three ways.
- **DB authentication identity:** the worker connects **directly** (no `SET ROLE`, no broader login) using the
  dedicated secret `safebet-guardian/enforcement-worker-db`. Because the datastore is the Supabase transaction
  **pooler**, the secret's *username field* is formatted `guardian_enforcement_worker.<project-ref>`; the
  resolved Postgres session identity is `current_user = session_user = guardian_enforcement_worker`
  (`rolsuper=false, rolbypassrls=false, rolcreaterole=false, rolcreatedb=false, login=true`). The C9 migration
  created the role `LOGIN` **without a password**; a login password was subsequently assigned out-of-band and
  stored only in Secrets Manager (never in source/migrations) — the original "no password" wording described
  the migration state, not the runtime, which does authenticate with a Secrets-Manager-held password.
- **Least privilege (runtime identity):** 19 grants = SELECT+INSERT on the 8 C9 tables + `audit_context`, plus
  SELECT on the `authorised_action` contract view; **0 UPDATE, 0 DELETE, 0 C1–C8 base-table grants, 0
  public/SafeBet-IQ grants, no BYPASSRLS**. RLS proven with the runtime identity: correct jurisdiction ALLOWED,
  wrong jurisdiction DENIED. Exec-role `secretsmanager:GetSecretValue` is scoped to
  `safebet-guardian/enforcement-worker-db-f4R8b3` **only** (no other Guardian DB secret, no SafeBet IQ secret).

### C3.2 branded Demo edge (guardian-demo.safebetiq.com)
- **Resources:** ACM cert (eu-west-1, DNS-validated) · API Gateway HTTP API `safebet-guardian-demo-edge`
  (Lambda proxy → `safebet-guardian-demo`; `$default`=AWS_IAM; `GET /health`+`/version`=public) ·
  custom domain `guardian-demo.safebetiq.com` (regional, TLS 1.2) + API mapping · Route 53 A-alias
  (additive) in the authoritative safebetiq.com zone.
- **No runtime change** — the branded edge fronts the existing Lambda; provenance stays the deployed
  Guardian SHA (do NOT redeploy for DNS).
- **Rollback (edge only):** delete the Route 53 `guardian-demo` alias + ACM-validation CNAME; delete
  the API Gateway custom domain, mapping, and HTTP API. The raw Lambda **Function URL** remains the
  prior known-good endpoint. No DB rollback; SafeBet IQ (demo/app.safebetiq.com) unaffected.
- **Do NOT** create `guardian.safebetiq.com` (Production) — future milestone only.

### Runtime rollback (≠ data rollback)
- Roll back code: `aws lambda update-function-code … --zip-file fileb://<prior-artifact>` (or a
  published version alias once versions exist).
- Remove entirely: delete the Function URL config, then `aws lambda delete-function
  --function-name safebet-guardian-demo`, then the IAM role. Previous state = no deployed runtime.
- The schema rollback (`DROP SCHEMA guardian CASCADE`) is a **separate** data concern — not the
  runtime rollback. SafeBet IQ is unaffected either way.

### Note on the Next `/api/guardian/*` routes
The additive `/api/guardian/{health,version,foundation}` routes remain in the IQ app as a
convenience surface, but they are **not** the independent runtime — the Lambda Function URL is.
The IQ app is not redeployed for Guardian in C0.1 (`demo.safebetiq.com` untouched).

## Rollback
- **DB schema:** `DROP SCHEMA guardian CASCADE;` then delete the ledger row
  `20260905160000`. Removes all Guardian tables/policies/seed; touches no SafeBet IQ object.
- **Source:** revert the C0 PR (removes `products/guardian`, `app/api/guardian`, `tests/guardian`,
  docs). No SafeBet IQ business code was modified.
- **Config/queue:** no external queue/infra was provisioned at C0; nothing to tear down.

## Safe Demo domain
Do not destabilise `demo.safebetiq.com` (the SafeBet IQ operator Demo). Guardian's interim
surface is the additive `/api/guardian/*` namespace on the same app; the **intended** future
hostname is a separate Guardian endpoint/subdomain (e.g. `guardian-demo.safebetiq.com`) once
DNS/runtime provisioning is authorised. C0 does not claim or hijack a hostname.

## Health / observability
`/api/guardian/health` (liveness) + `/api/guardian/version` (own provenance). All Guardian
observability metadata carries `product=GUARDIAN`. Do not rely on the SafeBet IQ `/api/health`
for Guardian liveness.

## Guardrails
Synthetic data only. No real regulator/provider integration. No live enforcement. No automatic
legal/enforcement decision. New DB functions default `SECURITY INVOKER`; no PUBLIC/anon grants;
register any privileged execution under the A5 baseline (`npm run ci:privfn`). Production is out
of scope.
