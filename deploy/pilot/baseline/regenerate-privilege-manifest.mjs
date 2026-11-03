// SafeBet IQ — deterministic privilege-manifest regeneration (M1B-P1F, Corrections 2–4 + Decision 3).
//
// The privilege manifest (pilot_privilege_manifest.txt) is the byte-exact expected output of
// pilot_privilege_verify.sql Part B after the Pilot apply. The authoritative source of truth is a live
// `postgres:17` apply (the CI rehearsal / apply jobs regenerate and diff it). This script performs the
// SAME transformation mechanically on the prior, CI-verified manifest so the committed file reflects
// the revised hardening, and so the static manifest test stays meaningful offline. It is a pure,
// reviewable text transform — never a hand-edit.
//
// Transform (exactly the grants the revised pilot_post_apply_grants.sql removes, nothing else):
//   • PUBLIC function EXECUTE removed from every function            (Correction 2)
//   • anon removed from sbiq_may_access_chain_scope + sbiq_audit_benchmark   (Decision 3B/3C)
//   • authenticated removed from sbiq_audit_benchmark                (Decision 3C)
//   • anon + authenticated table grants removed from sbiq_financial_rollup_checkpoint (Decision 3A)
//   • eff|… recomputed from the post-change fn exec (PUBLIC gone ⇒ eff = direct membership)
//   • postgres schema-level table/sequence defaults revert to owner-only ⇒ Postgres deletes those
//     pg_default_acl rows; the function default persists as postgres=EXECUTE (differs from built-in,
//     which includes PUBLIC). Global function default stays postgres=EXECUTE.   (Correction 4)
//   • final listing re-sorted by COLLATE "C" (byte order)
//
// Usage: node deploy/pilot/baseline/regenerate-privilege-manifest.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const MAN = join(HERE, 'pilot_privilege_manifest.txt');
const SHA = join(HERE, 'pilot_privilege_manifest.sha256');
const sha256 = (s) => createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');

const ANON_REMOVE_FN = new Set(['sbiq_may_access_chain_scope(p_scope text)', 'sbiq_audit_benchmark(p_n integer)']);
const AUTHN_REMOVE_FN = new Set(['sbiq_audit_benchmark(p_n integer)']);
const CHECKPOINT = 'sbiq_financial_rollup_checkpoint';

export function transformManifest(input) {
  const lines = input.replace(/\r\n/g, '\n').split('\n').filter(Boolean);
  const execBySig = new Map();          // sig -> string[] (post-change exec roles, ordered C)
  const out = [];

  // Pass 1: fn| lines — strip PUBLIC everywhere, plus anon/authenticated per decision; record new exec.
  for (const l of lines) {
    if (l.startsWith('fn|')) {
      const p = l.split('|');
      const sig = p[1];
      const exec = p[5].slice('exec='.length).split(',').filter(Boolean);
      let roles = exec.filter((r) => r !== 'PUBLIC');
      if (ANON_REMOVE_FN.has(sig)) roles = roles.filter((r) => r !== 'anon');
      if (AUTHN_REMOVE_FN.has(sig)) roles = roles.filter((r) => r !== 'authenticated');
      roles = [...roles].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
      execBySig.set(sig, roles);
      out.push(`fn|${sig}|${p[2]}|${p[3]}|${p[4]}|exec=${roles.join(',')}`);
    }
  }

  // Pass 2: everything else, transformed.
  for (const l of lines) {
    if (l.startsWith('fn|')) continue; // already emitted
    if (l.startsWith('eff|')) {
      const p = l.split('|');
      const sig = p[1];
      const roles = execBySig.get(sig) ?? [];
      const has = (r) => roles.includes(r);
      out.push(`eff|${sig}|anon=${has('anon')}|authenticated=${has('authenticated')}|service_role=${has('service_role')}`);
      continue;
    }
    if (l.startsWith('rel|')) {
      const p = l.split('|'); // rel|kind|nm|grantee|privs
      if (p[2] === CHECKPOINT && (p[3] === 'anon' || p[3] === 'authenticated')) continue; // Decision 3A
      out.push(l);
      continue;
    }
    if (l.startsWith('defacl|')) {
      // Correction 4: postgres schema table (r) / sequence (S) defaults revert to owner-only and are
      // deleted by Postgres (acl == acldefault). The schema function (f) default persists as owner-only
      // EXECUTE (built-in includes PUBLIC, so owner-only differs and the row remains). Global f default
      // stays postgres=EXECUTE.
      const p = l.split('|'); // defacl|postgres|<scope>|<objtype>|<grants>
      const scope = p[2], objtype = p[3];
      if (scope === 'public' && (objtype === 'r' || objtype === 'S')) continue; // row deleted
      if (scope === 'public' && objtype === 'f') { out.push('defacl|postgres|public|f|postgres=EXECUTE'); continue; }
      out.push(l); // GLOBAL f stays
      continue;
    }
    out.push(l);
  }

  out.sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  return out.join('\n') + '\n';
}

function counts(manifest) {
  const L = manifest.split('\n').filter(Boolean);
  const eff = L.filter((l) => l.startsWith('eff|')).map((l) => l.split('|'));
  const n = (i, k) => eff.filter((p) => p[i] === `${k}=true`).length;
  const pub = L.filter((l) => l.startsWith('fn|') && l.split('|')[5].slice(5).split(',').includes('PUBLIC')).length;
  const anonSecdef = L.filter((l) => l.startsWith('fn|') && l.split('|')[2] === 'secdef=true')
    .map((l) => l.split('|')[1])
    .filter((sig) => { const e = L.find((x) => x.startsWith(`eff|${sig}|`)); return e && e.split('|')[2] === 'anon=true'; });
  return { rels: new Set(L.filter((l) => l.startsWith('rel|')).map((l) => l.split('|')[2])).size,
           fns: L.filter((l) => l.startsWith('fn|')).length,
           secdef: L.filter((l) => l.startsWith('fn|') && l.split('|')[2] === 'secdef=true').length,
           anon: n(2, 'anon'), authenticated: n(3, 'authenticated'), service_role: n(4, 'service_role'),
           publicExec: pub, anonSecdef };
}

function main() {
  const check = process.argv.includes('--check');
  const current = readFileSync(MAN, 'utf8');
  const next = transformManifest(current);
  const nextSha = sha256(next);
  const c = counts(next);
  if (check) {
    const cur = current.replace(/\r\n/g, '\n');
    if (cur === next) { console.log('--check OK: manifest already in revised form'); return; }
    console.error('--check: manifest differs from the revised transform; run without --check to regenerate');
    process.exit(1);
  }
  writeFileSync(MAN, next);
  writeFileSync(SHA, `${nextSha}  pilot_privilege_manifest.txt\n`);
  console.log(`manifest regenerated: ${next.split('\n').filter(Boolean).length} lines`);
  console.log(`SHA-256: ${nextSha}`);
  console.log(`relations=${c.rels} functions=${c.fns} secdef=${c.secdef}`);
  console.log(`PUBLIC EXECUTE=${c.publicExec}  anon-secdef=[${c.anonSecdef.join(', ')}]`);
  console.log(`effective EXECUTE: anon=${c.anon} authenticated=${c.authenticated} service_role=${c.service_role}`);
}

const invoked = process.argv[1] ? fileURLToPath(import.meta.url) === join(process.argv[1]) : false;
if (invoked) main();
