# Phase 4 — Condition C5 Closure Evidence (Milestone 4.4)

**2026-07-16 · ADR-006 (frozen). C5: PARTIALLY CLOSED** — connector implemented + integration-tested vs a
controlled in-process sandbox; external-vendor + deployed-runtime evidence OPEN.

## C5 — verbatim
- **Condition:** "Live operator connector validation."
- **Test of satisfaction:** "Each operator connector ingests hash-only contributions; isolation negative tests pass."

## What is DONE
| Requirement | Evidence |
|---|---|
| Connector ingests hash-only contributions | connector → hash-before-boundary (4.2) → Event Platform (4.3); accepted (tested, e2e) |
| **Isolation negative tests pass** | cross-tenant SB-PLR rejected; tenant/jurisdiction switch impossible; no shared state; no federation read (tested) |
| Lifecycle (starts disabled; explicit activation) | provisioned→active; transitions guarded (tested) |
| Authentication bound to one operator/tenant/jurisdiction | invalid/expired/revoked/binding-mismatch rejected (tested) |
| Hash-before-boundary / no plaintext into SafeBet IQ | plaintext discarded after HMAC; scan clean (tested) |
| SB-PLR resolution (never creates SB-PLR) | tenant-scoped validation; missing/invalid/cross-tenant rejected (tested) |
| Checkpoint + restart + idempotency | resumes; no duplicate evidence (tested) |
| Rate/backpressure + retry/dead-letter | circuit + bounded retry + safe dead-letter (tested) |
| Suspension + revocation (history preserved) | suspend stops; revoke terminal + credential denied (tested) |
| Source corrections/revocations | prior contribution revoked, original preserved (tested) |
| Reconciliation (no silent loss) | balanced accounting (tested) |
| Multi-operator isolation | separate auth/tenant/checkpoint/audit; cross-tenant denied (tested) |
| Audit (secret/PII-free) | append-only, no PII (tested) |
| End-to-end | two connectors → one certified matching candidate (tested) |

## What is NOT done (OPEN → residual)
- **External operator sandbox connectivity** — only a controlled in-process simulator was used.
- **Deployed connector runtime** — integration-tested, not deployed.

## Status & retest to fully close C5
- **Status: PARTIALLY CLOSED.**
- **Retest to close:** run the connector against an external/approved operator sandbox in a **deployed**
  non-production runtime; re-run isolation negatives there. (Same connector code; only the source binding +
  deployment change.)

## Cross-condition confirmation (unchanged)
C1 PARTIALLY CLOSED · C2 PARTIALLY CLOSED · C3 PARTIALLY CLOSED · C4 PARTIALLY CLOSED · C10 CLOSED. No
status altered without new evidence; live wager/GGR reconciliation, native RLS, DB append-only, and managed
Secrets Manager/HSM bindings remain open.

## Addendum — Milestone 4.6B (2026-07-16): no new deployed C5 evidence
The connector was **not** run as an independently deployed service in 4.6B — it has no HTTP/worker deployment
surface (frozen design) and no managed runtime was available (invalid AWS session). It remains an in-process
component (4.4/4.6A). Per the brief ("if the connector cannot be independently deployed, C5 must remain
partially closed"), **C5 remains PARTIALLY CLOSED**; external-vendor evidence also remains open. See
`V2_DEPLOYED_CONNECTOR_EVIDENCE.md`.
