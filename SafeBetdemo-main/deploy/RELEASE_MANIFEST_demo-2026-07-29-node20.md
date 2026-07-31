# SafeBet IQ — Demo Release Manifest

**Release tag:** `demo-2026-07-29-node20`
**Environment:** `demo.safebetiq.com` (non-production demo, synthetic data)

| Field | Value |
|---|---|
| Source commit | `a62434548c49ce84836c382e0bcd6df35800817e` (`a624345`) |
| Branch | `Demo` |
| Elastic Beanstalk application | `safebet-iq-app` (eu-west-1) |
| Elastic Beanstalk environment | `safebet-iq-demo` |
| EB application version | `demo-node20-20260729-a624345` |
| Next.js build ID | `eI8OrhnrKC5DFUFZHm8FQ` |
| Deployment ZIP SHA-256 | `dbe542f9e9bd9a0f99fed10ceb60afa8d21366bc28079ed095c924d851a037f2` |
| Node version (build) | `20.20.0` (Linux, `aws/codebuild/standard:7.0`) |
| Build architecture | linux/amd64 |
| CodeBuild project | `safebet-demo-node20-build` (temporary; recreate via `deploy/codebuild-demo.sh`) |
| Buildspec | `deploy/buildspec.yml` |
| Demo Supabase project | `uexdjngogzunjxkpxwll` (demo; **not** production `ilibvipqbkugqkppzdmh`) |
| Deployed at (build stamp) | `2026-07-29T15:32:23Z` |
| Migration baseline | through `20260803120000_continuous_audit_assurance` (demo Supabase, current) |
| Previous versions retained (rollback) | `demo-node20-20260729-a21bc86`, `rc1-v20` |

## Reproduce this release

```bash
git checkout demo-2026-07-29-node20
# Public demo anon key only (never the service-role key):
NEXT_PUBLIC_SUPABASE_ANON_KEY=<demo anon key> ./deploy/codebuild-demo.sh
```

The build runs under Linux Node 20 (matching the EB runtime), produces a
forward-slash ZIP with `package.json` at the root and `.next` (minus cache),
excludes the on-instance build config, and injects `version.json` provenance
served at `/api/version`.

## Six-casino production-scale synthetic demo (staged)

**Frontend release:** commit `a9ba933` → EB version `demo-node20-20260729-a9ba933`
(buildId `uuRP7KSTgVdv9t1efzvCa`, node 20.20.0, ZIP sha256
`f17bca3bad9ec18b0493f4dca51af96da786e3728140955c084b4214ef4eefcc`) — adds the
six-casino login selector (email-only, demo-gated; removed hardcoded passwords).

**Six demo account → tenant mappings** (passwords random/owner-set; never printed):

| Casino | Demo login | Tenant id |
|---|---|---|
| Prestige Casino (Demo) | demo.prestige@safebetiq.com (+ legacy demo.casino@) | a1b2c3d4-0000-0000-0000-000000000001 |
| SunBet | demo.sunbet@safebetiq.com | cc000001-0000-0000-0000-000000000001 |
| Hollywoodbets | demo.hollywoodbets@safebetiq.com | cc000002-0000-0000-0000-000000000002 |
| Betway | demo.betway@safebetiq.com | cc000003-0000-0000-0000-000000000003 |
| Gold Rush | demo.goldrush@safebetiq.com | cc000004-0000-0000-0000-000000000004 |
| Royal Palace | demo.royalpalace@safebetiq.com | cc000005-0000-0000-0000-000000000005 |
| Regulator (National) | demo.regulator@safebetiq.com | jurisdiction ZA |

**Scale data:** producer `safebet-demo-scale-simulator-v1` (seed `s1`), migration
`20260729160000_demo_scale_simulator` (commits `0410485` + `27f1f59`). Fully
removable via `sbiq_demo_scale_cleanup()`.

**Seed versions (stage-independent, each removable via `sbiq_demo_scale_cleanup('<seed>')`):**
`stage1-v1` (producer `safebet-demo-scale-stage1-v1`, 30,000), `stage2-v1`
(`…-stage2-v1`, 34,500, 30-day history), `stage3-v1` (`…-stage3-v1`, 37,000,
90-day history). Seed-scoped migration `20260731090000_demo_scale_simulator_seed_scoped`.

**Final production-scale synthetic dataset (all three stages accepted):**

| Casino | Registered | Stage target |
|---|---|---|
| Hollywoodbets | 28,064 | 28,000 |
| Betway | 22,035 | 22,000 |
| Prestige Casino (Demo) | 18,152 | 18,000 |
| SunBet | 14,567 | 14,500 |
| Gold Rush | 10,546 | 10,500 |
| Royal Palace | 8,534 | 8,500 |
| **Total (incl. 398 baseline)** | **101,898** | ~101,500 |

Aggregate: active-now **9,637**, daily-active **22,318**, open sessions **10,044**,
machines **9,884**, certified events (90-day) **236,322**, GGR today ~**R2,691,919**
(differentiated). Historical partitions `2026_04/05/06` created born-secure.

**All Stage 3 hard gates green:** risk/session/activity/machine/financial
reconciliations (6 casinos), regulator aggregate = sum of six, 7 audit chains
verified, tenant isolation (per casino, cross-tenant 0), every event-log partition
secure, 90-day window queries, ZAR/Africa-Johannesburg, financial status Partial,
synthetic disclosed, voids/reversals unavailable (null), `/api/health` + `/api/version`
healthy, EB Ready/Green, regression 495/495. Each stage independently reversible.

**Data/DB tag:** `demo-db-2026-07-31-production-scale-synthetic`.

## Notes
- Not committed to the release: `node_modules`, `.next`, `.env*`, `*.pem`,
  deployment bundles — enforced by `.gitignore` and `git archive` (tracked-only).
- Classification: **non-production demo**, synthetic data. Not production,
  not regulator-approved, not real-data ready.
