# ADR-0009 — SafeBet Guardian Domain & Website Intelligence foundation (ARCH-V4-C2)

- **Status:** Accepted (C2 on Demo; synthetic only; no production)
- **Date:** 2026-09-06
- **Products affected:** SafeBet Guardian; Shared Platform Foundation (audit/evidence); SafeBet IQ (untouched)
- **Relates to:** ADR-0006 (foundation), ADR-0007 (runtime), ADR-0008 (registry), ADR-0005 (privileged-fn/MFA gate)

## Context
C1 gave Guardian an authoritative legal reference. C2 adds Guardian's first EXTERNAL-SUBJECT
intelligence domain — domains/websites — comparing synthetic observations against that
registry, **without** producing any legal/illegality finding and **without** any enforcement.

## Decision
1. **Domain model** (10 `guardian` tables): domain_subject, domain_observation, website_snapshot,
   page_resource_reference, domain_technical_signal, domain_content_signal,
   domain_registry_comparison (DB CHECK forbids an illegality flag), domain_entity_link,
   domain_review_item, domain_change_history (append-only). Immutable Guardian ids; RLS; 0 functions.
2. **Legal-inference safety:** DOMAIN DISCOVERED ≠ ILLEGAL; NO_MATCH ≠ ILLEGAL; HIGH-RISK SIGNAL
   ≠ LEGAL FINDING. Every result `isIllegalDetermination:false`; non-final classifications only.
3. **Deterministic engine** (no AI): normalise → technical/content signals → registry comparison
   via the C1 `resolveLegalReference` contract → reason codes → explainable investigation priority.
4. **Registry via governed contract**, not raw C1 tables.
5. **First real durable async path:** SQS `guardian-domain-observation` → dedicated worker Lambda
   `safebet-guardian-domain-worker` → DLQ (redrive maxReceiveCount 2, ReportBatchItemFailures);
   idempotent; poison→DLQ proven live. Worker/API run credential-free; no web crawl / no DNS.
6. **No** mobile/payment/geo intelligence; **no** enforcement/provider state machine; **no** AI legal decision.

## Alternatives considered
- **Live web capture/crawl:** rejected — synthetic fixtures only; no real network access (asserted by test).
- **Runtime DB-write credential now:** deferred — a credentialed Lambda is a real attack surface;
  the schema is the store of record (proven via SQL) and the worker is credential-free at C2; the
  dedicated `guardian`-scoped Secrets-Manager credential path is designed as the immediate follow-up.
- **AI/fuzzy classification:** rejected — deterministic + explainable only at C2.

## Consequences
- Guardian can triage synthetic domains against the registry with provenance, history, reason codes
  and human-review safeguards, never emitting an illegality determination.
- First real Guardian queue/worker/DLQ proven. No new platform-wide privileged exposure
  (public secdef 138 / anon 1 unchanged; guardian 0 functions). A1–A5 intact; MFA gate intact;
  Production untouched.

## Rollback
Data: drop the 10 C2 tables + ledger `20260905180000`. Infra: delete event source mapping, worker
Lambda, both queues, worker role. Runtime: `update-function-code` to the prior artifact / redeploy
C1 SHA `3911bfcb…`. Data, infra, and runtime rollback are separate concerns; SafeBet IQ unaffected.
