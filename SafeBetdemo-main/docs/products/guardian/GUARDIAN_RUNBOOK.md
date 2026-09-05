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
