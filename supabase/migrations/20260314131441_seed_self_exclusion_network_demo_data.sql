/*
  # Seed Self-Exclusion Network Demo Data

  ## Overview
  Realistic demo data for the Self-Exclusion Monitoring Network including:
  - All 13 casinos enrolled as network subscribers
  - 10 exclusion events from various operators
  - Protection broadcasts distributed network-wide
  - Acknowledgements from receiving operators
  - 4 breach detections representing active violations
*/

-- ─────────────────────────────────────────────
-- 1. Enrol all casinos as network subscribers
-- ─────────────────────────────────────────────
INSERT INTO sen_operator_subscriptions
  (casino_id, subscription_type, is_active, receives_broadcasts, submits_events,
   enrolled_at, total_events_submitted, total_broadcasts_received)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'full_network',           true, true, true, now() - INTERVAL '180 days', 5, 47),
  ('22222222-2222-2222-2222-222222222222', 'full_network',           true, true, true, now() - INTERVAL '170 days', 4, 45),
  ('33333333-3333-3333-3333-333333333333', 'full_network',           true, true, true, now() - INTERVAL '160 days', 3, 44),
  ('44444444-5555-6666-7777-888888888888', 'full_network',           true, true, true, now() - INTERVAL '155 days', 2, 41),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'full_network',           true, true, true, now() - INTERVAL '150 days', 1, 39),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'province_only',          true, true, true, now() - INTERVAL '140 days', 1, 30),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'full_network',           true, true, true, now() - INTERVAL '135 days', 1, 38),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'mutual',                 true, true, true, now() - INTERVAL '120 days', 0, 25),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'full_network',           true, true, true, now() - INTERVAL '110 days', 1, 22),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'full_network',           true, true, true, now() - INTERVAL '100 days', 0, 20),
  ('11111111-2222-3333-4444-555555555555', 'national_register_only', true, true, false, now() - INTERVAL '90 days',  0, 18),
  ('22222222-3333-4444-5555-666666666666', 'province_only',          true, true, true, now() - INTERVAL '80 days',  0, 15),
  ('33333333-4444-5555-6666-777777777777', 'full_network',           true, true, true, now() - INTERVAL '60 days',  0, 12)
ON CONFLICT (casino_id) DO NOTHING;

-- ─────────────────────────────────────────────
-- 2. Exclusion Events
-- ─────────────────────────────────────────────
INSERT INTO sen_exclusion_events
  (submitting_casino_id, player_id, pseudonym_token, exclusion_type, exclusion_reason,
   duration_months, exclusion_start_date, exclusion_end_date, is_permanent,
   risk_score_at_exclusion, trigger_event, cross_operator_history, previous_exclusions,
   status, validated_at, broadcast_at, reported_to_nrgp, nrgp_reference, created_at)
