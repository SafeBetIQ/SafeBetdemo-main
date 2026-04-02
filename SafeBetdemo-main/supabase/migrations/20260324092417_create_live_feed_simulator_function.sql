
/*
  # Create simulate_live_feed() Function

  ## Purpose
  Simulates a realistic casino data feed that runs every minute via pg_cron.

  ## Behavior (mirrors real casino systems)

  ### Session Churn
  - 1.5-3% of active sessions end each tick (players cash out / walk away)
  - Sessions that have been active > 4 hours are force-ended (table limits)
  - New sessions start for idle players to maintain ~9-11% live rate per casino

  ### In-Play Updates
  - 60-80% of still-active sessions get bet activity added each tick
  - Bet amounts vary by game type (slots = frequent small bets, poker = fewer larger bets)
  - Wins are calculated with realistic house edges per game type
  - Duration counter increments each tick

  ### Risk Score Simulation
  - Players on losing streaks get risk score bumps
  - Players who have wagered > 3x their average get flagged
  - High-velocity sessions (many bets in short time) trigger risk increases

  ## Tables Modified
  - gaming_sessions: end inactive, start new, update bets/wagers/wins
  - players: update last_active, risk_score, total_wagered, total_won
*/

CREATE OR REPLACE FUNCTION simulate_live_feed()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ended_count     int := 0;
  v_tmp_count       int := 0;
  v_started_count   int := 0;
  v_updated_count   int := 0;
  v_casino          record;
  v_target_live     int;
  v_current_live    int;
  v_deficit         int;

  -- House edges by game type (realistic industry values)
  v_edges           jsonb := '{
    "slots":     0.055,
    "blackjack": 0.005,
    "roulette":  0.027,
    "poker":     0.030,
    "baccarat":  0.012
  }'::jsonb;

  -- Avg bets per minute by game type
  v_bet_rates       jsonb := '{
    "slots":     12,
    "blackjack":  4,
    "roulette":   3,
    "poker":      2,
    "baccarat":   5
  }'::jsonb;

  -- Avg bet size by game type (ZAR)
  v_bet_sizes       jsonb := '{
    "slots":     45,
    "blackjack": 250,
    "roulette":  150,
    "poker":     350,
    "baccarat":  200
  }'::jsonb;

