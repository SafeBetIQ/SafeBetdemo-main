# SafeBet Guardian — Case Data Model (ARCH-V4-C6)

All tables live in the dedicated `guardian` schema, carry `jurisdiction`, a synthetic
marker, RLS, and history semantics. Cases hold **references**, never duplicated entity
or evidence bodies (minimisation). No SafeBet IQ public table is referenced.

## Tables (12)
| Table | Purpose | Notes |
|---|---|---|
| `investigation_case` | The case | Immutable `case_id`; unique `(case_reference, jurisdiction)` + `(jurisdiction, idempotency_key)`; DB CHECK `is_legal_determination=false` AND `is_enforcement_authorised=false`; no enforcement status. |
| `case_subject` | Bounded subject reference | `subject_type ∈ {OPERATOR,BRAND,LICENCE,DOMAIN,MOBILE_APP,MERCHANT,PAYMENT_CHANNEL,GEO_SERVICE_REFERENCE,OTHER_GUARDIAN_SUBJECT}`; reference only. |
| `case_intelligence_link` | Governed C1–C5 reference link | `source_domain ∈ {C1_REGISTRY,C2_DOMAIN,C3_APP,C4_PAYMENT,C5_GEO}`; snapshots `reference_state` + `source_as_of` (what was known at the time). |
| `case_evidence_link` | Reference-based evidence | `integrity_status ∈ {VERIFIED,INTEGRITY_FAILED,UNVERIFIED}`; body never duplicated. |
| `case_note` | Synthetic notes | No secrets/unnecessary personal data. |
| `case_finding` | Bounded analyst findings | DB CHECK `is_legal_determination=false`; no `ILLEGAL_OPERATOR_CONFIRMED`. |
| `case_assignment` | Historically traceable assignment | roles from the C0 vocabulary. |
| `case_review` | Bounded legal/regulatory review | outcomes bounded; DB CHECK `is_enforcement_authorised=false`; `legal_basis_reference` placeholder only. |
| `case_chronology` | **Append-only** timeline | trigger-guarded; 13 bounded event types incl. `CASE_REOPENED`. |
| `case_relationship` | Relate without merging | `DUPLICATE_OF/RELATED_TO/PARENT_CASE/CHILD_CASE/COMMON_ENTITY/COMMON_SIGNAL`; human-confirmable. |
| `case_status_history` | **Append-only** | trigger-guarded. |
| `case_priority_history` | **Append-only** | trigger-guarded; `override_reason`. |

## Bounded enums
- **Status:** DRAFT, OPEN, TRIAGE, INVESTIGATING, AWAITING_INFORMATION, AWAITING_REVIEW,
  REVIEWED, CLOSED, CANCELLED. (No ENFORCEMENT_APPROVED/BLOCKED/TAKEDOWN_COMPLETE.)
- **Priority:** LOW, MEDIUM, HIGH, CRITICAL (investigation priority; CRITICAL ≠ proven
  illegality).
- **Finding:** FACT_CONFIRMED, REFERENCE_CONFIRMED, INCONSISTENCY_CONFIRMED,
  SOURCE_INSUFFICIENT, SOURCE_CONFLICT, ENTITY_RELATIONSHIP_CONFIRMED,
  REQUIRES_FURTHER_INVESTIGATION, FALSE_POSITIVE, UNRESOLVED.
- **Review outcome:** SUFFICIENT_FOR_FURTHER_REVIEW, INSUFFICIENT_EVIDENCE,
  RETURN_TO_INVESTIGATION, REFERENCE_VALIDATED, CONFLICT_REQUIRES_RESOLUTION.
- **Closure:** FALSE_POSITIVE, INSUFFICIENT_EVIDENCE, DUPLICATE, REFERENCE_RESOLVED,
  NO_FURTHER_ACTION_AT_THIS_STAGE, TRANSFERRED_FOR_FURTHER_REVIEW, OTHER.

## Append-only guard
`guardian.case_block_mutation()` (SECURITY INVOKER; trigger-only; PUBLIC EXECUTE revoked)
raises on UPDATE/DELETE of chronology + status/priority history.

## Snapshot semantics (§24, §43)
`case_intelligence_link` preserves `reference_state` + `source_as_of` at link time, so a
later changed Domain/App/Payment/Geo observation never silently rewrites historical case
reasoning.

## Access
RLS jurisdiction-scoped for `authenticated`/`service_role` (JWT claim) and the
least-privilege `guardian_case_worker` (GUC). `anon` and IQ `casino_admin` have no grant.
