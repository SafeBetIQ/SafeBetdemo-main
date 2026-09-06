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
