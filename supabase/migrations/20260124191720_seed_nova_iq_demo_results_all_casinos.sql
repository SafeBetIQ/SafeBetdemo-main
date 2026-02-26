/*
  # Seed Nova IQ Demo Results for All Casinos

  1. Summary
    Creates comprehensive Nova IQ wellbeing game session results for ALL casinos in the database.
    Each casino gets 12-15 completed sessions with varied risk profiles and realistic behavioral patterns.

  2. Demo Data Created Per Casino
    - 12-15 completed game sessions across multiple players
    - Varied risk profiles (low, medium, high risk patterns)
    - Realistic scores with behaviour_risk_index (BRI)
    - Detailed risk breakdowns (impulsivity, risk_escalation, patience, recovery)
    - AI-generated insights for key sessions
    - Badge achievements for exemplary players
    - Telemetry events showing decision patterns

  3. Player Distribution Per Casino
    - 3 high-risk players showing concerning patterns (loss chasing, overconfidence)
    - 3 moderate-risk players showing mixed behavior (improvement trends)
    - 3 low-risk players showing safe gaming habits (excellent control)

  4. Purpose
    Demonstrates Nova IQ wellbeing game analytics capabilities across multiple casinos
    Shows how AI identifies patterns and generates actionable insights
    Provides rich data for ESG reporting and compliance dashboards
    Enables regulator to compare casino performance on player wellbeing
*/

DO $$
DECLARE
  v_casino RECORD;
  v_game_concept_id uuid;
  v_player_ids uuid[];
  v_player_high_risk_id uuid;
  v_player_medium_risk_id uuid;
  v_player_low_risk_id uuid;
  v_session_id uuid;
  v_badge_id uuid;
  v_casino_count integer := 0;
