import { db } from '../client';
import { randomName, randomInt, randomFloat, pick, daysAgoRandom, log, logOk, logErr } from '../utils';

const SA_PROVINCES = [
  'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape',
  'Limpopo', 'Mpumalanga', 'North West', 'Free State', 'Northern Cape',
];

// Distribution: 50% low, 30% medium, 15% high, 5% critical
const RISK_WEIGHTS = [0.50, 0.30, 0.15, 0.05];
const RISK_LEVELS  = ['low', 'medium', 'high', 'critical'] as const;

function weightedRisk(): typeof RISK_LEVELS[number] {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < RISK_WEIGHTS.length; i++) {
    acc += RISK_WEIGHTS[i];
    if (r < acc) return RISK_LEVELS[i];
  }
  return 'low';
}

export async function seedPlayers(casinoIds: string[]): Promise<string[]> {
  log('Seeding players...');
  const rows: Record<string, unknown>[] = [];

  for (const casinoId of casinoIds) {
    const count = randomInt(60, 90);
    for (let i = 0; i < count; i++) {
      const { first, last, email } = randomName();
      const riskLevel = weightedRisk();
      const riskScore =
        riskLevel === 'critical' ? randomInt(85, 99) :
        riskLevel === 'high'     ? randomInt(65, 84) :
        riskLevel === 'medium'   ? randomInt(35, 64) :
                                   randomInt(0, 34);
      const totalWagered = randomFloat(500, 50_000);
      const totalWon     = randomFloat(0, totalWagered * 0.9);

      rows.push({
        casino_id: casinoId,
        // player_id is the external text identifier; isolation marker: DEMO- prefix
        player_id: `DEMO-${casinoId.slice(0, 8).toUpperCase()}-${randomInt(10000, 99999)}`,
        external_id: `EXT-${randomInt(100000, 999999)}`,
        first_name: first,
        last_name: last,
        email,
        phone: `+27 ${randomInt(60, 82)} ${randomInt(100, 999)} ${randomInt(1000, 9999)}`,
        province: pick(SA_PROVINCES),
        risk_level: riskLevel,
        risk_score: riskScore,
        total_wagered: totalWagered,
        total_won: totalWon,
        total_deposits: randomFloat(totalWagered * 0.8, totalWagered * 1.1),
        total_withdrawals: randomFloat(0, totalWon * 0.7),
        lifetime_value: randomFloat(50, 5000),
        session_count: randomInt(1, 120),
        avg_session_duration: randomInt(15, 180),
        vip_tier: Math.random() < 0.08 ? 'vip' : Math.random() < 0.15 ? 'premium' : 'none',
        is_active: Math.random() > 0.08,
        status: 'active',
        signup_date: daysAgoRandom(30, 730),
        last_active: daysAgoRandom(0, 30),
        fica_verified: Math.random() > 0.25,
        popia_consent: Math.random() > 0.05,
        source: 'manual',
      });
    }
  }

  const { data, error } = await db
    .from('players')
    .upsert(rows, { onConflict: 'player_id', ignoreDuplicates: true })
    .select('id');

  if (error) { logErr(`players: ${error.message}`); return []; }
  logOk(`${data?.length ?? 0} players seeded`);
  return (data ?? []).map((r) => r.id as string);
}

export async function resetPlayers(): Promise<void> {
  const { error } = await db.from('players').delete().ilike('player_id', 'DEMO-%');
  if (error) logErr(`reset players: ${error.message}`);
  else logOk('Demo players deleted');
}
