# Operator Connector Architecture (Milestone 4.4)

**ADR-006 (frozen) · Vendor-neutral · NON-PRODUCTION sandbox.**

## 1. Flow
```
Operator Sandbox Source → Operator Connector → local normalisation →
hash-before-boundary HMAC (4.2) → hash-only contribution →
certified Event Platform (4.3) → projection → Identity Matching Engine
```
The connector never bypasses the Event Platform and never inserts into matching inputs, decisions, the
SB-NAT Registry, the Correlation Layer, national policy, or regulator-plane tables.

## 2. Responsibilities
Read approved synthetic source records · resolve the tenant-scoped SB-PLR · normalise + hash approved
attributes **before** the boundary · build the hash-only contribution · submit via the Event Platform ·
manage checkpoint/idempotency/sequence · enforce rate limit + backpressure · handle retry/dead-letter ·
support suspension/revocation/corrections · expose safe health + reconciliation.

## 3. Write-only w.r.t. federation
The connector holds handles only to: the sandbox source, the 4.2 crypto provider, an SB-PLR resolver, and
the Event Platform (submit + revoke). It has **no** Registry/Correlation/Policy handle → it structurally
cannot read SB-NAT, matching candidates, decisions, cross-operator intelligence, or national policy.

## 4. Components (`lib/identityFederation/connector/`)
- `model.ts` — contract, lifecycle, authenticator (WeakMap secrets), sandbox source, checkpoint, audit, reconciliation.
- `connector.ts` — `OperatorConnector` orchestration.

## 5. Deployment model
Local in-process component in the pilot (test/sandbox). Managed deployment (container/worker/service),
external vendor sandbox, and durable checkpoint store are **deployment bindings** (C5 residual + C2).
