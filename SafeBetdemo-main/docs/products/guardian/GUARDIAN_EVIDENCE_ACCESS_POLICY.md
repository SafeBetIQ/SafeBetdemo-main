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

## Storage access
No permanent public object URL. Retrieval is application-mediated; the private vault blocks
all public access (proven anon GET/LIST 403). Pre-signed URLs, if introduced later, are
short-lived, purpose-bound, and audited (not implemented in C7).

## MFA
MFA hard gate remains: no real Investigator / Legal Reviewer / Authorising Officer
activated. All C7 access tests use synthetic identities.
