# SafeBet Guardian — PR2 Dedicated-Database Cutover Runbook (v2, gates closed)

**Status: CUTOVER-READINESS PREPARATION. The live cutover has NOT been performed.**
Source Guardian (IQ Demo `uexdjngogzunjxkpxwll` / schema `guardian`) remains the sole live writable
authority. Target: `druuskabkgyotslcgnys` (SafeBet Guardian – Demo, eu-west-1, PG 17.6). Guardian live
runtime: `be34a417`. This runbook is validated technically and, where non-destructive, proven against
the target. Do NOT execute end-to-end until an explicit, separate **live cutover authorisation**.

---

## 0. Verified initial-migration checkpoint (§1 of prior task)

**Logical-content parity under the verified serialization/reconciliation method** — NOT a claim of
PostgreSQL physical byte-for-byte storage identity: 110 tables · 440 source = 440 target rows · 0 count
mismatches · 0 canonical-content fingerprint mismatches. The cutover re-copies from a fresh frozen
baseline, so this is a mechanism validation, not the cutover dataset.

---

## 1. Rollback completeness — runtime is APPEND-ONLY (§1)

**Proven from DB privileges (target):** the 11 guardian_* runtime roles hold **only INSERT (90) + SELECT
(124)** — **no UPDATE / DELETE / TRUNCATE** on any guardian table. Per-table classification: 78
INSERT_ONLY (runtime-writable), 0 INSERT_AND_UPDATE, **0 INSERT_UPDATE_DELETE**, 11 READ_ONLY, 21
NO_GRANT. Defense-in-depth: 28 `*_append_only` BEFORE UPDATE/DELETE block-mutation triggers; **0 SECURITY
DEFINER** functions (no escalation path). A runtime role's DELETE/UPDATE fails `42501` (proven).

**Therefore UPDATE and DELETE are structurally impossible for the runtime.** Post-cutover writes are
strictly new INSERTs, so the rollback delta = `target_PK \ baseline_PK` is **complete** (no UPDATE/DELETE
to miss). Rollback invariant (§8 below) restores the source to the exact logical state.

**Scoping assumption (operating, not a runtime-reachable path):** this completeness holds for *runtime*
(`guardian_*`) writes. `service_role` is retained for break-glass admin and bypasses RLS; an out-of-band
admin `UPDATE`/`DELETE` on the target during the authoritative window would not produce a new PK and
would therefore be missed by the PK-diff. The cutover operating rule is **no out-of-band admin mutation
of the target during the authoritative window** (all changes flow through the append-only runtime roles).

---

## 2. TLS trust path + CA verification (§5)

Target reachable **only via the pooler** `aws-1-eu-west-1.pooler.supabase.com:6543` (transaction mode;
user `<role>.druuskabkgyotslcgnys`). Direct `db.<ref>.supabase.co` does **not resolve**. Pooler cert
chains `*.pooler.supabase.com → Supabase Intermediate 2021 CA → Supabase Root 2021 CA` (private root, not
in the public trust store).

**Required deployment config:** `GUARDIAN_DB_CA_PEM` (or `_CA_BUNDLE`) =
`products/guardian/config/supabase-root-2021-ca.crt`. Verified: **certificate only, no private key**;
subject == issuer `CN=Supabase Root 2021 CA`; `basicConstraints CA:TRUE`; **SHA-256 fingerprint
`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`**;
valid `2021-04-28 → 2031-04-26`. Proven: with CA pinned → TLSv1.3 authorized; **without CA → refused**
(`self-signed certificate in certificate chain`) = fail-secure. `guardianDbSsl()` keeps
`rejectUnauthorized:true` + `minVersion TLSv1.2` + hostname (SNI) verification, and is **fail-closed** (an
explicitly-set-but-malformed `GUARDIAN_DB_CA_PEM` throws; no alternate insecure trust path).

---

## 3. Pooler compatibility (§4) — CONFIRMED

