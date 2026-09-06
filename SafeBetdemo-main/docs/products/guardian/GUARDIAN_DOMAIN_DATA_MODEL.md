# SafeBet Guardian — Domain Data Model (ARCH-V4-C2)

10 tables in the dedicated `guardian` schema (total **31** guardian tables: 7 C0 + 14 C1 +
10 C2). Immutable Guardian ids as keys (never the hostname). RLS on all; jurisdiction-scoped;
Guardian principals only; IQ/anon denied. **0 functions.** No anon/public grants.

| Table | Role |
|---|---|
| `domain_subject` | immutable `domain_id`; canonical/display hostname; first/last seen; jurisdiction |
| `domain_observation` | one processing of a subject; `content_hash`; `idempotency_key` (unique per domain) |
| `website_snapshot` | synthetic capture: title, visible-text extract, **evidence reference**, content hash, http status, viewport |
| `page_resource_reference` | script/resource references from a snapshot |
| `domain_technical_signal` | hostname/redirect/TLS/status/fingerprint signals |
| `domain_content_signal` | gambling/deposit/registration/age/licence-text signals (present + detail) |
| `domain_registry_comparison` | non-legal comparison result: match/resolution state, candidate op/brand, licence ref + verification, review priority, reason codes; **CHECK forbids `is_illegal_determination=true`** |
| `domain_entity_link` | domain↔operator/brand/licence link; type/confidence/source/observed-at/human-confirmed; not overwritten |
| `domain_review_item` | review queue: NEW/TRIAGED/REQUIRES_REVIEW/VERIFIED_REFERENCE/UNRESOLVED/CLOSED + bounded decision |
| `domain_change_history` | **append-only** change history (first-seen/content-hash/redirect/candidate changes) — supports future re-entry |

## Key rules
- **Hostname is an attribute, not a key** — deterministic normalisation produces the
  canonical hostname; `unique(canonical_hostname, jurisdiction)` prevents duplicate subjects.
- **Idempotency** — `unique(domain_id, idempotency_key)` prevents duplicate authoritative
  observations under duplicate delivery.
- **Non-destructive history** — new observations and change-history rows are appended; prior
  observations/links are never overwritten.
- **Evidence** — snapshots hold an **evidence reference** + content hash, never the body
  inline; audit/queue envelopes carry references only.
- **Freshness** — domain observation freshness (`observed_at`, `captured_at`) is tracked
  separately from registry reference freshness (C1 `last_verified_at`); a fresh observation
  over a stale licence is never presented as fully verified.
- **Illegality invariant at the DB** — the comparison table cannot store an illegality flag.
