# SafeBet Guardian — Digital Evidence Vault (ARCH-V4-C7)

**Status:** Planned / in development (synthetic Demo only). Not live, not production, no real
evidence, no real regulator users, no enforcement.

The Digital Evidence Vault is Guardian's regulator-grade evidence lifecycle **above** the
Shared Evidence primitive (which it does **not** replace).

## Lifecycle
```
ACQUIRE/RECEIVE -> REGISTER -> HASH -> CLASSIFY -> STORE/REFERENCE -> CHAIN OF CUSTODY ->
ACCESS -> VERIFY -> LINK TO CASE -> PRESERVE -> SUPERSEDE/DERIVE -> RETENTION/HOLD -> EXPORT -> AUDIT
```

## Principles (encoded + tested)
- EVIDENCE EXISTS != LEGAL FINDING
- EVIDENCE LINKED TO CASE != ILLEGAL OPERATOR
- HASH VERIFIED != FACT LEGALLY PROVEN
- HIGH-VALUE EVIDENCE != ENFORCEMENT AUTHORISATION

C7 manages **provenance + integrity**; it does not decide legal consequence, does not
enforce, does not contact providers. DB CHECKs forbid `is_legal_determination=true` AND
`is_enforcement_authorised=true` on `guardian_evidence` / `guardian_evidence_export`.

## Shared Evidence relationship
Shared Evidence (`@/lib/platform/evidence`) remains the underlying platform primitive. The
Vault adds the Guardian-specific governed lifecycle (registration, hashing, custody, holds,
export) and stores **references + hashes**, never duplicated bodies.

## Integrity (ADR-0017 "layered")
- **Content:** SHA-256 `content_hash`. **C7** registration verification operated over the
  synthetic registration input (in-memory body) at register time. **C7.2** adds verification
  against the **actual stored S3 bytes** via the dedicated least-privilege reader
  (`guardian-evidence-reader`, `s3:GetObject` on `evidence/*` only) after access-policy
  evaluation — see [GUARDIAN_EVIDENCE_ACCESS_POLICY.md](./GUARDIAN_EVIDENCE_ACCESS_POLICY.md).
  (Historical note: C7 did not have a GetObject/retrieval path; earlier wording that implied
  "verified after retrieval" is corrected here — retrieval-from-storage arrived in C7.2.)
- **Custody:** an independent **per-evidence tamper-evident hash chain**
  (`sequence_number` + `previous_event_hash` -> `event_hash`), **anchored** to Shared Audit
  (each material custody event also writes `audit_context`). Shared Audit is
  jurisdiction-scoped; the per-evidence chain gives precise custody integrity.

## Storage
Private S3 vault `safebet-guardian-evidence-demo` (eu-west-1): **all public access blocked**,
SSE-AES256, versioning enabled, TLS-only deny policy. Proven: anon GET/LIST -> 403. The
evidence worker holds `s3:PutObject` on the `evidence/*` prefix only. No permanent public
URL. Deterministic object key (`evidence/<jur>/<evidence_id>`) -> retry-safe/idempotent, so a
DB failure after store leaves a reconcilable orphan (same key on redelivery).

## Governed contracts only
Case context via the new **Case Reference Contract** (`guardian.case_reference` +
`resolveCaseReference`); C1-C5 origins via their existing reference contracts. The evidence
worker holds SELECT on `case_reference` only — never a C1-C6 base table (proven live).

## API
`GET /evidence`, `GET /evidence/:id`, `POST /evidence/register`, `POST /evidence/:id/verify`,
`GET /evidence/:id/custody`, `POST /evidence/:id/{link-case,hold,export}`. IAM-protected;
every surface carries `isLegalDetermination:false`, `isEnforcementAuthorised:false`. No
`/enforce` / `/block` / `/takedown` / `/referral`; no provider-response lifecycle.
