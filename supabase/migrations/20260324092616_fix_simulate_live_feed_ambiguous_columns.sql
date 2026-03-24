
/*
  # Fix simulate_live_feed() - Resolve Ambiguous Column References

  Fixes "column reference is ambiguous" errors in the player stats update
  step by fully qualifying all column references with table aliases.
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

  v_edges     jsonb := '{"slots":0.055,"blackjack":0.005,"roulette":0.027,"poker":0.030,"baccarat":0.012}'::jsonb;
  v_bet_rates jsonb := '{"slots":12,"blackjack":4,"roulette":3,"poker":2,"baccarat":5}'::jsonb;
  v_bet_sizes jsonb := '{"slots":45,"blackjack":250,"roulette":150,"poker":350,"baccarat":200}'::jsonb;

BEGIN

  -- ================================================================
  -- STEP 1: Force-end sessions > 4 hours old
  -- ================================================================
  UPDATE gaming_sessions gs1
  SET
    is_active = false,
    end_time  = NOW(),
    duration  = EXTRACT(EPOCH FROM (NOW() - gs1.start_time))::int / 60
  WHERE gs1.is_active = true
    AND gs1.start_time < NOW() - INTERVAL '4 hours';

  GET DIAGNOSTICS v_ended_count = ROW_COUNT;

  -- Natural churn: ~2% of remaining active sessions end per tick
  WITH churned AS (
    SELECT gs2.id
    FROM gaming_sessions gs2
    WHERE gs2.is_active = true
      AND random() < 0.02
  )
  UPDATE gaming_sessions gs3
  SET
    is_active = false,
    end_time  = NOW(),
    duration  = EXTRACT(EPOCH FROM (NOW() - gs3.start_time))::int / 60
  FROM churned c
  WHERE gs3.id = c.id;

  GET DIAGNOSTICS v_tmp_count = ROW_COUNT;
  v_ended_count := v_ended_count + v_tmp_count;

  -- ================================================================
  -- STEP 2: Update player stats for sessions that just ended
  -- ================================================================
  UPDATE players p
  SET
    session_count        = p.session_count + 1,
    total_wagered        = p.total_wagered + gs.total_wagered,
    total_won            = p.total_won + gs.total_won,
    avg_session_duration = CASE
      WHEN p.session_count = 0 THEN gs.duration
      ELSE (p.avg_session_duration * p.session_count + gs.duration) / (p.session_count + 1)
    END,
    updated_at = NOW()
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
      COUNT(DISTINCT p2.id) AS total_players,
      COUNT(DISTINCT gs4.player_id) FILTER (WHERE gs4.is_active = true) AS live_players
    FROM casinos c
    JOIN players p2 ON p2.casino_id = c.id AND p2.status = 'active' AND p2.is_active = true
    LEFT JOIN gaming_sessions gs4 ON gs4.casino_id = c.id AND gs4.is_active = true
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
        p3.id,
        p3.casino_id,
        (ARRAY['slots','blackjack','roulette','poker','baccarat'])[1 + floor(random()*5)::int],
        NOW() - (random() * INTERVAL '15 minutes'),
        NULL,
        0, 0, 0, 0, 0, 0,
        true,
        NOW()
      FROM players p3
      WHERE p3.casino_id = v_casino.casino_id
        AND p3.status = 'active'
        AND p3.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM gaming_sessions gs5
          WHERE gs5.player_id = p3.id AND gs5.is_active = true
        )
      ORDER BY random()
      LIMIT v_deficit;

      GET DIAGNOSTICS v_tmp_count = ROW_COUNT;
      v_started_count := v_started_count + v_tmp_count;
    END IF;
  END LOOP;

  -- ================================================================
  -- STEP 4: Simulate bet activity for 65% of active sessions
  -- ================================================================
  UPDATE gaming_sessions gs6
  SET
    total_bets    = gs6.total_bets + activity.new_bets,
    total_wagered = gs6.total_wagered + activity.new_wagered,
    total_won     = gs6.total_won + activity.new_won,
    net_result    = (gs6.total_won + activity.new_won) - (gs6.total_wagered + activity.new_wagered),
    duration      = EXTRACT(EPOCH FROM (NOW() - gs6.start_time))::int / 60,
    risk_score_change = CASE
      WHEN (gs6.total_wagered + activity.new_wagered) > 5000
           AND (gs6.total_won + activity.new_won) < (gs6.total_wagered + activity.new_wagered) * 0.5
      THEN LEAST(gs6.risk_score_change + 1, 20)
      ELSE gs6.risk_score_change
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
  WHERE gs6.id = activity.id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- ================================================================
  -- STEP 5: Propagate risk scores to player profiles
  -- ================================================================
  UPDATE players p4
  SET
    risk_score = LEAST(100, GREATEST(0,
      p4.risk_score + COALESCE((
        SELECT SUM(gs7.risk_score_change)
        FROM gaming_sessions gs7
        WHERE gs7.player_id = p4.id
          AND gs7.is_active = true
          AND gs7.risk_score_change > 0
      ), 0)
    )),
    risk_level = CASE
      WHEN LEAST(100, GREATEST(0,
        p4.risk_score + COALESCE((
          SELECT SUM(gs8.risk_score_change)
          FROM gaming_sessions gs8
          WHERE gs8.player_id = p4.id
            AND gs8.is_active = true
            AND gs8.risk_score_change > 0
        ), 0)
      )) >= 75 THEN 'critical'
      WHEN LEAST(100, GREATEST(0,
        p4.risk_score + COALESCE((
          SELECT SUM(gs9.risk_score_change)
          FROM gaming_sessions gs9
          WHERE gs9.player_id = p4.id
            AND gs9.is_active = true
            AND gs9.risk_score_change > 0
        ), 0)
      )) >= 50 THEN 'high'
      WHEN LEAST(100, GREATEST(0,
        p4.risk_score + COALESCE((
          SELECT SUM(gs10.risk_score_change)
          FROM gaming_sessions gs10
          WHERE gs10.player_id = p4.id
            AND gs10.is_active = true
            AND gs10.risk_score_change > 0
        ), 0)
      )) >= 25 THEN 'medium'
      ELSE 'low'
    END,
    last_active = NOW(),
    updated_at  = NOW()
  WHERE EXISTS (
    SELECT 1 FROM gaming_sessions gs11
    WHERE gs11.player_id = p4.id AND gs11.is_active = true
  );

  RETURN jsonb_build_object(
    'tick_at',          NOW(),
    'sessions_ended',   v_ended_count,
    'sessions_started', v_started_count,
    'sessions_updated', v_updated_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION simulate_live_feed() TO service_role;
