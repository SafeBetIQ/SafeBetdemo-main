# SafeBet Guardian — Policy & Authorisation Data Model (ARCH-V4-C8)

All tables in the `guardian` schema; jurisdiction, synthetic marker, RLS, append-only history.
No SafeBet IQ table referenced. References only (no duplicated evidence bodies).

## Policy registry (7 tables)
| Table | Purpose |
|---|---|
| `enforcement_policy` | Policy header (jurisdiction, authority_reference_type, status). |
| `policy_version` | Versioned policy; effective_from/until; supersedes_version_id; content_hash. |
| `policy_action_permission` | Which action types the version permits / requires review for. |
| `policy_condition` | Bounded conditions (MIN_EVIDENCE_TYPES, REQUIRED_LEGAL_REVIEW, MAX_AUTHORISATION_DURATION, …). |
| `policy_exception` | Bounded exceptions (COURT_REVIEW_REQUIRED, MANUAL_ESCALATION_REQUIRED, …) that block/route review. |
| `policy_review_record` | **Append-only** activation review (reviewer + outcome + effective date). |
| `policy_status_history` | **Append-only** status changes. |

## Authorisation workflow (5 tables)
| Table | Purpose |
|---|---|
| `proposed_action` | A proposed enforcement action awaiting review + human authorisation; status bounded (no EXECUTED). |
| `legal_review` | **Append-only** legal/regulatory review; `is_enforcement_execution=false` CHECK. |
| `action_authorisation` | The human AUTHORISED ACTION RECORD; CHECKs `is_external_action_executed=false` AND `is_provider_notified=false`; status bounded (no ACTIONED/PROVIDER_ACKNOWLEDGED). |
| `authorisation_history` | **Append-only** authorisation state changes / withdrawal / expiry. |
| `proposed_action_history` | **Append-only** proposed-action state changes. |

## Effective dating & versioning
Policy versions carry `effective_from`/`effective_until` and `supersedes_version_id`. A
historical authorisation retains the exact `version_id` used; a later policy update never
rewrites past authorisation reasoning (see GUARDIAN_POLICY_VERSIONING.md).

## Append-only guard
`guardian.policy_block_mutation()` (SECURITY INVOKER; trigger-only; PUBLIC EXECUTE revoked) on
the five history/review tables.
