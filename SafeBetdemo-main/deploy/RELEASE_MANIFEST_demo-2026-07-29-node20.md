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

## Notes
- Not committed to the release: `node_modules`, `.next`, `.env*`, `*.pem`,
  deployment bundles — enforced by `.gitignore` and `git archive` (tracked-only).
- Classification: **non-production demo**, synthetic data. Not production,
  not regulator-approved, not real-data ready.
