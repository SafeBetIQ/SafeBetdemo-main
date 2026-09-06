# SafeBet Guardian — Data Ownership (ARCH-V4-C0)

## Boundary: dedicated `guardian` schema (Option B, interim strangler)
Guardian owns a dedicated `guardian` Postgres schema on the controlled Demo Supabase project.
It is **not** `public`, shares **no** SafeBet IQ business table, and does **not** reuse the
legacy `public.guardian_*` / `guardianlayer_*` objects. **Final target:** a separate
database/project — deferred because a new project could not be safely/reversibly provisioned
in C0; the dedicated schema is the strongest reversible isolation available now.

Migration: `supabase/migrations/20260905160000_arch_v4_c0_guardian_foundation_schema.sql`.
**Reversible:** `DROP SCHEMA guardian CASCADE;` (removes everything; no IQ object touched).

## Foundation tables (7) — synthetic only
| Table | Purpose |
|---|---|
| `guardian.service_metadata` | product/service registry (singleton) |
| `guardian.jurisdiction` | jurisdiction registry |
| `guardian.principal` | synthetic principal reference (`is_synthetic` CHECK) |
| `guardian.case` | case primitive (id/jurisdiction/status/actor/correlation/refs) |
| `guardian.evidence_ref` | evidence reference (integrity hash + retention + purpose; never the body) |
| `guardian.audit_context` | product=GUARDIAN audit linkage, `guardian:<jurisdiction>` scope |
| `guardian.message` | message/job metadata (idempotency key), queue namespace `guardian-*` |

No Guardian business modules yet (domains/apps/payments/geo/entity-graph/enforcement/provider/
re-entry) — those are C1+. No functions were created in the `guardian` schema (0), so no
privileged-function regression.

## Access model
- **Grants:** `USAGE` on schema + `SELECT`/`INSERT` on tables to `authenticated` + `service_role`
  only. **No `anon`, no `PUBLIC`.**
- **RLS:** enabled on all 7 tables. Business tables scope rows by
  `jurisdiction = request.jwt.claims ->> 'guardian_jurisdiction'` (product is `GUARDIAN` by
  table constraint). Missing/other-product claims → deny. `service_role` bypasses RLS
  (worker/admin), as designed.
- **Proven (DB negative tests):** ZA-GP claim sees only ZA-GP; ZA-WC only ZA-WC; an IQ
  casino_admin claim sees 0 Guardian rows; `anon` is denied; `service_role` sees all.

## C1 addition — Legal Operator Registry (14 tables)
The `guardian` schema now also holds the C1 registry (regulatory_authority, registry_source,
ingestion_batch, operator_entity, operator_alias, brand, operator_brand_relationship,
licence, licence_scope, licence_status_history, registry_source_record, registry_staging,
resolution_result, human_review_record) — **21 guardian tables total**, all RLS-enabled,
still **0 functions**, no anon/public grants. Access is scoped by jurisdiction claim +
`access_scope`; national/shared reference is cross-jurisdiction for Guardian principals
only; non-Guardian (IQ) and anon are denied. Migration
`20260905170000_arch_v4_c1_guardian_legal_operator_registry.sql`.

## CURRENT vs TARGET data boundary (architectural debt — do not lose)
- **CURRENT (approved Demo interim):** isolated `guardian` schema in the Demo Supabase project.
- **TARGET (final):** an independently governed Guardian datastore/database boundary
  (separate database/project). No migration to a separate DB is performed in C1 (not
  authorised). Recorded so the debt persists.

## C2 addition — Domain Intelligence (10 tables)
The `guardian` schema now also holds the 10 C2 domain tables (domain_subject,
domain_observation, website_snapshot, page_resource_reference, domain_technical_signal,
domain_content_signal, domain_registry_comparison, domain_entity_link, domain_review_item,
domain_change_history) — **31 guardian tables total**, all RLS-enabled, still **0 functions**,
no anon/public grants. The comparison table has a DB CHECK forbidding an illegality flag.

## Runtime data-access (least privilege) — IMPLEMENTED (C2.1)
The **API** Lambda remains credential-free (serves a synthetic snapshot). The **domain worker**
Lambda now persists its results to the `guardian` schema through a **dedicated least-privilege
Postgres role** `guardian_domain_worker`:
- **Grants:** USAGE on `guardian` + SELECT/INSERT on the 10 C2 domain tables + `audit_context`
  **only**. **No grants on `public`/SafeBet IQ tables** → IQ business data is unreachable at the
  privilege level (verified: `has_table_privilege(... players/casino_event_log ...) = false`).
- **RLS enforced** (role has no BYPASSRLS, is not owner): dedicated policies scope every
  read/write by a per-message jurisdiction GUC (`app.guardian.jurisdiction`) the worker sets in
  its transaction → wrong-jurisdiction writes are blocked at the DB.
- **Secret:** connection JSON in AWS Secrets Manager (`safebet-guardian/domain-worker-db`); the
  worker role IAM has `secretsmanager:GetSecretValue` on **that one ARN only**. Not an IQ
  credential; never committed/logged/returned. Rotation: `alter role … password` + update secret.
- **Bounded contract:** the worker persists only via `DomainObservationRepository`
  (`products/guardian/src/domain/repository.ts` plan + fixed parameterised inserts) — **no
  generic `execute(sql)`**. Idempotent (deterministic ids + `on conflict do nothing`), one
  transaction (no partial state). Proven live: persist, duplicate-suppression, non-destructive
  history, wrong-jurisdiction denial, poison→DLQ.

## C3 addition — Mobile App Intelligence (10 tables) + dedicated worker principal
The `guardian` schema now also holds the 10 C3 mobile_app_* tables (**41 guardian tables
total**), all RLS-enabled, still **0 functions**, no anon/public grants. A comparison-table
CHECK forbids an illegality flag. The C3 app worker persists via a **separate** dedicated
least-privilege role `guardian_app_worker` (NOT reusing `guardian_domain_worker`): grants
ONLY on the 10 mobile_app_* tables + `audit_context` + **read-only** `domain_subject` (for
the governed app→domain link); **no grants on public/IQ** and no write on the C2 domain
tables. Its secret is `safebet-guardian/app-worker-db`; the app worker IAM has
`GetSecretValue` on that one ARN.

## C4 addition — Payment Intelligence (9 tables) + dedicated worker principal + App Reference Contract
9 C4 payment tables (**50 guardian tables total**), RLS on all, 0 functions, no anon/public;
comparison-table CHECKs forbid illegality AND enforcement flags; no PAN/CVV/raw bank/card data. A
separate least-privilege role `guardian_payment_worker` (payment tables + audit_context + SELECT on the
governed `domain_reference`/`app_reference` contract views; **no public/IQ, no C2/C3 base tables**) with
its own secret `safebet-guardian/payment-worker-db`. New governed **App Reference Contract** view
`guardian.app_reference` (owner Mobile App Intelligence).

## Interim exception + P1 exit target
The `guardian_domain_worker` role connects to the **same Supabase Postgres instance** as SafeBet
IQ (shared cluster, separate schema + separate least-privilege principal). This is a **governed
interim Demo boundary** — schema+privilege isolation, not a separate cluster. **Separate,
independently governed Guardian database/project remains the P1 exit target** (recorded, not lost).

## POPIA / minimisation
Evidence is stored as a **reference** (id + integrity hash) with `retention_until` and
`access_purpose`, never the raw body. Classification (`PUBLIC`/`RESTRICTED`/`SENSITIVE`)
recorded. No real personal/banking/player data at C0.
