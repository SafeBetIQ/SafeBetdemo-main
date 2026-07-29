// Unit tests for the Identity Resolution Service (Phase 3.1 + 3.1A abstraction).
// Run: node --test tests/playerIdentity.test.mjs
// (Node ≥ 22.6 — imports the actual TypeScript sources via type stripping.)
//
// Consumers-eye view: everything below (except the provider-internal suite)
// goes through IdentityResolutionService — never the SHA-256 provider directly.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SAFEBET_ID_PATTERN,
  isSafeBetId,
  formatPlayerId,
  playerAvatarChars,
} from '../lib/playerIdentity/core.ts';
import { IdentityResolutionService, getIdentityService } from '../lib/playerIdentity/service.ts';
import { SHA256IdentityProvider } from '../lib/playerIdentity/providers/sha256.ts';

const CASINO_A = '00000000-0000-0000-0000-000000000001';
const CASINO_B = '00000000-0000-0000-0000-000000000002';

// Pinned derivation vectors for demo-patron-1 @ CASINO_A (ADR-001).
// The v1 id is the exact PREFIX of the v2 id — same SHA-256, wider slice.
const V1_ID = 'SB-PLR-707371C3';                        // legacy 32-bit (sha256-v1)
const V2_ID = 'SB-PLR-707371C39AE04D71BBA3E495';        // production 96-bit (sha256-v2, default)

const svc = getIdentityService();
const ctxA = { casinoId: CASINO_A };
const ctxB = { casinoId: CASINO_B };

// ─── Resolution through the service (derive-only context) ────────────────────

test('resolved id matches canonical SB-PLR-XXXXXXXX format', async () => {
  const id = await svc.resolveIdentity('demo-patron-1', ctxA);
  assert.match(id, SAFEBET_ID_PATTERN);
});

test('resolution is deterministic: same input → same id, always', async () => {
  const a = await svc.resolveIdentity('demo-patron-1', ctxA);
  const b = await svc.resolveIdentity('demo-patron-1', ctxA);
  const c = await svc.resolveIdentity('demo-patron-1', ctxA);
  assert.equal(a, b);
  assert.equal(b, c);
});

test('different casino references resolve to different ids', async () => {
  const refs = Array.from({ length: 150 }, (_, i) => `demo-patron-${i + 1}`);
  const ids = await svc.resolveBatch(refs, ctxA);
  assert.equal(new Set(ids).size, 150, 'expected 150 unique ids for 150 refs');
});

test('same reference in different casinos resolves to different ids', async () => {
  const a = await svc.resolveIdentity('demo-patron-1', ctxA);
  const b = await svc.resolveIdentity('demo-patron-1', ctxB);
  assert.notEqual(a, b);
});

test('reference normalisation: case and whitespace do not split identity', async () => {
  const a = await svc.resolveIdentity('CARD-9001', ctxA);
  const b = await svc.resolveIdentity('  card-9001 ', ctxA);
  assert.equal(a, b);
});

test('resolveBatch preserves input order', async () => {
  const refs = ['demo-patron-3', 'demo-patron-1', 'demo-patron-2'];
  const batch = await svc.resolveBatch(refs, ctxA);
  const singles = await Promise.all(refs.map(r => svc.resolveIdentity(r, ctxA)));
  assert.deepEqual(batch, singles);
});

// PINNED DERIVATION VECTORS (Phase 3.1 → 3.1A → 4.2):
// The default provider is now sha256-v2 (96-bit). If the v2 vector changes,
// identity derivation broke; the v1 anchor proves backward continuity — the
// legacy 32-bit id remains the exact prefix of the 96-bit id (same hash).
test('pinned v2 derivation vector (default provider, 96-bit)', async () => {
  assert.equal(await svc.resolveIdentity('demo-patron-1', ctxA), V2_ID);
});

test('v1 legacy vector unchanged; v1 id is the exact prefix of the v2 id', async () => {
  const v1 = new IdentityResolutionService(
    [new SHA256IdentityProvider({ name: 'sha256-v1', hexWidth: 8 })],
    { defaultProvider: 'sha256-v1' },
  );
  assert.equal(await v1.resolveIdentity('demo-patron-1', ctxA), V1_ID);
  assert.ok(V2_ID.startsWith(V1_ID), 'v1 id must be the prefix of the v2 id');
});

