# Pilot Cryptographic Compromise Response (Milestone 4.2)

**ADR-006 (frozen) · PILOT NON-PRODUCTION ONLY.**

## 1. Controlled compromise workflow
Role required: `revocation-authority`. `PepperOperations.markCompromised(actor, jurisdiction, version, reason)`:
1. **Disable new contributions** for the affected jurisdiction (active pepper → `compromised`; no active
   pepper remains → `hashAttribute` fails closed).
2. **Invalidate** all relevant caches.
3. **Mark** the pepper version `compromised` and **destroy** its raw material (metadata retained).
4. **Preserve** the incident audit (`pepper-compromised` + `emergency-disablement`).
5. **Prevent** new matching using the compromised version (`computeHmac` rejects non-usable states).
6. **Assess** affected contribution records (out-of-band; historical hashes are marked by version).
7. **Provision** a new version through the authorised process.
8. **Re-establish** contributions via the future approved connector process (Phase 4.3+).
9. **Preserve** historical evidence with an explicit compromised-version marker.
10. **Require** security + privacy review (`approvedReview`) before reactivation.

## 2. Non-negotiables
- Historical federation records are **never** auto-deleted.
- A jurisdiction is **never** silently re-enabled — reactivation needs `approvedReview = true`.
- A compromised/revoked version is **never** reactivated — recovery uses a **new** version.
- New contributions **fail closed** while no usable pepper exists (no fallback).

## 3. Audit
Every step emits a secret-free, immutable audit event (`pepper-compromised`, `emergency-disablement`,
`cache-invalidated`, later `jurisdiction-reactivation`). No secret value or plaintext attribute is
recorded.

## 4. Validation
Tested: mark-compromised disables new contributions (fail closed); metadata preserved; reactivation
without approval rejected; recovery via a new approved version restores service.

## 5. Deployment binding
On the managed store, compromise integrates Secrets Manager version disablement + KMS key handling +
incident tooling; the incident + reactivation workflow is exercised as part of the managed C4 drill.