Workers wrap each unit of work in `begin; select set_config('app.guardian.jurisdiction',<jur>,true);
<writes>; commit` (transaction-local GUC). No `SET SESSION`, LISTEN/NOTIFY, advisory/session locks, temp
tables, prepared-statement assumptions, or long-lived transactions anywhere in Guardian runtime.
**Proven on the transaction-mode pooler:** in-transaction the transaction-local GUC drives RLS (4 ZA-GP
rows visible); a plain statement without the GUC sees 0 rows (no cross-transaction leak); repeatable
across sequential transactions on the pooled connection. Operational note: supavisor caches role
credentials — after `ALTER ROLE … PASSWORD`, allow a few seconds / connect with a short retry.

---

## 4. `authenticated` role decision (§3) — REVOKED on target

No Guardian runtime path depends on the PostgreSQL `authenticated` role: no `@supabase/supabase-js`,
`createClient`, PostgREST, or `NEXT_PUBLIC_SUPABASE` usage anywhere in Guardian; the runtime connects via
the `guardian_*` roles on the pooler; the API Lambda uses `guardian_identity_resolver`. C1–C10 flows use
these roles only. **Applied on the target (only):** `authenticated` guardian grants 216 → 0 and schema
USAGE removed; the 11 guardian_* roles are intact (214 grants). Documented inverse (only if ever needed):
`grant usage on schema guardian to authenticated; grant select, insert on all tables in schema guardian
to authenticated;`. NOTE: this is the one intentional, documented divergence of the target schema from the
reviewed source; the final data-only reload preserves it. If the schema is ever rebuilt from migrations,
re-apply the REVOKE.

---

## 5. Identity-sequence repair (§6) — robust for empty AND non-empty

`OVERRIDING SYSTEM VALUE`-loaded rows do not advance a `GENERATED ALWAYS AS IDENTITY` sequence; the naive
`setval(seq, coalesce(max,0))` breaks on an empty table (`0 < MINVALUE 1`). Robust repair, per identity
table (only `guardian.audit_context.id` today; 0 by-default-identity, 0 stored-generated), run AFTER the
final reload and BEFORE the first target write:

```sql
do $$
declare mx bigint; seq text;
begin
  seq := pg_get_serial_sequence('guardian.audit_context','id');
  select max(id) into mx from guardian.audit_context;
  if mx is null then perform setval(seq, 1, false);   -- empty  -> next nextval = 1
  else               perform setval(seq, mx, true);   -- non-empty -> next nextval = max+1
  end if;
end $$;
```

**Proven:** non-empty (max=39) → next inserts 40, 41; empty → first insert id = 1 (no error). Discover
identity tables generically: `select c.relname, a.attname from pg_attribute a join pg_class c … where
a.attidentity='a'`.

---

## 6. Source quiescence SQL (§2) — Management-API path; guardian-scoped; NOT executed

The already-approved Supabase Management API admin query path can execute the narrowly-scoped source
quiescence on `uexdjngogzunjxkpxwll` — **no privileged direct-PG IQ credential or postgres-password reset
is required.** All statements are restricted to the `guardian` schema and the known `guardian_*` roles;
**no `public`/IQ object is touched.** These require independent review and explicit cutover authorisation
before execution.

**(a) Capture exact current grants (for a precise, least-privilege restore):**
```sql
select grantee, table_name, privilege_type
  from information_schema.role_table_grants
 where table_schema='guardian' and grantee like 'guardian\_%'
 order by grantee, table_name, privilege_type;   -- persist this set as the restore manifest
```

