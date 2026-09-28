# SafeBet Guardian — PR2 Dedicated-Database Cutover Runbook

**Status: CUTOVER-READINESS PREPARATION. The live cutover has NOT been performed.**
Source Guardian schema (IQ Demo `uexdjngogzunjxkpxwll`) remains the sole live writable authority.
Target dedicated project: `druuskabkgyotslcgnys` (SafeBet Guardian – Demo, eu-west-1, PG 17.6).

This runbook is validated technically and, where non-destructive, proven against the target. It must
NOT be executed end-to-end until an explicit, separate **live cutover authorisation**.

---

## 0. Verified initial-migration checkpoint (§1)

Accepted as **logical-content parity under the verified serialization/reconciliation method** — NOT a
claim of PostgreSQL physical byte-for-byte storage identity:

- 110 Guardian tables · 440 source rows · 440 target rows
- 0 count mismatches · 0 canonical-content fingerprint mismatches (order-independent `md5(row_to_json)`)
- Manifest preserved (per-table copied/source/target counts + fingerprints + reconcile).

Because the cutover uses a **final full copy** (below), this checkpoint is a validation of the mechanism,
not the authoritative dataset for cutover.

---

## 1. TLS trust path (§4/§5) — REQUIRED deployment configuration

**Finding (corrected):** the target's only reachable endpoint is the **pooler**
`aws-1-eu-west-1.pooler.supabase.com:6543` (transaction mode; username `<role>.druuskabkgyotslcgnys`).
The direct host `db.druuskabkgyotslcgnys.supabase.co` does **not resolve** from the runtime environment.
The pooler certificate chains to the **private `Supabase Root 2021 CA`**, which is **not** in Node's
public trust store. Therefore `guardianDbSsl()` relying on public trust is **insufficient** for the
target — the runtime **MUST** supply the Supabase CA bundle.

**Deployment requirement:** set `GUARDIAN_DB_CA_PEM` (or `GUARDIAN_DB_CA_BUNDLE`) to
`products/guardian/config/supabase-root-2021-ca.pem` (a **public** CA cert; safe to commit; valid to 2031).
`guardianDbSsl()` then produces `{ rejectUnauthorized: true, minVersion: 'TLSv1.2', ca: <Supabase Root>,
servername: <pooler host> }`.

**Proven (non-live):** with the CA pinned → TLSv1.3, `authorized:true`, `current_user=guardian_evidence_reader`.
Without the CA → connection **refused** (`self-signed certificate in certificate chain`) — fail-secure.
`tls.ts` is now fail-closed: an explicitly-set-but-malformed `GUARDIAN_DB_CA_PEM` throws instead of
silently downgrading trust.

---

## 2. Final full-copy cutover sequence (§2) — validated; DO NOT EXECUTE YET

1. **Quiesce source writes (§8)** — stop write consumers, drain, revoke source write grants (see §5 below).
2. **Drain in-flight** — allow open API requests / worker invocations / transactions to complete.
3. **Revoke source write grants** — `REVOKE INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA guardian FROM
   guardian_*_worker, guardian_identity_resolver;` on the **source** (read stays for the final snapshot).
4. **Capture final authoritative source baseline** — per-table row counts + PK set + content fingerprints
   (the reviewed `tableContentHash` / reconcile method), and freeze it as the rollback baseline.
5. **Truncate TARGET only** — `TRUNCATE guardian.<all tables> RESTART IDENTITY CASCADE` (target-only;
   append-only triggers fire on UPDATE/DELETE, not TRUNCATE, so TRUNCATE is permitted).
6. **Reload target from the frozen source** — the reviewed Management-API copy
   (`runInitialMigration`, head with `rowsOf` + `OVERRIDING SYSTEM VALUE` + `jsonb::text` scale fidelity),
   FK-topological order.
7. **Reconcile** — exact row counts + canonical content fingerprints must match the frozen baseline
   (`reconcile.ok === true`, `contentMismatches === []`).
