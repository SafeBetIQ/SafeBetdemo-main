# SafeBet Guardian — Evidence Access Policy (ARCH-V4-C7)

Evidence access combines **role x jurisdiction x classification x purpose** (deterministic,
synthetic). No universal service-role access for ordinary human use.

## Jurisdiction (hard boundary — RLS)
Evidence is jurisdiction-scoped. Proven: ZA-GP principal -> ZA-GP evidence PASS; ZA-GP ->
ZA-WC DENIED; SafeBet IQ `casino_admin` -> DENIED; `anon` -> DENIED. No cross-jurisdiction leak.

## Classification ceiling
| Role | Max classification |
|---|---|
| INVESTIGATOR | RESTRICTED |
| AUTHORISING_OFFICER | RESTRICTED |
| LEGAL_REVIEWER | HIGHLY_RESTRICTED (bounded higher profile) |
| SYSTEM_SERVICE | HIGHLY_RESTRICTED (approved automated operations only) |

An Investigator requesting HIGHLY_RESTRICTED -> **DENIED** (`CLASSIFICATION_ABOVE_ROLE`); a
Legal Reviewer with a legal-review purpose -> ALLOW.

## Purpose limitation
Access requires a purpose: CASE_INVESTIGATION, INTEGRITY_VERIFICATION,
LEGAL_REVIEW_PREPARATION, AUDIT, EXPORT_PREPARATION, SYSTEM_MAINTENANCE. No purpose ->
DENIED (no arbitrary browsing). Every decision is recorded
(`guardian_evidence_access_event`, ALLOW/DENY with reason).

## Storage access (retrieval — C7.2)
No permanent public object URL. Retrieval is performed by the **dedicated least-privilege
reader** `guardian-evidence-reader` (IAM `s3:GetObject` on `arn:…:safebet-guardian-evidence-demo/
evidence/*` only — **no** ListBucket, **no** DeleteObject, **no** PutObject; separate from the
writer). The reader evaluates the access policy (role x jurisdiction x classification x purpose)
**before** any GetObject, verifies SHA-256 over the **actual retrieved bytes** vs the canonical
hash, and records an audited access event + an `ACCESSED` custody event. Denials never read
bytes. The branded API `POST /evidence/:id/retrieve` delegates to the reader (the credential-free
API Lambda holds no S3/DB). Pre-signed URLs are not used; if introduced later they must be
short-lived, purpose-bound, single-object, and audited. Proven anon GET/LIST 403.

## MFA
MFA hard gate remains: no real Investigator / Legal Reviewer / Authorising Officer
activated. All C7 access tests use synthetic identities.
