/*
  # Seed Cross-Operator Intelligence Demo Data

  ## Overview
  Seeds realistic pseudonymised cross-operator intelligence data for the demo environment.
  Players are represented by secure pseudonym tokens — real IDs are used internally but
  never exposed in cross-operator communications.

  ## What this seeds:
  - player_pseudonym_tokens: secure tokens for 20+ high-risk players
  - cross_operator_signal_log: 20+ individual signal events
  - cross_operator_alerts: 21 alerts across all 7 alert types with realistic evidence
*/

-- ─────────────────────────────────────────────
-- 1. Pseudonym Tokens for high-risk players
-- ─────────────────────────────────────────────
INSERT INTO player_pseudonym_tokens (player_id, casino_id, pseudonym_token, token_version, is_active, first_seen_at, last_seen_at)
SELECT
  p.id AS player_id,
  p.casino_id,
  encode(
    sha256(
      (p.id::text || '-' || p.casino_id::text || '-v1-safebet-cross-op-token')::bytea
    ),
    'hex'
  ) AS pseudonym_token,
  1 AS token_version,
  true AS is_active,
  now() - (random() * INTERVAL '90 days') AS first_seen_at,
  now() - (random() * INTERVAL '3 days') AS last_seen_at
FROM players p
WHERE p.risk_score >= 70
  AND p.casino_id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333'
  )
ON CONFLICT (player_id, casino_id) DO NOTHING;

-- ─────────────────────────────────────────────
-- 2. Cross-Operator Signal Log
-- ─────────────────────────────────────────────
INSERT INTO cross_operator_signal_log
  (player_id, casino_id, pseudonym_token, signal_type, signal_value, signal_score, source_operator, reported_at, evidence)
