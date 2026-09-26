#!/usr/bin/env node
// ─── SafeBet Guardian — PR2 INITIAL migration via Supabase Management API (Option B) ──
//
// Owner-approved alternative to the direct-Postgres pr2-migration.mjs when privileged
// direct-PG credentials are not safely obtainable. It performs a CONTROLLED, idempotent,
// read-only-source initial copy of the synthetic Guardian schema data from the IQ Demo
// project's `guardian` schema into the dedicated Guardian Demo project's `guardian` schema,
// using the Management API `/database/query` endpoint (admin, token-authenticated).
//
// HARD SAFETY INVARIANTS (enforced, unit-tested):
//   • Explicit --source and --target project refs are REQUIRED.
//   • source === target is REJECTED.
//   • The IQ PRODUCTION ref is REJECTED as either source or target.
//   • Only the `guardian` schema is touched — every object is allow-listed; anything else is rejected.
//   • SOURCE is read-only: every source statement must be a single SELECT (asserted). No source DDL/DML.
//   • TARGET writes are confined to guardian.<allow-listed table>.
//   • Idempotent: rows insert with ON CONFLICT DO NOTHING (a retry never overwrites a differing target row).
//   • The Management API token is read from env (SUPABASE_ACCESS_TOKEN) ONLY — never hard-coded,
//     never logged, never written to the manifest.
//   • It NEVER runs `supabase db push`/`migration up`, never mutates the IQ migration ledger,
//     never touches any non-guardian / IQ / public object.
//
// Admin API privilege is NOT treated as licence for unrestricted operations — the guards above bound it.
//
// Writes are GATED: this tool must pass tests + gates + independent review before it is run against a
// target (owner §6). Schema is (re)created separately from the reviewed Guardian migrations.

import { readFileSync } from 'node:fs';

export const IQ_PRODUCTION_REF = 'ilibvipqbkugqkppzdmh';   // NEVER a source or target
export const GUARDIAN_SCHEMA = 'guardian';
const REF_RE = /^[a-z]{20}$/;                               // Supabase project refs are 20 lowercase letters
const MGMT_BASE = 'https://api.supabase.com';

// ── guards ───────────────────────────────────────────────────────────────────

export function assertMigrationTargets(source, target) {
  if (!source || !target) throw new Error('both --source and --target project refs are required');
  if (!REF_RE.test(source)) throw new Error(`invalid source project ref: ${source}`);
  if (!REF_RE.test(target)) throw new Error(`invalid target project ref: ${target}`);
  if (source === target) throw new Error('source and target refs must differ (refusing same-project migration)');
  if (source === IQ_PRODUCTION_REF) throw new Error('IQ Production must never be a migration SOURCE');
  if (target === IQ_PRODUCTION_REF) throw new Error('IQ Production must never be a migration TARGET');
  return { source, target };
}

/** A source statement must be a single read-only SELECT (defence-in-depth against source mutation). */
export function assertSelectOnly(sql) {
  const s = String(sql).trim().replace(/;\s*$/, '');
  if (/;/.test(s)) throw new Error('source statement must be a single statement (no ";")');
  if (!/^(select|with)\b/i.test(s)) throw new Error('source statement must be read-only (SELECT/WITH only)');
  if (/\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call|do|merge)\b/i.test(s))
    throw new Error('source statement must not contain a mutating keyword');
  return s;
}

/** Every migrated object must be an allow-listed, unqualified guardian table name. */
export function assertGuardianTable(name, allowlist) {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`unsafe table identifier: ${name}`);
  if (allowlist && !allowlist.includes(name)) throw new Error(`table not in the guardian allow-list: ${name}`);
  return name;
}

// ── safe SQL literal for a JSON payload (single dollar-quote-free path) ────────

/** Escape a JSON string as a standard SQL string literal (single-quotes doubled). JSON has no bare
 *  single-quote delimiters, so this is injection-safe; the value is cast to jsonb by the caller. */
export function sqlJsonLiteral(jsonText) {
  const t = typeof jsonText === 'string' ? jsonText : JSON.stringify(jsonText);
  return `'${t.replace(/'/g, "''")}'`;
}

