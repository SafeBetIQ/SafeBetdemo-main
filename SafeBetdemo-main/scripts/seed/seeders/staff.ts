import { db } from '../client';
import { randomName, pick, randomInt, log, logOk, logErr } from '../utils';

// staff_role enum: frontline | vip_host | call_centre | manager | compliance_officer | regulator
const STAFF_ROLES = ['frontline', 'vip_host', 'call_centre', 'manager', 'compliance_officer'] as const;

// user_role_type enum: SUPPORT | COMPLIANCE | RISK_ANALYST | EXECUTIVE | REGULATOR
const ROLE_TO_USER_ROLE: Record<string, string> = {
  frontline: 'SUPPORT',
  vip_host: 'SUPPORT',
  call_centre: 'SUPPORT',
  manager: 'EXECUTIVE',
  compliance_officer: 'COMPLIANCE',
  regulator: 'REGULATOR',
};

export async function seedStaff(casinoIds: string[]): Promise<string[]> {
  log('Seeding staff...');
  const rows: Record<string, unknown>[] = [];

  for (const casinoId of casinoIds) {
    const count = randomInt(8, 12);
    for (let i = 0; i < count; i++) {
      const { first, last, email } = randomName();
      const role = pick(STAFF_ROLES);
      rows.push({
        casino_id: casinoId,
        first_name: first,
        last_name: last,
        email,
        role,
        // status is staff_status enum: active | inactive
        status: Math.random() > 0.1 ? 'active' : 'inactive',
        user_role: ROLE_TO_USER_ROLE[role],
        hire_date: new Date(Date.now() - randomInt(30, 1460) * 86_400_000).toISOString().split('T')[0],
      });
    }
  }

  const { data, error } = await db
    .from('staff')
    // Composite unique constraint is (casino_id, email)
    .upsert(rows, { onConflict: 'casino_id,email', ignoreDuplicates: true })
    .select('id');

  if (error) { logErr(`staff: ${error.message}`); return []; }
  logOk(`${data?.length ?? 0} staff members seeded`);
  return (data ?? []).map((r) => r.id as string);
}

export async function resetStaff(): Promise<void> {
  const { error } = await db.from('staff').delete().ilike('email', '%@demo.safebetiq.com');
  if (error) logErr(`reset staff: ${error.message}`);
  else logOk('Demo staff deleted');
}
