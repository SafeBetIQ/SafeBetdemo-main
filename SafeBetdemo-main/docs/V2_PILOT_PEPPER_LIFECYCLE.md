# Pilot Pepper Lifecycle (Milestone 4.2)

**ADR-006 (frozen) · PILOT NON-PRODUCTION ONLY. Metadata never contains secret material.**

## 1. States
`provisioned · active · transition · retired · revoked · compromised · disabled`.

## 2. Valid transitions (`PEPPER_TRANSITIONS`)
| From | To |
|---|---|
| provisioned | active, revoked, compromised, disabled |
| active | transition, retired, revoked, compromised, disabled |
| transition | retired, revoked, compromised, disabled |
| retired | revoked, compromised |
| revoked | — (terminal) |
| compromised | — (terminal) |
| disabled | active (reactivation, approved review only) |

Every transition is **authorised** (least-privilege role), **audited** (secret-free), **jurisdiction-
bound**, **versioned**, and explainable. An active pepper is **never silently replaced**.

## 3. Usability for hashing
`computeHmac` accepts **active** and **transition** versions only. `retired / revoked / compromised /
disabled` are rejected (fail-closed) for new hashing. Historical hashes already produced remain valid
(SafeBet IQ does not retain plaintext, so it never recomputes them).

## 4. Material handling
- Raw material is generated (`randomBytes`) into a non-exported module WeakMap; no getter/serialisation.
- On **revoke** / **compromise**, the material is **destroyed**; metadata is **retained** (audit + history).

## 5. Metadata (safe)
jurisdiction, version, state, algorithm, canonical-format version, normalisation version, opaque
`secretRef` (`pilot-nonproduction/…`), activation/retirement timestamps, rotation ref, actor, audit ref.
Never: raw/encoded pepper, reversible derivative, full secret response, store credentials.

## 6. Deployment binding
State transitions map onto Secrets Manager/HSM version lifecycle + KMS at-rest encryption at deployment
(condition C4).
