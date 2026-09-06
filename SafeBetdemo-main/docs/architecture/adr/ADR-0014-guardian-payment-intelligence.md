# ADR-0014 — SafeBet Guardian Payment Intelligence (ARCH-V4-C4)

- **Status:** Accepted (C4 on Demo; provider-neutral; synthetic; no production)
- **Date:** 2026-09-06
- **Relates to:** ADR-0011 (mobile app), ADR-0012 (domain reference contract), ADR-0008/0009/0010, ADR-0005 (MFA)

## Context
C3 delivered Mobile App Intelligence. C4 adds Guardian's Payment Intelligence domain — provider-
neutral merchant/payment-channel analysis — comparing synthetic subjects against the C1 registry and
governed C2/C3 references, **without** legal findings, enforcement, payment action, or real bank/PSP/
customer data.

## Decision
1. **Model** (9 `guardian` tables): merchant_subject, payment_subject, payment_provider_reference,
   merchant_observation, payment_observation (aggregates only — NO PAN/CVV), payment_registry_comparison
   (DB CHECKs forbid illegality AND enforcement flags), payment_entity_link, payment_review_item,
   payment_change_history (append-only). Immutable ids; RLS; 0 functions.
2. **Provider-neutral + privacy-minimised** vocabulary; no named bank/PSP; no PAN/CVV/raw customer data.
3. **Legal + enforcement safety:** every result `isIllegalDetermination:false` AND
   `isEnforcementAuthorised:false`; NO_MATCH ≠ illegal; no block/freeze/terminate; no PAYMENT_REFERRAL.
4. **Governed cross-module contracts only:** registry via `resolveLegalReference`; domain via the C3.1
   `domain_reference` contract; **app via a NEW `app_reference` contract** (view + `resolveAppReference`,
   owner Mobile App Intelligence). The payment worker holds SELECT on the contract views only — no C2/C3
   base tables.
5. **Dedicated durable path + least-privilege principal:** SQS `guardian-payment-observation` → worker
   `safebet-guardian-payment-worker` → DLQ; role `guardian_payment_worker` (payment tables + audit +
   contract views; no public/IQ, no C2/C3 base tables); own Secrets-Manager secret.

## Alternatives considered
- **Reuse app/domain workers or grant base-table access:** rejected — separate principal + governed
  contracts (no raw coupling), consistent with C3.1.
- **Raw individual bank/card/customer data:** rejected — privacy minimisation; aggregates/tokens only.
- **AI/enforcement:** rejected — deterministic, non-legal, non-enforcement only.

## Consequences
Guardian triages synthetic payment/merchant subjects against registry + domain + app references with
provenance, history, reason codes and human-review safeguards, never emitting illegality/enforcement.
Proven live: persist with governed DOMAIN→DOM-SYNTH-0003 + APP→APP-SYNTH-0003 links via contract views;
duplicate-suppression; wrong-jurisdiction→DLQ; poison→DLQ; 0 illegal/enforce. No new platform-wide
privileged exposure (public secdef 138 / anon 1; guardian 0 functions). A1–A5 + edge intact; MFA gate
intact; Production untouched.

## Rollback
Data: drop the 9 C4 tables + the `app_reference` view + ledger `20260905230000`/`20260905240000` + drop
role. Infra: delete mapping/worker/queues/role/secret. Runtime: redeploy prior/canonical SHA. Separate
concerns; SafeBet IQ + C2/C3 unaffected.