test('createIdentity and getExistingIdentity agree with resolveIdentity', async () => {
  const resolved = await svc.resolveIdentity('demo-patron-7', ctxA);
  assert.equal(await svc.createIdentity('demo-patron-7', ctxA), resolved);
  assert.equal(await svc.getExistingIdentity('demo-patron-7', ctxA), resolved);
});

test('validateIdentity accepts canonical ids and rejects everything else', () => {
  assert.equal(svc.validateIdentity('SB-PLR-7C5D91E4', ctxA), true);
  assert.equal(svc.validateIdentity('SB-PLR-7c5d91e4', ctxA), false); // lowercase not canonical
  assert.equal(svc.validateIdentity('SB-PLR-123', ctxA), false);
  assert.equal(svc.validateIdentity('7C5D91E4', ctxA), false);
});

test('supportsProvider reflects the registry', () => {
  assert.equal(svc.supportsProvider('sha256-v1'), true);
  assert.equal(svc.supportsProvider('national-id-v1'), false);
});

// ─── Persisted resolution (mocked RPC client through the service) ────────────

function mockClient(handler) {
  const calls = [];
  return {
    calls,
    rpc(fn, args) {
      calls.push({ fn, args });
      return Promise.resolve(handler(fn, args, calls.length));
    },
  };
}

test('service persists via RPC when a client is in the context', async () => {
  const client = mockClient((_fn, args) => ({
    data: [{ out_safebet_player_id: args.p_safebet_id, out_status: 'created' }],
    error: null,
  }));
  const id = await svc.resolveIdentity('demo-patron-1', { casinoId: CASINO_A, client });
  assert.equal(id, V2_ID);
  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0].fn, 'resolve_player_identity');
});

test('persisted mapping wins over derivation (idempotency)', async () => {
  const client = mockClient(() => ({
    data: [{ out_safebet_player_id: 'SB-PLR-AAAAAAAA', out_status: 'existing' }],
    error: null,
  }));
  const id = await svc.resolveIdentity('demo-patron-1', { casinoId: CASINO_A, client });
  assert.equal(id, 'SB-PLR-AAAAAAAA');
});

test('id collision retries with probed candidate, same hash key', async () => {
  const client = mockClient((_fn, args, n) =>
    n === 1
      ? { data: [{ out_safebet_player_id: null, out_status: 'collision' }], error: null }
      : { data: [{ out_safebet_player_id: args.p_safebet_id, out_status: 'created' }], error: null },
  );
  const id = await svc.resolveIdentity('demo-patron-1', { casinoId: CASINO_A, client });
  assert.equal(client.calls.length, 2);
  assert.equal(client.calls[0].args.p_ref_hash, client.calls[1].args.p_ref_hash);
  assert.notEqual(client.calls[0].args.p_safebet_id, client.calls[1].args.p_safebet_id);
  assert.equal(id, client.calls[1].args.p_safebet_id);
});

test('RPC errors surface through the service', async () => {
  const client = mockClient(() => ({ data: null, error: { message: 'permission denied' } }));
  await assert.rejects(
    () => svc.resolveIdentity('demo-patron-1', { casinoId: CASINO_A, client }),
    /identity resolution failed: permission denied/,
  );
});

test('raw casino reference never crosses the service boundary', async () => {
  const client = mockClient((_fn, args) => ({
    data: [{ out_safebet_player_id: args.p_safebet_id, out_status: 'created' }],
    error: null,
  }));
  await svc.resolveIdentity('demo-patron-1', { casinoId: CASINO_A, client });
  const sent = JSON.stringify(client.calls[0].args);
  assert.ok(!sent.includes('demo-patron-1'), 'raw reference must never leave the resolver');
  assert.match(client.calls[0].args.p_ref_hash, /^[0-9a-f]{64}$/);
});

// ─── Encapsulation & extensibility (Phase 3.1A guarantees) ───────────────────

test('public API does not expose the hashing implementation', async () => {
  const api = await import('../lib/playerIdentity/index.ts');
  for (const leaked of ['deriveSafeBetId', 'hashCasinoRef', 'safeBetIdFromHash', 'normalizeCasinoRef', 'SHA256IdentityProvider']) {
    assert.equal(leaked in api, false, `'${leaked}' must not be exported from the public API`);
  }
  assert.equal(typeof api.getIdentityService, 'function');
  assert.equal(typeof api.formatPlayerId, 'function');
});