VALUES
  ('11111111-1111-1111-1111-111111111111',
   (SELECT id FROM players WHERE casino_id = '11111111-1111-1111-1111-111111111111' AND risk_score >= 85 LIMIT 1),
   COALESCE(
     (SELECT ppt.pseudonym_token FROM player_pseudonym_tokens ppt JOIN players p ON p.id = ppt.player_id
      WHERE ppt.casino_id = '11111111-1111-1111-1111-111111111111' AND p.risk_score >= 85 LIMIT 1),
     encode(sha256('royal-palace-event-001-v1'::bytea),'hex')
   ),
   'voluntary_self_exclusion', 'Player requested exclusion after significant losses and expressed distress.',
   24, CURRENT_DATE - 45, (CURRENT_DATE - 45) + INTERVAL '24 months', false,
   92, 'large_loss_event', true, 1,
   'broadcast', now() - INTERVAL '45 days', now() - INTERVAL '44 days',
   true, 'NRGP-2025-001847', now() - INTERVAL '45 days'),

  ('22222222-2222-2222-2222-222222222222',
   (SELECT id FROM players WHERE casino_id = '22222222-2222-2222-2222-222222222222' AND risk_score >= 90 LIMIT 1),
   COALESCE(
     (SELECT ppt.pseudonym_token FROM player_pseudonym_tokens ppt JOIN players p ON p.id = ppt.player_id
      WHERE ppt.casino_id = '22222222-2222-2222-2222-222222222222' AND p.risk_score >= 90 LIMIT 1),
     encode(sha256('golden-dragon-event-002-v1'::bytea),'hex')
   ),
   'operator_initiated', 'Operator identified critical loss-chasing pattern and mandatory exclusion applied.',
   12, CURRENT_DATE - 30, (CURRENT_DATE - 30) + INTERVAL '12 months', false,
   96, 'intervention_escalation', true, 0,
   'broadcast', now() - INTERVAL '30 days', now() - INTERVAL '29 days',
   false, null, now() - INTERVAL '30 days'),

  ('33333333-3333-3333-3333-333333333333', NULL,
   encode(sha256('regulatory-order-silver-star-003-v1'::bytea), 'hex'),
   'regulatory_order', 'Provincial regulator ordered exclusion following AML investigation.',
   60, CURRENT_DATE - 120, (CURRENT_DATE - 120) + INTERVAL '60 months', false,
   88, 'regulatory_directive', true, 2,
   'broadcast', now() - INTERVAL '120 days', now() - INTERVAL '119 days',
   true, 'NRGP-2025-000392', now() - INTERVAL '120 days'),

  ('11111111-1111-1111-1111-111111111111', NULL,
   encode(sha256('national-permanent-004-v1'::bytea), 'hex'),
   'national_register', 'Permanent self-exclusion via NRGP national register portal.',
   120, CURRENT_DATE - 200, (CURRENT_DATE - 200) + INTERVAL '120 months', true,
   78, 'nrgp_portal_submission', false, 3,
   'broadcast', now() - INTERVAL '200 days', now() - INTERVAL '199 days',
   true, 'NRGP-2024-012234', now() - INTERVAL '200 days'),

  ('44444444-5555-6666-7777-888888888888', NULL,
   encode(sha256('family-requested-montecasino-005-v1'::bytea), 'hex'),
   'family_requested', 'Family member submitted exclusion application on behalf of player.',
   6, CURRENT_DATE - 15, (CURRENT_DATE - 15) + INTERVAL '6 months', false,
   65, 'family_intervention', false, 0,
   'broadcast', now() - INTERVAL '15 days', now() - INTERVAL '14 days',
   false, null, now() - INTERVAL '15 days'),

  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL,
   encode(sha256('voluntary-ep-006-v1'::bytea), 'hex'),
   'voluntary_self_exclusion', 'Player voluntarily requested 6-month break after counselling session.',
   6, CURRENT_DATE - 8, (CURRENT_DATE - 8) + INTERVAL '6 months', false,
   71, 'counselling_followup', true, 0,
   'broadcast', now() - INTERVAL '8 days', now() - INTERVAL '7 days',
   false, null, now() - INTERVAL '8 days'),

  ('cccccccc-cccc-cccc-cccc-cccccccccccc', NULL,
   encode(sha256('sibaya-validated-007-v1'::bytea), 'hex'),
   'operator_initiated', 'Mandatory exclusion after three intervention refusals in 30 days.',
   18, CURRENT_DATE - 1, (CURRENT_DATE - 1) + INTERVAL '18 months', false,
   82, 'intervention_refused_3x', true, 1,
   'validated', now() - INTERVAL '2 hours', null,
   false, null, now() - INTERVAL '1 day'),

  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NULL,
   encode(sha256('sun-pending-008-v1'::bytea), 'hex'),
   'voluntary_self_exclusion', 'Player submitted exclusion form at self-service kiosk.',
   12, CURRENT_DATE, CURRENT_DATE + INTERVAL '12 months', false,
   58, 'kiosk_submission', false, 0,
   'pending', null, null,
   false, null, now() - INTERVAL '2 hours'),

  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', NULL,
   encode(sha256('meropa-national-009-v1'::bytea), 'hex'),
   'national_register', 'Submitted via NRGP national portal — 5 year exclusion.',
   60, CURRENT_DATE - 90, (CURRENT_DATE - 90) + INTERVAL '60 months', false,
   80, 'nrgp_portal', false, 2,
   'broadcast', now() - INTERVAL '90 days', now() - INTERVAL '89 days',
   true, 'NRGP-2025-004511', now() - INTERVAL '90 days'),

  ('22222222-2222-2222-2222-222222222222', NULL,
   encode(sha256('golden-dragon-second-010-v1'::bytea), 'hex'),
   'voluntary_self_exclusion', 'Player expressed concern about gambling frequency during welfare check.',
   6, CURRENT_DATE - 5, (CURRENT_DATE - 5) + INTERVAL '6 months', false,
   68, 'welfare_check', false, 0,
   'broadcast', now() - INTERVAL '5 days', now() - INTERVAL '4 days',
   false, null, now() - INTERVAL '5 days');

-- ─────────────────────────────────────────────
-- 3. Protection Broadcasts
-- ─────────────────────────────────────────────
INSERT INTO sen_protection_broadcasts
  (exclusion_event_id, originating_casino_id, pseudonym_token,
   broadcast_scope, protection_action, protection_level, confidence_score,
   exclusion_type, duration_months, is_permanent, risk_score_at_exclusion,
   cross_operator_pattern, previous_exclusions,
   valid_from, valid_until, is_active, operators_notified, acknowledgements_received, last_delivered_at)