8. **Advance identity sequences (§7)** — see below; run AFTER reload, BEFORE any target write.
9. **Switch Guardian runtime to the target** — repoint the 11 clients to the staged target credentials
   (promote `safebet-guardian/target/*` → the live secret ids, or repoint client secret ids) + set
   `GUARDIAN_DB_CA_PEM`. (This is the irreversible authority switch — requires cutover authorisation.)
10. **Acceptance (§C1–C10)** — run the acceptance plan below against the target runtime.
11. **Preserve the frozen source** — retain the original source schema (read-only) for the rollback window.

Technical validation notes: the copy is idempotent (`ON CONFLICT DO NOTHING`) and FK-safe (topological);
`TRUNCATE ... RESTART IDENTITY CASCADE` clears all rows + resets identity; the reconcile is the go/no-go gate.

---

## 3. Identity-sequence repair (§7) — proven on temp tables; run post-reload, pre-first-write

Rows loaded with `OVERRIDING SYSTEM VALUE` do **not** advance a `GENERATED ALWAYS AS IDENTITY` sequence,
so the first app insert would collide (reproduced: `23505 unique_violation`). Repair per identity table
(only `guardian.audit_context.id` today; 0 by-default-identity, 0 stored-generated):

```sql
select setval(pg_get_serial_sequence('guardian.audit_context','id'),
              (select coalesce(max(id),0) from guardian.audit_context), true);
```

**Proven:** after `setval` to MAX(id)=39, subsequent plain inserts received ids 40, 41 — no collision.
Do **NOT** run this now (the final truncate would reset it); run it only after the final reload and
before enabling target writes. Discover identity tables generically:
`select c.relname, a.attname from pg_attribute a join pg_class c ... where a.attidentity='a'`.

---

## 4. Source quiescence (§8) — measurable SOURCE WRITES = 0

An alias switch alone does **not** provide write quiescence. Ordered procedure:

1. **Stop consumers** — disable the SQS event-source mappings / scheduled triggers for all 11 workers;
   set the API to read-only or stop it accepting mutating routes.
2. **Drain** — wait for in-flight Lambda invocations + open transactions to finish (monitor
   `pg_stat_activity` for `state='active'` write queries in the guardian schema = 0; queue `ApproximateNumberOfMessages` + `...NotVisible` = 0).
3. **Revoke DB write-grants** on the source (step 3 above) — makes writes structurally impossible.
4. **Verify SOURCE WRITES = 0** (measurable proof, all must hold for a stable window, e.g. 5 min):
   - `pg_stat_activity`: 0 non-idle sessions from `guardian_*` roles running INSERT/UPDATE/DELETE.
   - Per-table `xact_commit` deltas via a guardian write-counter (or `pg_stat_user_tables.n_tup_ins/upd/del`
     deltas) = 0 across the window.
   - SQS depth (queues + DLQs) = 0 and no in-flight.
   - A canary write attempt by a `guardian_*_worker` role now fails with `42501` (grants revoked).
5. Only then capture the final baseline (step 4 of §2).

---

## 5. Rollback after target writes (§9) — designed; detection proven; no source write, no dual authority

Scenario: target became authoritative, new Guardian records were written, acceptance then fails.

**Invariant:** at all times exactly one writable authority. Rollback restores the source as sole authority
with **no data loss** and **no blind alias flip**.

Procedure:
1. **Re-quiesce the target** (same measurable procedure as §4, applied to the target).
2. **Detect post-cutover records** — rows in the target whose PK is absent from the frozen source baseline
   (proven on temp tables: detection isolated exactly the new rows). Formally:
   `target_PK \ baseline_PK` per table.
3. **Export** those rows (with full content + custody/evidence/audit hashes) to a durable manifest.
4. **Reconcile** the export: every detected row accounted for; hashes intact.
5. **Replay into the restored source** — insert the exported rows into the source (which still holds the
   frozen baseline), preserving PKs/hashes/identity via `OVERRIDING SYSTEM VALUE`, then re-run identity-
   sequence repair on the source.
