import { db } from '../client';
import { randomInt, log, logOk, logErr } from '../utils';

// Frameworks that match existing compliance_snapshots data
const FRAMEWORKS = ['ISO27001', 'POPIA'] as const;

export async function seedComplianceSnapshots(casinoIds: string[]): Promise<void> {
  log('Seeding compliance snapshots (13 months × 2 frameworks per casino)...');
  const rows: Record<string, unknown>[] = [];
  const now = new Date();

  for (const casinoId of casinoIds) {
    // Each casino has a slightly different base score (creates meaningful differentiation)
    const baseCompliant = randomInt(24, 30); // out of 40 controls

    for (const framework of FRAMEWORKS) {
      for (let m = 12; m >= 0; m--) {
        const date = new Date(now);
        date.setMonth(date.getMonth() - m);
        date.setDate(1);
        const snapshotDate = date.toISOString().split('T')[0];

        // Upward trend over time
        const trendBonus  = Math.round((12 - m) * 0.6);
        const variance    = randomInt(-2, 2);
        const compliant   = Math.min(38, baseCompliant + trendBonus + variance);
        const nonCompliant = Math.max(1, 40 - compliant - randomInt(1, 4));
        const partial      = Math.max(0, 40 - compliant - nonCompliant);
        const notAssessed  = 0;
        const complianceScore = parseFloat(((compliant / 40) * 100).toFixed(1));

        rows.push({
          casino_id: casinoId,
          framework,
          snapshot_date: snapshotDate,
          total_controls: 40,
          compliant,
          non_compliant: nonCompliant,
          partial,
          not_assessed: notAssessed,
          compliance_score: complianceScore,
        });
      }
    }
  }

  // No unique constraint on (casino_id, snapshot_date, framework) — use INSERT with pre-check
  // Filter out dates that already exist to make the seeder idempotent
  const { data: existing } = await db
    .from('compliance_snapshots')
    .select('casino_id, framework, snapshot_date')
    .in('casino_id', casinoIds);

  const existingKeys = new Set(
    (existing ?? []).map((r) => `${r.casino_id}|${r.framework}|${r.snapshot_date}`)
  );

  const newRows = rows.filter(
    (r) => !existingKeys.has(`${r.casino_id}|${r.framework}|${r.snapshot_date}`)
  );

  if (newRows.length === 0) {
    logOk('Compliance snapshots already seeded — skipping');
    return;
  }

  const { error } = await db.from('compliance_snapshots').insert(newRows);
  if (error) logErr(`compliance_snapshots: ${error.message}`);
  else logOk(`${newRows.length} compliance snapshots seeded`);
}

export async function resetComplianceSnapshots(casinoIds: string[]): Promise<void> {
  if (casinoIds.length === 0) return;
  const { error } = await db.from('compliance_snapshots').delete().in('casino_id', casinoIds);
  if (error) logErr(`reset compliance_snapshots: ${error.message}`);
  else logOk('Demo compliance snapshots deleted');
}
