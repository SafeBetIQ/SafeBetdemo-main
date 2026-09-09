# SafeBet Guardian — Case Workflow (ARCH-V4-C6)

Investigation lifecycle (synthetic; human-controlled). No enforcement.

## Status lifecycle
`DRAFT → OPEN → TRIAGE → INVESTIGATING → AWAITING_INFORMATION → AWAITING_REVIEW →
REVIEWED → CLOSED` (`CANCELLED` from any pre-closed state). Every transition writes an
append-only `case_status_history` row and a `case_chronology` `STATUS_CHANGED` event.

## Human control (§14)
A synthetic **Investigator** may: open/accept an investigation, add subjects, attach
intelligence, add notes, request information, add evidence references, record analyst
findings, recommend escalation. An Investigator may **not**: authorise enforcement, issue
a final legal order, or impersonate the Authorising Officer.

## Chronology events (append-only)
`CASE_OPENED, SUBJECT_LINKED, INTELLIGENCE_LINKED, EVIDENCE_LINKED, NOTE_ADDED,
ASSIGNMENT_CHANGED, STATUS_CHANGED, PRIORITY_CHANGED, FINDING_RECORDED, REVIEW_REQUESTED,
REVIEW_COMPLETED, CASE_CLOSED, CASE_REOPENED`. Chronology is never destructively rewritten.

## Closed case + later intelligence (§16, scenario 16)
A closed case is not silently rewritten by later intelligence. Intake is idempotent by
`(jurisdiction, idempotency_key)`; a genuine reopen is an **explicit** `CASE_REOPENED`
decision, not an automatic mutation.

## Recommendation (§29)
Deterministic signals may yield `CASE_REVIEW_RECOMMENDED` or
`ESCALATION_REVIEW_RECOMMENDED`. Never `ENFORCEMENT_RECOMMENDED` — that belongs to a later
authorised legal/policy milestone.

## Relationships (§27)
Cases relate (`DUPLICATE_OF/RELATED_TO/PARENT_CASE/CHILD_CASE/COMMON_ENTITY/COMMON_SIGNAL`)
without merging. Human confirmation where appropriate; investigations are never
auto-merged.
