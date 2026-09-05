# ADR-0006 — SafeBet Guardian standalone foundation (ARCH-V4-C0)

- **Status:** Accepted (C0 foundation on Demo; synthetic only; no production)
- **Date:** 2026-09-05
- **Products affected:** SafeBet Guardian (new standalone product); Shared Platform Foundation (consumed); SafeBet IQ (untouched)
- **Relates to:** Architecture Authority v4.0 §7/§9/§10/§11; ADR-0003 (product boundaries), ADR-0004 (shared foundation), ADR-0005 (privileged-function hardening / MFA gate)

## Context
A5 closed the platform security baseline (privileged execution hardened + governed; MFA hard
gate before privileged regulatory-role activation). The Shared Platform Foundation (audit,
evidence) is formalised. This is sufficient to establish the **first Guardian product
milestone**: a genuine standalone boundary — **not** the full illegal-gambling platform, **no**
real integrations, **no** enforcement, synthetic data only.

## Decision
Establish Guardian as a standalone product with:
1. **Runtime = Option C** — monorepo package `products/guardian` (`@safebet/guardian`) with an
   independently runnable entry point (`bin/guardian-service.ts`) and its own API namespace
   `/api/guardian/*`. Genuine future independence at the lowest safe migration cost; route
   separation is explicitly **not** treated as runtime separation. A separate deployable
   service is the C1+ target.
2. **Data = Option B** — a dedicated `guardian` Postgres schema (7 foundation tables, RLS on
   all, no anon/public grants, 0 functions). Never `public`, never IQ business tables, never the
   legacy `guardian_*`/`guardianlayer_*` namespaces. Separate database/project = final target.
3. **Shared consumption via governed contracts only** — `@/lib/platform/audit`,
   `@/lib/platform/evidence`. No SafeBet IQ business module imported (statically tested).
4. **Identity + SoD** — Guardian role vocabulary; MFA hard gate rejects real privileged humans
   at C0 (synthetic/service only); SoD rejects same-principal/mixed-jurisdiction enforcement
   decisions.
5. **Foundation primitives only** — service metadata, jurisdiction, synthetic principal, case,
   evidence reference, audit context, message/queue metadata. No business modules (C1+).

## Alternatives considered
- **Pages inside the IQ app:** rejected — route separation ≠ runtime/data independence.
- **Immediate separate Next app + EB env + Supabase project:** deferred — higher-risk migration
  with no C0 benefit; the package + dedicated schema give real independence reversibly now.
- **Guardian tables in `public`:** rejected — violates data-ownership independence; would
  entangle with IQ RLS/estate.

## Consequences
- Guardian has independent runtime/API/identity/data/queue/config/observability/release/rollback
  boundaries, proven by tests and DB RLS negatives.
- No new platform-wide privileged exposure (secdef 138 / anon 1 / PUBLIC 1 unchanged; `guardian`
  schema has 0 functions, no anon access). A1–A5 intact; ADR-0002 unchanged; Production untouched.
- **Real privileged Guardian users and any production privileged regulatory access remain
  BLOCKED** until MFA enforcement is proven (ADR-0005 gate).

## Rollback
`DROP SCHEMA guardian CASCADE;` + remove ledger row `20260905160000`; revert the C0 PR. No
SafeBet IQ object modified.
