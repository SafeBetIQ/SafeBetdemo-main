-- ─── UAT-OP-5: synthetic Demo self-exclusion presentation records ────────────
-- Seeds a SMALL, clearly-synthetic set of self_exclusions so the authenticated
-- Operator Self-Exclusion module can demonstrate search, status filter and the
-- active/expired/lifted/breached states. DEMO ONLY.
--
-- Safety:
--   * Idempotent — fixed ids + ON CONFLICT (id) DO NOTHING; re-running is a no-op.
--   * Clearly synthetic — player references are 'SB-DEMO-SEXCL-*', reasons say
--     "(synthetic demo)"; no real names/emails/IDs/phones.
--   * Demo-scoped — rows reference the Demo casinos cc000003 (Betway) and
--     cc000001 (SunBet). The casino_id FK is the natural environment guard: on the
--     unrelated Production database those casinos do not exist, so the insert would
--     fail rather than silently seed prod (and this migration is only ever applied
--     to the Demo project uexdjngogzunjxkpxwll).
--   * No RLS change — the existing "Casino admins see own exclusions" policy scopes
--     visibility to each operator's own casino (cross-casino remains denied).
--   * Read-only feature — no write path is added by this seed.

insert into public.self_exclusions
  (id, casino_id, player_id, player_token, exclusion_type, duration_type, duration_days,
   starts_at, ends_at, status, breach_count, reason, notes, created_at, updated_at)
values
  -- Betway (cc000003): active temporary cooling-off
  ('5e000001-0000-4000-a000-000000000001', 'cc000003-0000-0000-0000-000000000003', null,
   'SB-DEMO-SEXCL-0001', 'self', 'temporary', 90,
   now() - interval '30 days', now() + interval '60 days', 'active', 0,
   'Self-requested cooling-off (synthetic demo)', 'Synthetic demonstration record.',
   now() - interval '30 days', now() - interval '30 days'),
  -- Betway: active operator-initiated, indefinite
  ('5e000001-0000-4000-a000-000000000002', 'cc000003-0000-0000-0000-000000000003', null,
   'SB-DEMO-SEXCL-0002', 'operator_initiated', 'indefinite', null,
   now() - interval '10 days', null, 'active', 0,
   'Operator responsible-gambling intervention (synthetic demo)', 'Synthetic demonstration record.',
   now() - interval '10 days', now() - interval '10 days'),
  -- Betway: expired temporary
  ('5e000001-0000-4000-a000-000000000003', 'cc000003-0000-0000-0000-000000000003', null,
   'SB-DEMO-SEXCL-0003', 'self', 'temporary', 180,
   now() - interval '200 days', now() - interval '20 days', 'expired', 0,
   'Temporary self-exclusion lapsed (synthetic demo)', 'Synthetic demonstration record.',
   now() - interval '200 days', now() - interval '20 days'),
  -- Betway: lifted after review
  ('5e000001-0000-4000-a000-000000000004', 'cc000003-0000-0000-0000-000000000003', null,
   'SB-DEMO-SEXCL-0004', 'self', 'temporary', 120,
   now() - interval '120 days', now() - interval '30 days', 'lifted', 0,
   'Exclusion lifted after compliance review (synthetic demo)', 'Synthetic demonstration record.',
   now() - interval '120 days', now() - interval '30 days'),
  -- Betway: breached permanent
  ('5e000001-0000-4000-a000-000000000005', 'cc000003-0000-0000-0000-000000000003', null,
   'SB-DEMO-SEXCL-0005', 'self', 'permanent', null,
   now() - interval '60 days', null, 'breached', 2,
   'Attempted re-entry detected during exclusion (synthetic demo)', 'Synthetic demonstration record.',
   now() - interval '60 days', now() - interval '2 days'),
  -- SunBet (cc000001): a record for a DIFFERENT operator (proves cross-casino scoping)
  ('5e000001-0000-4000-a000-000000000006', 'cc000001-0000-0000-0000-000000000001', null,
   'SB-DEMO-SEXCL-0006', 'self', 'temporary', 30,
   now() - interval '5 days', now() + interval '25 days', 'active', 0,
   'SunBet self-requested exclusion (synthetic demo)', 'Synthetic demonstration record — different operator.',
   now() - interval '5 days', now() - interval '5 days')
on conflict (id) do nothing;
