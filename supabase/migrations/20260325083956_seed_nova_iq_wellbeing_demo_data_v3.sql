
/*
  # Seed Nova IQ / Wellbeing Game Demo Data (v3)

  Seeds comprehensive demo data for the Nova IQ (wellbeing game) system:

  1. Wellbeing Game Campaigns - per casino, valid trigger_types: periodic, post_session, risk_signal, regulator_cycle
  2. Wellbeing Game Invitations - statuses: pending/sent/opened/completed/expired/abandoned
     delivery_status: pending/sent/simulated/failed/error
  3. Wellbeing Game Sessions - completed sessions with full behavioural scoring
  4. Wellbeing Risk Scores - BRI, impulsivity, patience, recovery scores

  Data covers all 10 casinos, ~30 players per casino, realistic 90-day spread.
*/

-- ============================================================
-- 1. CAMPAIGNS — three per casino
-- ============================================================
INSERT INTO wellbeing_game_campaigns (id, casino_id, name, game_concept_id, trigger_type, channel, message_template, active, created_at)
SELECT
  gen_random_uuid(), c.id,
  'Nova IQ - Monthly Check-in (' || c.name || ')',
  (SELECT id FROM wellbeing_game_concepts WHERE mechanics_type = 'decision_path' LIMIT 1),
  'periodic', 'email',
  'Hi there! It''s time for your monthly Nova IQ wellbeing check-in. Takes just 5 minutes.',
  true, now() - interval '90 days'
FROM casinos c;

INSERT INTO wellbeing_game_campaigns (id, casino_id, name, game_concept_id, trigger_type, channel, message_template, active, created_at)
SELECT
  gen_random_uuid(), c.id,
  'Nova IQ - Post Session WhatsApp (' || c.name || ')',
  (SELECT id FROM wellbeing_game_concepts WHERE mechanics_type = 'risk_vs_stability' LIMIT 1),
  'post_session', 'whatsapp',
  'Thanks for playing! How are you feeling? Take a quick Nova IQ check to support your balance.',
  true, now() - interval '60 days'
FROM casinos c;

INSERT INTO wellbeing_game_campaigns (id, casino_id, name, game_concept_id, trigger_type, channel, message_template, active, created_at)
SELECT
  gen_random_uuid(), c.id,
  'Nova IQ - Risk Signal Follow-up (' || c.name || ')',
  (SELECT id FROM wellbeing_game_concepts WHERE mechanics_type = 'timing_control' LIMIT 1),
  'risk_signal', 'email',
  'We noticed some patterns in your recent activity. Please take this quick assessment.',
  true, now() - interval '30 days'
FROM casinos c;

-- ============================================================
-- 2. INVITATIONS + SESSIONS + RISK SCORES via PL/pgSQL
-- ============================================================
DO $$
DECLARE
  casino_ids uuid[] := ARRAY[
    '74af4a9b-a774-46c9-bc20-18c72a21526e',
    'f310e9c0-f374-4ffa-8e2f-e87c2818e60f',
    '11111111-2222-3333-4444-555555555555',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '33333333-4444-5555-6666-777777777777',
    '63c6faf0-e89c-48b4-8ae1-a14aee52cd9c',
    '22222222-2222-2222-2222-222222222222',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '22222222-3333-4444-5555-666666666666'
  ];
  concept_ids uuid[];

  cid uuid;
  pid uuid;
  concept_id uuid;
  campaign_id uuid;
  inv_id uuid;
  sess_id uuid;
  inv_status text;
  delivery text;
  channel text;
  days_ago int;
  sent_ts timestamptz;
  opened_ts timestamptz;
  completed_ts timestamptz;

  bri numeric;
  impulsivity numeric;
  risk_esc numeric;
  patience numeric;
  recovery numeric;
  raw_sc int;
  hesitation int;
  consistency int;
  dur_sec int;
  rv float;
