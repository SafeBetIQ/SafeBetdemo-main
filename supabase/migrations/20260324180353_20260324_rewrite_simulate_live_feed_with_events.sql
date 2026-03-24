/*
  # Rewrite simulate_live_feed() to emit live_events and update machine_activity

  ## Changes
  1. simulate_live_feed() now:
     - Ends/starts gaming sessions (existing logic preserved)
     - Inserts rows into live_events for each active session bet tick
     - Updates machine_activity to reflect active/idle machines
     - Writes a live_kpi_snapshot each tick

  2. This makes Supabase Realtime actually fire for:
     - live_events INSERT → CasinoDataContext betting feed
     - machine_activity UPDATE → MachineMonitor

  3. Realistic event generation:
     - Game type specific bet sizes & velocities
     - Risk flags assigned probabilistically (loss_chasing, excessive_time, bet_escalation)
     - Outcome (win/loss/push/active) per house edge
     - machine_id assigned and tracked per session
*/

CREATE OR REPLACE FUNCTION simulate_live_feed()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ended_count     int := 0;
  v_tmp_count       int := 0;
  v_started_count   int := 0;
  v_updated_count   int := 0;
  v_event_count     int := 0;
  v_casino          record;
  v_target_live     int;
  v_current_live    int;
  v_deficit         int;

  v_edges           jsonb := '{
    "slots":     0.055,
    "blackjack": 0.005,
    "roulette":  0.027,
    "poker":     0.030,
    "baccarat":  0.012
  }'::jsonb;

  v_bet_rates       jsonb := '{
    "slots":     12,
    "blackjack":  4,
    "roulette":   3,
    "poker":      2,
    "baccarat":   5
  }'::jsonb;

  v_bet_sizes       jsonb := '{
    "slots":     50,
    "blackjack": 300,
    "roulette":  175,
    "poker":     400,
    "baccarat":  225
  }'::jsonb;

  v_machine_types   text[] := ARRAY['slot','slot','slot','table','rng','live_dealer'];

