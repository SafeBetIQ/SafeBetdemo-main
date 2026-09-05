# SafeBet Guardian — Architecture (ARCH-V4-C0 foundation)

**Status:** C0 foundation established (Demo, synthetic only). Not the full product.
**Scope:** standalone product boundary + governed Shared-Foundation consumption. No
real regulator/bank/PSP/ISP/registrar/hosting/mobile-platform integration; no live
enforcement; no production.

## What Guardian is
SafeBet Guardian is a **standalone commercial product**: a *National Illegal Gambling
Intelligence & Multi-Channel Enforcement-Orchestration platform*. It is **not** part of
SafeBet IQ, **not** an IQ module, **not** the Regulator Suite, and **not** an operator
responsible-gambling module. It **orchestrates** enforcement; it never itself blocks,
freezes, suspends, removes, or issues legal determinations.

## Future lifecycle (foundation only at C0)
Monitor → Detect → Verify → Investigate → Evidence → Human Review → Human Authorisation →
Enforcement Orchestration → Provider Response → Verification → Re-entry Monitoring.
C0 builds only the substrate for that lifecycle.

## Runtime strategy — Option C (monorepo package, independent entry point)
Guardian lives in [`products/guardian/`](../../../products/guardian) as an isolated package
(`@safebet/guardian`) with:
- its own composition root (`src/index.ts`) and public contract surface;
- an **independently runnable** entry point [`bin/guardian-service.ts`](../../../products/guardian/bin/guardian-service.ts)
  (`npx tsx products/guardian/bin/guardian-service.ts`) that runs the full synthetic
  foundation flow **without** the SafeBet IQ Next.js runtime and **without** any IQ business
  module — the runtime-independence demonstration;
- its own API namespace `/api/guardian/*` (health, version, synthetic foundation demo).

Option C was chosen over "new pages in the IQ app" (route separation ≠ runtime separation)
and over immediately standing up a separate Next app/EB environment (higher-risk migration
with no C0 benefit). The package boundary + independent entry point give genuine future
independence at the lowest safe cost; a separate deployable service is the C1+ target.

## Shared Platform Foundation consumption (governed contracts only)
Guardian's **only** cross-product dependencies are the governed shared contracts:
`../../../lib/platform/audit` (tamper-evident chain verification) and
`../../../lib/platform/evidence` (evidence envelope/pagination/scope). It imports **no**
SafeBet IQ business module (statically enforced by `tests/guardian/guardianBoundary.test.mjs`).

## Data boundary — Option B (dedicated `guardian` schema, interim strangler)
Guardian owns a dedicated `guardian` Postgres schema (7 foundation tables, RLS on all,
no anon/public grants). It never uses `public` or the SafeBet IQ business tables, and never
reuses the legacy `public.guardian_*` / `guardianlayer_*` objects. A fully separate
database/project is the final target (documented in `GUARDIAN_DATA_OWNERSHIP.md`).

## Standalone-ness checklist (C0)
runtime boundary ✓ · app namespace (`products/guardian`) ✓ · API namespace (`/api/guardian`) ✓ ·
identity/authorisation boundary ✓ · data boundary (`guardian` schema) ✓ · queue/worker namespace
(`guardian-*`) ✓ · configuration boundary ✓ · secrets boundary (external, none hard-coded) ✓ ·
observability (own health/version) ✓ · release lifecycle (own build/test/version/rollback) ✓ ·
product-specific audit context (`guardian:<jurisdiction>` scope, `product=GUARDIAN`) ✓.

## Hard invariants (encoded in `src/product.ts`, tested)
automated signal ≠ legal finding · detection ≠ enforcement authorisation · no automatic
blocking · MFA required for real privileged use · synthetic data only · no live external
integration · Guardian never self-executes freeze/block/terminate/remove/suspend/compel/
issue-determination.
