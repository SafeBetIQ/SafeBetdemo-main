import { db } from '../client';
import { DEMO_EMAIL_DOMAIN, logOk, logErr, log } from '../utils';
import { randomUUID } from 'crypto';

export const DEMO_CASINOS = [
  { name: 'GrandWest Casino', province: 'Western Cape',  license_number: 'WC-NGB-001',  city: 'Cape Town' },
  { name: 'Suncoast Casino',  province: 'KwaZulu-Natal', license_number: 'KZN-NGB-002', city: 'Durban' },
  { name: 'Emperors Palace',  province: 'Gauteng',        license_number: 'GP-NGB-003',  city: 'Johannesburg' },
  { name: 'Montecasino',      province: 'Gauteng',        license_number: 'GP-NGB-004',  city: 'Sandton' },
  { name: 'Gold Reef City',   province: 'Gauteng',        license_number: 'GP-NGB-005',  city: 'Johannesburg' },
  { name: 'Boardwalk Casino', province: 'Eastern Cape',  license_number: 'EC-NGB-006',  city: 'Gqeberha' },
];

export async function seedCasinos(): Promise<string[]> {
  log('Seeding casinos...');
  const rows = DEMO_CASINOS.map((c) => ({
    name: c.name,
    license_number: c.license_number,
    country: 'South Africa',
    province: c.province,
    contact_email: `ops${DEMO_EMAIL_DOMAIN}`,
    contact_phone: '+27 21 000 0000',
    address: `${c.city}, ${c.province}, South Africa`,
    simulation_mode: true,
    // hmac_secret is NOT NULL with no default — must be provided
    hmac_secret: randomUUID(),
  }));

  const { data, error } = await db
    .from('casinos')
    // Actual unique constraint is (license_number, country) — composite
    .upsert(rows, { onConflict: 'license_number,country', ignoreDuplicates: false })
    .select('id, name');

  if (error) { logErr(`casinos: ${error.message}`); return []; }
  logOk(`${data?.length ?? 0} casinos seeded`);
  return (data ?? []).map((r) => r.id as string);
}

export async function resetCasinos(): Promise<void> {
  const { error } = await db.from('casinos').delete().eq('simulation_mode', true);
  if (error) logErr(`reset casinos: ${error.message}`);
  else logOk('Demo casinos deleted');
}
