/*
  # Seed Intervention History Demo Data

  1. Data Created
    - Sample intervention history records for all casinos
    - Various intervention types (break_suggestion, session_limit, cooling_off, etc.)
    - Mix of delivery methods (in_app, whatsapp, sms, email)
    - Different player responses and success rates
    - Realistic trigger reasons based on risk scores

  2. Purpose
    - Demonstrate intervention tracking functionality
    - Show compliance audit trail
    - Display effectiveness metrics
*/

DO $$
DECLARE
  v_casino_id uuid;
  v_player_id uuid;
  v_risk_profile_id uuid;
  v_intervention_types text[] := ARRAY['break_suggestion', 'session_limit', 'cooling_off', 'self_exclusion', 'contact_support', 'educational_content'];
  v_delivery_methods text[] := ARRAY['in_app', 'whatsapp', 'sms', 'email'];
  v_player_responses text[] := ARRAY['accepted', 'declined', 'ignored', 'deferred'];
  v_trigger_reasons text[] := ARRAY[
    'High risk score detected - exceeded threshold',
    'Loss-chasing behavior pattern identified',
    'Session time exceeded recommended limits',
    'Spending velocity increased significantly',
    'Multiple deposits in short timeframe',
    'Betting pattern shows escalation',
    'Risk score increased by 20+ points',
    'Prolonged session without breaks',
    'High impulsivity score from Nova IQ',
    'Behavioral indicators suggest intervention needed'
  ];
  i integer;
  j integer;
  v_days_ago integer;
  v_risk_score integer;
  v_successful boolean;
BEGIN
  -- For each casino
  FOR v_casino_id IN
    SELECT id FROM casinos ORDER BY id LIMIT 5
  LOOP
    -- Get some players from this casino
    FOR v_player_id, v_risk_profile_id IN
      SELECT p.id, brp.id
      FROM players p
      LEFT JOIN behavioral_risk_profiles brp ON brp.player_id = p.id
      WHERE p.casino_id = v_casino_id
      ORDER BY RANDOM()
      LIMIT 15
    LOOP
      -- Create 2-5 interventions per player
      FOR j IN 1..(2 + floor(random() * 4)::int)
      LOOP
        v_days_ago := floor(random() * 60)::int;
        v_risk_score := 40 + floor(random() * 60)::int;
        v_successful := random() > 0.25; -- 75% success rate

        INSERT INTO intervention_history (
          player_id,
          casino_id,
          risk_profile_id,
          intervention_type,
          trigger_reason,
          risk_score_at_trigger,
          delivery_method,
          message_sent,
          player_response,
          action_taken,
          intervention_successful,
          triggered_at,
          responded_at,
          created_at
        ) VALUES (
          v_player_id,
          v_casino_id,
          v_risk_profile_id,
          v_intervention_types[1 + floor(random() * array_length(v_intervention_types, 1))::int],
          v_trigger_reasons[1 + floor(random() * array_length(v_trigger_reasons, 1))::int],
          v_risk_score,
          v_delivery_methods[1 + floor(random() * array_length(v_delivery_methods, 1))::int],
          'We care about your wellbeing. Please consider taking a break or setting limits.',
          v_player_responses[1 + floor(random() * array_length(v_player_responses, 1))::int],
          CASE
            WHEN v_successful THEN 'Player acknowledged and reduced activity'
            ELSE 'Player did not respond or continued play'
          END,
          v_successful,
          now() - (v_days_ago || ' days')::interval,
          CASE
            WHEN random() > 0.3 THEN now() - ((v_days_ago - floor(random() * 3)::int) || ' days')::interval
            ELSE NULL
          END,
          now() - (v_days_ago || ' days')::interval
        );
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Intervention history demo data seeded successfully';
END $$;
