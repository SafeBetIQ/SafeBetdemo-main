# ADR-0003 — Product boundary extraction, strangler start (ARCH-V4-A3)

- **Status:** Accepted
- **Date:** 2026-09-04
- **Products affected:** all (ownership classification); Shared Platform Foundation + SafeBet IQ (first extraction)
- **Approver:** pending independent PR review (Demo-only; no Production)
- **Relates to:** Architecture Authority v4.0 §7/§8/§10/§21/§22; ADR-0001/0002

## Context
The estate (330 tables / 24 views / 157 functions in one `public` schema; 30 edge functions) mixes
product, shared, demo and legacy objects, and the `guardian_*` names collide with the reserved v4
Guardian namespace. A3 must establish explicit ownership and prove the strangler pattern **without
rebuilding working capability or a big-bang schema move**.

## Decision
1. **Ownership classification (read-only):** recorded in `PRODUCT_BOUNDARY_MAP.md`
   (IQ ~276 · Shared ~163 · Demo 26 · Legacy/Academy 18 · `guardian_*` reclassify→IQ 7 ·
   Guardian/Regulator-Suite targets 0/greenfield) + Data Ownership Register + API Ownership Map.
2. **Database boundary strategy:** **Option A (logical ownership registry) + Option C (governed
   contract facades)** now; **Option B (new bounded schemas for NEW code only) + Option D (selected
   safe extraction)** from A4. **No** bulk relocation of existing tables; **no** new cross-context joins.
3. **Guardian namespace:** reserved; `guardian_*` analytics reclassified to IQ and scheduled for
   rename off the namespace (deferred, reversible). Academy = legacy, retire later. See registers.
4. **First safe extraction (implemented):** move the pure, product-agnostic **audit-chain
   verification primitive** to **`lib/platform/audit`** (Shared Platform Foundation), leaving a
   deprecated re-export shim at `lib/consumerPlatform/auditChain.ts` and migrating one consumer
   (`lib/consumerPlatform/index.ts`) to the governed path. This gives Guardian/Regulator a governed
   audit contract without depending on IQ business tables (§10).

## Why the audit primitive as the first extraction
It is already pure and dependency-injected (no DB, no side effects) but mislocated under the IQ
consumer namespace — the lowest-risk, highest-signal way to prove the strangler pattern. Explicitly
avoided as first candidates: financial calculation, auth, Guardian business logic, Regulator crawler,
cross-operator raw identity (§20).

## Consequences
- Establishes the `lib/platform/*` Shared Platform Foundation namespace and the deprecate-shim
  strangler pattern for future extractions (evidence, identity, reporting).
- Behaviour is unchanged (pure relocation, byte-identical hashes proven) → **no runtime deploy
  required**; the change ships with the next release. A3 is a contracts/boundary phase.
- Raw cross-product coupling is **reduced** (a shared contract now exists) and **not increased**
  (no new cross-product raw-table access; RLS/auth unchanged; SECURITY DEFINER estate unchanged
  141/61/62/131).

## Verification
Full suite **707/707** (incl. new `tests/platformAuditContract.test.mjs` proving byte-parity across
governed/deprecated/facade paths + DB-identical hashes), typecheck + build green, secret scan clean.

## Rollback
Pure source change on a branch; revert the PR. No DB/infra/Production change. If ever deployed and
an issue arises, the deprecated shim keeps all existing consumers working; revert restores the
original file location.
