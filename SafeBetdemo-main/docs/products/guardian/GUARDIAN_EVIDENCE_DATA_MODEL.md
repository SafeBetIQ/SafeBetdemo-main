# SafeBet Guardian — Evidence Data Model (ARCH-V4-C7)

All tables in the dedicated `guardian` schema; jurisdiction, synthetic marker, RLS,
append-only history where appropriate. Content is a **hash + storage reference**, never a
body. No SafeBet IQ table referenced.

## Tables (9)
| Table | Purpose | Notes |
|---|---|---|
| `guardian_evidence` | Registered evidence record | unique `(evidence_reference,jurisdiction)` + `(jurisdiction,idempotency_key)`; DB CHECK `is_legal_determination=false` AND `is_enforcement_authorised=false`; `hash_algorithm='SHA-256'`. |
| `guardian_evidence_version` | Immutability: content change = new version | unique `(evidence_id,version_no)`; append-only. |
| `guardian_evidence_derivation` | Derived artefact <-> parent lineage | `parent<>derived`; never masquerades as original; append-only. |
| `guardian_evidence_custody_event` | **Append-only** per-evidence hash chain | `sequence_number` + `previous_event_hash` -> `event_hash`; unique `(evidence_id,sequence_number)`. |
| `guardian_evidence_access_event` | **Append-only** ALLOW/DENY access decisions | purpose + classification-at-access. |
| `guardian_evidence_hold` | Legal/preservation hold | `ACTIVE`/`RELEASED`; blocks destructive disposition. |
| `guardian_evidence_export` | Export package | `manifest_hash` SHA-256; DB CHECK `is_legal_determination=false`. |
| `guardian_evidence_export_item` | Evidence ref + hash + integrity-at-export | reference-based. |
| `guardian_evidence_integrity_check` | **Append-only** verify results | `VERIFIED`/`INTEGRITY_FAILED`; tamper preserved, not deleted. |

## Bounded enums
- **evidence_type:** WEB_CAPTURE, SCREENSHOT, DOCUMENT, REGISTRY_SOURCE_RECORD,
  MOBILE_APP_METADATA, PAYMENT_REFERENCE, GEO_OBSERVATION, STRUCTURED_DATA,
  ANALYST_ATTACHMENT, SYSTEM_GENERATED_REPORT, OTHER (no legal conclusion encoded in type).
- **classification:** PUBLIC_REFERENCE, INTERNAL, RESTRICTED, HIGHLY_RESTRICTED.
- **integrity_status:** VERIFIED, INTEGRITY_FAILED, UNVERIFIED.
- **legal_hold_state:** NONE, HELD.

## Immutability & derivation
Original evidence bytes are never silently overwritten: a content change creates a new
`guardian_evidence_version` (or a distinct evidence record). Derived artefacts
(`guardian_evidence_derivation`) reference their parent, carry their own hash + `DERIVED`
custody event, and are flagged `isOriginal=false`.

## Metadata protection (§36)
Integrity-critical metadata (source reference, capture timestamp, classification, parent
linkage) is protected by **event-sourcing**: changes append a custody event
(`CLASSIFICATION_CHANGED`, `CORRECTION`) rather than mutating history. The **content bytes**
are what the SHA-256 `content_hash` covers; metadata immutability is provided by the
append-only custody chain, not by claiming the content hash covers metadata.

## Append-only guard
`guardian.evidence_block_mutation()` (SECURITY INVOKER; trigger-only; PUBLIC EXECUTE revoked)
on custody / access / integrity / version / derivation tables.
