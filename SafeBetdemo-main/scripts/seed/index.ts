#!/usr/bin/env node
/**
 * SafeBet IQ — Demo Data Seeder
 *
 * Usage:
 *   npm run seed              — seed demo data (idempotent, safe to re-run)
 *   npm run seed:reset        — wipe all demo data then re-seed from scratch
 *   npx tsx scripts/seed/index.ts --dry-run   — validate env without writing
 *
 * Isolation strategy:
 *   - Casinos:  simulation_mode = true
 *   - Players:  player_token starts with "DEMO-"
 *   - Staff:    email ends with "@demo.safebetiq.com"
 *   - Related:  linked via casino_id FK to the demo casinos above
 */

import { seedCasinos, resetCasinos } from './seeders/casinos';
import { seedStaff, resetStaff } from './seeders/staff';
import { seedPlayers, resetPlayers } from './seeders/players';
import { seedSessions, resetSessions } from './seeders/sessions';
import { seedInterventions, resetInterventions } from './seeders/interventions';
import { seedExclusions, resetExclusions } from './seeders/exclusions';
import { seedComplianceSnapshots, resetComplianceSnapshots } from './seeders/compliance';
import { seedAuditEvents, resetAuditEvents } from './seeders/audit';
import { logSection, logOk } from './utils';

const RESET = process.argv.includes('--reset');
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   SafeBet IQ — Demo Data Seeder v1.0    ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`  Mode   : ${RESET ? 'RESET + SEED' : 'SEED ONLY (idempotent)'}`);
  console.log(`  Target : demo.safebetiq.com (Supabase)\n`);

  if (DRY_RUN) {
    console.log('  [DRY RUN] Environment validated. No writes performed.\n');
    return;
  }

  let casinoIds: string[] = [];
  let playerIds: string[] = [];
  let staffIds: string[] = [];

  // ── RESET ──────────────────────────────────────────────────────────────────
  if (RESET) {
    logSection('RESET — Removing existing demo data');
    // Delete in reverse dependency order to avoid FK violations
    await resetAuditEvents([]);
    await resetExclusions([]);
    await resetInterventions([]);
    await resetSessions([]);
    await resetComplianceSnapshots([]);
    await resetPlayers();
    await resetStaff();
    await resetCasinos();
  }

  // ── SEED ───────────────────────────────────────────────────────────────────
  logSection('SEED — Casinos');
  casinoIds = await seedCasinos();
  if (casinoIds.length === 0) {
    console.error('\n  ✗ Casino seeding failed — aborting. Check Supabase credentials and RLS policies.\n');
    process.exit(1);
  }

  logSection('SEED — Staff');
  staffIds = await seedStaff(casinoIds);

  logSection('SEED — Players');
  playerIds = await seedPlayers(casinoIds);

  logSection('SEED — Gaming Sessions');
  await seedSessions(casinoIds, playerIds);

  logSection('SEED — Player Protection Interventions');
  await seedInterventions(casinoIds, playerIds);

  logSection('SEED — Self-Exclusion Registry');
  await seedExclusions(casinoIds, playerIds);

  logSection('SEED — Compliance Snapshots');
  await seedComplianceSnapshots(casinoIds);

  logSection('SEED — Audit Events');
  await seedAuditEvents(casinoIds);

  // ── SUMMARY ────────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  logOk(`Demo seed complete.`);
  console.log(`\n  Entities created:`);
  console.log(`    Casinos        : ${casinoIds.length}`);
  console.log(`    Staff          : ${staffIds.length}`);
  console.log(`    Players        : ${playerIds.length}`);
  console.log(`    (plus sessions, interventions, exclusions, compliance snapshots, audit events)\n`);
  console.log(`  To reset and re-seed: npm run seed:reset\n`);
}

main().catch((err: Error) => {
  console.error('\n  ✗ Seed failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
