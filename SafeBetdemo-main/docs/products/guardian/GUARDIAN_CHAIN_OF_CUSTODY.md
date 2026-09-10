# SafeBet Guardian — Chain of Custody (ARCH-V4-C7)

Custody integrity is **LAYERED** (ADR-0017): an independent per-evidence tamper-evident hash
chain, anchored to Shared Audit.

## Custody events (append-only)
`CAPTURED, RECEIVED, REGISTERED, HASH_VERIFIED, STORED, ACCESSED, LINKED_TO_CASE,
COPIED_FOR_EXPORT, DERIVED, CLASSIFICATION_CHANGED, LEGAL_HOLD_APPLIED, LEGAL_HOLD_RELEASED,
RETENTION_REVIEWED, EXPORTED, INTEGRITY_FAILED, CORRECTION`.

Each `guardian_evidence_custody_event` records `sequence_number`, actor/role, jurisdiction,
`occurred_at`, reason, `previous_event_hash`, `event_hash`, `correlation_id`, and an audit
reference. A trigger blocks UPDATE/DELETE (append-only; corrections are a new `CORRECTION`
event, never a rewrite).

## Hash chain
`event_hash = SHA-256(evidence_id | sequence | event_type | actor | role | jurisdiction |
occurred_at | previous_event_hash)`. The first event's `previous_event_hash` is the genesis
`0...0`. `verifyCustodyChain(...)` checks sequence contiguity + each previous-hash link + each
recomputed event hash, so any tamper (e.g. a flipped `event_type`) breaks verification.
Proven live: `00000000 -> a59a0e60 -> 7027385f -> c8e45979` (REGISTERED -> HASH_VERIFIED ->
STORED).

## Shared Audit anchor
Every material custody event also produces Guardian Shared Audit context, correlated via
`evidence_id` / `correlation_id` / `case_id` / `jurisdiction` — one correlated history, not
two unrelated ones.

## Architectural decision (custody integrity)
**Chosen: C (layered).** Independent per-evidence custody hash chain **for** precise,
per-object tamper-evidence (Shared Audit is jurisdiction-scoped, not per-evidence) **plus**
Shared Audit as the platform-wide integrity anchor. Rationale: the two guarantees are
complementary — per-evidence integrity for a single artefact's custody, and the tenant-wide
tamper-evident audit chain for cross-cutting provenance.
