# SafeBet Guardian — Re-entry Intelligence & Continuous Verification (ARCH-V4-C10)

**Synthetic demo only. Intelligence + verification + routing — never automatic re-enforcement.**

C10 completes the POST-ORCHESTRATION Guardian lifecycle:

```
C9 AUTHORISED ORCHESTRATION → SYNTHETIC PROVIDER RESPONSE → INDEPENDENT VERIFICATION → VERIFIED
  → CONTINUOUS/FOLLOW-UP VERIFICATION → NEW SYNTHETIC OBSERVATION → RE-ENTRY CANDIDATE
  → RELATIONSHIP ASSESSMENT → AUTHORITY-COVERAGE ASSESSMENT → HUMAN REVIEW
  → ROUTE TO EXISTING-AUTHORITY REVIEW (C8)  OR  NEW INVESTIGATION (C6) / NEW C8 AUTHORISATION
```

C10 **never** implements `RE-ENTRY DETECTED → AUTOMATIC BLOCK / REFERRAL`.

## Core safety invariants (encoded + tested)
- `RE-ENTRY DETECTED != ILLEGALITY DETERMINED`
- `RE-ENTRY DETECTED != EXISTING AUTHORITY APPLIES`
- `SIMILAR TARGET != SAME OPERATOR` · `SHARED INFRASTRUCTURE != SAME ENTITY`
- `EXISTING AUTHORITY != AUTOMATIC NEW PROVIDER REQUEST`
- `HISTORIC VERIFIED ACTION != PERMANENTLY VERIFIED STATE`

Human/legal authority remains in **C8**. Dispatch remains in **C9**. C10 is intelligence, verification and routing only.

## No detection-to-enforcement shortcut
The required path remains `C1–C5 → C6 → C7 → C8 → C9`. For a re-entry target: `C10 → human review → C8 authority assessment/new authorisation where required → C9 orchestration`. **Never** `C10 detection → C9 dispatch` — C9 only ever runs on a valid bounded C8 `AuthorisedActionContract`. The re-entry worker holds **no** grant on the C9 enforcement queue or tables and its IAM role has **no** `sqs:SendMessage`, so a direct enqueue is impossible.

## Components
- **Continuous / follow-up verification** — append-only `guardian.enforcement_verification_observation`; bounded synthetic observations after ACTIONED/VERIFIED; factual observational states (see `GUARDIAN_CONTINUOUS_VERIFICATION.md`). A historic VERIFIED record is never rewritten.
- **Re-entry candidate** — `guardian.reentry_candidate` (+ append-only history); deterministic relationship label + review priority + coverage state + reason codes (see `GUARDIAN_REENTRY_DATA_MODEL.md`, `GUARDIAN_REENTRY_REASON_CODES.md`).
- **Authority-coverage assessment** — internal routing assessment; standing authority is never inferred (see `GUARDIAN_AUTHORITY_COVERAGE.md`).
- **Human review + routing** — required before any routing; routes to C6/C8 only (see `GUARDIAN_REENTRY_REVIEW_POLICY.md`).
- **Provider follow-up** — MORE_INFO_REQUIRED / DECLINED / ACTIONED-but-not-verified handling (see `GUARDIAN_PROVIDER_FOLLOWUP.md`).

## Privacy & source boundary
All observation sources are **synthetic fixtures/adapters** — no real crawling, DNS scanning, provider/app-store/payment querying, or traffic surveillance. Re-entry intelligence operates at the operator / brand / service / domain / app / payment-channel / infrastructure reference level only — **no** person-level browsing, subscriber history, device tracking, banking history, or geo tracking (C5 boundary preserved).

## API (all IAM-protected; no anonymous access)
`GET /reentry` · `GET /reentry/:id` · `POST /reentry/:id/review` · `POST /reentry/:id/route` · `GET /enforcement/:id/verification-history`. There is **no** `/reblock`, `/re-enforce`, or `/auto-referral`. Reviewer role + jurisdiction are bound from the authenticated Guardian principal — never self-asserted from the request body.
