# Phase 4 — Condition C1 (Contribution Wiring) Closure Evidence (Milestone 4.3)

**2026-07-16 · ADR-006 (frozen). C1: PARTIALLY CLOSED** — the operator-contribution & Event-Platform
wiring portion is done; the live connector (4.4) and live wager/GGR reconciliation (4.5) are OPEN.

## C1 — verbatim
- **Condition:** "Live Event Platform contribution wiring + live reconciliation."
- **Test of satisfaction:** "Live wager/GGR events flow → certified projections; live operator↔national reconciliation report passes."

## What is DONE (contribution & Event Platform wiring)
| Requirement | Evidence |
|---|---|
| Hash-only contribution contract | `IDENTITY_FEDERATION_ATTRIBUTE`; strict schema + runtime PII rejection (tested) |
| Flow through the Event Platform (no downstream bypass) | `FederationEventPlatform` authoritative; projector → certified engine (tested e2e) |
| Tenant/operator attribution + SB-PLR validation | authenticated-context + Identity Resolution checks (tested) |
| Jurisdiction + attribute-policy + crypto-version enforcement | full pipeline (tested) |
| Idempotency + replay + duplicate handling | content-key dedup; cross-operator preserved (tested) |
| Sequencing | duplicate rejected; out-of-order audited (tested) |
| Append-only accepted records + provenance | reconstructable; candidate provenance (tested) |
| Projection → certified Matching Engine | deterministic, version-segregated (tested e2e) |
| Revocation + expiry (history preserved) | excluded from new matching; originals kept (tested) |
| Dead-letter + bounded retry (no payload) | classified, retryable, resolved on retry (tested) |
| Deny-by-default access | operators/unauth denied submit + read (tested) |
| Secret-free, PII-free audit | tested |
| End-to-end through real boundaries | contribution → matching → decision → SB-NAT (tested) |

## What is NOT done (OPEN → later milestones)
- **Live operator connector** (authn onboarding, transport, suspension/revocation) → **Phase 4.4**.
- **Live Event Platform transport + live wagering/GGR reconciliation** → **Phase 4.5** (the "live
  reconciliation" half of C1's test).
- **Managed durable persistence + RLS** for contribution records → **C2/C3** deployment bindings.

## Status & retest to fully close C1
- **Status: PARTIALLY CLOSED.**
- **Retest to close:** live wager/GGR events flow through the certified Event Platform → certified
  projections; the **live operator↔national reconciliation report passes** on the managed environment
  (4.4 + 4.5 + C2/C3).

## Cross-condition confirmation (unchanged)
C2 PARTIALLY CLOSED · C3 PARTIALLY CLOSED · C4 PARTIALLY CLOSED · C10 CLOSED. No status altered without
new evidence; native RLS / DB append-only / managed secret-store bindings remain open.
