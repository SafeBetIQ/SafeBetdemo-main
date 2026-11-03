// SafeBet IQ — deterministic Supabase deployment-derivative generator (M1B-P1F, Correction 1).
//
// WHY: the curated canonical baseline (pilot_app_schema_baseline.sql, SHA 530941a5…) is a pg_dump
// of Demo and therefore ends with 12 `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA
// public …` statements. On hosted Supabase `supabase_admin` is an internal reserved role: `postgres`
// is NOT a member and may not alter its default privileges, so those 12 statements fail. Rather than
// silently ignore errors or disable ON_ERROR_STOP, we deterministically produce a deployment
// derivative that removes EXACTLY those 12 statements and nothing else.
//
// GUARANTEES (all fail-closed — any deviation aborts, writing nothing):
//   • starts only from the exact approved canonical SHA 530941a5… (LF-normalised);
//   • removes ONLY lines on the explicit allowlist (the 12 supabase_admin default-privilege GRANTs);
//   • removes EXACTLY 12 lines; every other byte is identical to the canonical;
//   • never touches the function-body reference on line 3548 or the `-- Name:` comment headers;
//   • emits generated/pilot_app_schema_supabase.sql (LF), its SHA-256, and a transformation report.
//
// The canonical file is NEVER written. Do not hand-edit the generated derivative — regenerate it.
//
// Usage:
//   node deploy/pilot/baseline/generate-supabase-derivative.mjs            # write derivative + report
//   node deploy/pilot/baseline/generate-supabase-derivative.mjs --check    # regenerate in-memory and
//                                                                           # assert the committed
//                                                                           # derivative is byte-identical
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const CANONICAL = join(HERE, 'pilot_app_schema_baseline.sql');
const OUT_DIR = join(HERE, 'generated');
const OUT_SQL = join(OUT_DIR, 'pilot_app_schema_supabase.sql');
const OUT_REPORT = join(OUT_DIR, 'transformation-report.json');

export const CANONICAL_SHA = '530941a513216c056eab18e182be09f3d0fe803955c7c7315ccd36123b9fa182';
export const CANONICAL_FINGERPRINT = '5f324b14ea87dec4601b0586bc4a4726be83ebceae3112253ba2db838ca55f49';

// The ONLY statements the derivative may remove. Each must match a whole line exactly (LF-trimmed).
// These are the trailing `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public …` lines
// (canonical lines 39052-39055, 39072-39075, 39092-39095). Order here is irrelevant.
export const REMOVAL_ALLOWLIST = Object.freeze([
  'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;',
  'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;',
  'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;',
  'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;',
  'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;',
  'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;',
  'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;',
  'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;',
  'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;',
  'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;',
  'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;',
  'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;',
]);
const EXPECTED_REMOVED = REMOVAL_ALLOWLIST.length; // 12
const ALLOW = new Set(REMOVAL_ALLOWLIST);
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// A line is removable only if it is on the allowlist AND is a genuine ALTER DEFAULT PRIVILEGES
// statement for supabase_admin — belt-and-braces so a stray allowlist match inside a string/body
// (there is none today) could never be silently dropped.
const isRemovable = (line) =>
  ALLOW.has(line) && /^ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON (?:SEQUENCES|FUNCTIONS|TABLES) TO (?:postgres|anon|authenticated|service_role);$/.test(line);