VALUES
  -- operator_hop signals
  ('1ba52590-b67a-460f-b432-7e6c20f83901', '22222222-2222-2222-2222-222222222222',
   (SELECT pseudonym_token FROM player_pseudonym_tokens WHERE player_id = '1ba52590-b67a-460f-b432-7e6c20f83901'),
   'operator_hop', 1, 72, 'Royal Palace Casino', now() - INTERVAL '6 hours',
   '{"operators_visited":["Royal Palace","Golden Dragon"],"time_window_hours":24}'::jsonb),

  ('0b819c1d-004d-485e-a84c-910e2fca82c0', '22222222-2222-2222-2222-222222222222',
   (SELECT pseudonym_token FROM player_pseudonym_tokens WHERE player_id = '0b819c1d-004d-485e-a84c-910e2fca82c0'),
   'operator_hop', 1, 85, 'Montecasino', now() - INTERVAL '3 hours',
   '{"operators_visited":["Golden Dragon","Montecasino","Flamingo"],"time_window_hours":12}'::jsonb),

  ('6c0ce2f7-649a-4dda-93b0-156fea500ef8', '33333333-3333-3333-3333-333333333333',
   (SELECT pseudonym_token FROM player_pseudonym_tokens WHERE player_id = '6c0ce2f7-649a-4dda-93b0-156fea500ef8'),
   'operator_hop', 1, 78, 'Graceland Casino', now() - INTERVAL '1 day',
   '{"operators_visited":["Flamingo","Graceland","Golden Dragon"],"time_window_hours":18}'::jsonb),

  -- concurrent_session signals
  ('fb36fed0-cc75-45cd-80fa-fafac74af014', '11111111-1111-1111-1111-111111111111',
   (SELECT pseudonym_token FROM player_pseudonym_tokens WHERE player_id = 'fb36fed0-cc75-45cd-80fa-fafac74af014'),
   'concurrent_session', 45, 90, 'Online Platform', now() - INTERVAL '2 days',
   '{"overlap_minutes":45,"platforms":["Royal Palace","betway.co.za"]}'::jsonb),

  ('1ba52590-b67a-460f-b432-7e6c20f83901', '22222222-2222-2222-2222-222222222222',
   (SELECT pseudonym_token FROM player_pseudonym_tokens WHERE player_id = '1ba52590-b67a-460f-b432-7e6c20f83901'),
   'concurrent_session', 75, 95, 'Betway ZA', now() - INTERVAL '1 day',
   '{"overlap_minutes":75,"platforms":["Golden Dragon","betway.co.za","sportsbetting.co.za"]}'::jsonb),

  -- loss_chase signals
  ('0ba91179-b7e8-41d0-a804-187927b7f16d', '22222222-2222-2222-2222-222222222222',
   (SELECT pseudonym_token FROM player_pseudonym_tokens WHERE player_id = '0ba91179-b7e8-41d0-a804-187927b7f16d'),
   'loss_chase', 8500, 88, 'Flamingo Casino', now() - INTERVAL '7 hours',
   '{"single_session_loss":8500,"subsequent_deposits":3,"escalation_ratio":2.4}'::jsonb),

  ('3b1bc746-4ed8-4d6c-bf44-0118a00fd914', '11111111-1111-1111-1111-111111111111',
   (SELECT pseudonym_token FROM player_pseudonym_tokens WHERE player_id = '3b1bc746-4ed8-4d6c-bf44-0118a00fd914'),
   'loss_chase', 12000, 92, 'Emperors Palace Casino', now() - INTERVAL '2 days',
   '{"single_session_loss":12000,"subsequent_deposits":4,"escalation_ratio":3.1}'::jsonb),

  ('2bd52c04-8170-4720-8afe-79e1d79e0371', '33333333-3333-3333-3333-333333333333',
   (SELECT pseudonym_token FROM player_pseudonym_tokens WHERE player_id = '2bd52c04-8170-4720-8afe-79e1d79e0371'),
   'loss_chase', 15000, 96, 'Multiple Operators', now() - INTERVAL '5 hours',
   '{"single_session_loss":15000,"subsequent_deposits":5,"escalation_ratio":4.2}'::jsonb),

  -- deposit_escalation signals
  ('794f90e9-aec7-4c86-ae32-e2ecdbe48c2b', '22222222-2222-2222-2222-222222222222',
   (SELECT pseudonym_token FROM player_pseudonym_tokens WHERE player_id = '794f90e9-aec7-4c86-ae32-e2ecdbe48c2b'),
   'deposit_escalation', 3200, 70, 'Golden Dragon', now() - INTERVAL '10 hours',
   '{"deposits_24h":4,"total_deposited":3200,"escalation_pct":340}'::jsonb),

  ('4181cf8c-8b6e-41b7-a29e-65e6fe2d5140', '22222222-2222-2222-2222-222222222222',
   (SELECT pseudonym_token FROM player_pseudonym_tokens WHERE player_id = '4181cf8c-8b6e-41b7-a29e-65e6fe2d5140'),
   'deposit_escalation', 5500, 80, 'Multiple Operators', now() - INTERVAL '6 hours',
   '{"deposits_24h":6,"total_deposited":5500,"escalation_pct":460}'::jsonb),

  -- self_exclusion_flag signals
  ('56475e7a-e5e6-440c-99b7-8857c65ef5f8', '11111111-1111-1111-1111-111111111111',
   (SELECT pseudonym_token FROM player_pseudonym_tokens WHERE player_id = '56475e7a-e5e6-440c-99b7-8857c65ef5f8'),
   'self_exclusion_flag', 0, 100, 'NRG Registry', now(),
   '{"exclusion_register":"NRGP","registered_date":"2024-11-01","violation_detected":true}'::jsonb),

  ('9d86e73b-2fa9-402a-98cc-33de048346d4', '11111111-1111-1111-1111-111111111111',
   (SELECT pseudonym_token FROM player_pseudonym_tokens WHERE player_id = '9d86e73b-2fa9-402a-98cc-33de048346d4'),
   'self_exclusion_flag', 0, 100, 'NRG Registry', now() - INTERVAL '3 days',
   '{"exclusion_register":"NRGP","registered_date":"2024-09-15","violation_detected":true}'::jsonb),

  -- velocity_spike signals
  ('768215c7-dd81-4869-894e-4645a0aff9ee', '33333333-3333-3333-3333-333333333333',
   (SELECT pseudonym_token FROM player_pseudonym_tokens WHERE player_id = '768215c7-dd81-4869-894e-4645a0aff9ee'),
   'velocity_spike', 45, 83, 'Betway ZA', now() - INTERVAL '4 days',
   '{"bets_per_hour":45,"baseline_bets_per_hour":12,"spike_ratio":3.75}'::jsonb),

  -- multi_platform_deposit signals
  ('91fa1116-17bc-45b3-a31a-79d8fda2dd29', '11111111-1111-1111-1111-111111111111',
   (SELECT pseudonym_token FROM player_pseudonym_tokens WHERE player_id = '91fa1116-17bc-45b3-a31a-79d8fda2dd29'),
   'multi_platform_deposit', 7200, 88, 'Multiple Operators', now() - INTERVAL '2 days',
   '{"platforms_deposited":3,"total_amount":7200,"within_hours":4}'::jsonb)

ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- 3. Cross-Operator Alerts
-- ─────────────────────────────────────────────
DO $$
DECLARE
  v_token text;
