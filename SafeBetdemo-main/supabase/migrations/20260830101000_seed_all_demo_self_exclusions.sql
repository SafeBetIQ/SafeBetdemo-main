-- ─── UAT-OP-5S: synthetic Self-Exclusion presentation data for ALL Demo casinos ──
-- Follow-up to 20260830100000 (which covered only Betway + SunBet). Seeds 5 clearly-
-- synthetic self_exclusions for EVERY current Demo casino so the read-only Operator
-- Self-Exclusion module can be demonstrated from any Demo account. DEMO ONLY.
--
-- Safety:
--   * Registry-driven — inserts for every row in `casinos` (so a new Demo casino is
--     covered automatically), 5 records each: 2 active, 1 expired, 1 lifted, 1 breached.
--   * Idempotent — deterministic ids (5eb0<casino-ord>-…-<rec>) + ON CONFLICT (id) DO
--     NOTHING; safe to re-run; does not collide with the 20260830100000 ids.
--   * Clearly synthetic — player references 'SB-DEMO-SEXCL-C<ord>-<rec>', "(synthetic
--     demo)" reasons; no real names/emails/IDs/phones; professional, non-clinical wording.
--   * Casino-scoped — each row's casino_id is the operator; the existing RLS policy
--     "Casino admins see own exclusions" keeps cross-casino data isolated (unchanged).
--   * Read-only feature — no write path is added; no RLS/schema/grant/ownership change.
--   * PRODUCTION GUARD — aborts unless the known Demo casinos are present, so it cannot
--     run against the unrelated Production database.

-- Demo-environment guard: refuse to run if this is not the Demo casino registry.
do $$
begin
  if not exists (select 1 from public.casinos where id = 'cc000003-0000-0000-0000-000000000003')
     or not exists (select 1 from public.casinos where id = 'a1b2c3d4-0000-0000-0000-000000000001') then
    raise exception 'UAT-OP-5S self-exclusion seed: expected Demo casinos absent — refusing to run outside Demo (uexdjngogzunjxkpxwll).';
  end if;
end $$;

with casino as (
  select id as casino_id, row_number() over (order by name) as ord
  from public.casinos
),
tpl (rec, status, exclusion_type, duration_type, duration_days, start_off, end_off, breach_count, reason) as (
  values
    (1, 'active',   'self',               'temporary',  90,   30,  -60, 0, 'Player-requested self-exclusion (synthetic demo)'),
    (2, 'active',   'operator_initiated', 'indefinite', null, 12,  null, 0, 'Responsible gambling exclusion (synthetic demo)'),
    (3, 'expired',  'self',               'temporary',  180,  210, 25,  0, 'Cooling-off period completed (synthetic demo)'),
    (4, 'lifted',   'self',               'temporary',  120,  150, 40,  0, 'Self-exclusion lifted after compliance review (synthetic demo)'),
    (5, 'breached', 'self',               'permanent',  null, 70,  null, 2, 'Attempted re-entry during exclusion (synthetic demo)')
)
insert into public.self_exclusions
  (id, casino_id, player_id, player_token, exclusion_type, duration_type, duration_days,
   starts_at, ends_at, status, breach_count, reason, notes, created_at, updated_at)
select
  ('5eb0' || lpad(to_hex(c.ord), 4, '0') || '-0000-4000-b000-' || lpad(to_hex(t.rec), 12, '0'))::uuid,
  c.casino_id,
  null,
  'SB-DEMO-SEXCL-C' || c.ord || '-' || lpad(t.rec::text, 2, '0'),
  t.exclusion_type, t.duration_type, t.duration_days,
  now() - (t.start_off || ' days')::interval,
  case when t.end_off is null then null else now() - (t.end_off || ' days')::interval end,
  t.status, t.breach_count, t.reason, 'Synthetic demonstration record.',
  now() - (t.start_off || ' days')::interval,
  now() - (coalesce(t.end_off, 2) || ' days')::interval
from casino c cross join tpl t
on conflict (id) do nothing;

-- Post-seed coverage flag (Phase 11): report any Demo casino below 4 records.
do $$
declare low text;
begin
  select string_agg(c.name, ', ') into low
  from public.casinos c
  where (select count(*) from public.self_exclusions s where s.casino_id = c.id) < 4;
  if low is not null then
    raise notice 'UAT-OP-5S: Demo casinos with < 4 self-exclusion records: %', low;
  else
    raise notice 'UAT-OP-5S: every Demo casino has >= 4 synthetic self-exclusion records.';
  end if;
end $$;
