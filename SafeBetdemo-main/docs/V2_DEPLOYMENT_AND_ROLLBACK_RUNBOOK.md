# V2 — Deployment & Rollback Runbook (Milestone 4.6)

**Non-production only. Federation OFF by default. Deployment NOT authorised in this milestone.**
Owner-executed steps are marked **[OWNER]**; nothing here is executed automatically.

## 1. Preconditions
- Approved non-production target provisioned (Elastic Beanstalk env + RDS + Secrets Manager + CloudWatch). **[OWNER]**
- Branch `Demo`; `npx tsc --noEmit` clean; `node --test "tests/**/*.test.mjs"` → 428 pass.
- Feature flags default OFF; `approvedTestTenants` restricted to synthetic tenants.

## 2. Deploy (residual — NOT performed this milestone) **[OWNER]**
1. Build the service artifact; deploy to the non-production Elastic Beanstalk environment.
2. Bind RDS (with native RLS + append-only role), Secrets Manager (pepper), CloudWatch.
3. Confirm `version()` reports `environment: deployed-non-production` and correct component versions.
4. Confirm `health()` overall is `healthy` with federation still **disabled**.
5. Run the deployed Consumer Platform regression + route/contract smoke **with V2 present** (this is the C8-closing evidence).

## 3. Enable Federation (controlled) **[OWNER]**
1. `flags.enableTestTenant(<approved-synthetic-tenant>, <CC>)` then `flags.activateJurisdiction(<CC>)`.
2. Verify correlation/policy report `enabled`; run the deployed smoke against synthetic data only.

## 4. Health Gates
- `unavailable` → do not proceed; investigate composition/persistence/crypto wiring.
- `misconfigured` → secret store / feature-flag store not bound correctly.
- `disabled` on correlation/policy is EXPECTED when federation is off — not a failure.

## 5. Rollback
1. **Emergency shutdown:** `flags.emergencyShutdown()` → all federation reads denied; state persists across restart. (Exercised in the 4.6 smoke, in-process.)
2. **Deploy rollback [OWNER]:** redeploy the prior artifact; federation library is additive, so rollback removes only `lib/identityFederation/` behaviour — no operator route/contract/schema change to revert.
3. **Data:** regulator-plane store is isolated; no operator/production data is touched by rollback.
4. Verify `health()` and `version()`, and that the Consumer Platform is unaffected.

## 6. Restart / Recovery
- Registry reconstructs from durable persistence with intact integrity (`reconstructRegistry()`; verified in the 4.6 smoke). Feature-flag state persists via the flag store.

## 7. Limitation
Steps 2 and 5 (managed deploy + deployed Consumer regression) were **not executed** — no authorised target.
Until executed, **C8 remains PARTIALLY CLOSED** and no production/pilot-live claim is made.
