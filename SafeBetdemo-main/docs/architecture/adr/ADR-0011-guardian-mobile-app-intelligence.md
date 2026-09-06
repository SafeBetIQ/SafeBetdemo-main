# ADR-0011 — SafeBet Guardian Mobile App Intelligence (ARCH-V4-C3)

- **Status:** Accepted (C3 on Demo; provider-neutral; synthetic only; no production)
- **Date:** 2026-09-06
- **Relates to:** ADR-0009/0010 (domain intelligence + worker persistence), ADR-0008 (registry), ADR-0007 (runtime), ADR-0005 (privileged-fn/MFA)

## Context
C2 delivered Domain & Website Intelligence with durable persistence. C3 adds Guardian's
Mobile App Intelligence domain — provider-neutral, synthetic — comparing synthetic app
subjects against the C1 registry and governed C2 domain references, without legal findings,
app removal, or platform integration.

## Decision
1. **Model** (10 `guardian` tables): mobile_app_subject/observation/snapshot, content+technical
   signals, registry_comparison (DB CHECK forbids illegality flag), entity_link, **domain_link**
   (governed app→domain, FK→C2 domain_subject or NULL), review_item, change_history (append-only).
   Immutable Guardian ids; RLS; 0 functions.
2. **Provider-neutral** vocabulary; no named app store/platform; no partnership/integration claim.
3. **Deterministic engine** (no AI): normalise identity → signals → C1 `resolveLegalReference`
   (governed contract, not raw tables) → governed app→domain link (C2 domain contract, resolved
   by the worker to the real domain_id) → reason codes + explainable priority.
4. **Legal-safety:** every result `isIllegalDetermination:false`; NO_MATCH ≠ illegal; platform
   presence/absence non-legal; no enforcement/removal/referral.
5. **Dedicated durable path:** SQS `guardian-app-observation` → worker `safebet-guardian-app-worker`
   → DLQ (own queue, not the domain queue). Idempotent; poison→DLQ.
6. **Separate least-privilege principal** `guardian_app_worker` (NOT reusing the domain worker):
   grants only on mobile_app_* + audit_context + read-only domain_subject; own Secrets-Manager
   secret; no public/IQ. RLS enforced.

## Alternatives considered
- **Reuse `guardian_domain_worker`:** rejected (§25) — separate governed identity per domain.
- **Live app-store/marketplace access:** rejected — synthetic fixtures only; no real access.
- **AI/fuzzy resolution:** rejected — deterministic + explainable only.

## Consequences
Guardian can triage synthetic apps against the registry + known domains with provenance,
history, reason codes and human-review safeguards, never emitting illegality/enforcement.
Proven live: persist (governed app→domain link to real C2 domain), duplicate-suppression,
wrong-jurisdiction→DLQ, poison→DLQ. No new platform-wide privileged exposure (public secdef
138 / anon 1; guardian 0 functions). A1–A5 intact; MFA gate intact; Production untouched.

## Rollback
Data: drop the 10 C3 tables + ledger `20260905200000`/`20260905210000` + drop role. Infra:
delete mapping/worker/queues/role/secret. Runtime: redeploy prior/C2.1 SHA `9b9e601…`. Separate
concerns; SafeBet IQ unaffected.
