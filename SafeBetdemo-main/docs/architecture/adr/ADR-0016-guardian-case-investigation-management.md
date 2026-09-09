# ADR-0016 — SafeBet Guardian Case & Investigation Management (ARCH-V4-C6)

- **Status:** Accepted (synthetic Demo only; not production)
- **Date:** 2026-09-07
- **Relates:** ADR-0009..0015 (Guardian intelligence domains C1–C5); C0 identity/SoD/case/evidence primitives.

## Context
Guardian intelligence (C1–C5) produces deterministic, non-legal review signals. A governed
HUMAN investigation layer is needed to link those signals into cases with evidence,
chronology, findings and review — WITHOUT becoming a legal-finding or enforcement engine.

## Decision
Add a sixth domain, **Case & Investigation Management**, mirroring the Guardian pattern:

1. **Fundamental boundary as invariant** — intelligence ≠ legal finding; case opened ≠
   illegal; high priority ≠ enforcement; finding ≠ final legal determination; case closed ≠
   provider action. DB CHECKs (`is_legal_determination=false`, `is_enforcement_authorised=
   false`) on case/finding/review; no enforcement status; no `ILLEGAL_OPERATOR_CONFIRMED`.
2. **12 `guardian`-schema tables** with jurisdiction, synthetic marker, RLS, append-only
   chronology + status/priority history (trigger-guarded), reference-based minimisation.
3. **Governed contracts only** — C1 `resolveLegalReference`, C2/C3/C4 reference contracts,
   and the **new C5 Geo Reference Contract** (`guardian.geo_reference` +
   `resolveGeoReference`). The case worker holds SELECT on the four reference views only —
   never a C2–C5 base table.
4. **Dedicated least-privilege role** `guardian_case_worker` + dedicated secret
   `safebet-guardian/case-worker-db`. Grants: only the 12 case tables + `audit_context` +
   SELECT on the four contract views. No BYPASSRLS, no public/IQ, no base tables.
5. **Durable intake** — SQS `guardian-case-intake` + DLQ + worker
   `safebet-guardian-case-worker` + DLQ alarm. Idempotent by `(jurisdiction,
   idempotency_key)`. A system-recommended intake creates a DRAFT case only.
6. **SoD reused** — `evaluateSod` proves same-principal investigate+review is denied; a
   distinct reviewer passes. No enforcement SoD is built.
7. **IAM-protected API** — `/cases` (+ bounded sub-resources). No `/enforce`, `/block`,
   `/takedown`, `/referral`. No provider-response lifecycle.

## Consequences
- Multi-signal correlation is evidence for a human investigation, never automatic
  illegality or an enforcement recommendation. No AI legal decision; no black-box score.
- The Geo Reference Contract completes five governed reference contracts (Legal / Domain /
  App / Payment / Geo).
- Strictly synthetic Demo; SafeBet IQ and Production untouched; MFA hard gate intact.

## Carried-forward architectural debt (P1, unresolved)
1. Separate, independently governed Guardian database.
2. MFA enforcement before real privileged regulatory users.
3. Duplicate `safebetiq.com` hosted-zone consolidation.