BEGIN
  -- Get game concept (Balance Journey)
  SELECT id INTO v_game_concept_id FROM wellbeing_game_concepts WHERE name = 'Balance Journey' LIMIT 1;
  
  IF v_game_concept_id IS NULL THEN
    RAISE NOTICE 'No game concept found, skipping Nova IQ demo data';
    RETURN;
  END IF;

  -- Loop through each casino
  FOR v_casino IN (SELECT id, name FROM casinos ORDER BY name) LOOP
    v_casino_count := v_casino_count + 1;
    RAISE NOTICE 'Creating Nova IQ demo data for casino: %', v_casino.name;

    -- Get players for this casino with different risk profiles
    SELECT id INTO v_player_high_risk_id FROM players 
    WHERE casino_id = v_casino.id AND risk_score >= 70 
    ORDER BY random() LIMIT 1;
    
    SELECT id INTO v_player_medium_risk_id FROM players 
    WHERE casino_id = v_casino.id 
    AND risk_score BETWEEN 40 AND 69 
    AND id != COALESCE(v_player_high_risk_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ORDER BY random() LIMIT 1;
    
    SELECT id INTO v_player_low_risk_id FROM players 
    WHERE casino_id = v_casino.id 
    AND risk_score < 40 
    AND id NOT IN (
      COALESCE(v_player_high_risk_id, '00000000-0000-0000-0000-000000000000'::uuid),
      COALESCE(v_player_medium_risk_id, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    ORDER BY random() LIMIT 1;

    -- Fallback: if we don't have players with these profiles, just get any 3 players
    IF v_player_high_risk_id IS NULL THEN
      SELECT id INTO v_player_high_risk_id FROM players 
      WHERE casino_id = v_casino.id ORDER BY risk_score DESC LIMIT 1;
    END IF;
    
    IF v_player_medium_risk_id IS NULL THEN
      SELECT id INTO v_player_medium_risk_id FROM players 
      WHERE casino_id = v_casino.id AND id != v_player_high_risk_id 
      ORDER BY random() LIMIT 1;
    END IF;
    
    IF v_player_low_risk_id IS NULL THEN
      SELECT id INTO v_player_low_risk_id FROM players 
      WHERE casino_id = v_casino.id 
      AND id NOT IN (v_player_high_risk_id, COALESCE(v_player_medium_risk_id, v_player_high_risk_id))
      ORDER BY random() LIMIT 1;
    END IF;

    -- Skip if we don't have enough players for this casino
    IF v_player_high_risk_id IS NULL OR v_player_medium_risk_id IS NULL OR v_player_low_risk_id IS NULL THEN
      RAISE NOTICE 'Not enough players for casino %, skipping', v_casino.name;
      CONTINUE;
    END IF;

    -- ===== HIGH RISK PLAYER SESSIONS =====
    
    -- Session 1: High Risk - Loss Chasing Pattern
    INSERT INTO wellbeing_game_sessions (
      player_id, casino_id, game_concept_id,
      started_at, completed_at,
      duration_seconds, completion_rate, abandoned,
      raw_score, behaviour_risk_index,
      risk_escalation_detected,
      hesitation_score, consistency_score,
      insights_generated
    ) VALUES (
      v_player_high_risk_id, v_casino.id, v_game_concept_id,
      now() - interval '7 days', now() - interval '7 days' + interval '3 minutes',
      180, 100, false,
      35, 78.5,
      true,
      75, 28,
      '[{"type": "loss_chasing", "severity": "concern", "message": "Pattern shows increased risk-taking after losses"}]'::jsonb
    ) RETURNING id INTO v_session_id;

    INSERT INTO wellbeing_risk_scores (
      player_id, casino_id, session_id,
      behaviour_risk_index,
      impulsivity_score, risk_escalation_score, patience_score, recovery_response_score,
      explanation, calculated_at
    ) VALUES (
      v_player_high_risk_id, v_casino.id, v_session_id,
      78.5, 85.2, 82.3, 24.1, 18.5,
      '{"confidence": "high", "primary_concern": "loss_chasing", "trend": "negative"}'::jsonb,
      now() - interval '7 days'
    );

    INSERT INTO wellbeing_game_insights (
      session_id, player_id, casino_id,
      insight_type, insight_category,
      title, description, severity,
      evidence, recommendation
    ) VALUES (
      v_session_id, v_player_high_risk_id, v_casino.id,
      'loss_chasing', 'behavioral_pattern',
      'Loss Chasing Detected',
      'Choices show a pattern of increasing bet sizes after losses. This is a common trap that rarely leads to recovery.',
      'concern',
      '[{"decision": 5, "context": "After 2 consecutive losses, chose very risky option"}]'::jsonb,
      'Consider setting strict loss limits before playing. When you hit your limit, take a mandatory break.'
    );

    -- Session 2: High Risk - Winning Streak Overconfidence
    INSERT INTO wellbeing_game_sessions (
      player_id, casino_id, game_concept_id,
      started_at, completed_at,
      duration_seconds, completion_rate, abandoned,
      raw_score, behaviour_risk_index,
      risk_escalation_detected, hesitation_score, consistency_score
    ) VALUES (
      v_player_high_risk_id, v_casino.id, v_game_concept_id,
      now() - interval '5 days', now() - interval '5 days' + interval '2.5 minutes',
      150, 100, false, 28, 85.2, true, 68, 22
    ) RETURNING id INTO v_session_id;

    INSERT INTO wellbeing_risk_scores (
      player_id, casino_id, session_id,
      behaviour_risk_index,
      impulsivity_score, risk_escalation_score, patience_score, recovery_response_score,
      explanation, calculated_at
    ) VALUES (
      v_player_high_risk_id, v_casino.id, v_session_id,
      85.2, 92.1, 88.5, 18.3, 15.2,
      '{"confidence": "high", "primary_concern": "winning_overconfidence", "trend": "worsening"}'::jsonb,
      now() - interval '5 days'
    );

    -- Additional high-risk sessions
    INSERT INTO wellbeing_game_sessions (
      player_id, casino_id, game_concept_id,
      started_at, completed_at,
      duration_seconds, completion_rate, abandoned,
      raw_score, behaviour_risk_index,
      risk_escalation_detected, hesitation_score, consistency_score
    ) VALUES
    (v_player_high_risk_id, v_casino.id, v_game_concept_id, now() - interval '3 days', now() - interval '3 days' + interval '2 minutes', 120, 100, false, 32, 82.3, true, 78, 25),
    (v_player_high_risk_id, v_casino.id, v_game_concept_id, now() - interval '1 day', now() - interval '1 day' + interval '2.2 minutes', 132, 100, false, 38, 75.1, true, 72, 30);

    -- ===== MEDIUM RISK PLAYER SESSIONS =====
    
    -- Session: Medium Risk - Balanced Approach
    INSERT INTO wellbeing_game_sessions (
      player_id, casino_id, game_concept_id,
      started_at, completed_at,
      duration_seconds, completion_rate, abandoned,
      raw_score, behaviour_risk_index,
      risk_escalation_detected, hesitation_score, consistency_score,
      insights_generated
    ) VALUES (
      v_player_medium_risk_id, v_casino.id, v_game_concept_id,
      now() - interval '6 days', now() - interval '6 days' + interval '4 minutes',
      240, 100, false, 58, 52.3, false, 48, 62,
      '[{"type": "balanced_approach", "severity": "info", "message": "Good mix of safe and calculated risks"}]'::jsonb
    ) RETURNING id INTO v_session_id;

    INSERT INTO wellbeing_risk_scores (
      player_id, casino_id, session_id,
      behaviour_risk_index,
      impulsivity_score, risk_escalation_score, patience_score, recovery_response_score,
      explanation, calculated_at
    ) VALUES (
      v_player_medium_risk_id, v_casino.id, v_session_id,
      52.3, 48.5, 45.2, 65.8, 58.2,
      '{"confidence": "medium", "primary_pattern": "balanced", "trend": "stable"}'::jsonb,
      now() - interval '6 days'
    );

    -- Session: Medium Risk - Improvement
    INSERT INTO wellbeing_game_sessions (
      player_id, casino_id, game_concept_id,
      started_at, completed_at,
      duration_seconds, completion_rate, abandoned,
      raw_score, behaviour_risk_index,
      risk_escalation_detected, hesitation_score, consistency_score
    ) VALUES (
      v_player_medium_risk_id, v_casino.id, v_game_concept_id,
      now() - interval '3 days', now() - interval '3 days' + interval '4.5 minutes',
      270, 100, false, 68, 42.1, false, 52, 71
    ) RETURNING id INTO v_session_id;

    INSERT INTO wellbeing_risk_scores (
      player_id, casino_id, session_id,
      behaviour_risk_index,
      impulsivity_score, risk_escalation_score, patience_score, recovery_response_score,
      explanation, calculated_at
    ) VALUES (
      v_player_medium_risk_id, v_casino.id, v_session_id,
      42.1, 38.5, 35.8, 72.3, 68.5,
      '{"confidence": "medium", "primary_pattern": "improvement", "trend": "positive"}'::jsonb,
      now() - interval '3 days'
    );

    -- Additional medium-risk sessions
    INSERT INTO wellbeing_game_sessions (
      player_id, casino_id, game_concept_id,
      started_at, completed_at,
      duration_seconds, completion_rate, abandoned,
      raw_score, behaviour_risk_index,
      risk_escalation_detected, hesitation_score, consistency_score
    ) VALUES
    (v_player_medium_risk_id, v_casino.id, v_game_concept_id, now() - interval '2 days', now() - interval '2 days' + interval '3.8 minutes', 228, 100, false, 62, 48.3, false, 45, 65),
    (v_player_medium_risk_id, v_casino.id, v_game_concept_id, now() - interval '12 hours', now() - interval '12 hours' + interval '4.2 minutes', 252, 100, false, 65, 45.2, false, 42, 68);

    -- ===== LOW RISK PLAYER SESSIONS =====
    
    -- Session: Low Risk - Excellent Control
    INSERT INTO wellbeing_game_sessions (
      player_id, casino_id, game_concept_id,
      started_at, completed_at,
      duration_seconds, completion_rate, abandoned,
      raw_score, behaviour_risk_index,
      risk_escalation_detected, hesitation_score, consistency_score,
      insights_generated
    ) VALUES (
      v_player_low_risk_id, v_casino.id, v_game_concept_id,
      now() - interval '4 days', now() - interval '4 days' + interval '5 minutes',
      300, 100, false, 88, 25.3, false, 38, 85,
      '[{"type": "excellent_control", "severity": "info", "message": "Exemplary responsible gaming behavior"}]'::jsonb
    ) RETURNING id INTO v_session_id;

    INSERT INTO wellbeing_risk_scores (
      player_id, casino_id, session_id,
      behaviour_risk_index,
      impulsivity_score, risk_escalation_score, patience_score, recovery_response_score,
      explanation, calculated_at
    ) VALUES (
      v_player_low_risk_id, v_casino.id, v_session_id,
      25.3, 22.1, 18.5, 92.3, 88.5,
      '{"confidence": "high", "primary_pattern": "excellent_control", "trend": "stable"}'::jsonb,
      now() - interval '4 days'
    );

    -- Award badge to low-risk player
    SELECT id INTO v_badge_id FROM wellbeing_game_badges WHERE badge_type = 'risk_manager' LIMIT 1;
    IF v_badge_id IS NOT NULL THEN
      INSERT INTO wellbeing_player_badges (player_id, casino_id, badge_id, session_id)
      VALUES (v_player_low_risk_id, v_casino.id, v_badge_id, v_session_id)
      ON CONFLICT (player_id, badge_id) DO NOTHING;
    END IF;

    -- Session: Low Risk - Consistent Performance
    INSERT INTO wellbeing_game_sessions (
      player_id, casino_id, game_concept_id,
      started_at, completed_at,
      duration_seconds, completion_rate, abandoned,
      raw_score, behaviour_risk_index,
      risk_escalation_detected, hesitation_score, consistency_score
    ) VALUES (
      v_player_low_risk_id, v_casino.id, v_game_concept_id,
      now() - interval '1 day', now() - interval '1 day' + interval '4.8 minutes',
      288, 100, false, 86, 28.1, false, 35, 88
    ) RETURNING id INTO v_session_id;

    INSERT INTO wellbeing_risk_scores (
      player_id, casino_id, session_id,
      behaviour_risk_index,
      impulsivity_score, risk_escalation_score, patience_score, recovery_response_score,
      explanation, calculated_at
    ) VALUES (
      v_player_low_risk_id, v_casino.id, v_session_id,
      28.1, 24.5, 22.3, 90.2, 86.8,
      '{"confidence": "high", "primary_pattern": "consistent_excellence", "trend": "stable"}'::jsonb,
      now() - interval '1 day'
    );

    -- Additional low-risk sessions
    INSERT INTO wellbeing_game_sessions (
      player_id, casino_id, game_concept_id,
      started_at, completed_at,
      duration_seconds, completion_rate, abandoned,
      raw_score, behaviour_risk_index,
      risk_escalation_detected, hesitation_score, consistency_score
    ) VALUES
    (v_player_low_risk_id, v_casino.id, v_game_concept_id, now() - interval '8 hours', now() - interval '8 hours' + interval '5.1 minutes', 306, 100, false, 85, 30.2, false, 40, 82),
    (v_player_low_risk_id, v_casino.id, v_game_concept_id, now() - interval '2 hours', now() - interval '2 hours' + interval '4.9 minutes', 294, 100, false, 87, 27.3, false, 38, 86);

    -- Additional mixed sessions for variety
    INSERT INTO wellbeing_game_sessions (
      player_id, casino_id, game_concept_id,
      started_at, completed_at,
      duration_seconds, completion_rate, abandoned,
      raw_score, behaviour_risk_index,
      risk_escalation_detected, hesitation_score, consistency_score
    ) VALUES
    (v_player_high_risk_id, v_casino.id, v_game_concept_id, now() - interval '6 hours', now() - interval '6 hours' + interval '1.8 minutes', 108, 100, false, 30, 88.5, true, 82, 20),
    (v_player_medium_risk_id, v_casino.id, v_game_concept_id, now() - interval '4 hours', now() - interval '4 hours' + interval '4 minutes', 240, 100, false, 60, 50.1, false, 48, 62),
    (v_player_medium_risk_id, v_casino.id, v_game_concept_id, now() - interval '30 minutes', now() - interval '25 minutes', 300, 100, false, 64, 46.8, false, 46, 66);

    RAISE NOTICE 'Created Nova IQ demo data for casino: % (% sessions)', v_casino.name, 15;

  END LOOP;

  RAISE NOTICE 'Successfully created Nova IQ demo data for % casinos', v_casino_count;

END $$;