SELECT
  e.id,
  e.submitting_casino_id,
  e.pseudonym_token,
  CASE
    WHEN e.exclusion_type IN ('regulatory_order', 'national_register') THEN 'national_register'
    WHEN e.risk_score_at_exclusion >= 85 THEN 'full_network'
    ELSE 'full_network'
  END,
  CASE
    WHEN e.is_permanent OR e.exclusion_type IN ('regulatory_order', 'national_register') THEN 'block_access'
    WHEN e.risk_score_at_exclusion >= 80 THEN 'block_access'
    WHEN e.risk_score_at_exclusion >= 60 THEN 'flag_for_review'
    ELSE 'mandatory_check'
  END,
  CASE
    WHEN e.is_permanent OR e.exclusion_type IN ('regulatory_order', 'national_register') THEN 'mandatory'
    WHEN e.risk_score_at_exclusion >= 80 THEN 'standard'
    ELSE 'advisory'
  END,
  CASE
    WHEN e.exclusion_type IN ('regulatory_order', 'national_register') THEN 100
    WHEN e.risk_score_at_exclusion >= 85 THEN 95
    ELSE 85
  END,
  e.exclusion_type,
  e.duration_months,
  e.is_permanent,
  e.risk_score_at_exclusion,
  e.cross_operator_history,
  e.previous_exclusions,
  e.exclusion_start_date::timestamptz,
  e.exclusion_end_date::timestamptz,
  (e.exclusion_end_date >= CURRENT_DATE),
  13,
  (8 + FLOOR(random() * 5))::integer,
  now() - (random() * INTERVAL '24 hours')
FROM sen_exclusion_events e
WHERE e.status = 'broadcast';

-- ─────────────────────────────────────────────
-- 4. Broadcast Acknowledgements
-- ─────────────────────────────────────────────
INSERT INTO sen_broadcast_acknowledgements
  (broadcast_id, receiving_casino_id, acknowledged_at, action_taken, notes)
SELECT
  b.id,
  c.id,
  b.created_at + (random() * INTERVAL '6 hours'),
  (ARRAY['blocked','flagged','noted','player_not_found','already_excluded'])[1 + FLOOR(random()*5)::integer],
  (ARRAY[
    'Protection applied to player matching token.',
    'Token checked — player not present in our system.',
    'Noted and added to watchlist.'
  ])[1 + FLOOR(random()*3)::integer]
FROM sen_protection_broadcasts b
CROSS JOIN casinos c
WHERE c.id != b.originating_casino_id
  AND c.id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    '44444444-5555-6666-7777-888888888888',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
  )
  AND random() > 0.35
ON CONFLICT (broadcast_id, receiving_casino_id) DO NOTHING;

-- ─────────────────────────────────────────────
-- 5. Breach Detections
-- ─────────────────────────────────────────────
DO $$
DECLARE
  v_broadcast_id uuid;
  v_event_id uuid;
  v_token text;
  v_origin uuid;
  r record;
  breach_casinos uuid[] := ARRAY[
    '22222222-2222-2222-2222-222222222222'::uuid,
    '33333333-3333-3333-3333-333333333333'::uuid,
    '44444444-5555-6666-7777-888888888888'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  ];
  breach_methods text[] := ARRAY['token_match','login_trigger','token_match','deposit_trigger'];
  breach_contexts text[] := ARRAY['deposit','login','deposit','deposit'];
  breach_actions text[] := ARRAY['deposit_blocked','account_suspended','account_suspended',NULL];
  breach_times integer[] := ARRAY[4,2,8,NULL];
  breach_amounts numeric[] := ARRAY[500.00,0.00,2200.00,1500.00];
  breach_sessions integer[] := ARRAY[0,8,45,22];
  breach_statuses text[] := ARRAY['responded','reported','closed','open'];
  breach_reg boolean[] := ARRAY[true,true,true,false];
  breach_nrgp boolean[] := ARRAY[true,true,true,false];
  breach_offsets interval[] := ARRAY[INTERVAL '10 days',INTERVAL '5 days',INTERVAL '3 days',INTERVAL '30 minutes'];
  i integer;
BEGIN
  FOR i IN 1..4 LOOP
    -- pick the i-th broadcast that doesn't originate from the detecting casino
    SELECT b.id, b.exclusion_event_id, b.pseudonym_token, b.originating_casino_id
    INTO v_broadcast_id, v_event_id, v_token, v_origin
    FROM sen_protection_broadcasts b
    WHERE b.is_active = true
      AND b.originating_casino_id != breach_casinos[i]
    ORDER BY b.created_at
    LIMIT 1 OFFSET (i-1);

    IF v_broadcast_id IS NOT NULL THEN
      INSERT INTO sen_breach_detections
        (broadcast_id, exclusion_event_id, detecting_casino_id, originating_casino_id,
         pseudonym_token, detection_method, detection_context, response_action,
         response_time_minutes, amount_deposited_before_detection, session_duration_before_detection,
         severity, status, regulatory_report_filed, nrgp_notified, detected_at, responded_at)
      VALUES
        (v_broadcast_id, v_event_id, breach_casinos[i], v_origin,
         v_token, breach_methods[i], breach_contexts[i], breach_actions[i],
         breach_times[i], breach_amounts[i], breach_sessions[i],
         'critical', breach_statuses[i], breach_reg[i], breach_nrgp[i],
         now() - breach_offsets[i],
         CASE WHEN breach_actions[i] IS NOT NULL
           THEN (now() - breach_offsets[i]) + (COALESCE(breach_times[i],0) * INTERVAL '1 minute')
           ELSE NULL END);
    END IF;
  END LOOP;
END $$;
