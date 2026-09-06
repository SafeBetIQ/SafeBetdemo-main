# ADR-0012 — Guardian Domain Reference Contract (ARCH-V4-C3.1)

- **Status:** Accepted (C3.1 on Demo; synthetic only; no production)
- **Date:** 2026-09-06
- **Relates to:** ADR-0011 (mobile app intelligence), ADR-0009/0010 (domain), ADR-0005 (privileged-fn/MFA)

## Context
C3 reported a governed C2 relationship, but the `guardian_app_worker` role retained **direct
SELECT on `guardian.domain_subject`** — a raw cross-module base-table dependency. That couples
Mobile App Intelligence to Domain Intelligence's persistence implementation and blocks a future
separate Guardian datastore.

## Decision
Introduce a **Domain-owned Domain Reference Contract** and remove the raw coupling:
- **TS** `resolveDomainReference({hostname, jurisdiction})` (`products/guardian/src/domain/contract.ts`)
  returns ONLY bounded fields (`matchState, canonicalHostname, jurisdiction, domainReferenceId,
  freshness, referenceStatus`). App Intelligence consumes this at analysis time.
- **DB** view `guardian.domain_reference` (owner: Domain Intelligence) exposes the same bounded
  fields, jurisdiction-scoped by the `app.guardian.jurisdiction` GUC. The app worker resolves the
  real reference id via this view at persistence time.
- **Privilege:** `revoke select on guardian.domain_subject from guardian_app_worker`; grant SELECT
  on the view only. A plain view (not SECURITY DEFINER); no PUBLIC/anon.

## Alternatives considered
- **Keep direct base-table SELECT:** rejected (the coupling this milestone closes).
- **SECURITY DEFINER function:** rejected — would require A5 privileged-function review; a bounded
  view + GUC filter achieves least privilege without a new privileged function.
- **HTTP domain service endpoint:** heavier; deferred (the view is the least-privilege DB contract
  compatible with the current runtime; a service endpoint remains a future option).

## Consequences
- App Intelligence depends only on the governed contract; `guardian_app_worker` has **0 C2
  base-table grants**. Domain Intelligence owns `domain_subject` + the contract. Proven live: base
  table DENIED; view resolves `DOM-SYNTH-0003`; wrong-jurisdiction not found; unknown → NULL (not
  illegal). No new SECURITY DEFINER/PUBLIC/anon; guardian 0 functions. A1–A5 intact; Production untouched.

## Rollback
Drop the view; re-grant SELECT on `domain_subject` to `guardian_app_worker` + restore the
`aw_domain_subject_sel` policy; revert the worker to the base-table query (migration `20260905220000`).
SafeBet IQ + the domain worker unaffected. Known-good C3 release `de4dd43…`.
