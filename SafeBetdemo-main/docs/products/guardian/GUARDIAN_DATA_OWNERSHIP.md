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

## POPIA / minimisation
Evidence is stored as a **reference** (id + integrity hash) with `retention_until` and
`access_purpose`, never the raw body. Classification (`PUBLIC`/`RESTRICTED`/`SENSITIVE`)
recorded. No real personal/banking/player data at C0.
