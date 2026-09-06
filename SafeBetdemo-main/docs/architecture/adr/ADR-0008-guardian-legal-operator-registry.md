# ADR-0008 — SafeBet Guardian Legal Operator Registry & authoritative entity model (ARCH-V4-C1)

- **Status:** Accepted (C1 on Demo; synthetic only; no production)
- **Date:** 2026-09-06
- **Products affected:** SafeBet Guardian; Shared Platform Foundation (audit/evidence consumed); SafeBet IQ (untouched)
- **Relates to:** ADR-0006 (Guardian standalone foundation), ADR-0007 (Guardian runtime), ADR-0005 (privileged-function governance / MFA gate); Authority v4.0 §7/§10/§11

## Context
Guardian needs a trusted legal/reference layer so future intelligence can compare subjects
against authoritative operator/brand/licence/regulator data — **without** deciding legality.
C1 builds that reference model, synthetic only, on the existing `guardian` schema + runtime.

## Decision
Establish the Legal Operator Registry:
1. **Entity model** (14 `guardian` tables): regulatory_authority, registry_source,
   ingestion_batch, operator_entity, operator_alias, brand, operator_brand_relationship,
   licence, licence_scope, licence_status_history, registry_source_record, registry_staging,
   resolution_result, human_review_record. Immutable Guardian ids as keys; external ids are
   attributes with provenance. Operator ≠ brand ≠ licence. Effective-dating + append-only
   history + supersession. Staging separated from authoritative records.
2. **Legal-inference rule (encoded + tested):** *absence from registry ≠ illegal.* No
   `ILLEGAL` value exists; `resolveLegalReference` always `isIllegalDetermination:false`;
   ambiguity/conflict → human review; no AI legal determination.
3. **Deterministic matching** (licence ref, registration ref, legal name, normalised name,
   alias, brand), jurisdiction-scoped; states EXACT/ALIAS/MULTIPLE/NO_MATCH/REQUIRES_REVIEW.
4. **Source governance:** authority levels (SYNTHETIC_TEST seeded), conflict detection (no
   silent last-write-wins), freshness (stale ≠ verified), publication SoD.
5. **RLS** by jurisdiction claim + access_scope; national/shared reference for Guardian
   principals only; IQ/anon denied. **0 new functions**, no anon/public grants.
6. **Runtime:** `resolveLegalReference` contract + `/registry/*` endpoints on the Guardian
   Lambda over a build-time **synthetic snapshot** (runtime holds no DB credentials).

## Alternatives considered
- **Registry in `public` / reuse legacy guardian_*:** rejected — violates the product/data
  boundary.
- **Live DB reads from the Lambda now (credentialed):** deferred to C2 — a runtime DB
  credential is a real attack surface; the synthetic snapshot proves the contract at C1 with
  zero secrets while the `guardian` schema is the store of record (proven via SQL/RLS).
- **Fuzzy/AI entity resolution:** deferred — C1 is deterministic only.

## Consequences
- Guardian can answer WHO/WHICH/WHAT-STANDING/WHAT-SOURCE/WHEN against an authoritative
  synthetic reference, with provenance + history + human-review safeguards, and can never
  emit an illegality determination.
- No new platform-wide privileged exposure (public secdef 138 / anon 1 unchanged; guardian
  schema 0 functions). A1–A5 intact; MFA gate intact; Production untouched.
- Data-boundary debt (separate Guardian DB) and the C2 live-DB credential path are recorded.

## Rollback
Data: drop the 14 C1 tables + remove ledger `20260905170000` (C0 tables + IQ untouched).
Runtime: `update-function-code` to the prior artifact / redeploy from the C0 release SHA
`563a1331…`. Runtime and data rollback are separate concerns.
