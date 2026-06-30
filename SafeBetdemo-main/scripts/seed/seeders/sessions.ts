import { db } from '../client';
import { randomInt, randomFloat, pick, daysAgoRandom, GAME_TYPES, log, logOk, logErr } from '../utils';

const DEVICE_TYPES = ['desktop', 'mobile', 'tablet'] as const;
const SOURCES      = ['web', 'mobile_app', 'floor_terminal'] as const;

export async function seedSessions(casinoIds: string[], playerIds: string[]): Promise<void> {
  log('Seeding gaming sessions...');

  if (playerIds.length === 0) {
    logErr('sessions: no playerIds provided — skipping');
    return;
  }

  const rows: Record<string, unknown>[] = [];
  const playerPool = playerIds.slice(0, Math.min(playerIds.length, 300));

  for (const casinoId of casinoIds) {
    const count = randomInt(30, 60);
    for (let i = 0; i < count; i++) {
      const durationSec = randomInt(300, 14_400);
      const isActive    = Math.random() < 0.12;
      const startTime   = daysAgoRandom(0, 90);
      const totalWagered = randomFloat(50, 10_000);
      const totalWon     = randomFloat(0, totalWagered * 0.85);
      const peakRisk     = randomInt(5, 95);

      rows.push({
        casino_id: casinoId,
        // player_id is NOT NULL — always required
        player_id: pick(playerPool),
        game_type: pick(GAME_TYPES),
        source: pick(SOURCES),
        device_type: pick(DEVICE_TYPES),
        start_time: startTime,
        end_time: isActive ? null : new Date(new Date(startTime).getTime() + durationSec * 1000).toISOString(),
        duration: isActive ? null : durationSec,
        total_wagered: totalWagered,
        total_won: totalWon,
        net_result: totalWon - totalWagered,
        total_bets: randomInt(5, 500),
        risk_score_change: randomInt(-10, 25),
        peak_risk_score: peakRisk,
        intervention_triggered: peakRisk >= 75 && Math.random() < 0.3,
        is_active: isActive,
      });
    }
  }

  const { error } = await db.from('gaming_sessions').insert(rows);
  if (error) logErr(`gaming_sessions: ${error.message}`);
  else logOk(`${rows.length} gaming sessions seeded`);
}

export async function resetSessions(casinoIds: string[]): Promise<void> {
  if (casinoIds.length === 0) return;
  const { error } = await db.from('gaming_sessions').delete().in('casino_id', casinoIds);
  if (error) logErr(`reset gaming_sessions: ${error.message}`);
  else logOk('Demo sessions deleted');
}