**(b) Revoke write authority (guardian schema + guardian_* roles only).** Derive the role list
DYNAMICALLY from `pg_roles` so it self-reconciles to exactly the existing 11 roles — do NOT hard-code a
role list (there is no `guardian_authorisation_worker`; the authorisation worker connects as
`guardian_policy_worker`, so a hard-coded name would raise `42704 role does not exist` and abort the whole
statement):
```sql
do $$
declare r record;
begin
  for r in select rolname from pg_roles where rolname like 'guardian\_%' loop
    execute format('revoke insert, update, delete, truncate on all tables in schema guardian from %I', r.rolname);
  end loop;
end $$;
-- SELECT retained so a read-only drain can complete; the final baseline is read by the admin path.
```
(Revoking a privilege a role does not hold is a harmless no-op; because the list is derived from
`pg_roles`, a non-existent role can never be referenced — avoiding the hard `42704` error a hard-coded
list would raise.)

**(c) Verify the revoke (expect 0 rows):**
```sql
select grantee, privilege_type from information_schema.role_table_grants
 where table_schema='guardian' and grantee like 'guardian\_%'
   and left(privilege_type,3) in ('INS','UPD','DEL','TRU');
```

**(d) 42501 write canary (must fail):**
```sql
set role guardian_app_worker;
-- expect ERROR 42501 insufficient_privilege:
insert into guardian.audit_context (product, actor_principal_id, actor_role, jurisdiction, event_type,
  correlation_id, occurred_at, sequence_number, previous_hash, event_id, event_hash)
values ('GUARDIAN','canary','SYSTEM_SERVICE','ZZ-CANARY','guardian.canary','canary', now(), 1,
  repeat('0',64), 'canary', repeat('0',64));
reset role;
```

**(e) pg_stat_activity verification (expect 0 active guardian writers):**
```sql
select count(*) active_guardian_writes from pg_stat_activity
 where usename like 'guardian\_%' and state <> 'idle'
   and query ~* '(insert|update|delete)';
```

**(f) Tuple-write counter (capture, wait window ≥5 min, re-capture → delta 0):**
```sql
select coalesce(sum(n_tup_ins+n_tup_upd+n_tup_del),0) guardian_writes
  from pg_stat_user_tables where schemaname='guardian';
```

**(g) Inverse / restore during pre-switch rollback (exact, least-privilege — replay the (a) manifest):**
```sql
-- for each saved row: grant <privilege_type> on guardian.<table_name> to <grantee>;
-- (NOT a blanket "grant insert on all tables" — that would over-grant and break least-privilege.)
```

---

## 7. Final cutover order (§7) — with STOP/ROLLBACK conditions. DO NOT EXECUTE YET.

| # | Step | STOP / ROLLBACK condition |
|---|------|---------------------------|
| 1 | Declare change window | Abort if no authorisation / no on-call. |
| 2 | Stop/disable Guardian consumers (SQS event-source mappings, schedules; API mutating routes) | If any consumer cannot be stopped → STOP (no partial quiesce). |
| 3 | Drain queues + in-flight work | Queue depth + in-flight not reaching 0 in window → STOP. |
| 4 | Revoke source Guardian writes — §6(b) via Management API | Revoke errors / touches non-guardian → STOP + §6(g) restore. |
| 5 | Prove SOURCE WRITES = 0 — §6(c)(d)(e)(f) | Any nonzero write signal or canary that succeeds → STOP + restore. |
| 6 | Capture final source baseline (counts + PK set + content fingerprints) | Baseline capture incomplete/unreadable → STOP + restore. |
| 7 | `TRUNCATE guardian.<all> RESTART IDENTITY CASCADE` — TARGET only (0 TRUNCATE-event triggers confirmed) | Truncate error / not target → STOP (no reload); target still non-authoritative. |
| 8 | Reload from frozen source (reviewed Management-API mechanism; FK-topological) | Copy error → STOP; re-run idempotently or restore source authority. |
| 9 | Reconcile counts + canonical fingerprints vs baseline | `reconcile.ok≠true` or `contentMismatches≠[]` → STOP; do NOT switch. |
| 10 | Verify Guardian crypto artifacts (evidence content/custody, audit chain) | Any hash/chain verify failure → STOP; do NOT switch. |
| 11 | Repair identity sequence(s) — §5 (after reload, before any write) | setval error → STOP; do NOT enable writes. |
| 12 | Verify least-privilege target grants + `authenticated` removed (§4) + 0 SECDEF | Unexpected grant/SECDEF → STOP; remediate before switch. |
| 13 | Verify secure pooler TLS (CA-validated, fail-closed) | TLS not CA-validated → STOP. |
| 14 | Switch Guardian API + workers to target (promote staged `safebet-guardian/target/*` creds; set `GUARDIAN_DB_CA_PEM`) — **the authority switch** | Health/smoke fail post-switch → ROLLBACK (§8). |
| 15 | Run C1–C10 + PR1 acceptance against target | Any acceptance failure → ROLLBACK (§8). |
| 16 | Declare target authoritative | Only after 14+15 green. |
| 17 | Keep old source frozen/read-only | — |
| 18 | Start 30-day retention clock | — |

