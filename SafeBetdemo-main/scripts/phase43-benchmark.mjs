// Phase 4.3 — in-process performance benchmark (WS4/WS7).
// Measures the CPU-bound hot paths of the enterprise flow (the parts that run
// per event regardless of I/O topology): identity derivation, envelope
// enrichment, projection reduction. I/O throughput (DB round-trips) is
// analysed separately in the deliverables — this isolates compute cost.
//
// Run: node scripts/phase43-benchmark.mjs

import { getIdentityService } from '../lib/playerIdentity/index.ts';
import { emptyStates, reduceEnvelopes } from '../lib/projectionPlatform/apply.ts';

const CASINO = '00000000-0000-0000-0000-000000000001';

function bench(name, iterations, fn) {
  // warm-up
  for (let i = 0; i < Math.min(1000, iterations); i++) fn(i);
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) fn(i);
  const ns = Number(process.hrtime.bigint() - t0);
  const perOp = ns / iterations;
  const opsPerSec = 1e9 / perOp;
  console.log(`${name.padEnd(34)} ${iterations.toLocaleString().padStart(9)} ops  ${(perOp / 1000).toFixed(2).padStart(8)} µs/op  ${Math.round(opsPerSec).toLocaleString().padStart(12)} ops/sec`);
  return opsPerSec;
}

async function benchAsync(name, iterations, fn) {
  for (let i = 0; i < Math.min(200, iterations); i++) await fn(i);
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) await fn(i);
  const ns = Number(process.hrtime.bigint() - t0);
  const opsPerSec = 1e9 / (ns / iterations);
  console.log(`${name.padEnd(34)} ${iterations.toLocaleString().padStart(9)} ops  ${((ns / iterations) / 1000).toFixed(2).padStart(8)} µs/op  ${Math.round(opsPerSec).toLocaleString().padStart(12)} ops/sec`);
  return opsPerSec;
}

function envelope(i) {
  return {
    eventId: `e${i}`, correlationId: 'c', traceId: 't', tenantId: CASINO, casinoId: CASINO,
    jurisdiction: 'ZA', safeBetPlayerId: `SB-PLR-${(i % 150).toString(16).padStart(24, '0').toUpperCase()}`,
    sessionId: `s${i % 150}`, machineId: `M-${(i % 80).toString().padStart(3, '0')}`,
    producer: 'bench', schemaVersion: 1, eventType: 'BET_PLACED',
    occurredAt: new Date(1_700_000_000_000 + i * 1000).toISOString(), receivedAt: '', processedAt: '',
    replayNumber: 0, idempotencyKey: `e${i}`,
    payload: { bet_amount: 50, win_amount: 10, risk_score: 30, game_type: 'slots' },
  };
}

console.log('\nSafeBet IQ — Phase 4.3 in-process hot-path benchmark');
console.log('platform:', process.platform, '| node:', process.version, '\n');

const svc = getIdentityService();
await benchAsync('identity resolve (derive, 96-bit)', 50_000, (i) =>
  svc.resolveIdentity(`patron-${i}`, { casinoId: CASINO }));

const batch = Array.from({ length: 1000 }, (_, i) => envelope(i));
bench('projection reduce (1k-event batch)', 2000, () => reduceEnvelopes(emptyStates(), batch));

// Single-event reduce (the live per-event apply cost).
bench('projection reduce (single event)', 200_000, (i) => reduceEnvelopes(emptyStates(), [envelope(i)]));

console.log('\nInterpretation: these are the per-event CPU costs. End-to-end');
console.log('throughput is bounded by DB round-trips (persist + versioned apply),');
console.log('now batched and idempotent — see the Phase 4.3 deliverables for the');
console.log('I/O analysis and the 100 → 100,000 ev/s scalability assessment.\n');