test('a new provider plugs in via configuration with zero consumer changes', async () => {
  // Simulates e.g. a TestingIdentityProvider / NationalIdentityProvider.
  const testingProvider = {
    name: 'testing-v1',
    resolveIdentity: async ref => `SB-PLR-${ref.length.toString(16).padStart(8, '0').toUpperCase()}`,
    createIdentity: async ref => `SB-PLR-${ref.length.toString(16).padStart(8, '0').toUpperCase()}`,
    getExistingIdentity: async () => null,
    validateIdentity: v => /^SB-PLR-[0-9A-F]{8}$/.test(v),
    resolveBatch: async refs => refs.map(r => `SB-PLR-${r.length.toString(16).padStart(8, '0').toUpperCase()}`),
    supportsJurisdiction: () => true,
    supportsCasino: () => true,
  };

  // Same consumer call shape; only registry + config differ.
  const custom = new IdentityResolutionService(
    [new SHA256IdentityProvider({ name: 'sha256-v1', hexWidth: 8 }), testingProvider],
    { defaultProvider: 'sha256-v1', casinoProviders: { [CASINO_B]: 'testing-v1' } },
  );

  // Casino A still routes to SHA-256 v1 (ids unchanged)…
  assert.equal(await custom.resolveIdentity('demo-patron-1', ctxA), V1_ID);
  // …while casino B routes to the new provider — no consumer code changed.
  assert.equal(await custom.resolveIdentity('demo-patron-1', ctxB), 'SB-PLR-0000000D');
  assert.equal(custom.supportsProvider('testing-v1'), true);
});

test('unregistered provider selection fails loudly', async () => {
  const custom = new IdentityResolutionService(
    [new SHA256IdentityProvider()],
    { defaultProvider: 'national-id-v1' },
  );
  await assert.rejects(
    () => custom.resolveIdentity('demo-patron-1', ctxA),
    /identity provider 'national-id-v1' is not registered/,
  );
});

// ─── Identity Policy Layer (Phase 3.1B) — decision point, not an engine ──────

test('default policy permits resolution and preserves all existing ids', async () => {
  const decision = svc.evaluatePolicy(ctxA);
  assert.equal(decision.permitted, true);
  assert.equal(decision.providerName, 'sha256-v2');
  // Privacy-safe defaults: strictly per-casino identity, no federation.
  assert.equal(decision.crossCasinoPermitted, false);
  assert.equal(decision.federationPermitted, false);
  // The flow through the policy layer yields the identical pinned id.
  assert.equal(await svc.resolveIdentity('demo-patron-1', ctxA), V2_ID);
});

test('policy evaluation is pure and stateless: same context → same decision', () => {
  const a = svc.evaluatePolicy({ casinoId: CASINO_A, jurisdiction: 'ZA' });
  const b = svc.evaluatePolicy({ casinoId: CASINO_A, jurisdiction: 'ZA' });
  assert.deepEqual(a, b);
});

test('tenant policy: denied casino refuses resolution before any provider runs', async () => {
  const guarded = new IdentityResolutionService(
    [new SHA256IdentityProvider()],
    undefined,
    { deniedCasinos: [CASINO_B] },
  );
  // Casino A unaffected — same id as always.
  assert.equal(await guarded.resolveIdentity('demo-patron-1', ctxA), V2_ID);
  await assert.rejects(
    () => guarded.resolveIdentity('demo-patron-1', ctxB),
    /identity policy refused resolution: identity resolution is not permitted for casino/,
  );
});

test('jurisdiction policy: denied jurisdiction refuses resolution', async () => {
  const guarded = new IdentityResolutionService(
    [new SHA256IdentityProvider()],
    undefined,
    { deniedJurisdictions: ['XX'] },
  );
  assert.equal(
    await guarded.resolveIdentity('demo-patron-1', { casinoId: CASINO_A, jurisdiction: 'ZA' }),
    V2_ID,
  );
  await assert.rejects(
    () => guarded.resolveIdentity('demo-patron-1', { casinoId: CASINO_A, jurisdiction: 'XX' }),
    /not permitted in jurisdiction 'XX'/,
  );
});

