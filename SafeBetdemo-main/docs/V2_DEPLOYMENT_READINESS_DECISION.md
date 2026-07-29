# Version 2.0 — Deployment Readiness Decision

**Milestone 3.8 · 2026-07-16 · ADR-006 (Accepted).**
**Production Status: UNCHANGED · Deployment: NOT AUTHORISED.**

Readiness is decided **separately per environment and scope** — no single broad "production
ready" conclusion is issued.

## 1. Domain implementation readiness → **APPROVED**
The Version 2.0 domain/architecture implementation (`lib/identityFederation`) is certified:
additive, isolated (both directions), deterministic, explainable, immutable-audited, integrity-
verifiable, privacy-preserving, ADR-006-compliant. 354/354 regression, `tsc` clean.

## 2. Isolated demonstration readiness → **APPROVED**
The National Demonstration Dataset v2.0 runs the real pipeline deterministically in-memory with
full reconciliation, all scenarios, isolation, access control, and no PII. Reset/reseed is safe
and idempotent. Approved for isolated demonstration use.

## 3. Supervised regulator demonstration readiness → **APPROVED WITH CONDITIONS**
Approved for a supervised regulator demonstration **subject to**:
- **C7** regulator legal + privacy approval before engaging an actual regulator;
- **synthetic data only** (no live/real data) until live integration is certified.

## 4. Controlled pilot readiness → **NOT APPROVED**
Blocked pending conditions **C1–C9** (live Event Platform ingestion + reconciliation, durable
regulator-plane DB + RLS, durable append-only audit storage, production HSM/Secrets Manager
pepper + rotation, live operator connector validation, backup/restore test, regulator legal
approval, deployed Consumer Platform regression, pilot operational-readiness review).

## 5. Production deployment readiness → **NOT APPROVED**
Production deployment remains **prohibited**. Requires all conditions (C1–C10) satisfied **and**
explicit post-certification authorisation. Do not enable federation in production; do not begin
production integration under this milestone.

## 6. Hard-gate confirmation
- **C2-1 Architecture — PASS** (hard gate).
- **C2-5 Consumer Platform Regression — PASS within library + import-boundary scope** (hard gate, scoped; deployed-runtime regression is condition C8).

## 7. Environment-scope summary
| Environment | Decision |
|---|---|
| Domain implementation | APPROVED |
| Isolated demonstration | APPROVED |
| Supervised regulator demonstration | APPROVED WITH CONDITIONS (C7; synthetic only) |
| Controlled pilot | NOT APPROVED (C1–C9) |
| Production deployment | NOT APPROVED (C1–C10 + authorisation) |

## 8. Standing constraints
All work remains on the Demo branch and demonstration environment. Production is untouched.
Federation is off by default. Commit/tag/deploy are owner-executed and require explicit
authorisation not granted by this certification.