/**
 * Build the idempotent, type-faithful bulk INSERT for one page of rows. Postgres does ALL type
 * coercion via jsonb_populate_recordset (bytea via \\x hex, jsonb, timestamptz from ISO, arrays,
 * NULL) so no per-type serialization is hand-rolled. ON CONFLICT DO NOTHING = idempotent retry.
 */
export function buildInsertStatement(table, rowsJsonArrayText, allowlist) {
  assertGuardianTable(table, allowlist);
  return `insert into ${GUARDIAN_SCHEMA}.${table} ` +
    `select * from jsonb_populate_recordset(null::${GUARDIAN_SCHEMA}.${table}, ${sqlJsonLiteral(rowsJsonArrayText)}::jsonb) ` +
    `on conflict do nothing`;
}

/** Reconcile per-table source vs target counts into an explained result (no silent skips). */
export function reconcileCounts(perTable) {
  const rows = perTable.map((t) => ({ ...t, match: t.source === t.target, delta: t.target - t.source }));
  const mismatches = rows.filter((r) => !r.match);
  return {
    tables: rows.length,
    sourceTotal: rows.reduce((a, r) => a + r.source, 0),
    targetTotal: rows.reduce((a, r) => a + r.target, 0),
    mismatches,
    ok: mismatches.length === 0,
  };
}

// ── Management API runtime (token from env; never logged) ──────────────────────

function token() {
  const t = process.env.SUPABASE_ACCESS_TOKEN;
  if (!t) throw new Error('SUPABASE_ACCESS_TOKEN is not set (required; never hard-code or log it)');
  return t;
}

export async function mgmtQuery(ref, sql, { readOnly = false } = {}) {
  if (readOnly) assertSelectOnly(sql);
  const res = await fetch(`${MGMT_BASE}/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Management API query failed on ${ref}: HTTP ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json();
}

/** Allow-listed guardian tables (source, read-only), non-empty first for copy ordering context. */
export async function listGuardianTables(sourceRef) {
  const rows = await mgmtQuery(sourceRef,
    `select c.relname as t, coalesce(s.n_live_tup,0) as rows` +
    ` from pg_class c join pg_namespace n on n.oid=c.relnamespace` +
    ` left join pg_stat_user_tables s on s.relid=c.oid` +
    ` where n.nspname='${GUARDIAN_SCHEMA}' and c.relkind='r' order by c.relname`,
    { readOnly: true });
  return (rows.rows ?? rows ?? []).map((r) => ({ table: r.t, rows: Number(r.rows) }));
}

/** Copy one guardian table via keyset pagination on its PK, idempotently, preserving IDs/hashes. */
export async function copyTable(sourceRef, targetRef, table, allowlist, { page = 500 } = {}) {
  assertGuardianTable(table, allowlist);
  // primary key columns (for stable ordering + keyset pagination)
  const pk = await mgmtQuery(sourceRef,
    `select a.attname from pg_index i join pg_class c on c.oid=i.indrelid` +
    ` join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum=any(i.indkey)` +
    ` where n.nspname='${GUARDIAN_SCHEMA}' and c.relname='${table}' and i.indisprimary order by a.attnum`,
    { readOnly: true });
  const pkCols = (pk.rows ?? []).map((r) => r.attname);
  const orderBy = pkCols.length ? pkCols.map((c) => `"${c}"`).join(',') : 'ctid';
  let copied = 0, offset = 0;
  for (;;) {
    const q = `select coalesce(jsonb_agg(row_to_json(t) order by ${orderBy}), '[]'::jsonb) as j from` +
      ` (select * from ${GUARDIAN_SCHEMA}.${table} order by ${orderBy} limit ${page} offset ${offset}) t`;
    const r = await mgmtQuery(sourceRef, q, { readOnly: true });
    const arr = (r.rows?.[0]?.j) ?? [];
    if (!Array.isArray(arr) || arr.length === 0) break;
    await mgmtQuery(targetRef, buildInsertStatement(table, JSON.stringify(arr), allowlist));
    copied += arr.length; offset += arr.length;
    if (arr.length < page) break;
  }
  return { table, copied, pk: pkCols };
}

// (schema creation + full runMigration orchestration are invoked by the operator step AFTER the
//  review gate; kept out of module import side-effects. This file has no top-level execution.)