BEGIN
  SELECT array_agg(id) INTO concept_ids FROM wellbeing_game_concepts WHERE active = true;

  FOREACH cid IN ARRAY casino_ids LOOP
    FOR pid IN
      SELECT p.id FROM players p WHERE p.casino_id = cid ORDER BY random() LIMIT 30
    LOOP
      days_ago := floor(random() * 85 + 1)::int;
      sent_ts := now() - (days_ago || ' days')::interval - (floor(random()*12)||' hours')::interval;
      rv := random();

      -- Status: ~45% completed, ~15% opened, ~25% sent, ~15% expired
      inv_status := CASE
        WHEN rv < 0.45 THEN 'completed'
        WHEN rv < 0.60 THEN 'opened'
        WHEN rv < 0.85 THEN 'sent'
        ELSE 'expired'
      END;

      -- delivery_status: use 'sent' or 'simulated' or 'failed' (not 'delivered' — not a valid value)
      delivery := CASE
        WHEN random() > 0.08 THEN CASE WHEN random() > 0.5 THEN 'sent' ELSE 'simulated' END
        ELSE 'failed'
      END;

      channel := CASE WHEN random() > 0.4 THEN 'email' ELSE 'whatsapp' END;
      concept_id := concept_ids[1 + (floor(random() * array_length(concept_ids, 1)))::int % array_length(concept_ids, 1)];

      SELECT id INTO campaign_id
      FROM wellbeing_game_campaigns
      WHERE casino_id = cid
      ORDER BY random()
      LIMIT 1;

      opened_ts := CASE WHEN inv_status IN ('opened','completed') THEN sent_ts + interval '2 hours' ELSE NULL END;
      completed_ts := CASE WHEN inv_status = 'completed' THEN sent_ts + interval '2 hours 7 minutes' ELSE NULL END;

      inv_id := gen_random_uuid();

      INSERT INTO wellbeing_game_invitations
        (id, campaign_id, player_id, game_concept_id, secure_token, channel,
         sent_at, expires_at, opened_at, completed_at, status, delivery_status, casino_id)
      VALUES (
        inv_id, campaign_id, pid, concept_id,
        encode(gen_random_bytes(24), 'hex'),
        channel, sent_ts, sent_ts + interval '7 days',
        opened_ts, completed_ts,
        inv_status, delivery, cid
      );

      IF inv_status = 'completed' THEN
        bri := round((random() * 80 + 10)::numeric, 1);
        impulsivity := round((random() * 85 + 5)::numeric, 1);
        risk_esc := round((random() * 75 + 5)::numeric, 1);
        patience := round(LEAST(100, (100 - impulsivity * 0.6 + random() * 15))::numeric, 1);
        recovery := round((random() * 70 + 15)::numeric, 1);
        raw_sc := floor(random() * 800 + 100)::int;
        hesitation := floor(random() * 60 + 10)::int;
        consistency := floor(random() * 50 + 40)::int;
        dur_sec := floor(random() * 320 + 180)::int;
        sess_id := gen_random_uuid();

        INSERT INTO wellbeing_game_sessions
          (id, invitation_id, player_id, game_concept_id, casino_id,
           started_at, completed_at, duration_seconds, completion_rate, abandoned,
           raw_score, behaviour_risk_index, hesitation_score, consistency_score,
           decision_speed_variance, risk_escalation_detected, insights_generated, device_info)
        VALUES (
          sess_id, inv_id, pid, concept_id, cid,
          completed_ts - interval '7 minutes', completed_ts,
          dur_sec, 1.0, false, raw_sc, bri,
          hesitation, consistency,
          round((random() * 2.5 + 0.2)::numeric, 2),
          bri > 65,
          jsonb_build_object(
            'primary_insight', CASE
              WHEN bri > 70 THEN 'High impulsivity pattern detected across loss-recovery scenarios'
              WHEN bri > 45 THEN 'Moderate risk escalation tendency — monitor deposit velocity'
              ELSE 'Balanced decision-making with strong loss-acceptance indicators'
            END,
            'secondary_insight', CASE
              WHEN impulsivity > 65 THEN 'Decision speed spikes on consecutive loss scenarios'
              WHEN patience > 60 THEN 'Above-average patience on cooling-off scenario'
              ELSE 'Consistent mid-range behavioural signals'
            END,
            'risk_band', CASE
              WHEN bri > 70 THEN 'high'
              WHEN bri > 45 THEN 'medium'
              ELSE 'low'
            END
          ),
          jsonb_build_object('type', CASE WHEN random() > 0.5 THEN 'mobile' ELSE 'desktop' END)
        );

        INSERT INTO wellbeing_risk_scores
          (id, player_id, casino_id, session_id, behaviour_risk_index, impulsivity_score,
           risk_escalation_score, patience_score, recovery_response_score, explanation, calculated_at)
        VALUES (
          gen_random_uuid(), pid, cid, sess_id,
          bri, impulsivity, risk_esc, patience, recovery,
          jsonb_build_object(
            'bri_components', jsonb_build_array(
              jsonb_build_object('factor', 'loss_chasing',       'weight', round((random()*40+10)::numeric,1)),
              jsonb_build_object('factor', 'session_escalation', 'weight', round((random()*30+10)::numeric,1)),
              jsonb_build_object('factor', 'impulse_decisions',  'weight', round((random()*25+5)::numeric,1))
            ),
            'risk_band', CASE
              WHEN bri > 70 THEN 'high'
              WHEN bri > 45 THEN 'medium'
              ELSE 'low'
            END
          ),
          completed_ts
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;
