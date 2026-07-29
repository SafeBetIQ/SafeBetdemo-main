# Pilot Pepper Recovery Runbook (Milestone 4.2)

**ADR-006 (frozen) · PILOT NON-PRODUCTION ONLY.**

## 1. Principle
Recovery restores the ability to produce new contributions **without** exposing or reusing compromised
material, and **without** deleting historical metadata, audit, decisions, or breaking jurisdiction
isolation / evidence reproducibility.

## 2. Recovery scenarios & response
| Scenario | Response |
|---|---|
| Secret-store temporary outage | `computeHmac` fails closed → contributions rejected; retry after recovery; no fallback |
| Incorrect active-version pointer | Read `rotationState()`; re-activate the correct version (approved) or rotate forward |
| Failed rotation | Rolls back automatically (previous version stays active); re-attempt with a fresh version |
| Lost runtime access | Restore least-privilege retrieval role (deployment/IAM); no code change |
| Accidental disablement | `reactivateJurisdiction(version, approvedReview=true)` |
| Compromised pepper | See compromise-response runbook; provision + activate a NEW version |
| Corrupted secret metadata | Re-provision the version metadata (audit trail preserved) |
| Cache inconsistency | `invalidateCache(jurisdiction)` |
| Regional service disruption | Fail closed for the affected sovereign jurisdiction only; others unaffected |
| Rollback to prior version | Only if that version is still `active`/`transition`; retired/revoked/compromised are never reactivated |

## 3. What recovery preserves
Audit history · historical version metadata · existing federation decisions · Registry integrity ·
jurisdiction isolation · evidence reproducibility. **Historical metadata is not deleted** on
retirement/compromise.

## 4. Fail-closed guarantee
While a jurisdiction has no active/usable pepper, new contributions **fail closed** — never falling back
to unkeyed SHA-256, a global/demo pepper, a hard-coded secret, or plaintext comparison.

## 5. Reactivation control
A disabled jurisdiction is reactivated only with `approvedReview = true` (security + privacy review);
otherwise rejected (`reactivation-not-approved`). A compromised/revoked version is **never** reactivated
— recovery uses a **new** version.

## 6. Deployment binding
On the managed store, recovery integrates Secrets Manager backup/restore + KMS + regional failover
(conditions C4/C6). The managed rotation + recovery exercise is the outstanding C4 closure test.
