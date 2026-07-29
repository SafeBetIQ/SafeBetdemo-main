# Financial Event Idempotency & Replay (Milestone 4.5)

**ADR-006 (frozen) · No duplicate financial effect.**

## 1. Content idempotency (server-derived)
Content key = `tenant ␟ eventType ␟ sessionId ␟ wagerId ␟ settlementResult`. The same financial content
produces **one** authoritative effect; duplicates reference the original acceptance.

## 2. Replay protection
A replayed eventId returns the original acceptance. A replay must not increase turnover/GGR, create a second
win/loss, duplicate a refund/void, inflate player-risk indicators, or inflate operator/national totals. All
enforced (tested: GGR unchanged by replay + content-duplicate).

## 3. Ordering
Duplicate source sequence → `invalid-sequence`. Settlement before wager → `settle-unknown-wager` (until the
wager exists). Corrections reference an accepted event. Inconsistent sequences are not silently accepted.

## 4. Repeated delivery (all event types)
Session/wager/settlement/win/loss/void/refund/correction repeats each resolve to **one** authoritative
financial effect; duplicate attempts are recorded safely (audit) with no double impact.

## 5. Restart safety
Idempotency/replay state derives from the append-only accepted log — rebuildable after restart (durable
binding = C2/C3).
