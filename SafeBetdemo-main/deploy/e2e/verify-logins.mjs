// Verify each demo account can authenticate and resolves to the correct role.
// Never prints passwords or tokens. Run:
//   SUPABASE_ANON=<anon> node --env-file=deploy/e2e/.env.demo-walkthrough deploy/e2e/verify-logins.mjs

const URL = 'https://uexdjngogzunjxkpxwll.supabase.co';
const ANON = process.env.SUPABASE_ANON;
if (!ANON) { console.error('missing SUPABASE_ANON'); process.exit(1); }

const ACCOUNTS = [
  ['Prestige', 'DEMO_PRESTIGE'], ['SunBet', 'DEMO_SUNBET'], ['Hollywoodbets', 'DEMO_HOLLYWOODBETS'],
  ['Gold Rush', 'DEMO_GOLDRUSH'], ['Betway', 'DEMO_BETWAY'], ['Royal Palace', 'DEMO_ROYALPALACE'],
  ['Regulator', 'DEMO_REGULATOR'], ['Super Admin', 'DEMO_ADMIN'],
];

let allOk = true;
for (const [label, key] of ACCOUNTS) {
  const email = process.env[`${key}_EMAIL`];
  const password = process.env[`${key}_PASSWORD`];
  if (!email || !password) { console.log(`${label}: MISSING env`); allOk = false; continue; }
  try {
    const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const j = await res.json();
    if (res.status === 200 && j.access_token) {
      const role = j.user?.user_metadata?.role ?? '(none)';
      console.log(`${label} <${email}>: LOGIN OK · role=${role}`);
    } else {
      console.log(`${label} <${email}>: LOGIN FAILED (${res.status} ${j.error_code || j.error || ''})`);
      allOk = false;
    }
  } catch (e) {
    console.log(`${label} <${email}>: ERROR ${e.message}`); allOk = false;
  }
}
console.log(allOk ? '\nALL LOGINS OK' : '\nSOME LOGINS FAILED');
process.exit(allOk ? 0 : 1);
