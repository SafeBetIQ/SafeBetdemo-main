// Demo Simulation Health fast-load contract (pure client/route decision logic).
//   node --test tests/demoSimHealthClient.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readTokenFromStore, slowMessage, showRetryAt, shouldPoll, cacheHit,
} from '../lib/demoSimHealthClient.ts';

// A localStorage-like store for testing the lock-free token read.
function store(entries) {
  const keys = Object.keys(entries);
  return { length: keys.length, key: (i) => keys[i] ?? null, getItem: (k) => entries[k] ?? null };
}

test('lock-free token read parses the persisted session (no getSession call)', () => {
  const s = store({ 'sb-uexdjngogzunjxkpxwll-auth-token': JSON.stringify({ access_token: 'tok_abc', refresh_token: 'r' }) });
  assert.equal(readTokenFromStore(s), 'tok_abc');
  // legacy currentSession shape
  const s2 = store({ 'sb-x-auth-token': JSON.stringify({ currentSession: { access_token: 'tok_legacy' } }) });
  assert.equal(readTokenFromStore(s2), 'tok_legacy');
});

test('token read is null-safe (no session, bad JSON, missing store)', () => {
  assert.equal(readTokenFromStore(null), null);
  assert.equal(readTokenFromStore(store({})), null);
  assert.equal(readTokenFromStore(store({ 'sb-x-auth-token': 'not json' })), null);
  assert.equal(readTokenFromStore(store({ 'other-key': JSON.stringify({ access_token: 't' }) })), null);
});

test('staged loading messages escalate correctly', () => {
  assert.equal(slowMessage('verifying', 0), 'Verifying Super Admin access…');
  assert.equal(slowMessage('loading', 0), 'Loading simulator health…');
  assert.equal(slowMessage('loading', 5), 'Loading casino activity…');
  assert.equal(slowMessage('loading', 10), 'This is taking longer than expected…');
  assert.equal(slowMessage('loading', 15), 'This is taking longer than expected…');
});

test('retry option only appears at the 15s stage', () => {
  assert.equal(showRetryAt(0), false);
  assert.equal(showRetryAt(10), false);
  assert.equal(showRetryAt(15), true);
});

test('polling only when visible AND first load complete', () => {
  assert.equal(shouldPoll(false, true), true);   // visible + first done → poll
  assert.equal(shouldPoll(true, true), false);   // hidden tab → paused
  assert.equal(shouldPoll(false, false), false); // first load not done → wait
  assert.equal(shouldPoll(true, false), false);
});

test('server cache: serve within TTL, bypass on fresh, miss when stale/empty', () => {
  const now = 100000;
  assert.equal(cacheHit(now - 3000, now, 6000, false), true);   // within 6s TTL
  assert.equal(cacheHit(now - 3000, now, 6000, true), false);   // ?fresh=1 bypass
  assert.equal(cacheHit(now - 9000, now, 6000, false), false);  // stale
  assert.equal(cacheHit(null, now, 6000, false), false);        // nothing cached
});