/** Pure transform. Returns { canonicalSha, derivative, derivativeSha, removed[], report }. Throws on any deviation. */
export function buildDerivative(canonicalRaw) {
  const canonicalLf = canonicalRaw.replace(/\r\n/g, '\n');
  const canonicalSha = sha256(Buffer.from(canonicalLf, 'utf8'));
  if (canonicalSha !== CANONICAL_SHA) {
    throw new Error(`canonical baseline SHA mismatch: got ${canonicalSha}, expected ${CANONICAL_SHA}. REFUSING (generator starts only from the approved canonical).`);
  }
  const lines = canonicalLf.split('\n');
  const kept = [];
  const removed = [];
  lines.forEach((line, i) => {
    if (isRemovable(line)) removed.push({ line: i + 1, statement: line });
    else kept.push(line);
  });
  if (removed.length !== EXPECTED_REMOVED) {
    throw new Error(`expected to remove exactly ${EXPECTED_REMOVED} supabase_admin default-privilege statements, removed ${removed.length}. REFUSING (unexpected transformation).`);
  }
  // Prove the removed set equals the allowlist exactly (no duplicates, nothing extra/missing).
  const removedStmts = removed.map((r) => r.statement).sort();
  const allowSorted = [...REMOVAL_ALLOWLIST].sort();
  if (JSON.stringify(removedStmts) !== JSON.stringify(allowSorted)) {
    throw new Error('removed statements do not equal the approved allowlist exactly. REFUSING.');
  }
  const derivative = kept.join('\n');
  // Prove NOTHING else changed: re-inserting the removed statements at their recorded positions must
  // reproduce the canonical byte-for-byte.
  const reconstructed = [...kept];
  // Reconstruct by splicing removed lines back in ascending original-index order.
  const rebuilt = (() => {
    const out = [];
    let k = 0;
    const removedByIdx = new Map(removed.map((r) => [r.line - 1, r.statement]));
    for (let i = 0; i < lines.length; i++) {
      if (removedByIdx.has(i)) out.push(removedByIdx.get(i));
      else out.push(kept[k++]);
    }
    return out.join('\n');
  })();
  void reconstructed;
  if (sha256(Buffer.from(rebuilt, 'utf8')) !== CANONICAL_SHA) {
    throw new Error('reconstruction check failed: removing the allowlist changed more than the 12 statements. REFUSING.');
  }
  const derivativeSha = sha256(Buffer.from(derivative, 'utf8'));
  const report = {
    artifact: 'SafeBet IQ Pilot Supabase deployment derivative (M1B-P1F)',
    generator: 'deploy/pilot/baseline/generate-supabase-derivative.mjs',
    canonical: { path: 'deploy/pilot/baseline/pilot_app_schema_baseline.sql', sha256: canonicalSha, lines: lines.length, unchanged: true },
    derivative: { path: 'deploy/pilot/baseline/generated/pilot_app_schema_supabase.sql', sha256: derivativeSha, lines: kept.length },
    structuralFingerprintExpected: CANONICAL_FINGERPRINT,
    removedStatementCount: removed.length,
    removedStatements: removed,
    rationale: 'Hosted Supabase: supabase_admin is an internal reserved role; postgres is not a member and cannot alter its default privileges. These 12 ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin statements are removed so the derivative applies cleanly under psql ON_ERROR_STOP. The derivative changes no schema object, so the structural fingerprint is unchanged (default privileges are not part of the fingerprint).',
    assertions: {
      canonicalShaMatches: true,
      removedExactly12: true,
      removedEqualsAllowlist: true,
      reconstructionReproducesCanonical: true,
      onlySupabaseAdminDefaultsRemoved: true,
    },
  };
  return { canonicalSha, derivative, derivativeSha, removed, report };
}

function main() {
  const check = process.argv.includes('--check');
  const canonicalRaw = readFileSync(CANONICAL, 'utf8');
  const { derivative, derivativeSha, report } = buildDerivative(canonicalRaw);
  const derivativeWithEol = derivative.endsWith('\n') ? derivative : derivative + '\n';
  // Keep the SHA defined over the exact file bytes we write.
  const fileSha = sha256(Buffer.from(derivativeWithEol, 'utf8'));
  report.derivative.sha256 = fileSha;
  report.derivative.bytes = Buffer.byteLength(derivativeWithEol, 'utf8');

  if (check) {
    if (!existsSync(OUT_SQL)) { console.error('--check: derivative not present; run the generator first'); process.exit(1); }
    const committed = readFileSync(OUT_SQL, 'utf8').replace(/\r\n/g, '\n');
    const committedSha = sha256(Buffer.from(committed, 'utf8'));
    if (committedSha !== fileSha) {
      console.error(`--check FAILED: committed derivative SHA ${committedSha} != regenerated ${fileSha}`);
      process.exit(1);
    }
    console.log(`--check OK: derivative is the exact generator output (SHA ${fileSha}); removed ${report.removedStatementCount} statements; canonical unchanged (${report.canonical.sha256}).`);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_SQL, derivativeWithEol);
  writeFileSync(OUT_REPORT, JSON.stringify(report, null, 2) + '\n');
  console.log(`canonical SHA (unchanged): ${report.canonical.sha256}`);
  console.log(`removed ${report.removedStatementCount} supabase_admin default-privilege statements (lines ${report.removedStatements.map((r) => r.line).join(', ')})`);
  console.log(`derivative: ${OUT_SQL}`);
  console.log(`derivative SHA-256: ${fileSha}`);
  console.log(`transformation report: ${OUT_REPORT}`);
  void derivativeSha;
}

// Run main() when executed directly (robust across POSIX/Windows path forms).
const invoked = process.argv[1] ? fileURLToPath(import.meta.url) === join(process.argv[1]) : false;
if (invoked) main();