BEGIN

  -- ================================================================
  -- STEP 1: Force-end sessions > 4 hours (casino floor limits)
  -- ================================================================
  UPDATE gaming_sessions
  SET is_active = false,
      end_time  = NOW(),
      duration  = EXTRACT(EPOCH FROM (NOW() - start_time))::int / 60
  WHERE is_active = true
    AND start_time < NOW() - INTERVAL '4 hours';
  GET DIAGNOSTICS v_ended_count = ROW_COUNT;

  -- Natural churn: ~2% per tick
  WITH churned AS (
    SELECT id FROM gaming_sessions
    WHERE is_active = true AND random() < 0.02
  )
  UPDATE gaming_sessions gs
  SET is_active = false,
      end_time  = NOW(),
      duration  = EXTRACT(EPOCH FROM (NOW() - gs.start_time))::int / 60
  FROM churned c WHERE gs.id = c.id;
  GET DIAGNOSTICS v_tmp_count = ROW_COUNT;
  v_ended_count := v_ended_count + v_tmp_count;

  -- ================================================================
  -- STEP 2: Update player stats for sessions that just ended
  -- ================================================================
  UPDATE players p
  SET session_count        = session_count + 1,
      total_wagered        = total_wagered + gs.total_wagered,
      total_won            = total_won + gs.total_won,
      avg_session_duration = CASE
        WHEN session_count = 0 THEN gs.duration
        ELSE (avg_session_duration * session_count + gs.duration) / (session_count + 1)
      END,
      updated_at           = NOW()
  FROM gaming_sessions gs
  WHERE gs.player_id = p.id
    AND gs.is_active  = false
    AND gs.end_time  >= NOW() - INTERVAL '2 minutes'
    AND gs.end_time IS NOT NULL;

  -- ================================================================
  -- STEP 3: Start new sessions to maintain ~10% live rate
  -- ================================================================
  FOR v_casino IN
    SELECT c.id AS casino_id,
           COUNT(DISTINCT p.id) AS total_players,
           COUNT(DISTINCT gs.player_id) FILTER (WHERE gs.is_active = true) AS live_players
    FROM casinos c
    JOIN players p ON p.casino_id = c.id AND p.status = 'active' AND p.is_active = true
    LEFT JOIN gaming_sessions gs ON gs.casino_id = c.id AND gs.is_active = true
    GROUP BY c.id
  LOOP
    v_target_live  := ROUND(v_casino.total_players * (0.09 + random() * 0.02));
    v_current_live := v_casino.live_players;
    v_deficit      := GREATEST(0, v_target_live - v_current_live);

    IF v_deficit > 0 THEN
      INSERT INTO gaming_sessions (
        id, player_id, casino_id, game_type,
        start_time, end_time, duration,
        total_bets, total_wagered, total_won, net_result,
        risk_score_change, is_active, created_at
      )
      SELECT
        gen_random_uuid(), p.id, p.casino_id,
        (ARRAY['slots','blackjack','roulette','poker','baccarat'])[1 + floor(random()*5)::int],
        NOW() - (random() * INTERVAL '15 minutes'),
        NULL, 0, 0, 0, 0, 0, 0, true, NOW()
      FROM players p
      WHERE p.casino_id = v_casino.casino_id
        AND p.status = 'active' AND p.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM gaming_sessions gs2
          WHERE gs2.player_id = p.id AND gs2.is_active = true
        )
      ORDER BY random()
      LIMIT v_deficit;
      GET DIAGNOSTICS v_tmp_count = ROW_COUNT;
      v_started_count := v_started_count + v_tmp_count;
    END IF;
  END LOOP;

  -- ================================================================
  -- STEP 4: Simulate bets for 65% of active sessions + emit live_events
  -- ================================================================
  WITH active_sessions AS (
    SELECT gs.id, gs.player_id, gs.casino_id, gs.game_type,
           gs.total_wagered, gs.total_won, gs.total_bets,
           gs.risk_score_change,
           p.first_name || ' ' || p.last_name AS player_name,
           p.risk_score AS player_risk
    FROM gaming_sessions gs
    JOIN players p ON p.id = gs.player_id
    WHERE gs.is_active = true AND random() < 0.65
  ),
  activity AS (
    SELECT
      s.*,
      -- machine assignment: deterministic from player+casino
      'M-' || LPAD((ABS(hashtext(s.player_id::text || s.casino_id::text)) % 80 + 1)::text, 3, '0') AS machine_id,
      v_machine_types[1 + (ABS(hashtext(s.player_id::text)) % array_length(v_machine_types, 1))] AS machine_type,
      GREATEST(1, ROUND((v_bet_rates->>s.game_type)::numeric * (0.5 + random())))::int AS new_bets,
      GREATEST(1, ROUND(
        (v_bet_sizes->>s.game_type)::numeric * (0.8 + random()*0.4)
      ))::numeric AS bet_amt,
      -- win/loss outcome per house edge
      (random() > (v_edges->>s.game_type)::numeric * 3) AS is_win,
      -- risk flags
      (s.total_wagered > 3000 AND s.total_won < s.total_wagered * 0.4) AS flag_loss_chasing,
      (EXTRACT(EPOCH FROM NOW() - (NOW() - INTERVAL '90 minutes')) > 5400) AS flag_excessive_time,
      (s.total_bets > 50 AND s.total_wagered > 5000) AS flag_bet_escalation,
      -- risk score
      LEAST(100, GREATEST(0,
        s.player_risk
        + CASE WHEN s.total_wagered > 3000 AND s.total_won < s.total_wagered * 0.4 THEN 8 ELSE 0 END
        + CASE WHEN s.total_bets > 50 THEN 5 ELSE 0 END
        + floor(random() * 10)::int
      )) AS computed_risk
    FROM active_sessions s
  )
  INSERT INTO live_events (
    id, event_id, event_type, casino_id, player_id, session_id,
    game_id, machine_id, bet_amount, win_amount, balance_after,
    duration_seconds, risk_score, risk_flags, outcome,
    game_type, is_simulated, metadata, created_at
  )
  SELECT
    gen_random_uuid(),
    gen_random_uuid(),
    'BET_PLACED',
    a.casino_id,
    a.player_id::text,
    a.id::text,
    'GAME-' || upper(a.game_type) || '-' || (floor(random()*100+1)::int)::text,
    a.machine_id,
    a.bet_amt,
    CASE WHEN a.is_win THEN ROUND(a.bet_amt * (1.5 + random()*1.5)) ELSE 0 END,
    NULL,
    EXTRACT(EPOCH FROM NOW() - (SELECT start_time FROM gaming_sessions WHERE id = a.id))::int,
    a.computed_risk,
    (
      CASE WHEN a.flag_loss_chasing THEN '["loss_chasing"' ELSE '[]' END ||
      CASE WHEN a.flag_loss_chasing AND a.flag_bet_escalation THEN ',"bet_escalation"' ELSE '' END ||
      CASE WHEN a.flag_loss_chasing AND a.flag_excessive_time THEN ',"excessive_time"' ELSE '' END ||
      CASE WHEN a.flag_loss_chasing THEN ']' ELSE '' END
    )::jsonb,
    CASE WHEN a.is_win THEN 'win' ELSE 'loss' END,
    a.game_type,
    true,
    jsonb_build_object(
      'player_name', a.player_name,
      'session_bets', a.new_bets,
      'game_type', a.game_type
    ),
    NOW() - (random() * INTERVAL '30 seconds')
  FROM activity a;

  GET DIAGNOSTICS v_event_count = ROW_COUNT;

  -- ================================================================
  -- STEP 5: Update gaming_sessions with new bet totals
  -- ================================================================
  UPDATE gaming_sessions gs
  SET total_bets    = gs.total_bets + activity.new_bets,
      total_wagered = gs.total_wagered + activity.new_wagered,
      total_won     = gs.total_won + activity.new_won,
      net_result    = (gs.total_won + activity.new_won) - (gs.total_wagered + activity.new_wagered),
      duration      = EXTRACT(EPOCH FROM (NOW() - gs.start_time))::int / 60,
      risk_score_change = CASE
        WHEN (gs.total_wagered + activity.new_wagered) > 5000
             AND (gs.total_won + activity.new_won) < (gs.total_wagered + activity.new_wagered) * 0.5
        THEN LEAST(gs.risk_score_change + 1, 20)
        ELSE gs.risk_score_change
      END
  FROM (
    SELECT id, game_type,
      GREATEST(1, ROUND((v_bet_rates->>game_type)::numeric * (0.5 + random())))::int AS new_bets,
      GREATEST(1, ROUND((v_bet_sizes->>game_type)::numeric * (0.8 + random()*0.4)))::numeric AS new_wagered,
      GREATEST(0, ROUND((v_bet_sizes->>game_type)::numeric * (0.8 + random()*0.4) *
        (1.0 - (v_edges->>game_type)::numeric) * (0.4 + random()*1.2)))::numeric AS new_won
    FROM gaming_sessions
    WHERE is_active = true AND random() < 0.65
  ) activity
  WHERE gs.id = activity.id;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- ================================================================
  -- STEP 6: Upsert machine_activity based on active sessions
  -- ================================================================
  INSERT INTO machine_activity (
    id, casino_id, machine_id, machine_type,
    current_player_id, session_start, status,
    spins_per_minute, current_risk_score, total_wagered_session,
    is_simulated, updated_at, created_at
  )
  SELECT
    gen_random_uuid(),
    gs.casino_id,
    'M-' || LPAD((ABS(hashtext(gs.player_id::text || gs.casino_id::text)) % 80 + 1)::text, 3, '0'),
    v_machine_types[1 + (ABS(hashtext(gs.player_id::text)) % array_length(v_machine_types, 1))],
    gs.player_id::text,
    gs.start_time,
    'active',
    ROUND(((v_bet_rates->>gs.game_type)::numeric * (0.7 + random()*0.6))::numeric, 1),
    LEAST(100, GREATEST(0, p.risk_score + floor(random()*15)::int)),
    gs.total_wagered,
    true,
    NOW(),
    NOW()
  FROM gaming_sessions gs
  JOIN players p ON p.id = gs.player_id
  WHERE gs.is_active = true
  ON CONFLICT (casino_id, machine_id)
  DO UPDATE SET
    current_player_id   = EXCLUDED.current_player_id,
    status              = 'active',
    spins_per_minute    = EXCLUDED.spins_per_minute,
    current_risk_score  = EXCLUDED.current_risk_score,
    total_wagered_session = EXCLUDED.total_wagered_session,
    updated_at          = NOW();

  -- Set machines not in active sessions to idle
  UPDATE machine_activity ma
  SET status     = 'idle',
      updated_at = NOW()
  WHERE ma.casino_id IN (SELECT id FROM casinos)
    AND NOT EXISTS (
      SELECT 1 FROM gaming_sessions gs
      WHERE gs.is_active = true
        AND 'M-' || LPAD((ABS(hashtext(gs.player_id::text || gs.casino_id::text)) % 80 + 1)::text, 3, '0') = ma.machine_id
        AND gs.casino_id = ma.casino_id
    )
    AND ma.status = 'active';

  -- ================================================================
  -- STEP 7: Write KPI snapshot per casino
  -- ================================================================
  INSERT INTO live_kpi_snapshots (
    id, casino_id, snapshot_at,
    active_players, events_per_min,
    total_wagered, total_won, ggr, avg_bet_size,
    risk_critical, risk_high, risk_medium, risk_low,
    active_machines, is_simulated, created_at
  )
  SELECT
    gen_random_uuid(),
    le.casino_id,
    NOW(),
    COUNT(DISTINCT le.player_id),
    COUNT(*),
    SUM(le.bet_amount),
    SUM(le.win_amount),
    SUM(le.bet_amount) - SUM(le.win_amount),
    AVG(le.bet_amount),
    COUNT(*) FILTER (WHERE le.risk_score >= 80),
    COUNT(*) FILTER (WHERE le.risk_score >= 60 AND le.risk_score < 80),
    COUNT(*) FILTER (WHERE le.risk_score >= 40 AND le.risk_score < 60),
    COUNT(*) FILTER (WHERE le.risk_score < 40),
    (SELECT COUNT(*) FROM machine_activity ma WHERE ma.casino_id = le.casino_id AND ma.status = 'active'),
    true,
    NOW()
  FROM live_events le
  WHERE le.created_at >= NOW() - INTERVAL '1 minute'
  GROUP BY le.casino_id;

  -- ================================================================
  -- STEP 8: Propagate risk scores to players
  -- ================================================================
  UPDATE players p
  SET risk_score = LEAST(100, GREATEST(0,
        p.risk_score + COALESCE((
          SELECT SUM(gs.risk_score_change)
          FROM gaming_sessions gs
          WHERE gs.player_id = p.id AND gs.is_active = true AND gs.risk_score_change > 0
          LIMIT 1
        ), 0)
      )),
      risk_level = CASE
        WHEN LEAST(100, p.risk_score + 5) >= 75 THEN 'critical'
        WHEN LEAST(100, p.risk_score + 5) >= 50 THEN 'high'
        WHEN LEAST(100, p.risk_score + 5) >= 25 THEN 'medium'
        ELSE 'low'
      END,
      last_active = NOW(),
      updated_at  = NOW()
  WHERE EXISTS (
    SELECT 1 FROM gaming_sessions gs WHERE gs.player_id = p.id AND gs.is_active = true
  );

  -- Cleanup old live_events (keep last 24h only to prevent table bloat)
  DELETE FROM live_events WHERE created_at < NOW() - INTERVAL '24 hours';

  RETURN jsonb_build_object(
    'tick_at',          NOW(),
    'sessions_ended',   v_ended_count,
    'sessions_started', v_started_count,
    'sessions_updated', v_updated_count,
    'events_emitted',   v_event_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION simulate_live_feed() TO service_role;
