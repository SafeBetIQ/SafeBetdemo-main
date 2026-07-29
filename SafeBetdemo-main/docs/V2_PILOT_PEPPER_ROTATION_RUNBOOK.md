# Pilot Pepper Rotation Runbook (Milestone 4.2)

**ADR-006 (frozen) · PILOT NON-PRODUCTION ONLY. Do NOT rotate production peppers.**

## 1. Why governed rotation (not central re-hash)
SafeBet IQ retains no plaintext identity attributes, so historical hashes **cannot** be recomputed
centrally after rotation. Rotation is therefore a **governed dual-version transition**, not a re-hash.

## 2. Rotation procedure (`PepperOperations.rotate`)
Role required: `key-admin` or `rotation-authority`.
1. Provision a new pepper version (state `provisioned`).
2. Activate the new version (state `active`) — it becomes primary for new contributions.
3. Move the previous active version to `transition` (still recognised for a bounded period).
4. Record which pepper version produced every contribution (`ContributionCryptoStamp.pepperVersion`).
5. Emit a `rotation-completed` audit; invalidate the provider cache.
6. Retire the previous version (`retire()`) only after approved transition criteria are met.

## 3. Guarantees
- New contributions use the **new primary**; old + new are both **recognised** during transition.
- **Old and new HMAC outputs are NOT equal** and `sameCryptoVersion()` is false — the Matching Engine
  must segregate by version and never compare incompatible versions as equal.
- Historical audit + decisions remain reproducible (version metadata preserved).
- Neither pepper is ever exposed to an operator read API.

## 4. Failure & rollback
- Rotating to an **existing** version fails and **rolls back** (previous version stays active) — no
  partial state (tested).
- If activation of the new version fails before completion, the previous version remains active
  (fail-closed; no zero-active window is observable within the synchronous operation).

## 5. Transition criteria (before retiring the old version)
- All expected operators have re-contributed under the new version (Phase 4.3+), OR
- The approved bounded transition period has elapsed, AND
- No unresolved integrity/security concern exists.
Only then call `retire(old)`.

## 6. Deployment binding
On the managed store, rotation maps to Secrets Manager version staging + KMS; the **rotation + recovery
exercise on the managed store** is the outstanding C4 closure test.