BEGIN

  -- Alert 1: operator_hopping critical
  SELECT pseudonym_token INTO v_token FROM player_pseudonym_tokens WHERE player_id = '1ba52590-b67a-460f-b432-7e6c20f83901';
  INSERT INTO cross_operator_alerts (player_id, casino_id, pseudonym_token, alert_type, severity, status, detected_operators, operator_names, evidence, cross_operator_score, platforms_detected, total_cross_op_deposits, total_cross_op_losses, session_overlap_minutes, self_exclusion_violation, lookback_days, alert_message, recommendation, auto_generated, detected_at)
  VALUES ('1ba52590-b67a-460f-b432-7e6c20f83901', '22222222-2222-2222-2222-222222222222', v_token, 'operator_hopping', 'critical', 'new', 3, ARRAY['Royal Palace Casino','Golden Dragon Gaming'], '{"hops_in_24h":3,"pattern":"rapid_casino_hopping","risk_indicator":"loss_chasing_likely"}'::jsonb, 92, 3, 4200.00, 8500.00, 0, false, 30, 'Player detected at 3 casinos within 24 hours — rapid operator hopping consistent with loss-chasing behaviour.', 'Immediate intervention required. Contact player within 2 hours. Consider account review.', true, now() - INTERVAL '1 hour');

  -- Alert 2: operator_hopping high reviewed
  SELECT pseudonym_token INTO v_token FROM player_pseudonym_tokens WHERE player_id = '0b819c1d-004d-485e-a84c-910e2fca82c0';
  INSERT INTO cross_operator_alerts (player_id, casino_id, pseudonym_token, alert_type, severity, status, detected_operators, operator_names, evidence, cross_operator_score, platforms_detected, total_cross_op_deposits, total_cross_op_losses, session_overlap_minutes, self_exclusion_violation, lookback_days, alert_message, recommendation, auto_generated, detected_at)
  VALUES ('0b819c1d-004d-485e-a84c-910e2fca82c0', '22222222-2222-2222-2222-222222222222', v_token, 'operator_hopping', 'high', 'reviewed', 2, ARRAY['Golden Dragon Gaming','Montecasino'], '{"hops_in_24h":2,"pattern":"afternoon_hopping","risk_indicator":"moderate_velocity"}'::jsonb, 78, 2, 1800.00, 3200.00, 0, false, 30, 'Player visited 2 operators within a 12-hour window. Deposit velocity elevated.', 'Schedule welfare check. Monitor for 48 hours.', true, now() - INTERVAL '5 days');

  -- Alert 3: operator_hopping high actioned
  SELECT pseudonym_token INTO v_token FROM player_pseudonym_tokens WHERE player_id = '6c0ce2f7-649a-4dda-93b0-156fea500ef8';
  INSERT INTO cross_operator_alerts (player_id, casino_id, pseudonym_token, alert_type, severity, status, detected_operators, operator_names, evidence, cross_operator_score, platforms_detected, total_cross_op_deposits, total_cross_op_losses, session_overlap_minutes, self_exclusion_violation, lookback_days, alert_message, recommendation, auto_generated, detected_at)
  VALUES ('6c0ce2f7-649a-4dda-93b0-156fea500ef8', '33333333-3333-3333-3333-333333333333', v_token, 'operator_hopping', 'high', 'actioned', 3, ARRAY['Flamingo Casino','Graceland Casino'], '{"hops_in_24h":3,"pattern":"weekend_hopping","risk_indicator":"escalating_deposits"}'::jsonb, 82, 3, 2900.00, 5100.00, 0, false, 30, 'Operator hopping detected across 3 venues — deposits escalating at each stop.', 'Intervention dispatched via WhatsApp. Cooling-off recommended.', true, now() - INTERVAL '2 days');

  -- Alert 4: multi_platform_gambling critical
  SELECT pseudonym_token INTO v_token FROM player_pseudonym_tokens WHERE player_id = 'fb36fed0-cc75-45cd-80fa-fafac74af014';
  INSERT INTO cross_operator_alerts (player_id, casino_id, pseudonym_token, alert_type, severity, status, detected_operators, operator_names, evidence, cross_operator_score, platforms_detected, total_cross_op_deposits, total_cross_op_losses, session_overlap_minutes, self_exclusion_violation, lookback_days, alert_message, recommendation, auto_generated, detected_at)
  VALUES ('fb36fed0-cc75-45cd-80fa-fafac74af014', '11111111-1111-1111-1111-111111111111', v_token, 'multi_platform_gambling', 'critical', 'new', 3, ARRAY['Royal Palace Casino','Online Platform'], '{"platforms":["land_based","mobile_app","web_portal"],"concurrent_sessions":true}'::jsonb, 95, 3, 5500.00, 10800.00, 45, false, 30, 'Simultaneous gambling detected across land-based casino and 2 online platforms — session overlap of 45 minutes.', 'Mandatory welfare check. Multiple platform usage with concurrent sessions is a critical risk indicator.', true, now() - INTERVAL '2 days');

  -- Alert 5: multi_platform_gambling high reviewed
  SELECT pseudonym_token INTO v_token FROM player_pseudonym_tokens WHERE player_id = 'ff66dba9-da4a-42d9-af8f-8599ab25e243';
  INSERT INTO cross_operator_alerts (player_id, casino_id, pseudonym_token, alert_type, severity, status, detected_operators, operator_names, evidence, cross_operator_score, platforms_detected, total_cross_op_deposits, total_cross_op_losses, session_overlap_minutes, self_exclusion_violation, lookback_days, alert_message, recommendation, auto_generated, detected_at)
  VALUES ('ff66dba9-da4a-42d9-af8f-8599ab25e243', '33333333-3333-3333-3333-333333333333', v_token, 'multi_platform_gambling', 'high', 'reviewed', 2, ARRAY['Flamingo Casino','Online Platform'], '{"platforms":["land_based","mobile_app"],"concurrent_sessions":true}'::jsonb, 80, 2, 2200.00, 4600.00, 30, false, 30, 'Player active on mobile gambling app while visiting land-based casino.', 'Responsible gambling message dispatched. Follow up in 7 days.', true, now() - INTERVAL '4 days');

  -- Alert 6: multi_platform_gambling high new
  SELECT pseudonym_token INTO v_token FROM player_pseudonym_tokens WHERE player_id = '91fa1116-17bc-45b3-a31a-79d8fda2dd29';
  INSERT INTO cross_operator_alerts (player_id, casino_id, pseudonym_token, alert_type, severity, status, detected_operators, operator_names, evidence, cross_operator_score, platforms_detected, total_cross_op_deposits, total_cross_op_losses, session_overlap_minutes, self_exclusion_violation, lookback_days, alert_message, recommendation, auto_generated, detected_at)
  VALUES ('91fa1116-17bc-45b3-a31a-79d8fda2dd29', '11111111-1111-1111-1111-111111111111', v_token, 'multi_platform_gambling', 'high', 'new', 3, ARRAY['Royal Palace Casino','Online Platform'], '{"platforms":["land_based","sports_betting","casino_app"],"total_platforms":3}'::jsonb, 88, 3, 7200.00, 9100.00, 0, false, 30, 'Three-platform gambling pattern detected — R7,200 deposited across platforms in 4 hours.', 'Deposit limit advisory recommended. Contact player.', true, now() - INTERVAL '1.5 days');

  -- Alert 7: cross_operator_loss_chasing critical new
  SELECT pseudonym_token INTO v_token FROM player_pseudonym_tokens WHERE player_id = '0ba91179-b7e8-41d0-a804-187927b7f16d';
  INSERT INTO cross_operator_alerts (player_id, casino_id, pseudonym_token, alert_type, severity, status, detected_operators, operator_names, evidence, cross_operator_score, platforms_detected, total_cross_op_deposits, total_cross_op_losses, session_overlap_minutes, self_exclusion_violation, lookback_days, alert_message, recommendation, auto_generated, detected_at)
  VALUES ('0ba91179-b7e8-41d0-a804-187927b7f16d', '22222222-2222-2222-2222-222222222222', v_token, 'cross_operator_loss_chasing', 'critical', 'new', 2, ARRAY['Flamingo Casino','Golden Dragon Gaming'], '{"total_loss":8500,"subsequent_operators":2,"escalation_ratio":2.4,"recovery_bets":true}'::jsonb, 90, 2, 4800.00, 8500.00, 0, false, 30, 'Loss of R8,500 at primary casino followed by immediate re-deposit at competitor — classic cross-operator loss chasing.', 'Critical intervention required. Immediate outreach mandatory.', true, now() - INTERVAL '7 hours');

  -- Alert 8: cross_operator_loss_chasing critical actioned
  SELECT pseudonym_token INTO v_token FROM player_pseudonym_tokens WHERE player_id = '3b1bc746-4ed8-4d6c-bf44-0118a00fd914';
  INSERT INTO cross_operator_alerts (player_id, casino_id, pseudonym_token, alert_type, severity, status, detected_operators, operator_names, evidence, cross_operator_score, platforms_detected, total_cross_op_deposits, total_cross_op_losses, session_overlap_minutes, self_exclusion_violation, lookback_days, alert_message, recommendation, auto_generated, detected_at)
  VALUES ('3b1bc746-4ed8-4d6c-bf44-0118a00fd914', '11111111-1111-1111-1111-111111111111', v_token, 'cross_operator_loss_chasing', 'critical', 'actioned', 2, ARRAY['Royal Palace Casino','Emperors Palace Casino'], '{"total_loss":12000,"subsequent_operators":2,"escalation_ratio":3.1,"recovery_bets":true}'::jsonb, 94, 2, 6200.00, 12000.00, 0, false, 30, 'R12,000 loss followed by R6,200 in deposits across 2 alternative casinos within 3 hours.', 'Cooling-off period applied. Followed up with counselling referral.', true, now() - INTERVAL '2 days');

  -- Alert 9: cross_operator_loss_chasing critical new (highest)
  SELECT pseudonym_token INTO v_token FROM player_pseudonym_tokens WHERE player_id = '2bd52c04-8170-4720-8afe-79e1d79e0371';
  INSERT INTO cross_operator_alerts (player_id, casino_id, pseudonym_token, alert_type, severity, status, detected_operators, operator_names, evidence, cross_operator_score, platforms_detected, total_cross_op_deposits, total_cross_op_losses, session_overlap_minutes, self_exclusion_violation, lookback_days, alert_message, recommendation, auto_generated, detected_at)
  VALUES ('2bd52c04-8170-4720-8afe-79e1d79e0371', '33333333-3333-3333-3333-333333333333', v_token, 'cross_operator_loss_chasing', 'critical', 'new', 3, ARRAY['Flamingo Casino','Multiple Operators'], '{"total_loss":15000,"subsequent_operators":3,"escalation_ratio":4.2,"recovery_bets":true}'::jsonb, 97, 3, 8500.00, 15000.00, 0, false, 30, 'Most severe loss-chasing pattern detected — R15,000 loss triggering immediate deposits at 3 competitors.', 'Highest priority intervention. Manual compliance review required.', true, now() - INTERVAL '5 hours');

  -- Alert 10: self_exclusion_breach critical new
  SELECT pseudonym_token INTO v_token FROM player_pseudonym_tokens WHERE player_id = '56475e7a-e5e6-440c-99b7-8857c65ef5f8';
  INSERT INTO cross_operator_alerts (player_id, casino_id, pseudonym_token, alert_type, severity, status, detected_operators, operator_names, evidence, cross_operator_score, platforms_detected, total_cross_op_deposits, total_cross_op_losses, session_overlap_minutes, self_exclusion_violation, lookback_days, alert_message, recommendation, auto_generated, detected_at)
  VALUES ('56475e7a-e5e6-440c-99b7-8857c65ef5f8', '11111111-1111-1111-1111-111111111111', v_token, 'self_exclusion_breach', 'critical', 'new', 1, ARRAY['Royal Palace Casino'], '{"exclusion_register":"NRGP","exclusion_date":"2024-11-01","breach_detected":true,"days_excluded":104}'::jsonb, 100, 1, 850.00, 1200.00, 0, true, 30, 'CRITICAL: Player is registered on the NRGP self-exclusion register but has been detected gambling at this casino.', 'MANDATORY: Immediately suspend account. Report to NRGP within 24 hours. Legal obligation.', true, now());

  -- Alert 11: self_exclusion_breach critical actioned
  SELECT pseudonym_token INTO v_token FROM player_pseudonym_tokens WHERE player_id = '9d86e73b-2fa9-402a-98cc-33de048346d4';
  INSERT INTO cross_operator_alerts (player_id, casino_id, pseudonym_token, alert_type, severity, status, detected_operators, operator_names, evidence, cross_operator_score, platforms_detected, total_cross_op_deposits, total_cross_op_losses, session_overlap_minutes, self_exclusion_violation, lookback_days, alert_message, recommendation, auto_generated, detected_at)
  VALUES ('9d86e73b-2fa9-402a-98cc-33de048346d4', '11111111-1111-1111-1111-111111111111', v_token, 'self_exclusion_breach', 'critical', 'actioned', 1, ARRAY['Royal Palace Casino'], '{"exclusion_register":"NRGP","exclusion_date":"2024-09-15","breach_detected":true,"days_excluded":151}'::jsonb, 100, 1, 350.00, 600.00, 0, true, 30, 'Self-exclusion violation — player registered NRGP September 2024 detected at casino.', 'Account suspended. NRGP notified. Regulatory report filed.', true, now() - INTERVAL '2 days');

  -- Alert 12: velocity_spike high new
  SELECT pseudonym_token INTO v_token FROM player_pseudonym_tokens WHERE player_id = '768215c7-dd81-4869-894e-4645a0aff9ee';
  INSERT INTO cross_operator_alerts (player_id, casino_id, pseudonym_token, alert_type, severity, status, detected_operators, operator_names, evidence, cross_operator_score, platforms_detected, total_cross_op_deposits, total_cross_op_losses, session_overlap_minutes, self_exclusion_violation, lookback_days, alert_message, recommendation, auto_generated, detected_at)
  VALUES ('768215c7-dd81-4869-894e-4645a0aff9ee', '33333333-3333-3333-3333-333333333333', v_token, 'velocity_spike', 'high', 'new', 2, ARRAY['Flamingo Casino','Betway ZA'], '{"bets_per_hour":45,"baseline":12,"spike_ratio":3.75,"multi_operator":true}'::jsonb, 83, 2, 2100.00, 3800.00, 0, false, 30, 'Betting velocity 375% above baseline — spike simultaneous with activity on sports betting platform.', 'Monitor for 24 hours. Consider session time limit advisory.', true, now() - INTERVAL '3.5 days');

  -- Alert 13: deposit_escalation high new
  SELECT pseudonym_token INTO v_token FROM player_pseudonym_tokens WHERE player_id = '794f90e9-aec7-4c86-ae32-e2ecdbe48c2b';
  INSERT INTO cross_operator_alerts (player_id, casino_id, pseudonym_token, alert_type, severity, status, detected_operators, operator_names, evidence, cross_operator_score, platforms_detected, total_cross_op_deposits, total_cross_op_losses, session_overlap_minutes, self_exclusion_violation, lookback_days, alert_message, recommendation, auto_generated, detected_at)
  VALUES ('794f90e9-aec7-4c86-ae32-e2ecdbe48c2b', '22222222-2222-2222-2222-222222222222', v_token, 'deposit_escalation', 'high', 'new', 2, ARRAY['Golden Dragon Gaming','Online Platform'], '{"deposits_4h":4,"total":3200,"escalation_pct":340,"cross_operator":true}'::jsonb, 70, 2, 3200.00, 2100.00, 0, false, 30, '4 deposits totalling R3,200 in 4 hours across 2 operators — 340% escalation from 7-day average.', 'Deposit limit advisory. Follow up if pattern continues.', true, now() - INTERVAL '9.5 hours');

  -- Alert 14: deposit_escalation critical actioned
  SELECT pseudonym_token INTO v_token FROM player_pseudonym_tokens WHERE player_id = '4181cf8c-8b6e-41b7-a29e-65e6fe2d5140';
  INSERT INTO cross_operator_alerts (player_id, casino_id, pseudonym_token, alert_type, severity, status, detected_operators, operator_names, evidence, cross_operator_score, platforms_detected, total_cross_op_deposits, total_cross_op_losses, session_overlap_minutes, self_exclusion_violation, lookback_days, alert_message, recommendation, auto_generated, detected_at)
  VALUES ('4181cf8c-8b6e-41b7-a29e-65e6fe2d5140', '22222222-2222-2222-2222-222222222222', v_token, 'deposit_escalation', 'critical', 'actioned', 3, ARRAY['Golden Dragon Gaming','Multiple Operators'], '{"deposits_4h":6,"total":5500,"escalation_pct":460,"cross_operator":true}'::jsonb, 85, 3, 5500.00, 4800.00, 0, false, 30, '6 deposits across 3 operators in 4 hours — 460% escalation. Pattern indicates urgency.', 'Deposit limit enforced. Player contacted via WhatsApp. Follow-up scheduled.', true, now() - INTERVAL '5.5 days');

  -- Alert 15: cross_operator_high_risk critical new (composite)
  SELECT pseudonym_token INTO v_token FROM player_pseudonym_tokens WHERE player_id = '1ba52590-b67a-460f-b432-7e6c20f83901';
  INSERT INTO cross_operator_alerts (player_id, casino_id, pseudonym_token, alert_type, severity, status, detected_operators, operator_names, evidence, cross_operator_score, platforms_detected, total_cross_op_deposits, total_cross_op_losses, session_overlap_minutes, self_exclusion_violation, lookback_days, alert_message, recommendation, auto_generated, detected_at)
  VALUES ('1ba52590-b67a-460f-b432-7e6c20f83901', '22222222-2222-2222-2222-222222222222', v_token, 'cross_operator_high_risk', 'critical', 'new', 4, ARRAY['Golden Dragon Gaming','Multiple Operators'], '{"triggers":["operator_hopping","concurrent_session","loss_chasing"],"composite_score":92}'::jsonb, 92, 4, 6800.00, 14200.00, 75, false, 30, 'Multiple simultaneous risk signals: operator hopping, concurrent sessions, and cross-operator loss chasing all detected within 6 hours.', 'Highest urgency. Manual compliance review and immediate intervention required.', true, now() - INTERVAL '18 minutes');

  -- Alert 16: cross_operator_high_risk high reviewed
  SELECT pseudonym_token INTO v_token FROM player_pseudonym_tokens WHERE player_id = 'ff66dba9-da4a-42d9-af8f-8599ab25e243';
  INSERT INTO cross_operator_alerts (player_id, casino_id, pseudonym_token, alert_type, severity, status, detected_operators, operator_names, evidence, cross_operator_score, platforms_detected, total_cross_op_deposits, total_cross_op_losses, session_overlap_minutes, self_exclusion_violation, lookback_days, alert_message, recommendation, auto_generated, detected_at)
  VALUES ('ff66dba9-da4a-42d9-af8f-8599ab25e243', '33333333-3333-3333-3333-333333333333', v_token, 'cross_operator_high_risk', 'high', 'reviewed', 2, ARRAY['Flamingo Casino','Online Platform'], '{"triggers":["multi_platform","velocity_spike"],"composite_score":80}'::jsonb, 80, 2, 3100.00, 5900.00, 30, false, 30, 'Dual-trigger cross-operator alert: concurrent multi-platform activity with elevated betting velocity.', 'Welfare check conducted. Player agreed to voluntary session limits.', true, now() - INTERVAL '4 days');

  -- Alert 17: cross_operator_high_risk critical actioned
  SELECT pseudonym_token INTO v_token FROM player_pseudonym_tokens WHERE player_id = '3b1bc746-4ed8-4d6c-bf44-0118a00fd914';
  INSERT INTO cross_operator_alerts (player_id, casino_id, pseudonym_token, alert_type, severity, status, detected_operators, operator_names, evidence, cross_operator_score, platforms_detected, total_cross_op_deposits, total_cross_op_losses, session_overlap_minutes, self_exclusion_violation, lookback_days, alert_message, recommendation, auto_generated, detected_at)
  VALUES ('3b1bc746-4ed8-4d6c-bf44-0118a00fd914', '11111111-1111-1111-1111-111111111111', v_token, 'cross_operator_high_risk', 'critical', 'actioned', 3, ARRAY['Royal Palace Casino','Multiple Operators'], '{"triggers":["loss_chasing","operator_hopping","deposit_escalation"],"composite_score":94}'::jsonb, 94, 3, 8900.00, 16500.00, 0, false, 30, 'Tri-signal critical: loss chasing + operator hopping + deposit escalation — all active simultaneously.', 'Cooling-off enforced. NRGP notified. Full compliance audit initiated.', true, now() - INTERVAL '2.5 days');

  -- Alert 18: operator_hopping dismissed
  SELECT pseudonym_token INTO v_token FROM player_pseudonym_tokens WHERE player_id = '533d0fd8-4361-45e7-a937-2dc6062bec45';
  INSERT INTO cross_operator_alerts (player_id, casino_id, pseudonym_token, alert_type, severity, status, detected_operators, operator_names, evidence, cross_operator_score, platforms_detected, total_cross_op_deposits, total_cross_op_losses, session_overlap_minutes, self_exclusion_violation, lookback_days, alert_message, recommendation, auto_generated, detected_at, false_positive)
  VALUES ('533d0fd8-4361-45e7-a937-2dc6062bec45', '11111111-1111-1111-1111-111111111111', v_token, 'operator_hopping', 'medium', 'dismissed', 2, ARRAY['Royal Palace Casino','Sibaya Casino'], '{"hops_in_24h":2,"pattern":"casual_visit","risk_indicator":"low_velocity"}'::jsonb, 45, 2, 650.00, 400.00, 0, false, 30, 'Two-operator visit pattern — low velocity, appears recreational.', 'False positive — verified recreational player. No action required.', true, now() - INTERVAL '18 days', true);

  -- Alert 19: velocity_spike medium reviewed
  SELECT pseudonym_token INTO v_token FROM player_pseudonym_tokens WHERE player_id = '1b9e2d54-1983-4fc2-b4f0-dde5e7bdb457';
  INSERT INTO cross_operator_alerts (player_id, casino_id, pseudonym_token, alert_type, severity, status, detected_operators, operator_names, evidence, cross_operator_score, platforms_detected, total_cross_op_deposits, total_cross_op_losses, session_overlap_minutes, self_exclusion_violation, lookback_days, alert_message, recommendation, auto_generated, detected_at)
  VALUES ('1b9e2d54-1983-4fc2-b4f0-dde5e7bdb457', '33333333-3333-3333-3333-333333333333', v_token, 'velocity_spike', 'medium', 'reviewed', 1, ARRAY['Flamingo Casino'], '{"bets_per_hour":38,"baseline":10,"spike_ratio":3.8}'::jsonb, 75, 1, 1400.00, 2400.00, 0, false, 30, 'Elevated betting velocity detected — 3.8x baseline rate sustained over 2 hours.', 'Responsible gambling reminder dispatched.', true, now() - INTERVAL '7 days');

  -- Alert 20: deposit_escalation medium dismissed (false positive)
  SELECT pseudonym_token INTO v_token FROM player_pseudonym_tokens WHERE player_id = '1db01070-ee7a-499e-b399-fe7a7593e51d';
  INSERT INTO cross_operator_alerts (player_id, casino_id, pseudonym_token, alert_type, severity, status, detected_operators, operator_names, evidence, cross_operator_score, platforms_detected, total_cross_op_deposits, total_cross_op_losses, session_overlap_minutes, self_exclusion_violation, lookback_days, alert_message, recommendation, auto_generated, detected_at, false_positive)
  VALUES ('1db01070-ee7a-499e-b399-fe7a7593e51d', '22222222-2222-2222-2222-222222222222', v_token, 'deposit_escalation', 'medium', 'dismissed', 1, ARRAY['Golden Dragon Gaming'], '{"deposits_4h":3,"total":2800,"escalation_pct":280}'::jsonb, 65, 1, 2800.00, 1900.00, 0, false, 30, 'Deposit escalation pattern — 280% above average. Single operator.', 'False positive confirmed — player disclosed income change. Dismissed.', true, now() - INTERVAL '13 days', true);

  -- Alert 21: multi_platform_gambling low new (mild)
  SELECT pseudonym_token INTO v_token FROM player_pseudonym_tokens WHERE player_id = 'df1c8cad-2b41-41a2-8fb1-1cccc7ae9e81';
  INSERT INTO cross_operator_alerts (player_id, casino_id, pseudonym_token, alert_type, severity, status, detected_operators, operator_names, evidence, cross_operator_score, platforms_detected, total_cross_op_deposits, total_cross_op_losses, session_overlap_minutes, self_exclusion_violation, lookback_days, alert_message, recommendation, auto_generated, detected_at)
  VALUES ('df1c8cad-2b41-41a2-8fb1-1cccc7ae9e81', '33333333-3333-3333-3333-333333333333', v_token, 'multi_platform_gambling', 'medium', 'new', 2, ARRAY['Flamingo Casino','Multiple Operators'], '{"platforms_deposited":2,"total_amount":4800,"within_hours":6}'::jsonb, 78, 2, 4800.00, 3100.00, 0, false, 30, 'Multi-platform deposits detected: R4,800 across 2 operators within 6 hours.', 'Send educational responsible gambling content.', true, now() - INTERVAL '5 days');

END $$;
