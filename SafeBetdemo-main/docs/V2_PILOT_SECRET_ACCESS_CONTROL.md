# Pilot Secret Access Control (Milestone 4.2)

**ADR-006 (frozen) · Least privilege · PILOT NON-PRODUCTION ONLY.**

## 1. Authorities (separated)
| Authority | Role | Operations |
|---|---|---|
| Provisioning | `key-admin` | `provision`, `reactivate` (with approved review) |
| Rotation | `key-admin` / `rotation-authority` | `rotate`, `retire` |
| Revocation / emergency | `revocation-authority` | `revoke`, `markCompromised`, `disableJurisdiction` |
| Runtime retrieval (hashing) | **no admin role** | `hashAttribute` (domain path) — cannot provision/rotate/revoke |
| Audit review | `auditor` | read the crypto audit |

`requireRole()` enforces these at the operations boundary; unauthorised calls throw `CryptoError`
(`unauthorised`) — tested.

## 2. Raw-secret protection
- Raw peppers live in a **non-exported module WeakMap**; there is **no** `store.raw`, getter, export, or
  serialisation (finding CRYPTO-F1 fixed in-milestone).
- The store computes HMAC internally — the **pepper never leaves** the store boundary.
- The provider exposes no secret-store client and no raw material.

## 3. What is application-enforced vs deployment-bound
| Control | 4.1/4.2 (application) | Deployment binding (C4) |
|---|---|---|
| Runtime least-privilege retrieval | role model + narrow surface | IAM role scoped to the pilot jurisdiction secret paths |
| Provision/rotate/revoke separation | actor roles | IAM policy separation |
| No production secret access | no cloud SDK / env / production ref in code | IAM deny to production secret paths |
| At-rest encryption | n/a (in-memory pilot) | KMS-backed Secrets Manager / HSM |

## 4. Guardrails
No broad secret administration to the application runtime; no access to production secret paths; secret
name/reference makes the non-production boundary explicit (`pilot-nonproduction/…`); no secret in source
control.
