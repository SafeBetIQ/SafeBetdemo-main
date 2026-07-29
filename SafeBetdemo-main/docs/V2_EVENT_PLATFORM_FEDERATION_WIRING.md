# Event Platform Federation Wiring (Milestone 4.3)

**ADR-006 (frozen) · PILOT NON-PRODUCTION ONLY. The Event Platform is authoritative for accepted contributions.**

## 1. Flow
```
(Operator Connector Boundary — Phase 4.4, NOT built here)
  → Hash-only Federation Contribution (4.2 crypto)
  → Certified Event Platform (validate + persist + audit)   ← authoritative
  → Contribution Projector (deterministic)
  → certified Identity Matching Engine (candidates only)
  → certified Federation Decision Engine → SB-NAT Registry → Correlation → Policy
```
No direct insertion into matching inputs, decision records, the Registry, the Correlation Layer, the
Policy Platform, or regulator-plane tables — everything goes through the Event Platform + projector.

## 2. Acceptance pipeline (all must pass)
schema → auth/attribution → tenant → jurisdiction → SB-PLR (Identity Resolution) → attribute policy →
cryptographic version → idempotency → replay → sequence → privacy → persistence → audit → (projection +
matching handoff are pull-based + deterministic, rebuildable from accepted events).

## 3. Acceptance record
event id, acceptance timestamp, tenant, operator, jurisdiction, SB-PLR, attribute type, digest ref,
content key, version metadata, idempotency ref, source sequence, expiry, revocation flag, provenance
ref, audit ref. No plaintext PII.

## 4. Authority & boundaries
- Accepted contributions are **append-only** and reconstructable.
- The certified Matching / Decision / Registry components are **unchanged**; the projector emits the
  certified `FederationContribution[]` input model.
- The Event Platform never makes a federation decision, mints an SB-NAT, or modifies operator runtime.

## 5. Deployment binding
The pilot boundary is in-process/non-production; the managed Event Platform transport (topics/queues) +
durable persistence + live wager/GGR reconciliation are **Phase 4.4/4.5 + C1/C2/C3** bindings.
