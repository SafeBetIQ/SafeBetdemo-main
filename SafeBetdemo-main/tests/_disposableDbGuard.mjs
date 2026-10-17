// SafeBet IQ — disposable-database safety guard (TEST HARNESS ONLY).
//
// Every gated real-Postgres suite MUST call assertDisposableDb(dsn) before connecting.
// It fails closed unless the target is provably an ephemeral/disposable database:
//   1. the host is NOT any known SafeBet managed/cloud host (Supabase/RDS/pooler/project refs);
//   2. the host is local/ephemeral (localhost / 127.0.0.1 / the CI service-container name);
//   3. an explicit operator marker SAFEBET_DISPOSABLE_TEST_DB=1 is set;
//   4. the database name follows a disposable/test convention.
// This never connects anywhere and stores nothing; it only inspects the DSN + environment.

const FORBIDDEN_HOST = [
  /supabase\.co$/i, /supabase\.net$/i, /\.pooler\.supabase\.com$/i,
  /rds\.amazonaws\.com$/i,
  /uexdjngogzunjxkpxwll/i,   // IQ Demo project ref
  /druuskabkgyotslcgnys/i,   // Guardian-Demo project ref
];
const LOCAL_HOST = (h) => h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === 'postgres' || h.endsWith('.internal') || h.endsWith('.local');
const DISPOSABLE_NAME = /(^|[_-])(test|disposable|ci)([_-]|$)/i;

export function assertDisposableDb(dsn) {
  if (!dsn) return;                     // unset ⇒ the suite SKIPs; nothing to guard
  let u;
  try { u = new URL(dsn); } catch { throw new Error('disposable-db guard: unparseable connection string'); }
  const host = (u.hostname || '').toLowerCase();
  const dbname = decodeURIComponent((u.pathname || '').replace(/^\//, '')).toLowerCase();

  for (const re of FORBIDDEN_HOST) {
    if (re.test(host)) throw new Error(`disposable-db guard: refusing to run against a non-disposable/managed host (${host}). IQ Demo/Production/Guardian/cloud databases are never permitted.`);
  }
  if (process.env.SAFEBET_DISPOSABLE_TEST_DB !== '1') {
    throw new Error('disposable-db guard: SAFEBET_DISPOSABLE_TEST_DB=1 is required to confirm an ephemeral database.');
  }
  if (!LOCAL_HOST(host)) {
    throw new Error(`disposable-db guard: host must be a local/ephemeral database, got "${host}".`);
  }
  if (!DISPOSABLE_NAME.test(dbname)) {
    throw new Error(`disposable-db guard: database name must follow a disposable/test convention, got "${dbname}".`);
  }
}
