# SafeBet Guardian — Re-entry Data Model (ARCH-V4-C10)

All tables in the `guardian` schema. RLS-enabled + jurisdiction-scoped. Six of seven are
append-only (trigger `guardian.reentry_block_mutation()`, SECURITY INVOKER, PUBLIC revoked);
`reentry_candidate` is a state machine whose transitions are recorded in the append-only history.

| Table | Purpose | Mutability |
|---|---|---|
| `enforcement_verification_observation` | continuous / follow-up verification observations (§6) | append-only |
| `reentry_candidate` | re-entry candidate + state/coverage/review-priority (§9) | state machine (service_role UPDATE; history appended) |
| `reentry_relationship_assessment` | deterministic correlation assessment (§15) | append-only |
| `reentry_coverage_assessment` | authority-coverage routing assessment (§16) | append-only |
| `reentry_review` | human review outcome (§21) | append-only |
| `reentry_routing` | routing decision to C6/C8 (§20) | append-only |
| `reentry_candidate_history` | candidate state history (§38) | append-only |

## Safety columns (DB CHECKs)
- `enforcement_verification_observation`: `is_real_observation_source = false`, `is_external_network_call = false`.
- `reentry_candidate`: `is_illegality_determined = false`, `is_authority_applied = false`.
- `reentry_coverage_assessment`: `is_final_legal_determination = false`.
- `reentry_routing`: `is_authorisation_granted = false`, `is_enforcement_dispatched = false`.
- every table: `is_synthetic = true`.

## Verification observation states (§7)
`EXPECTED_STATE_OBSERVED` · `EXPECTED_STATE_NOT_OBSERVED` · `INCONCLUSIVE` · `TARGET_UNAVAILABLE`
· `TARGET_AVAILABLE` · `TARGET_CHANGED` · `REFERENCE_NOT_FOUND` · `REQUIRES_REVIEW`. There is **no**
`ILLEGAL_AGAIN` / auto-re-enforce state.

## Candidate state machine (§22)
`DETECTED → TRIAGED → REQUIRES_REVIEW → { RELATIONSHIP_CONFIRMED | FALSE_POSITIVE |
COVERAGE_REVIEW_REQUIRED | EXISTING_AUTHORITY_PATH | NEW_INVESTIGATION_REQUIRED | ROUTED_TO_C8 } → CLOSED`.
`BLOCKED` / `REMOVED` / `ENFORCED` are **not** valid detection states.

## Relationship types (§10) & review priority (§11)
Relationship types are correlation labels, not legal findings (full list in `GUARDIAN_REENTRY_REASON_CODES.md`).
Review priority is deterministic `LOW | MEDIUM | HIGH` — a REVIEW PRIORITY only, never an illegality /
re-enforcement / enforcement probability.

## Governed contract consumed
C10 reads only the bounded **C9 Orchestration Reference Contract** view `guardian.orchestration_reference`
(orchestration reference + latest provider state + latest verification state) — never the C9
`enforcement_orchestration` / `provider_response` / `enforcement_verification` base tables.
