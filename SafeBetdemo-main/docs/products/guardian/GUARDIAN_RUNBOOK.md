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

## Deployment (C0)
C0 introduces **source + a reversible DB schema + docs/CI** only. No separate Guardian runtime
was deployed (Option C package; the IQ app is not redeployed for Guardian source that its
routes reference only additively — confirm per change). If/when a standalone Guardian runtime
is deployed, prove provenance independently: **Git = Build = Guardian deploy = `/api/guardian/version`**,
and never report the SafeBet IQ runtime SHA as Guardian's.

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
