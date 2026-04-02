/*
  # Seed Active Sessions for Live Monitor v3

  Seeds 50 active gaming sessions per casino with full behavioral risk profiles.
  Uses only valid game types from the check constraint.
*/

-- Step 1: Close all stale active sessions
UPDATE gaming_sessions
SET is_active = false, end_time = now()
WHERE is_active = true;

-- Step 2: Create 50 active sessions per casino with risk profiles
DO $$
DECLARE
  v_casino_id uuid;
  v_player_id uuid;
  v_session_id uuid;
  v_risk_score int;
  v_loss int;
  v_session_dur int;
  v_deposit int;
  v_bet int;
  v_cross int;
  v_cross_flags int;
  v_game_types text[] := ARRAY['slots','blackjack','roulette','poker','baccarat'];
  v_emotional_states text[] := ARRAY['Calm','Focused','Agitated','Anxious','Frustrated'];
  casino_ids uuid[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT casino_id) INTO casino_ids FROM players;

  FOREACH v_casino_id IN ARRAY casino_ids LOOP
    FOR i IN 1..50 LOOP
      SELECT id INTO v_player_id
      FROM players
      WHERE casino_id = v_casino_id
      ORDER BY random()
      LIMIT 1;

      CONTINUE WHEN v_player_id IS NULL;

      v_risk_score  := (30 + floor(random() * 65))::int;
      v_loss        := LEAST(100, GREATEST(0, v_risk_score + floor((random() * 20) - 5)::int));
      v_session_dur := LEAST(100, GREATEST(0, v_risk_score + floor((random() * 15) - 8)::int));
      v_deposit     := LEAST(100, GREATEST(0, v_risk_score + floor((random() * 18) - 9)::int));
      v_bet         := LEAST(100, GREATEST(0, v_risk_score + floor((random() * 12) - 6)::int));
      v_cross       := CASE WHEN v_risk_score >= 70 THEN floor(30 + random() * 50)::int ELSE floor(random() * 30)::int END;
      v_cross_flags := CASE WHEN v_cross >= 50 THEN floor(1 + random() * 3)::int ELSE 0 END;

      INSERT INTO gaming_sessions (
        player_id, casino_id, game_type, start_time,
        end_time, duration, total_bets, total_wagered,
        total_won, net_result, risk_score_change, is_active, created_at
      ) VALUES (
        v_player_id,
        v_casino_id,
        v_game_types[1 + (floor(random() * 5))::int],
        now() - (floor(random() * 180) || ' minutes')::interval,
        NULL,
        floor(random() * 180)::int,
        floor(10 + random() * 200)::int,
        round((50 + random() * 5000)::numeric, 2),
        round((random() * 4000)::numeric, 2),
        round((-2500 + random() * 5000)::numeric, 2),
        CASE WHEN v_risk_score >= 70 THEN floor(random() * 20)::int ELSE floor(-5 + random() * 10)::int END,
        true,
        now()
      ) RETURNING id INTO v_session_id;

      INSERT INTO behavioral_risk_profiles (
        player_id, session_id, casino_id,
        risk_score, risk_level,
        session_duration_score, deposit_frequency_score,
        loss_escalation_score, bet_intensity_score, cross_operator_score,
        cross_operator_flags,
        impulse_level, betting_velocity,
        session_duration_minutes, reaction_time_ms, fatigue_index,
        personality_shift_score,
        emotional_state, advised_break, intervention_triggered,
        intervention_accepted,
        sessions_analyzed, deposits_analyzed,
        risk_rationale, analyzed_at, created_at, updated_at
      ) VALUES (
        v_player_id, v_session_id, v_casino_id,
        v_risk_score,
        CASE
          WHEN v_risk_score >= 80 THEN 'critical'
          WHEN v_risk_score >= 60 THEN 'high'
          WHEN v_risk_score >= 40 THEN 'moderate'
          ELSE 'low'
        END,
        v_session_dur, v_deposit, v_loss, v_bet, v_cross,
        v_cross_flags,
        round((v_risk_score * 0.9 + random() * 10)::numeric, 1),
        round((2 + random() * 18)::numeric, 1),
        floor(15 + random() * 165)::int,
        floor(800 + random() * 1200)::int,
        round((v_risk_score * 0.7 / 100)::numeric, 2),
        round((v_risk_score * 0.8 + random() * 15)::numeric, 1),
        v_emotional_states[1 + (floor(random() * 5))::int],
        v_risk_score >= 70,
        v_risk_score >= 80,
        CASE WHEN v_risk_score >= 80 THEN random() > 0.4 ELSE false END,
        floor(3 + random() * 20)::int,
        floor(1 + random() * 8)::int,
        CASE
          WHEN v_risk_score >= 80 THEN 'Critical risk: sustained loss escalation pattern with rapid deposit cycling and extended session duration'
          WHEN v_risk_score >= 60 THEN 'High risk: elevated bet intensity with multiple loss-recovery attempts detected'
          WHEN v_risk_score >= 40 THEN 'Moderate risk: session extending beyond normal baseline; deposit frequency elevated'
          ELSE 'Low risk: behavioural patterns within normal parameters'
        END,
        now() - (floor(random() * 10) || ' minutes')::interval,
        now(),
        now()
      );

    END LOOP;
  END LOOP;
END $$;
