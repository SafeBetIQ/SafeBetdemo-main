import { db } from '../client';
import { randomInt, pick, log, logOk, logErr } from '../utils';

// exclusion_type: self | operator_initiated | regulator_mandated
const EXCLUSION_TYPES = ['self', 'operator_initiated', 'regulator_mandated'] as const;

// status values observed in existing data: active | expired | lifted
const STATUSES = ['active', 'active', 'active', 'expired', 'lifted'] as const; // weighted toward active

function addDays(isoDate: string, days: number): string {
  return new Date(new Date(isoDate).getTime() + days * 86_400_000).toISOString().split('T')[0];
}

function daysAgoDate(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().split('T')[0];
}

export async function seedExclusions(casinoIds: string[], playerIds: string[]): Promise<void> {
  log('Seeding self-exclusion registry...');

  if (playerIds.length === 0) {
    logErr('exclusions: no playerIds provided — skipping');
    return;
  }

  const rows: Record<string, unknown>[] = [];
  const playerPool = playerIds.slice(0, Math.min(playerIds.length, 80));

  for (const casinoId of casinoIds) {
    const count = randomInt(5, 12);
    for (let i = 0; i < count; i++) {
      const startDaysAgo     = randomInt(10, 365);
      const startDate        = daysAgoDate(startDaysAgo);
      // exclusion_end_date is NOT NULL — always provide a concrete end date
      const periodMonths     = pick([3, 6, 12, 24, 60] as const);
      const endDate          = addDays(startDate, periodMonths * 30);
      const status           = pick(STATUSES);
      const treatmentRequired = Math.random() < 0.35;

      rows.push({
        casino_id: casinoId,
        // player_id is NOT NULL
        player_id: pick(playerPool),
        exclusion_type: pick(EXCLUSION_TYPES),
        exclusion_start_date: startDate,
        exclusion_end_date: endDate,
        minimum_period_months: periodMonths,
        status,
        treatment_required: treatmentRequired,
        counseling_sessions_required: treatmentRequired ? randomInt(3, 12) : 0,
        counseling_sessions_completed: treatmentRequired ? randomInt(0, 8) : 0,
        reinstatement_requested: status === 'expired' && Math.random() < 0.3,
        notes: null,
      });
    }
  }

  const { error } = await db.from('self_exclusion_registry').insert(rows);
  if (error) logErr(`self_exclusion_registry: ${error.message}`);
  else logOk(`${rows.length} exclusion records seeded`);
}

export async function resetExclusions(casinoIds: string[]): Promise<void> {
  if (casinoIds.length === 0) return;
  const { error } = await db.from('self_exclusion_registry').delete().in('casino_id', casinoIds);
  if (error) logErr(`reset self_exclusion_registry: ${error.message}`);
  else logOk('Demo exclusion records deleted');
}
