
/*
  # Seed Revenue Protection Events for All Casinos (v3)

  ## Summary
  Seeds 90 realistic protection events (30 per casino) and monthly summary rows.
  Uses correct event_type values and correct monthly table column names.
*/

DO $$
DECLARE
  casino1 uuid := '11111111-1111-1111-1111-111111111111';
  casino2 uuid := '22222222-2222-2222-2222-222222222222';
  casino3 uuid := '33333333-3333-3333-3333-333333333333';

  event_types text[] := ARRAY['ltv_saved','fraud_prevented','chargeback_avoided','vip_retained','dropout_prevented'];
  calc_methods text[] := ARRAY['ltv_model','rule_based','ml_prediction','statistical'];

  rp_players uuid[];
  gd_players uuid[];
  ss_players uuid[];

  p uuid;
  et text;
  risk_before int;
  risk_after int;
  impact numeric;
  days_ago int;
BEGIN
  SELECT ARRAY(SELECT id FROM players WHERE casino_id = casino1 ORDER BY random() LIMIT 20) INTO rp_players;
  SELECT ARRAY(SELECT id FROM players WHERE casino_id = casino2 ORDER BY random() LIMIT 20) INTO gd_players;
  SELECT ARRAY(SELECT id FROM players WHERE casino_id = casino3 ORDER BY random() LIMIT 20) INTO ss_players;

  -- Royal Palace Casino
  FOR i IN 1..30 LOOP
    p := rp_players[1 + (i % array_length(rp_players, 1))];
    et := event_types[1 + (i % 5)];
    risk_before := 45 + (random() * 50)::int;
    risk_after := greatest(10, risk_before - 10 - (random() * 25)::int);
    impact := round((5000 + random() * 45000)::numeric, 2);
    days_ago := (random() * 59)::int;

    INSERT INTO revenue_protection_events (
      id, casino_id, player_id, event_type, event_date,
      financial_impact_zar, calculation_method,
      player_risk_before, player_risk_after,
      confidence_score, notes, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), casino1, p, et,
      CURRENT_DATE - days_ago, impact,
      calc_methods[1 + (i % 4)],
      risk_before, risk_after,
      round((0.65 + random() * 0.30)::numeric, 2),
      'AI-triggered intervention based on behavioral pattern analysis',
      NOW() - (days_ago || ' days')::interval - (random() * 12 || ' hours')::interval,
      NOW() - (days_ago || ' days')::interval
    );
  END LOOP;

  -- Golden Dragon Gaming
  FOR i IN 1..30 LOOP
    p := gd_players[1 + (i % array_length(gd_players, 1))];
    et := event_types[1 + ((i + 2) % 5)];
    risk_before := 40 + (random() * 55)::int;
    risk_after := greatest(10, risk_before - 8 - (random() * 28)::int);
    impact := round((4000 + random() * 52000)::numeric, 2);
    days_ago := (random() * 59)::int;

    INSERT INTO revenue_protection_events (
      id, casino_id, player_id, event_type, event_date,
      financial_impact_zar, calculation_method,
      player_risk_before, player_risk_after,
      confidence_score, notes, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), casino2, p, et,
      CURRENT_DATE - days_ago, impact,
      calc_methods[1 + ((i + 1) % 4)],
      risk_before, risk_after,
      round((0.60 + random() * 0.35)::numeric, 2),
      'Behavioral risk model flagged session anomaly',
      NOW() - (days_ago || ' days')::interval - (random() * 10 || ' hours')::interval,
      NOW() - (days_ago || ' days')::interval
    );
  END LOOP;

  -- Silver Star Resort
  FOR i IN 1..30 LOOP
    p := ss_players[1 + (i % array_length(ss_players, 1))];
    et := event_types[1 + ((i + 1) % 5)];
    risk_before := 35 + (random() * 60)::int;
    risk_after := greatest(10, risk_before - 12 - (random() * 22)::int);
    impact := round((3500 + random() * 48000)::numeric, 2);
    days_ago := (random() * 59)::int;

    INSERT INTO revenue_protection_events (
      id, casino_id, player_id, event_type, event_date,
      financial_impact_zar, calculation_method,
      player_risk_before, player_risk_after,
      confidence_score, notes, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), casino3, p, et,
      CURRENT_DATE - days_ago, impact,
      calc_methods[1 + ((i + 2) % 4)],
      risk_before, risk_after,
      round((0.62 + random() * 0.33)::numeric, 2),
      'Proactive intervention triggered by AI risk scoring',
      NOW() - (days_ago || ' days')::interval - (random() * 8 || ' hours')::interval,
      NOW() - (days_ago || ' days')::interval
    );
  END LOOP;

END $$;

-- Seed monthly summary using individual category columns (total_protected_zar is generated)
INSERT INTO revenue_protection_monthly (
  id, casino_id, month,
  ltv_saved_zar, fraud_prevented_zar, chargebacks_avoided_zar, vip_retained_zar, dropout_prevented_zar,
  events_count, players_protected_count, roi_multiple,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  casino_id,
  date_trunc('month', CURRENT_DATE)::date,
  SUM(CASE WHEN event_type = 'ltv_saved' THEN financial_impact_zar ELSE 0 END),
  SUM(CASE WHEN event_type = 'fraud_prevented' THEN financial_impact_zar ELSE 0 END),
  SUM(CASE WHEN event_type = 'chargeback_avoided' THEN financial_impact_zar ELSE 0 END),
  SUM(CASE WHEN event_type = 'vip_retained' THEN financial_impact_zar ELSE 0 END),
  SUM(CASE WHEN event_type = 'dropout_prevented' THEN financial_impact_zar ELSE 0 END),
  COUNT(*),
  COUNT(DISTINCT player_id),
  8.5,
  NOW(),
  NOW()
FROM revenue_protection_events
WHERE event_date >= date_trunc('month', CURRENT_DATE)
GROUP BY casino_id
ON CONFLICT DO NOTHING;