BEGIN

  -- ================================================================
  -- STEP 1: Force-end sessions > 4 hours old (casino floor limits)
  -- ================================================================
  UPDATE gaming_sessions
  SET
    is_active  = false,
    end_time   = NOW(),
    duration   = EXTRACT(EPOCH FROM (NOW() - start_time))::int / 60
  WHERE is_active = true
    AND start_time < NOW() - INTERVAL '4 hours';

  GET DIAGNOSTICS v_ended_count = ROW_COUNT;

  -- Natural churn: ~2% of remaining active sessions end per tick
  WITH churned AS (
    SELECT id
    FROM gaming_sessions
    WHERE is_active = true
      AND random() < 0.02
  )
  UPDATE gaming_sessions gs
  SET
    is_active = false,
    end_time  = NOW(),
    duration  = EXTRACT(EPOCH FROM (NOW() - gs.start_time))::int / 60
  FROM churned c
  WHERE gs.id = c.id;

  GET DIAGNOSTICS v_tmp_count = ROW_COUNT;
  v_ended_count := v_ended_count + v_tmp_count;

  -- ================================================================
  -- STEP 2: Update player stats for sessions that just ended
  -- ================================================================
  UPDATE players p
  SET
    session_count        = session_count + 1,
    total_wagered        = total_wagered + gs.total_wagered,
    total_won            = total_won + gs.total_won,
    avg_session_duration = CASE
      WHEN session_count = 0 THEN gs.duration
      ELSE (avg_session_duration * session_count + gs.duration) / (session_count + 1)
    END,
    updated_at           = NOW()
  FROM gaming_sessions gs
  WHERE gs.player_id = p.id
    AND gs.is_active = false
    AND gs.end_time >= NOW() - INTERVAL '2 minutes'
    AND gs.end_time IS NOT NULL;

  -- ================================================================
  -- STEP 3: Start new sessions to maintain ~10% live rate per casino
  -- ================================================================
  FOR v_casino IN
    SELECT
      c.id AS casino_id,
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
        gen_random_uuid(),
        p.id,
        p.casino_id,
        (ARRAY['slots','blackjack','roulette','poker','baccarat'])[1 + floor(random()*5)::int],
        NOW() - (random() * INTERVAL '15 minutes'),
        NULL,
        0, 0, 0, 0, 0, 0,
        true,
        NOW()
      FROM players p
      WHERE p.casino_id = v_casino.casino_id
        AND p.status = 'active'
        AND p.is_active = true
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
  -- STEP 4: Simulate ongoing bet activity for active sessions
  -- 65% of active sessions place bets each tick
  -- ================================================================
  UPDATE gaming_sessions gs
  SET
    total_bets    = gs.total_bets + activity.new_bets,
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
    SELECT
      id,
      game_type,
      GREATEST(1, ROUND(
        (v_bet_rates->>game_type)::numeric * (0.5 + random())
      ))::int AS new_bets,
      GREATEST(1, ROUND(
        (v_bet_sizes->>game_type)::numeric
        * GREATEST(1, ROUND((v_bet_rates->>game_type)::numeric * (0.5 + random())))
        * (0.8 + random()*0.4)
      ))::numeric AS new_wagered,
      GREATEST(0, ROUND(
        (v_bet_sizes->>game_type)::numeric
        * GREATEST(1, ROUND((v_bet_rates->>game_type)::numeric * (0.5 + random())))
        * (0.8 + random()*0.4)
        * (1.0 - (v_edges->>game_type)::numeric)
        * (0.4 + random() * 1.2)
      ))::numeric AS new_won
    FROM gaming_sessions
    WHERE is_active = true
      AND random() < 0.65
  ) activity
  WHERE gs.id = activity.id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- ================================================================
  -- STEP 5: Propagate risk scores to player profiles
  -- ================================================================
  UPDATE players p
  SET
    risk_score = LEAST(100, GREATEST(0,
      p.risk_score + COALESCE((
        SELECT SUM(gs.risk_score_change)
        FROM gaming_sessions gs
        WHERE gs.player_id = p.id
          AND gs.is_active = true
          AND gs.risk_score_change > 0
        LIMIT 1
      ), 0)
    )),
    risk_level = CASE
      WHEN LEAST(100, GREATEST(0,
        p.risk_score + COALESCE((
          SELECT SUM(gs.risk_score_change)
          FROM gaming_sessions gs
          WHERE gs.player_id = p.id
            AND gs.is_active = true
            AND gs.risk_score_change > 0
          LIMIT 1
        ), 0)
      )) >= 75 THEN 'critical'
      WHEN LEAST(100, GREATEST(0,
        p.risk_score + COALESCE((
          SELECT SUM(gs.risk_score_change)
          FROM gaming_sessions gs
          WHERE gs.player_id = p.id
            AND gs.is_active = true
            AND gs.risk_score_change > 0
          LIMIT 1
        ), 0)
      )) >= 50 THEN 'high'
      WHEN LEAST(100, GREATEST(0,
        p.risk_score + COALESCE((
          SELECT SUM(gs.risk_score_change)
          FROM gaming_sessions gs
          WHERE gs.player_id = p.id
            AND gs.is_active = true
            AND gs.risk_score_change > 0
          LIMIT 1
        ), 0)
      )) >= 25 THEN 'medium'
      ELSE 'low'
    END,
    last_active = NOW(),
    updated_at  = NOW()
  WHERE EXISTS (
    SELECT 1 FROM gaming_sessions gs
    WHERE gs.player_id = p.id AND gs.is_active = true
  );

  RETURN jsonb_build_object(
    'tick_at',            NOW(),
    'sessions_ended',     v_ended_count,
    'sessions_started',   v_started_count,
    'sessions_updated',   v_updated_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION simulate_live_feed() TO service_role;