6. **Verify** `source_PK == (baseline_PK ∪ detected_PK)` by PK **and** content fingerprint BEFORE restoring
   source write-authority.
7. **Restore source write-grants**; leave the target read-only/decommissioned. Single writable authority
   throughout — the source is never written while the target is writable, and vice-versa.

**Verification method / rollback invariant:** `reconcile(source, baseline ∪ export) == exact`
(0 count + 0 content-fingerprint mismatch) is the go signal to restore source write-authority.

---

## 6. Role/grant posture (§6) — verified on target

All 11 Guardian roles are least-privilege (LOGIN only; no SUPER/CREATEROLE/CREATEDB/BYPASSRLS). Per-role
grants are scoped INSERT/SELECT subsets (append-only; `guardian_identity_resolver`/API minimal at
INSERT:1/SELECT:2). **0 SECURITY DEFINER functions; no PUBLIC/anon grants.** RLS is active (verified: a role
with no jurisdiction claim sees 0 rows).

**Hardening finding (recommended, not yet applied — needs owner/reviewer sign-off as it diverges the
target schema from the reviewed source):** the Supabase `authenticated` role has broad INSERT/SELECT +
schema USAGE on guardian (inherited from the reviewed migrations; RLS-scoped). The Guardian runtime uses
only the `guardian_*` roles (direct pooler), not PostgREST/`authenticated`. Recommended at cutover
hardening:

```sql
revoke all on all tables in schema guardian from authenticated;
revoke usage on schema guardian from authenticated;
-- (service_role retained for break-glass admin; review separately)
```

---

## 7. C1–C10 acceptance plan (§16) — run against the target runtime post-switch

Per capability area, against the target-backed runtime (jwt auth mode, MFA), synthetic data only:

- **C1 Legal registry:** `/registry/operators|licences|sources`, `/registry/match` — jurisdiction-scoped, `isIllegalDetermination:false`.
- **C2 Domain / C3 App / C4 Payment / C5 Geo:** list + `observe` + get — NON-LEGAL, NON-ENFORCEMENT flags present; cross-jurisdiction denied (403).
- **C6 Case:** `/cases` GET/POST + sub-resources — investigation only; no enforcement route exists.
- **C7 Evidence:** register/verify/custody/retrieve/hold/export — SHA-256 content hash + append-only custody chain verify OK; `EVIDENCE_HOLD`/`EVIDENCE_EXPORT` capability-gated.
- **C8 Authorisation:** policy applicability + human authorisation gate (AUTHORISING_OFFICER + MFA); worker cannot insert final authorisation.
- **C9 Orchestration:** synthetic providers only; ACK≠ACTIONED≠VERIFIED.
- **C10 Re-entry:** intelligence + routing only; human review; no auto re-enforcement.
- **Cross-cutting:** each privileged route gated on the Cognito JWT path; per-jurisdiction RLS returns rows only for the caller's jurisdiction; audit chain verifies; `/version` four-way provenance parity; all 11 workers connect over CA-validated TLS.

Acceptance gate: all green + reconcile parity + identity-sequence repair applied + SOURCE WRITES=0 confirmed pre-switch.

---

## 8. 30-day retention (§17)

Retain the original source Guardian schema (IQ Demo, read-only) for **30 days** post-cutover as the
rollback source. After 30 days with no rollback, retirement of the original schema is a **separate**
authorisation (not part of PR2). Retention record: keep the frozen baseline manifest + this runbook +
the cutover acceptance evidence for the window.

---

## 9. Remaining cutover gates (§21)

1. Explicit **live cutover authorisation** (this runbook is preparation only).
2. Direct-PG source credentials for the final quiesce/revoke on the source (§9 of the migration task).
3. Owner/reviewer decision on the `authenticated` hardening REVOKE (§6 above).
4. Cutover window scheduling + on-call + acceptance sign-off.
5. Post-switch identity-sequence repair (§3 above) executed and verified.
6. 30-day retention observed before any source retirement.
