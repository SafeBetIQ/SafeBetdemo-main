# Pilot Secret Cache Policy (Milestone 4.2)

**ADR-006 (frozen) · PILOT NON-PRODUCTION ONLY.**

## 1. What is cached
The provider caches, per jurisdiction: the **active pepper version pointer**, the **recognised-versions
list**, and a timestamp. **No secret value is ever cached** — only version metadata.

## 2. Policy
| Aspect | Policy |
|---|---|
| Cache key | jurisdiction |
| Duration (TTL) | bounded (default 30 s) |
| Jurisdiction separation | one entry per jurisdiction; never shared |
| Pepper-version separation | recognised-versions list is per jurisdiction |
| Invalidation | rotation, revocation, compromise, disablement, explicit `invalidateCache`, TTL expiry |
| Process restart | cold — cache is empty; repopulated on first lookup |
| Secret-store outage | `activeVersion` fails closed; nothing cached; no stale fallback |
| Concurrent retrieval | single-threaded; deterministic; last-writer consistent |
| Stale after revocation | **not used** — invalidation on revoke/compromise/disable forces a fresh lookup that fails closed |

## 3. Memory exposure (honest limitation)
The JavaScript runtime **cannot guarantee memory zeroisation**; this policy does **not** claim it. The
cache holds only version metadata (no secret). Raw pepper material lives in the secret store's non-
exported WeakMap; on revoke/compromise the material is deleted from the map, but the runtime may retain
freed memory until GC — **stated honestly, not claimed as zeroised**.

## 4. Fail-closed
When an approved pepper cannot be safely obtained (outage / disabled / revoked / unknown version), the
provider **fails closed** and never continues using stale material.

## 5. Deployment binding
On the managed store, caching integrates with Secrets Manager client caching + KMS; TTL/invalidation
policy carries over. Managed-store validation is part of the C4 closure test.
