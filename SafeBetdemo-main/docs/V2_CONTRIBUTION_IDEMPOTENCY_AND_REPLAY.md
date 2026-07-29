# Contribution Idempotency & Replay (Milestone 4.3)

**ADR-006 (frozen) · PILOT NON-PRODUCTION ONLY.**

## 1. Content idempotency (server-derived)
Idempotency identity = `tenantId ␟ sbPlr ␟ attributeType ␟ pepperVersion ␟ digest`. The operator-supplied
`idempotencyKey` is validated but **not** authoritative. The same valid content, resubmitted:
- is accepted **once**; produces **one** authoritative contribution;
- produces **no** duplicate matching input, candidate, decision, or SB-NAT;
- returns/references the original acceptance; records safe duplicate diagnostics.

## 2. Duplicate categories (distinguished, not collapsed)
| Category | Detection | Outcome |
|---|---|---|
| Replay (same eventId) | `seenEventIds` | return original acceptance; audit `replay-detected` |
| Content-duplicate (new eventId) | content key seen | return original; audit `duplicate-detected` |
| Legitimate new version | new content key | accepted |
| Repeated after rotation | new pepper version → new content key | accepted (segregated by version) |
| Different operator | different tenant → different content key | **preserved** (cross-operator evidence) |
| Superseding | `supersedesEventId` reference | accepted; supersession recorded |
| Revoked | revocation log | excluded from new matching |

**Cross-operator evidence is never collapsed merely because the digest matches** — the tenant is part of
the content key, so two operators contributing the same value produce two authoritative contributions
(operator attribution preserved).

## 3. Replay protection
Replay uses eventId + content key + (optional) source sequence + accepted-event history. Replays are
rejected or safely deduplicated; they cannot create duplicate candidates, inflate evidence, trigger
duplicate decisions, mint duplicate SB-NAT, or distort audit counts (tested).

## 4. Restart safety
Idempotency + replay state is derived from the append-only accepted log — rebuildable after restart
(the accepted log is the source of truth; managed durable binding is C2/C3).
