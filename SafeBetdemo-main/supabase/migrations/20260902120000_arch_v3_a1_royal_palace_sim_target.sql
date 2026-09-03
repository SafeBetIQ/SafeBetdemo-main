-- ─── ARCH-V3-A1 — Royal Palace synthetic stake range (Demo presentation band) ──
-- Lifts Royal Palace's Demo live-simulator STAKE range (bet_min 40 → 60, bet_max
-- 700 → 1080) so its event-derived daily GGR reaches the Demo presentation band
-- (~R100k–R500k) like every other Demo casino. Royal Palace stays the SMALLEST
-- operator by active-player count (fewest registered) — the lever here is stake
-- size, not player volume, so the tick's event COUNT (and compute load) is
-- unchanged; only the per-bet amounts rise.
--
-- How this reaches the band (arithmetic reference, nothing hard-coded here):
--   sbiq_demo_live_tick draws bet = bmin + random()*(bmax-bmin) and
--   win = bet * ~0.72, so certified GGR = Σ(bet - win) scales with the average
--   bet (bmin+bmax)/2. 40/700 (avg 370) → 60/1080 (avg 570) ≈ ×1.54, lifting
--   Royal Palace from ~R74k/day into the band. GGR is NOT written or computed
--   here; revenue continues to arise from generated wager/win events through the
--   certified pipeline (GGR = stakes − winnings), entirely unchanged.
--
-- Safety:
--   * DEMO-ONLY GUARD — aborts unless the known Royal Palace Demo casino exists, so
--     it cannot run against the unrelated Production database.
--   * Narrow — a single UPDATE of one existing sbiq_demo_sim_config row. No schema,
--     RLS, grant, function, or privilege change. Reversible (restore 40/700).
--   * Idempotent — re-running sets the same values.

do $$
begin
  if not exists (
    select 1 from public.casinos where id = 'cc000005-0000-0000-0000-000000000005'
  ) then
    raise exception 'ARCH-V3-A1 Royal Palace bet range: Royal Palace Demo casino absent — refusing to run outside Demo (uexdjngogzunjxkpxwll).';
  end if;
end $$;

update public.sbiq_demo_sim_config
   set bet_min    = 60,
       bet_max    = 1080,
       updated_at = now()
 where casino_id = 'cc000005-0000-0000-0000-000000000005';

do $$
declare v_min numeric; v_max numeric;
begin
  select bet_min, bet_max into v_min, v_max
    from public.sbiq_demo_sim_config
   where casino_id = 'cc000005-0000-0000-0000-000000000005';
  raise notice 'ARCH-V3-A1: Royal Palace synthetic bet range now %/% (was 40/700); active-player targets unchanged.', v_min, v_max;
end $$;
