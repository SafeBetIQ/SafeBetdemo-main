# SafeBet Guardian — Payment Data Model (ARCH-V4-C4)

9 tables in the `guardian` schema (total **50**). Immutable Guardian ids. RLS on all
(jurisdiction-local; Guardian principals only; IQ/anon denied). **0 functions.** No anon/public.

| Table | Role |
|---|---|
| `merchant_subject` | immutable id; reference/descriptor; provider-neutral provider reference |
| `payment_subject` | merchant + channel context |
| `payment_provider_reference` | provider-neutral provider (PSP/BANKING/ACQUIRER/PLATFORM/WALLET) |
| `merchant_observation` | append-only merchant observation; idempotency key |
| `payment_observation` | append-only; channel, provider ref, **aggregate** amount (no PAN/CVV/account) |
| `payment_registry_comparison` | non-legal comparison; **CHECKs forbid `is_illegal_determination`=true AND `is_enforcement_authorised`=true** |
| `payment_entity_link` | operator/brand/licence/**domain**/**app** links (domain/app resolved via contract views) |
| `payment_review_item` | review queue + bounded decisions |
| `payment_change_history` | **append-only** change history |

## Key rules
- Merchant reference is an attribute; `unique(merchant_reference, jurisdiction)`.
- Idempotency: `unique(payment_subject_id, idempotency_key)`.
- **Privacy:** no PAN/CVV/account-number columns; only aggregates + provider-neutral references.
- Non-destructive history; illegality **and** enforcement invariants at the DB.
- Cross-module links (domain/app) store the real reference id resolved via the governed contract
  views (`domain_reference`/`app_reference`), never base tables.
- Freshness tracked separately (payment observed / merchant last seen / registry / linked domain+app).
