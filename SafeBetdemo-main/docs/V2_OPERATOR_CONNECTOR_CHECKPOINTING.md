# Operator Connector Checkpointing (Milestone 4.4)

**ADR-006 (frozen) · NON-PRODUCTION sandbox.**

## 1. Checkpoint
`ConnectorCheckpoint { cursor, lastSourceSequence, lastSourceTimestamp, lastAcceptedEventId,
connectorVersion, datasetVersion }`, persisted via an injectable `CheckpointStore` (in-memory default;
durable binding = C2).

## 2. Advance rule
The cursor advances **only after safe processing** of a record (validation + submit outcome handled). If a
record triggers backpressure (circuit open), the cursor is **not** advanced and the checkpoint is preserved.

## 3. Restart / recovery guarantees
A fresh connector over the same checkpoint store resumes at the saved cursor. A restart must not:
- lose accepted records (checkpoint only advances after safe processing);
- re-submit uncontrolled duplicates (deterministic event ids → Event Platform replay dedup);
- skip unprocessed records (cursor is monotonic);
- inflate matching evidence (idempotency at the Event Platform).

## 4. Validation
Tested: two records processed → cursor = 2; restart resumes at 2 with nothing left; reprocessing yields no
duplicate evidence (accepted count stable).

## 5. Corrupted checkpoint
A corrupted/absent checkpoint falls back to cursor 0 (full re-read); idempotency prevents duplicate
evidence. Managed durable checkpoint storage + integrity is a deployment binding (C2/C6).
