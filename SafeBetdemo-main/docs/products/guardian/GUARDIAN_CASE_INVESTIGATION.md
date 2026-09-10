# SafeBet Guardian — Case & Investigation Management (ARCH-V4-C6)

**Status:** Planned / in development (synthetic Demo only). Not live, not production, no
real regulator users, no enforcement.

Case & Investigation Management is Guardian's governed HUMAN investigation layer — the
controlled record that sits **between** Guardian intelligence (C1–C5) and any FUTURE
legal/enforcement workflow.

## Flow
```
INTELLIGENCE SIGNALS → INVESTIGATION INTAKE → CASE → SUBJECT/ENTITY LINKING →
EVIDENCE → CHRONOLOGY → ANALYST FINDINGS → REVIEW → CASE STATUS
```

## Fundamental boundary (encoded + tested)
- INTELLIGENCE RESULT ≠ LEGAL FINDING
- CASE OPENED ≠ ILLEGAL OPERATOR
- HIGH PRIORITY CASE ≠ ENFORCEMENT AUTHORISATION
- INVESTIGATOR FINDING ≠ FINAL LEGAL DETERMINATION
- CASE CLOSED ≠ PROVIDER ACTION

Every case/finding/review carries `isLegalDetermination = false` and
`isEnforcementAuthorised = false` (DB CHECK on `investigation_case`, `case_finding`,
`case_review`). No case object triggers blocking/referral/enforcement. There is no
`ENFORCEMENT_APPROVED`/`BLOCKED`/`TAKEDOWN_COMPLETE` status and no
`ILLEGAL_OPERATOR_CONFIRMED` finding.

## Governed contracts only (no raw base tables)
C6 consumes the four governed reference contracts and **formalises the C5 Geo Reference
Contract** (`guardian.geo_reference` view + `resolveGeoReference`):
- C1 `resolveLegalReference` · C2 `domain_reference` · C3 `app_reference` ·
  C4 `payment_reference` · C5 `geo_reference`.
C6 owns the case; intelligence domains own their observations. The case worker holds
SELECT on the four reference views only — never a C2–C5 base table (proven live).

## No automatic case = illegality (§12)
Opening a case because of `NO_MATCH`, mismatch, or source conflict means **INVESTIGATION
REQUIRED**, never illegal. Multi-signal correlation is **evidence**, not an automatic
illegality score. No AI legal decision. No black-box case score.

## Intake (§13)
`MANUAL_SYNTHETIC_INTAKE`, `INTELLIGENCE_REVIEW_PROMOTION`, `SYSTEM_RECOMMENDED_CASE`. A
system-recommended intake creates a **DRAFT** case only — it never silently creates an
authoritative/legal case state. Recommendations are `CASE_REVIEW_RECOMMENDED` /
`ESCALATION_REVIEW_RECOMMENDED`; never `ENFORCEMENT_RECOMMENDED`.

## Durable pipeline & API
- Queue `guardian-case-intake` + DLQ `guardian-case-intake-dlq` (maxReceiveCount 2,
  visibility 15, ReportBatchItemFailures), worker `safebet-guardian-case-worker`, alarm
  `guardian-case-intake-dlq-not-empty`.
- API (IAM-protected): `GET/POST /cases`, `GET /cases/:id`, `POST /cases/:id/{subjects,
  intelligence,evidence,notes,findings,review,status}`. Responses carry
  `isLegalDetermination:false`, `isEnforcementAuthorised:false`. **No** `/enforce`,
  `/block`, `/takedown`, or `/referral` endpoint exists.