test('policy owns provider selection: tenant routing flows through the decision', async () => {
  const v1Provider = new SHA256IdentityProvider({ name: 'sha256-v1', hexWidth: 8 });
  const routed = new IdentityResolutionService(
    [new SHA256IdentityProvider(), v1Provider],
    { casinoProviders: { [CASINO_B]: 'sha256-v1' } },
  );
  // Casino B is routed to v1 by policy; casino A keeps the v2 default.
  assert.equal(routed.evaluatePolicy(ctxB).providerName, 'sha256-v1');
  assert.equal(routed.evaluatePolicy(ctxA).providerName, 'sha256-v2');
  assert.equal(await routed.resolveIdentity('demo-patron-1', ctxB),
    await v1Provider.resolveIdentity('demo-patron-1', ctxB));
  assert.equal(await routed.resolveIdentity('demo-patron-1', ctxA), V2_ID);
});

test('cross-casino and federation permissions surface as decisions only', () => {
  const federated = new IdentityResolutionService(
    [new SHA256IdentityProvider()],
    undefined,
    { allowCrossCasino: true, allowFederation: true },
  );
  const d = federated.evaluatePolicy(ctxA);
  assert.equal(d.crossCasinoPermitted, true);
  assert.equal(d.federationPermitted, true);
});

// ─── Display helpers (implementation-agnostic) ────────────────────────────────

test('isSafeBetId accepts canonical ids and rejects everything else', () => {
  assert.equal(isSafeBetId('SB-PLR-7C5D91E4'), true);
  assert.equal(isSafeBetId('SB-PLR-7c5d91e4'), false);
  assert.equal(isSafeBetId(null), false);
  assert.equal(isSafeBetId(undefined), false);
});

test('formatPlayerId passes canonical ids through unchanged', () => {
  assert.equal(formatPlayerId('SB-PLR-7C5D91E4'), 'SB-PLR-7C5D91E4');
});

test('formatPlayerId renders legacy identifiers as anonymous SB-PLR labels', () => {
  assert.equal(formatPlayerId('a1b2c3d4-e5f6-7890-abcd-ef0123456789'), 'SB-PLR-EF012345');
  assert.equal(formatPlayerId(null), '—');
  assert.equal(formatPlayerId(''), '—');
});

test('playerAvatarChars derives two stable glyph chars', () => {
  assert.equal(playerAvatarChars('SB-PLR-7C5D91E4'), '7C');
  assert.equal(playerAvatarChars(null), 'SB');
  assert.equal(playerAvatarChars('---'), 'SB');
});

// ─── Phase 4.2 — Enterprise Identity Integrity (ADR-001, 96-bit) ─────────────

test('production ids are 96-bit: SB-PLR- + 24 uppercase hex', async () => {
  const id = await svc.resolveIdentity('demo-patron-42', ctxA);
  assert.match(id, /^SB-PLR-[0-9A-F]{24}$/);
  assert.equal(id.length, 'SB-PLR-'.length + 24);
});

test('both id widths validate; format contract accepts v1 and v2, rejects others', () => {
  assert.equal(isSafeBetId(V1_ID), true);                                   // 8 hex (legacy)
  assert.equal(isSafeBetId(V2_ID), true);                                   // 24 hex (production)
  assert.equal(isSafeBetId('SB-PLR-707371C39AE04D71BBA3E4'), false);        // 22 hex — neither width
  assert.equal(isSafeBetId('SB-PLR-707371C39AE04D71BBA3E495AA'), false);    // 28 hex
  assert.equal(isSafeBetId('SB-PLR-707371c39ae04d71bba3e495'), false);      // lowercase
});

test('96-bit space is collision-free across a large deterministic reference set', async () => {
  const refs = Array.from({ length: 5000 }, (_, i) => `stress-patron-${i}`);
  const ids = await svc.resolveBatch(refs, ctxA);
  assert.equal(new Set(ids).size, 5000, 'no collisions across 5000 refs');
  assert.ok(ids.every(id => /^SB-PLR-[0-9A-F]{24}$/.test(id)));
});

test('determinism holds across service instances and widths (long-run stability)', async () => {
  const svc2 = new IdentityResolutionService([new SHA256IdentityProvider()]);
  assert.equal(await svc2.resolveIdentity('demo-patron-1', ctxA), V2_ID);
  // Same reference, different casino → different id, still 96-bit.
  const other = await svc.resolveIdentity('demo-patron-1', ctxB);
  assert.notEqual(other, V2_ID);
  assert.match(other, /^SB-PLR-[0-9A-F]{24}$/);
});
