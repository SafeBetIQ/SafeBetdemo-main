# SafeBet Guardian — Mobile App Data Model (ARCH-V4-C3)

10 tables in the `guardian` schema (total **41**: 7 C0 + 14 C1 + 10 C2 + 10 C3). Immutable
Guardian ids (never the package id). RLS on all (jurisdiction-local; Guardian principals
only; IQ/anon denied). **0 functions.** No anon/public grants.

| Table | Role |
|---|---|
| `mobile_app_subject` | immutable `app_subject_id`; canonical identifier; platform type; developer |
| `mobile_app_observation` | one processing; version/publisher; content+metadata hash; `idempotency_key` (unique per app) |
| `mobile_app_snapshot` | synthetic metadata: title/version/developer/declared website/licence text; **evidence reference** |
| `mobile_app_content_signal` | gambling/deposit/registration/age + declared operator/brand/licence/website |
| `mobile_app_technical_signal` | identifier/platform/version/publisher/metadata+content fingerprints |
| `mobile_app_registry_comparison` | non-legal comparison; **CHECK forbids `is_illegal_determination=true`** |
| `mobile_app_entity_link` | app↔operator/brand/licence link |
| `mobile_app_domain_link` | governed app→domain link (`matched_domain_id` FK → C2 `domain_subject`, or NULL) |
| `mobile_app_review_item` | review queue + bounded decisions |
| `mobile_app_change_history` | **append-only** change history |

## Key rules
- Package/bundle id is an attribute; `unique(canonical_app_identifier, jurisdiction)`.
- Idempotency via `unique(app_subject_id, idempotency_key)`.
- Non-destructive history (append observations + change rows; never overwrite).
- Evidence held as reference + hash, never the body.
- App→domain link references a KNOWN C2 domain (resolved by the worker to the real
  `domain_id`), or NULL — never a guessed FK; the two subjects are never auto-merged.
- Freshness tracked separately: app observed/captured vs registry `last_verified_at` vs
  linked-domain last observed.
- Illegality invariant enforced at the DB (comparison CHECK).
