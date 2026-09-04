# ADR-0004 — Shared Platform Foundation formalisation (ARCH-V4-A4)

- **Status:** Accepted
- **Date:** 2026-09-04
- **Products affected:** all (Shared Foundation definition); Shared + SafeBet IQ (evidence extraction)
- **Approver:** pending independent PR review (Demo-only; no Production)
- **Relates to:** Architecture Authority v4.0 §7/§9/§10/§21; ADR-0001/0002/0003

## Context
A3 established product boundaries and proved the strangler pattern with the audit primitive. A4
formalises the **Shared Platform Foundation** — the internal, non-commercial technical layer that all
products consume through governed contracts — and proves the pattern with a second extraction.

## Decision
1. **Define the Shared Platform Foundation** (`SHARED_PLATFORM_FOUNDATION.md`): non-commercial
   boundary; 14-capability register; contract-first principle; **dependency-direction rules**
   (products→Shared only; Shared never→product business domains); standard async **message
   envelope**; **service metadata** standard; configuration ownership (secrets ≠ config);
   observability contract; DB Shared-ownership classification (no bulk move); privacy + AI-governance
   primitive registers.
2. **Second extraction (implemented):** move the pure certified **evidence framework** to
   `lib/platform/evidence` (Shared Foundation); deprecate `lib/consumerPlatform/evidence.ts` to a
   re-export shim; migrate consumers (`consumerPlatform/index.ts`, `regulatorFinancialExport.ts`) to
   the governed path. Byte-identical (file copied, not retyped); scope-narrowing + CSV-injection
   safety + certified-identity reconciliation preserved and tested.
3. **Identity/authZ/SoD/workflow/policy/integration/queue/config/notification/observability/
   reporting/security/AI/privacy** — contracts and extension points **defined**, not implemented.
4. **Independence tests:** Guardian and Regulator Suite can rely on Shared contracts **without** IQ
   business tables — both **PASS** (extracted modules are pure, no IQ imports).

## Why evidence as the second extraction
Preferred by the milestone after audit; it is pure and product-agnostic (like audit), currently
mislocated under IQ, and needed by Guardian/Regulator. Explicitly avoided: auth rewrite, financial
pipeline, Guardian/Regulator business logic, cross-operator identity federation.

## Consequences
- Audit and Evidence are **no longer conceptually IQ-owned** — both are Shared contracts under
  `lib/platform/*`, consumable without IQ coupling.
- No product feature expansion; no schema move; SECURITY DEFINER estate unchanged (141/61/62/131);
  RLS/auth unchanged; A1/A2/A3 intact.
- Edge functions keep byte-identical behaviour; they adopt governed paths on next deploy
  (`edge-shared-consumer-migration.md`).

## Verification
Full suite **714/714** (incl. `platformEvidenceContract` byte-parity + scope/CSV/reconciliation),
typecheck + build green, secret scan clean. Deployed exact merged SHA with four-way parity.

## Rollback
Source change on a branch; revert the PR. Deprecated shims keep all existing consumers working. No
DB/infra/Production change.