---

## 8. Rollback after target writes (§9 of prior task) — proven detection; single-writer invariant

Because the runtime is append-only (§1), post-cutover changes are new INSERTs only.

1. **Re-quiesce the target** (same measurable procedure as §6, applied to the target).
2. **Detect** post-cutover rows: `target_PK \ baseline_PK` per table (**proven** on temp tables — isolates
   exactly the new rows).
3. **Export** them with full content + custody/evidence/audit hashes.
4. **Replay into the restored source** (`OVERRIDING SYSTEM VALUE` to preserve PK/identity), then run the
   §5 identity-sequence repair on the source.
5. **Verify** `source_PK == baseline_PK ∪ detected_PK` by PK **and** content fingerprint **before**
   restoring source write-authority (§6(g)).
6. **Restore source write-grants** (§6(g) exact replay); leave target read-only/decommissioned.

**Invariant:** exactly one writable authority at all times — source is quiesced before the target becomes
authoritative, and the target is quiesced before the source is restored. **No dual-writer interval, no
blind alias flip, no data loss.** Go signal to restore source authority = `reconcile(source, baseline ∪
export)` exact (0 count + 0 content-fingerprint mismatch). A rollback restores the source to the exact
logical state that would exist had the target's accepted INSERTs occurred there.

---

## 9. C1–C10 + PR1 acceptance plan (against target runtime, post-switch)

Per capability (synthetic data; jwt auth mode + MFA): C1 registry (jurisdiction-scoped, isIllegal=false);
C2 domain / C3 app / C4 payment / C5 geo (NON-LEGAL/NON-ENFORCEMENT, cross-jurisdiction 403); C6 case
(investigation only); C7 evidence (SHA-256 content + append-only custody verify; EVIDENCE_HOLD/EXPORT
capability-gated); C8 authorisation (human AUTHORISING_OFFICER + MFA; worker cannot insert final
authorisation); C9 orchestration (synthetic providers; ACK≠ACTIONED≠VERIFIED); C10 re-entry (intelligence
+ routing; human review). Cross-cutting: every privileged route gated on the Cognito JWT path; per-
jurisdiction RLS; audit-chain verify; `/version` four-way provenance; all 11 workers over CA-validated
pooler TLS. Gate: all green + reconcile parity + identity repair applied + SOURCE WRITES=0 pre-switch.

---

## 10. 30-day retention (§8 of prior task)

Retain the original source Guardian schema (read-only) for **30 days** post-cutover as the rollback
source; retirement is a **separate** authorisation. Retain the frozen baseline manifest + this runbook +
acceptance evidence for the window.

---

## 11. Remaining owner decisions / gates

1. Explicit **live cutover authorisation**.
2. Independent review of the §6 source quiescence + restore SQL (part of this task's review).
3. Cutover window + on-call + acceptance sign-off.
4. Confirm the supavisor credential-sync retry is built into the switch step (§3 note).
5. 30-day retention observed before any source retirement.
