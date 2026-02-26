/*
  # Seed Comprehensive Nova IQ Data for All Casinos V3
  
  ## Summary
  Seeds comprehensive Nova IQ wellbeing game session and risk score data
  for all casinos to support ESG Performance Dashboard.
  
  ## Data Added
  - 50+ wellbeing game sessions per casino
  - Varied risk scores (low, moderate, high, critical)
  - Multiple game concepts
  - Realistic completion rates and behavioral indicators
  - Recent trend data for analytics
  
  ## Casinos
  - Royal Palace Casino: 50 total sessions
  - Golden Dragon Gaming: 50 total sessions  
  - Silver Star Resort: 50 total sessions
*/

DO $$
DECLARE
  royal_palace_id UUID := '11111111-1111-1111-1111-111111111111';
  golden_dragon_id UUID := '22222222-2222-2222-2222-222222222222';
  silver_star_id UUID := '33333333-3333-3333-3333-333333333333';
  
  game_concept_1 UUID;
  game_concept_2 UUID;
  game_concept_3 UUID;
  
  player_ids UUID[];
  session_id UUID;
  i INT;
BEGIN
  -- Get game concepts by slug
  SELECT id INTO game_concept_1 FROM wellbeing_game_concepts WHERE slug = 'impulse-challenge' LIMIT 1;
  SELECT id INTO game_concept_2 FROM wellbeing_game_concepts WHERE slug = 'balance-journey' LIMIT 1;
  SELECT id INTO game_concept_3 FROM wellbeing_game_concepts WHERE slug = 'resource-guardian' LIMIT 1;
  
  -- Use the first available game concept if specific ones not found
  IF game_concept_1 IS NULL THEN
    SELECT id INTO game_concept_1 FROM wellbeing_game_concepts LIMIT 1;
  END IF;
  
  IF game_concept_2 IS NULL OR game_concept_2 = game_concept_1 THEN
    SELECT id INTO game_concept_2 FROM wellbeing_game_concepts WHERE id != game_concept_1 LIMIT 1;
  END IF;
  
  IF game_concept_3 IS NULL OR game_concept_3 = game_concept_1 OR game_concept_3 = game_concept_2 THEN
    game_concept_3 := game_concept_1;
  END IF;
  
  -- ============================================================
  -- ROYAL PALACE CASINO - Add 20 more sessions (already has 30)
  -- ============================================================
  
  SELECT array_agg(id) INTO player_ids FROM players WHERE casino_id = royal_palace_id LIMIT 10;
  
  IF array_length(player_ids, 1) > 0 THEN
    FOR i IN 1..20 LOOP
      INSERT INTO wellbeing_game_sessions (
        player_id,
        game_concept_id,
        casino_id,
        started_at,
        completed_at,
        duration_seconds,
        completion_rate,
        abandoned,
        raw_score,
        behaviour_risk_index,
        hesitation_score,
        consistency_score,
        decision_speed_variance,
        risk_escalation_detected
      ) VALUES (
        player_ids[1 + (i % array_length(player_ids, 1))],
        CASE WHEN i % 3 = 0 THEN game_concept_1
             WHEN i % 3 = 1 THEN game_concept_2
             ELSE game_concept_3 END,
        royal_palace_id,
        NOW() - (i + 30 || ' days')::INTERVAL,
        NOW() - (i + 30 || ' days')::INTERVAL + (180 + (i * 10)) * INTERVAL '1 second',
        180 + (i * 10),
        CASE WHEN i % 5 = 0 THEN 0.85 ELSE 1.0 END,
        CASE WHEN i % 5 = 0 THEN true ELSE false END,
        500 + (i * 20) - (RANDOM() * 100)::INT,
        CASE 
          WHEN i % 4 = 0 THEN 30 + (RANDOM() * 20)::NUMERIC
          WHEN i % 4 = 1 THEN 50 + (RANDOM() * 20)::NUMERIC
          WHEN i % 4 = 2 THEN 70 + (RANDOM() * 15)::NUMERIC
          ELSE 85 + (RANDOM() * 10)::NUMERIC
        END,
        40 + (RANDOM() * 30)::INT,
        60 + (RANDOM() * 20)::INT,
        0.3 + (RANDOM() * 0.4)::NUMERIC,
        CASE WHEN i % 3 = 0 THEN true ELSE false END
      )
      RETURNING id INTO session_id;
      
      -- Add risk scores for completed sessions
      IF i % 5 != 0 THEN
        INSERT INTO wellbeing_risk_scores (
          session_id,
          player_id,
          casino_id,
          behaviour_risk_index,
          impulsivity_score,
          patience_score,
          risk_escalation_score,
          recovery_response_score,
          calculated_at
        ) VALUES (
          session_id,
          player_ids[1 + (i % array_length(player_ids, 1))],
          royal_palace_id,
          CASE 
            WHEN i % 4 = 0 THEN 30 + (RANDOM() * 20)::NUMERIC
            WHEN i % 4 = 1 THEN 50 + (RANDOM() * 20)::NUMERIC
            WHEN i % 4 = 2 THEN 70 + (RANDOM() * 15)::NUMERIC
            ELSE 85 + (RANDOM() * 10)::NUMERIC
          END,
          40 + (RANDOM() * 50)::NUMERIC,
          30 + (RANDOM() * 60)::NUMERIC,
          25 + (RANDOM() * 65)::NUMERIC,
          40 + (RANDOM() * 50)::NUMERIC,
          NOW() - (i + 30 || ' days')::INTERVAL
        );
      END IF;
    END LOOP;
  END IF;
  
  -- ============================================================
  -- GOLDEN DRAGON GAMING - Add 35 more sessions (already has 15)
  -- ============================================================
  
  SELECT array_agg(id) INTO player_ids FROM players WHERE casino_id = golden_dragon_id LIMIT 10;
  
  IF array_length(player_ids, 1) > 0 THEN
    FOR i IN 1..35 LOOP
      INSERT INTO wellbeing_game_sessions (
        player_id,
        game_concept_id,
        casino_id,
        started_at,
        completed_at,
        duration_seconds,
        completion_rate,
        abandoned,
        raw_score,
        behaviour_risk_index,
        hesitation_score,
        consistency_score,
        decision_speed_variance,
        risk_escalation_detected
      ) VALUES (
        player_ids[1 + (i % array_length(player_ids, 1))],
        CASE WHEN i % 3 = 0 THEN game_concept_1
             WHEN i % 3 = 1 THEN game_concept_2
             ELSE game_concept_3 END,
        golden_dragon_id,
        NOW() - (i + 15 || ' days')::INTERVAL,
        NOW() - (i + 15 || ' days')::INTERVAL + (200 + (i * 8)) * INTERVAL '1 second',
        200 + (i * 8),
        CASE WHEN i % 6 = 0 THEN 0.75 ELSE 1.0 END,
        CASE WHEN i % 6 = 0 THEN true ELSE false END,
        450 + (i * 25) - (RANDOM() * 120)::INT,
        CASE 
          WHEN i % 5 = 0 THEN 25 + (RANDOM() * 25)::NUMERIC
          WHEN i % 5 = 1 THEN 45 + (RANDOM() * 25)::NUMERIC
          WHEN i % 5 = 2 THEN 65 + (RANDOM() * 20)::NUMERIC
          WHEN i % 5 = 3 THEN 80 + (RANDOM() * 12)::NUMERIC
          ELSE 90 + (RANDOM() * 8)::NUMERIC
        END,
        35 + (RANDOM() * 35)::INT,
        55 + (RANDOM() * 25)::INT,
        0.25 + (RANDOM() * 0.5)::NUMERIC,
        CASE WHEN i % 4 = 0 THEN true ELSE false END
      )
      RETURNING id INTO session_id;
      
      -- Add risk scores for completed sessions
      IF i % 6 != 0 THEN
        INSERT INTO wellbeing_risk_scores (
          session_id,
          player_id,
          casino_id,
          behaviour_risk_index,
          impulsivity_score,
          patience_score,
          risk_escalation_score,
          recovery_response_score,
          calculated_at
        ) VALUES (
          session_id,
          player_ids[1 + (i % array_length(player_ids, 1))],
          golden_dragon_id,
          CASE 
            WHEN i % 5 = 0 THEN 25 + (RANDOM() * 25)::NUMERIC
            WHEN i % 5 = 1 THEN 45 + (RANDOM() * 25)::NUMERIC
            WHEN i % 5 = 2 THEN 65 + (RANDOM() * 20)::NUMERIC
            WHEN i % 5 = 3 THEN 80 + (RANDOM() * 12)::NUMERIC
            ELSE 90 + (RANDOM() * 8)::NUMERIC
          END,
          35 + (RANDOM() * 55)::NUMERIC,
          25 + (RANDOM() * 65)::NUMERIC,
          30 + (RANDOM() * 60)::NUMERIC,
          35 + (RANDOM() * 55)::NUMERIC,
          NOW() - (i + 15 || ' days')::INTERVAL
        );
      END IF;
    END LOOP;
  END IF;
  
  -- ============================================================
  -- SILVER STAR RESORT - Add 35 more sessions (already has 15)
  -- ============================================================
  
  SELECT array_agg(id) INTO player_ids FROM players WHERE casino_id = silver_star_id LIMIT 10;
  
  IF array_length(player_ids, 1) > 0 THEN
    FOR i IN 1..35 LOOP
      INSERT INTO wellbeing_game_sessions (
        player_id,
        game_concept_id,
        casino_id,
        started_at,
        completed_at,
        duration_seconds,
        completion_rate,
        abandoned,
        raw_score,
        behaviour_risk_index,
        hesitation_score,
        consistency_score,
        decision_speed_variance,
        risk_escalation_detected
      ) VALUES (
        player_ids[1 + (i % array_length(player_ids, 1))],
        CASE WHEN i % 3 = 0 THEN game_concept_1
             WHEN i % 3 = 1 THEN game_concept_2
             ELSE game_concept_3 END,
        silver_star_id,
        NOW() - (i + 15 || ' days')::INTERVAL,
        NOW() - (i + 15 || ' days')::INTERVAL + (170 + (i * 12)) * INTERVAL '1 second',
        170 + (i * 12),
        CASE WHEN i % 7 = 0 THEN 0.80 ELSE 1.0 END,
        CASE WHEN i % 7 = 0 THEN true ELSE false END,
        480 + (i * 22) - (RANDOM() * 100)::INT,
        CASE 
          WHEN i % 5 = 0 THEN 28 + (RANDOM() * 22)::NUMERIC
          WHEN i % 5 = 1 THEN 48 + (RANDOM() * 22)::NUMERIC
          WHEN i % 5 = 2 THEN 68 + (RANDOM() * 17)::NUMERIC
          WHEN i % 5 = 3 THEN 82 + (RANDOM() * 13)::NUMERIC
          ELSE 92 + (RANDOM() * 6)::NUMERIC
        END,
        38 + (RANDOM() * 32)::INT,
        58 + (RANDOM() * 22)::INT,
        0.28 + (RANDOM() * 0.45)::NUMERIC,
        CASE WHEN i % 3 = 0 THEN true ELSE false END
      )
      RETURNING id INTO session_id;
      
      -- Add risk scores for completed sessions
      IF i % 7 != 0 THEN
        INSERT INTO wellbeing_risk_scores (
          session_id,
          player_id,
          casino_id,
          behaviour_risk_index,
          impulsivity_score,
          patience_score,
          risk_escalation_score,
          recovery_response_score,
          calculated_at
        ) VALUES (
          session_id,
          player_ids[1 + (i % array_length(player_ids, 1))],
          silver_star_id,
          CASE 
            WHEN i % 5 = 0 THEN 28 + (RANDOM() * 22)::NUMERIC
            WHEN i % 5 = 1 THEN 48 + (RANDOM() * 22)::NUMERIC
            WHEN i % 5 = 2 THEN 68 + (RANDOM() * 17)::NUMERIC
            WHEN i % 5 = 3 THEN 82 + (RANDOM() * 13)::NUMERIC
            ELSE 92 + (RANDOM() * 6)::NUMERIC
          END,
          38 + (RANDOM() * 52)::NUMERIC,
          28 + (RANDOM() * 62)::NUMERIC,
          32 + (RANDOM() * 58)::NUMERIC,
          38 + (RANDOM() * 52)::NUMERIC,
          NOW() - (i + 15 || ' days')::INTERVAL
        );
      END IF;
    END LOOP;
  END IF;
  
END $$;
