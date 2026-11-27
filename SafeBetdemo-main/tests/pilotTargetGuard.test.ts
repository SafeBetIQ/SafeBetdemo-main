// M1B-P2B.2 — runtime exact Pilot Supabase target guard. Run: npx tsx --test tests/pilotTargetGuard.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertSupabaseTarget, PILOT_SUPABASE_URL } from '../lib/supabaseTarget';

const PILOT = { NEXT_PUBLIC_ENV: 'pilot', NEXT_PUBLIC_SAFEBET_ENV: 'pilot' };

test('1. exact Pilot URL in Pilot => PASS (returns url)', () => {
  assert.equal(assertSupabaseTarget(PILOT_SUPABASE_URL, PILOT), PILOT_SUPABASE_URL);
});

test('2. missing URL in Pilot => FAIL CLOSED', () => {
  assert.throws(() => assertSupabaseTarget(undefined, PILOT), /fail closed/);
  assert.throws(() => assertSupabaseTarget('', PILOT), /fail closed/);
});

test('3-6. Production / Demo / Guardian / unknown project in Pilot => FAIL CLOSED', () => {
  for (const u of [
    'https://ilibvipqbkugqkppzdmh.supabase.co',   // Production
    'https://uexdjngogzunjxkpxwll.supabase.co',   // Demo
    'https://druuskabkgyotslcgnys.supabase.co',   // Guardian
    'https://zzzzzzzzzzzzzzzzzzzz.supabase.co',    // unknown 4th project
  ]) assert.throws(() => assertSupabaseTarget(u, PILOT), /fail closed/, u);
});

test('7-8. lookalike hostname / appended path / query / trailing slash / scheme => FAIL CLOSED', () => {
  for (const u of [
    'https://umejmtnzxbmezraercdj.supabase.co.evil.com',
    'https://umejmtnzxbmezraercdj.supabase.co/rest/v1',
    'https://umejmtnzxbmezraercdj.supabase.co?x=1',
    'https://umejmtnzxbmezraercdj.supabase.co/',
    'http://umejmtnzxbmezraercdj.supabase.co',
    'umejmtnzxbmezraercdj.supabase.co',
  ]) assert.throws(() => assertSupabaseTarget(u, PILOT), /fail closed/, u);
});

test('9. conflicting Pilot environment indicators => FAIL CLOSED', () => {
  assert.throws(() => assertSupabaseTarget(PILOT_SUPABASE_URL, { NEXT_PUBLIC_ENV: 'pilot', NEXT_PUBLIC_SAFEBET_ENV: 'demo' }), /conflicting/);
  assert.throws(() => assertSupabaseTarget(PILOT_SUPABASE_URL, { NEXT_PUBLIC_ENV: 'production', NEXT_PUBLIC_SAFEBET_ENV: 'pilot' }), /conflicting/);
});

test('10. guard throws BEFORE any client/connection (invalid target cannot construct a client)', () => {
  // getSupabaseUrl() / assertSupabaseTarget is called at the top of every client module and every
  // server route *before* createClient(); a throw here means no outbound DB connection is attempted.
  assert.throws(() => assertSupabaseTarget('https://uexdjngogzunjxkpxwll.supabase.co', PILOT), /fail closed/);
});

test('11. non-Pilot behaviour unchanged (presence required, no allowlist)', () => {
  const nonPilot = { NEXT_PUBLIC_ENV: 'demo', NEXT_PUBLIC_SAFEBET_ENV: 'demo' };
  // any valid URL is returned unchanged outside Pilot (Demo/Prod/Guardian deployments unaffected)
  assert.equal(assertSupabaseTarget('https://uexdjngogzunjxkpxwll.supabase.co', nonPilot), 'https://uexdjngogzunjxkpxwll.supabase.co');
  assert.equal(assertSupabaseTarget('https://anything.example.com', {}), 'https://anything.example.com');
  // missing still fails (as before)
  assert.throws(() => assertSupabaseTarget(undefined, nonPilot), /not configured/);
});
