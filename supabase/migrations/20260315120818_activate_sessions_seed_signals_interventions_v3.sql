
/*
  # Activate Live Sessions and Seed Monitoring Data v3

  ## Purpose
  Populate data for the live monitoring dashboard:
  1. Activate ~500 gaming sessions as currently live (is_active = true)
  2. Seed 30 days of BRI signal history per casino
  3. Seed ~500 intervention history records using valid enum values

  ## Allowed constraint values
  - intervention_type: break_suggestion, session_limit, cooling_off, self_exclusion, contact_support, educational_content
  - delivery_method: in_app, whatsapp, sms, email
  - player_response: accepted, declined, ignored, deferred
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ACTIVATE LIVE SESSIONS
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE gaming_sessions
SET is_active = true
WHERE id IN (
  SELECT DISTINCT ON (gs.player_id) gs.id
  FROM gaming_sessions gs
  JOIN players p ON p.id = gs.player_id
  WHERE p.status = 'active'
    AND p.risk_score >= 30
  ORDER BY gs.player_id, gs.start_time DESC
  LIMIT 500
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. SEED BRI_SIGNAL_HISTORY (30 days x top 3 players per casino)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_casino RECORD;
  v_player RECORD;
  v_day INTEGER;
  v_base FLOAT;
  v_j FLOAT;
BEGIN
  FOR v_casino IN (SELECT id FROM casinos WHERE is_active = true LIMIT 18) LOOP
    FOR v_day IN 0..29 LOOP
      FOR v_player IN (
        SELECT p.id, p.risk_score
        FROM players p
        WHERE p.casino_id = v_casino.id
          AND p.status = 'active'
          AND p.risk_score >= 40
        ORDER BY p.risk_score DESC
        LIMIT 3
      ) LOOP
        v_base := v_player.risk_score;
        v_j    := (random() * 10) - 5;

        INSERT INTO bri_signal_history (
          player_id, casino_id, recorded_at,
          risk_score, session_duration_score, deposit_frequency_score,
          loss_escalation_score, bet_intensity_score, cross_operator_score
        ) VALUES (
          v_player.id, v_casino.id,
          NOW() - ((29 - v_day) || ' days')::interval - (random() * 3 || ' hours')::interval,
          LEAST(100, GREATEST(0, ROUND((v_base + v_j)::numeric, 1))),
          LEAST(100, GREATEST(0, ROUND((v_base * 0.75 + v_j * 1.2)::numeric, 1))),
          LEAST(100, GREATEST(0, ROUND((v_base * 0.65 + v_j * 0.8)::numeric, 1))),
          LEAST(100, GREATEST(0, ROUND((v_base * 0.85 + v_j * 1.5)::numeric, 1))),
          LEAST(100, GREATEST(0, ROUND((v_base * 0.70 + v_j)::numeric, 1))),
          LEAST(100, GREATEST(0, ROUND((v_base * 0.35 + v_j * 0.5)::numeric, 1)))
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SEED INTERVENTION_HISTORY (valid enum values only)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_player RECORD;
  v_types  TEXT[] := ARRAY['break_suggestion','session_limit','cooling_off','self_exclusion','contact_support','educational_content'];
  v_reasons TEXT[] := ARRAY[
    'Risk score exceeded critical threshold of 80',
    'Session duration exceeded 4 hours continuously',
    'Cooling-off period recommended based on behavioral signals',
    'Self-exclusion offered due to sustained critical risk score',
    'Support contact recommended after repeated loss chasing',
    'Educational resources triggered by rapid bet escalation pattern'
  ];
  v_channels TEXT[] := ARRAY['in_app','whatsapp','sms','email'];
  v_responses TEXT[] := ARRAY['accepted','accepted','declined','deferred','ignored'];
  v_type TEXT; v_reason TEXT; v_channel TEXT; v_response TEXT;
  v_days_ago FLOAT; v_successful BOOLEAN;
  v_ti INTEGER; v_ci INTEGER; v_ri INTEGER;
BEGIN
  FOR v_player IN (
    SELECT p.id, p.casino_id, p.risk_score
    FROM players p
    WHERE p.status = 'active'
      AND p.risk_score >= 50
    ORDER BY p.risk_score DESC
    LIMIT 200
  ) LOOP
    FOR i IN 1..GREATEST(1, FLOOR(v_player.risk_score / 30)::int) LOOP
      v_ti       := 1 + (FLOOR(random() * 6))::int;
      v_ci       := 1 + (FLOOR(random() * 4))::int;
      v_ri       := 1 + (FLOOR(random() * 5))::int;
      v_type     := v_types[v_ti];
      v_reason   := v_reasons[v_ti];
      v_channel  := v_channels[v_ci];
      v_response := v_responses[v_ri];
      v_days_ago := random() * 89 + 0.5;
      v_successful := (v_response = 'accepted') AND (random() > 0.3);

      INSERT INTO intervention_history (
        player_id, casino_id,
        intervention_type, trigger_reason, delivery_method,
        triggered_at, risk_score_at_trigger,
        player_response, intervention_successful, auto_triggered
      ) VALUES (
        v_player.id, v_player.casino_id,
        v_type, v_reason, v_channel,
        NOW() - (v_days_ago || ' days')::interval,
        LEAST(100, GREATEST(0, v_player.risk_score + FLOOR((random() * 10) - 5)::int)),
        v_response, v_successful, true
      );
    END LOOP;
  END LOOP;
END $$;
