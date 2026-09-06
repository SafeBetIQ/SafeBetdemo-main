# SafeBet Guardian — Entity Model (ARCH-V4-C1)

All tables live in the dedicated `guardian` schema. Guardian-controlled **immutable**
identifiers are the primary keys; external/regulator identifiers (legal name, brand name,
licence number, registration number) are **attributes with provenance**, never keys.

## Entities (14 C1 tables)
| Table | Role |
|---|---|
| `regulatory_authority` | national/provincial authority (synthetic); `access_scope` |
| `registry_source` | a source + `authority_level` (SYNTHETIC_TEST at C1) |
| `ingestion_batch` | ingestion unit; status INGESTED→VALIDATED→APPROVED/REJECTED |
| `operator_entity` | authoritative legal entity (immutable `operator_id`) |
| `operator_alias` | trading names/aliases → operator |
| `brand` | brand, **separate** from legal entity |
| `operator_brand_relationship` | historically-traceable brand↔operator (effective dating) |
| `licence` | authoritative licence + status + `verification_state` + `last_verified_at` |
| `licence_scope` | activity/channel/jurisdiction/brand/conditions (flexible) |
| `licence_status_history` | **append-only** status changes (no destructive overwrite) |
| `registry_source_record` | provenance record (evidence reference + `content_hash`; body never inline); `superseded_by` |
| `registry_staging` | staging, **separated** from authoritative registry; `match_state` |
| `resolution_result` | deterministic match outcome |
| `human_review_record` | ambiguity/conflict routed to a human |

## Key modelling rules
- **Operator ≠ brand ≠ licence.** One operator may own multiple brands; a brand
  association alone does not prove a licence covers every product/channel.
- **Effective dating:** records distinguish `recorded_at` (when Guardian learned it)
  from `effective_at`/`effective_from`/`expiry_date` (when it was legally valid). Enables
  "was Licence X active on date Y?" without destroying prior state.
- **History/supersession:** `licence_status_history` is append-only;
  `registry_source_record.superseded_by` preserves corrections without deletion.
- **Duplicates:** a deterministic uniqueness guard `(licence_reference, issuing_authority,
  jurisdiction)` prevents obvious duplicate authoritative licences; ambiguous legal
  entities are **never** auto-merged (→ human review).
- **Staging vs authoritative:** SOURCE → STAGING → VALIDATION → MATCH/REVIEW → AUTHORISED
  REGISTRY RECORD. Ingestion is not regulatory acceptance.

## Access scope
Each scoped table carries `access_scope ∈ {JURISDICTION_LOCAL, NATIONAL_REFERENCE,
SHARED_REGULATORY_REFERENCE, RESTRICTED}`. National/shared reference is readable
cross-jurisdiction **by Guardian principals only**; local/restricted require the matching
jurisdiction claim. Non-Guardian (e.g. IQ) principals and `anon` are denied entirely.
