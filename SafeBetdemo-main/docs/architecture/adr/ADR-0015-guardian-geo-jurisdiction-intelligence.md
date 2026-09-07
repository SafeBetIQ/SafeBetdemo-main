# ADR-0015 — SafeBet Guardian Geo & Jurisdiction Intelligence (ARCH-V4-C5)

- **Status:** Accepted (synthetic Demo only; not production)
- **Date:** 2026-09-07
- **Supersedes/relates:** ADR-0009..0014 (Guardian intelligence domains C2–C4);
  ADR-0012 (Domain Reference Contract), ADR-0014 (Payment Intelligence).

## Context
Guardian needs jurisdiction/geo intelligence at the **property/service** level (does a
synthetic service appear available in a region consistent with its licence scope?) without
becoming an individual-surveillance system. The regulatory value is jurisdiction-consistency
review; the risk is person-level tracking.

## Decision
Add a fifth intelligence domain, **Geo & Jurisdiction Intelligence**, mirroring the
established Guardian pattern:

1. **Privacy boundary as a first-class invariant** — `GEO INTELLIGENCE ≠ INDIVIDUAL
   SURVEILLANCE`. No person entity, no person-level column, an enforced
   `PROHIBITED_PERSON_FIELDS` reject-list at ingest, and a privacy test. Aggregate-region
   signals only.
2. **10 `guardian`-schema tables** with jurisdiction, synthetic marker, RLS, append-only
   observation/history (trigger-guarded), and DB CHECK invariants
   (`is_illegal_determination = false`, `is_enforcement_authorised = false`). No
   `ILLEGAL_IN_REGION` state.
3. **Governed cross-module contracts only** — C1 `resolveLegalReference`, C2/C3/C4 reference
   contracts. C5 **formalises the C4 Payment Reference Contract**
   (`guardian.payment_reference` view + `resolvePaymentReference`) so Geo obtains
   payment-channel jurisdiction context without touching C4 base tables.
4. **Dedicated least-privilege role** `guardian_geo_worker` + dedicated Secrets Manager
   secret `safebet-guardian/geo-worker-db` (not reusing domain/app/payment workers). Grants:
   only the 10 geo tables + `audit_context` + SELECT on the three contract views. No
   BYPASSRLS, no public/IQ, no C2/C3/C4 base tables.
5. **Durable pipeline** — SQS `guardian-geo-observation` + DLQ (maxReceiveCount 2, visibility
   15, ReportBatchItemFailures) + worker Lambda `safebet-guardian-geo-worker` + DLQ alarm.
6. **IAM-protected API** — `/geo`, `/geo/:id`, `/geo/:id/observations`, `/geo/observe`,
   `/geo/:id/review`. No `geoBlock`/`illegal`/`enforce` field.

## Consequences
- Geo inconsistencies are **explainable, deterministic review signals** — never legal
  findings or enforcement. Enforcement orchestration remains a separate future milestone.
- The Payment Reference Contract completes the four governed reference contracts (Legal /
  Domain / App / Payment), so every cross-module link is bounded and jurisdiction-scoped.
- Strictly synthetic Demo; SafeBet IQ and Production are untouched.

## Carried-forward architectural debt (P1, unresolved)
1. Separate, independently governed Guardian database.
2. MFA enforcement before real privileged regulatory users.
3. Duplicate `safebetiq.com` hosted-zone consolidation.
