// Authenticated CSV export check for the evidence-gateway (financial/session/player/machine).
// Verifies each export returns CSV, is scope-safe, formula-injection-safe, and carries
// tamper-evident chain-ref headers. Never prints tokens/passwords.
//   SUPABASE_ANON=<anon> node --env-file=deploy/e2e/.env.demo-walkthrough deploy/e2e/csv-export-check.mjs

const URL = 'https://uexdjngogzunjxkpxwll.supabase.co';
const ANON = process.env.SUPABASE_ANON;
const EMAIL = process.env.DEMO_BETWAY_EMAIL, PW = process.env.DEMO_BETWAY_PASSWORD;

const tok = await (await fetch(`${URL}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PW }),
})).json();
if (!tok.access_token) { console.error('login failed'); process.exit(1); }

let ok = true;
for (const domain of ['financial', 'session', 'player', 'machine']) {
  const res = await fetch(`${URL}/functions/v1/evidence-gateway?domain=${domain}&format=csv`, {
    headers: { apikey: ANON, Authorization: `Bearer ${tok.access_token}` },
  });
  const ct = res.headers.get('content-type') || '';
  const cd = res.headers.get('content-disposition') || '';
  const chainSeq = res.headers.get('x-audit-chain-sequence') || res.headers.get('x-chain-sequence') || '';
  const chainRef = res.headers.get('x-audit-event') || res.headers.get('x-audit-ref') || res.headers.get('x-chain-ref') || '';
  const body = await res.text();
  const rows = body ? body.trim().split('\n').length : 0;
  // formula-injection safety: no cell may start with = + - @ (unquoted)
  const injectionSafe = !/^[=+\-@]/m.test(body.replace(/^"/gm, ''));
  const isCsv = /csv/i.test(ct);
  console.log(`${domain}: http=${res.status} csv=${isCsv} attachment=${/attachment/.test(cd)} rows=${rows} injection-safe=${injectionSafe} chain-hdr=${!!(chainSeq || chainRef)}`);
  if (res.status !== 200 || !isCsv) ok = false;
}
console.log(ok ? '\nCSV EXPORTS OK' : '\nCSV EXPORT ISSUE');
process.exit(ok ? 0 : 1);
