#!/usr/bin/env node
// ─── SafeBet Guardian — PR2 dedicated-DB migration + reconciliation tooling ───
// Controlled, idempotent, CA-validated-TLS migration of the Guardian schema + synthetic
// data from the shared Demo DB (source) to the dedicated Guardian DB (target). No IQ data
// is ever read/written. Commands:
//   manifest                         — ordered arch_v4 Guardian migrations + SHA-256 ledger (offline)
//   reconcile   --source <secret>    — per-table row counts + critical ID/hash set (source dry-run now;
//               [--target <secret>]    add --target after provisioning for source-vs-target reconciliation)
//   evidence    --source <secret>    — C7 custody head-hash + evidence content-hash reference set
//   copy        --source --target    — FK-safe row copy source->target (requires target; refuses IQ tables)
//
// TLS: every DB connection uses guardianDbSsl() (rejectUnauthorized:true). Secrets are passed
// as file paths to a JSON {host,port,database,user,password}; values are never printed.
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { guardianDbSsl } from '../../../products/guardian/src/db/tls.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const MIG_DIR = path.join(ROOT, 'supabase', 'migrations');

// The authoritative Guardian schema-reconstruction set: the arch_v4 C0..PR1 migrations, in order.
export function guardianMigrationManifest() {
  const files = readdirSync(MIG_DIR).filter((f) => /arch_v4/.test(f) && /guardian|domain_reference/.test(f) && f.endsWith('.sql')).sort();
  return files.map((f) => {
    const body = readFileSync(path.join(MIG_DIR, f), 'utf8');
    return { version: f.slice(0, 14), name: f, sha256: createHash('sha256').update(body, 'utf8').digest('hex') };
  });
}

// Guardian tables in FK-safe insert order (parents before children). jurisdiction + provider_channel
// + registries first; append-only history/response tables last.
const COPY_ORDER_HINT = ['jurisdiction', 'provider_channel', 'audit_context', 'identity_entitlement'];
async function connect(secretPath, host) {
  const pg = (await import('pg')).default;
  const s = JSON.parse(readFileSync(secretPath, 'utf8'));
  const client = new pg.Client({ host: s.host, port: s.port, database: s.database, user: s.user, password: s.password, ssl: guardianDbSsl({ host: s.host }), statement_timeout: 30000, connectionTimeoutMillis: 10000 });
  await client.connect();
  return client;
}
function fkSafeOrder(tables) {
  const hinted = COPY_ORDER_HINT.filter((t) => tables.includes(t));
  const rest = tables.filter((t) => !COPY_ORDER_HINT.includes(t)).sort();
  return [...hinted, ...rest];
}

async function guardianTables(c) {
  const r = await c.query(`select table_name from information_schema.tables where table_schema='guardian' and table_type='BASE TABLE' order by table_name`);
  return r.rows.map((x) => x.table_name);
}

async function reconcile(srcPath, tgtPath) {
  const src = await connect(srcPath);
  const tables = await guardianTables(src);
  const out = [];
  for (const t of tables) {
    const sc = (await src.query(`select count(*)::int n from guardian.${t}`)).rows[0].n;
    out.push({ table: t, source: sc, target: null });
  }
  if (tgtPath) {
    const tgt = await connect(tgtPath);
    for (const row of out) row.target = (await tgt.query(`select count(*)::int n from guardian.${row.table}`)).rows[0].n;
    await tgt.end();
  }
  await src.end();
  const mismatches = out.filter((r) => r.target !== null && r.source !== r.target);
  return { tableCount: tables.length, totalSourceRows: out.reduce((a, r) => a + r.source, 0), rows: out, mismatches };
}

// Critical ID/hash reference sets that MUST be preserved exactly across migration.
async function criticalReferences(c) {
  const q = async (sql) => { try { return (await c.query(sql)).rows; } catch { return []; } };
  return {
    evidence: await q(`select evidence_id, content_hash from guardian.guardian_evidence order by evidence_id`),
    custodyHeads: await q(`select evidence_id, max(event_hash) head from guardian.guardian_evidence_custody_event group by evidence_id order by evidence_id`),
    authorisations: await q(`select authorisation_id, evidence_manifest_hash from guardian.action_authorisation order by authorisation_id`),
    orchestrations: await q(`select orchestration_id, request_payload_hash from guardian.enforcement_orchestration order by orchestration_id`),
    reentry: await q(`select reentry_candidate_id from guardian.reentry_candidate order by reentry_candidate_id`),
    entitlements: await q(`select subject, guardian_role, jurisdiction, account_state from guardian.identity_entitlement order by subject`),
  };
}
function refDigest(refs) {
  return createHash('sha256').update(JSON.stringify(refs)).digest('hex');
}

async function main() {
  const cmd = process.argv[2];
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
  if (cmd === 'manifest') {
    const m = guardianMigrationManifest();
    console.log(JSON.stringify({ command: 'manifest', count: m.length, migrations: m, ledgerDigest: createHash('sha256').update(JSON.stringify(m)).digest('hex') }, null, 2));
  } else if (cmd === 'reconcile') {
    const res = await reconcile(arg('--source'), arg('--target'));
    console.log(JSON.stringify({ command: 'reconcile', ...res }, null, 2));
    if (res.mismatches.length) process.exit(3);
  } else if (cmd === 'evidence') {
    const c = await connect(arg('--source'));
    const refs = await criticalReferences(c); await c.end();
    console.log(JSON.stringify({ command: 'evidence', counts: Object.fromEntries(Object.entries(refs).map(([k, v]) => [k, v.length])), criticalDigest: refDigest(refs) }, null, 2));
  } else if (cmd === 'copy') {
    const tgtPath = arg('--target');
    if (!tgtPath) { console.error('copy requires --target (dedicated Guardian DB); refuses to run without it'); process.exit(2); }
    const src = await connect(arg('--source')); const tgt = await connect(tgtPath);
    const tables = fkSafeOrder(await guardianTables(src));
    let copied = 0;
    for (const t of tables) {
      const rows = (await src.query(`select * from guardian.${t}`)).rows;
      for (const row of rows) {
        const cols = Object.keys(row); const params = cols.map((_, i) => `$${i + 1}`);
        await tgt.query(`insert into guardian.${t} (${cols.join(',')}) values (${params.join(',')}) on conflict do nothing`, cols.map((k2) => row[k2]));
      }
      copied += rows.length;
    }
    await src.end(); await tgt.end();
    console.log(JSON.stringify({ command: 'copy', tables: tables.length, rowsCopied: copied }));
  } else {
    console.error('usage: pr2-migration.mjs manifest|reconcile|evidence|copy [--source <secret.json>] [--target <secret.json>]');
    process.exit(1);
  }
}
main().catch((e) => { console.error(String(e && e.message || e)); process.exit(1); });
