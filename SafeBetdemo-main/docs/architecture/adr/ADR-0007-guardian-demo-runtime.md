# ADR-0007 — SafeBet Guardian independent Demo runtime (ARCH-V4-C0.1)

- **Status:** Accepted (Guardian Demo runtime; synthetic; no production)
- **Date:** 2026-09-05
- **Products affected:** SafeBet Guardian (own runtime); SafeBet IQ (untouched)
- **Relates to:** ADR-0006 (Guardian standalone foundation); Architecture Authority v4.0 §9

## Context
C0 established Guardian as a standalone package (`products/guardian`) + dedicated `guardian`
schema, but Guardian had **no independently deployed runtime**, so exact Git → build → deploy →
`/version` provenance was unproven. C0.1 must deploy Guardian as an independent Demo runtime
that is genuinely separate from the SafeBet IQ runtime/release/version, without destabilising
`demo.safebetiq.com`.

## Decision
Deploy the Guardian foundation as **AWS Lambda + Function URL** (a dedicated function
`safebet-guardian-demo`, Node 20, x86_64), with:
- a **dedicated least-privilege IAM role** `safebet-guardian-demo-lambda-role` (CloudWatch Logs
  only — the C0 foundation endpoints are pure synthetic compute needing no DB/secrets);
- its **own build artifact** produced by `scripts/guardian/build-guardian-lambda.mjs` (esbuild
  bundles Guardian source + the governed Shared Foundation contracts only; the **exact Git SHA
  is baked into the artifact** via esbuild `define`);
- its **own Function URL endpoint**, **own version identity** (`/version`), **own health**
  (`/health`), **own CloudWatch log group** (`/aws/lambda/safebet-guardian-demo`), and **own
  rollback** (Lambda versions / `update-function-code`).

## Alternatives considered
- **Option A — dedicated Elastic Beanstalk environment:** rejected for C0. It provisions
  long-running EC2 (cost + orphan risk) and heavier IAM/networking for a tiny stateless
  foundation service; no C0 benefit over Lambda for proving independence.
- **Option B — ECS/Fargate service:** rejected for C0. Container/cluster overhead unjustified
  for a stateless foundation endpoint; revisit when Guardian gains real workers.
- **Option C — Lambda + Function URL (chosen):** best fit for a small stateless AWS-native
  service; independent compute/version/endpoint/logs/IAM/rollback; negligible cost; no orphaned
  EC2; Lambda is already a proven pattern in this account (the A2 rollup worker). A separate
  Next.js/EB/ECS Guardian service remains the option for when Guardian gains UI/business runtime.

Deploying Guardian merely as routes inside `safebet-iq-demo` was explicitly rejected — route
separation is not runtime separation.

## Consequences
- Guardian runs on its own compute with its own release identity; SafeBet IQ is untouched and
  Guardian does not require the IQ runtime.
- Provenance is provable four-way (Git = build = deploy = live `/version`), the SHA being the
  source commit baked into the artifact (the same standard the IQ `/api/version` uses).
- The interim `guardian` schema (ADR-0006) remains the data boundary; the Lambda foundation
  endpoints do not read it (pure synthetic compute), so the runtime holds no DB credentials.

## Rollback (runtime ≠ data)
- **Runtime:** `aws lambda delete-function --function-name safebet-guardian-demo` (+ delete the
  Function URL config and the IAM role); or roll back code with `update-function-code` to a prior
  artifact once versions exist. Previous state = no deployed Guardian runtime.
- **Data:** unchanged by this ADR; the schema rollback (`DROP SCHEMA guardian CASCADE`) remains a
  separate concern (ADR-0006) and is **not** the runtime rollback.
- SafeBet IQ is unaffected by either.
