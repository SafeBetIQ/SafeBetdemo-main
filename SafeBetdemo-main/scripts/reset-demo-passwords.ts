/**
 * Resets demo account passwords to known values for the login page demo panel.
 * Run from SafeBetdemo-main/: npx tsx scripts/reset-demo-passwords.ts
 */
import { db } from './seed/client';

const DEMO_ACCOUNTS = [
  { email: 'demo.admin@safebetiq.com',     password: 'Admin@SafeBet1',     label: 'Demo Administrator (super_admin)' },
  { email: 'demo.casino@safebetiq.com',    password: 'Casino@Demo1',       label: 'Demo Casino Operator (casino_admin)' },
  { email: 'demo.regulator@safebetiq.com', password: 'Regulator@Demo1',   label: 'Demo Regulator (national_regulator)' },
];

async function run() {
  console.log('\n━━ Reset Demo Passwords ━━\n');

  for (const acct of DEMO_ACCOUNTS) {
    // Look up the auth user id by email
    const { data: listData, error: listErr } = await db.auth.admin.listUsers({ page: 1, perPage: 50 });
    if (listErr) { console.error(`  ✗ Could not list users: ${listErr.message}`); process.exit(1); }

    const user = listData?.users?.find((u) => u.email === acct.email);
    if (!user) {
      console.error(`  ✗ Auth user not found: ${acct.email}`);
      continue;
    }

    const { error: updateErr } = await db.auth.admin.updateUserById(user.id, { password: acct.password });
    if (updateErr) {
      console.error(`  ✗ Failed to update ${acct.email}: ${updateErr.message}`);
    } else {
      console.log(`  ✓ ${acct.label}`);
      console.log(`    ${acct.email} → ${acct.password}`);
    }
  }

  console.log('\n  Done. Update login page credentials panel to match.\n');
}

run().catch((e) => { console.error(e); process.exit(1); });
