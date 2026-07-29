# SB-NAT Registry Runtime Encapsulation (CERT-L1 / C10 · Milestone 4.1)

**ADR-006 (frozen) · Closes certification finding CERT-L1 / condition C10.**

## 1. The finding (recap)
Certification CERT-L1 (LOW): the registry used TypeScript `private` for internal state, which is
compile-time only at the project's build target — internal state was theoretically reachable at
runtime. No approved public path fabricated an SB-NAT, but runtime privacy was not enforced.

## 2. Approach (approved Phase 4.0 recommendation)
**Module-closure encapsulation + adversarial runtime tests + service-boundary hardening** — with **no
global TypeScript target change** and **no ECMAScript `#private`** (unsupported at the current target).

Implementation in `registry.ts`:
- Internal state (records, counters, minted ids, assignments, clock, audit sink, journal) is held in a
  **non-exported module-scoped `WeakMap`** keyed by the instance. There is no exported handle and no
  instance property mirrors it.
- All mutation logic (`mint`, `commit`, `write`, `assign`, `audit`, `linkMember`, `noteDecision`,
  `assertCreatable`, `activeRecordOf`, `requireActive`, …) is **non-exported module functions** taking
  the state — they are **not methods on the instance**.
- The class exposes only the **governed public API**: `create`, `reEvaluate`, `split`, `merge`,
  `retire`, `archive`, `get`, `exists`, `findBySbPlr`, `list`, `auditTrail`, `reconstructMappingAt`,
  `assignmentHistory`, `snapshot`, `verifyIntegrity`, `diagnostics`.
- Returned records + history are **deep-frozen**; returned lists are copies.

## 3. What is now impossible at runtime
- `registry.records` / `counters` / `mintedIds` / `assignments` / `auditSink` → `undefined`.
- `registry.commit` / `mint` / `write` / `assign` / `audit` → do not exist.
- No `set` / `insert` / `put` / `add` surface; mutating a returned list/record does not affect state.
- No counter reset; no audit rewrite; no bypass of approved-decision validation (no `commit()` path).

## 4. Adversarial validation (`tests/identityFederation.encapsulation.test.mjs`)
7/7 runtime tests (not compile-time): ENC-1 state unreachable · ENC-2 mutation internals absent ·
ENC-3 immutable records/history · ENC-4 arbitrary insertion impossible · ENC-5 counter cannot reset ·
ENC-6 audit trail immutable · ENC-7 approved-decision validation cannot be bypassed.

## 5. Compatibility & regression
Public API + domain semantics unchanged; **375/375** regression green; `tsc --noEmit` clean. No new
ADR required (registry contract preserved; no architectural change).

## 6. Status
**C10 CLOSED** at the current build target. (A future global ES2015+ target upgrade with ECMAScript
`#private` remains a separate, optional build-governance decision — **not** required for C10.)
