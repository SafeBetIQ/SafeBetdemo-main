/*
  # GuardianLayer Comprehensive Demo Data Seed v2
  Seeds all GuardianLayer tables with realistic synthetic data
*/

-- Clear existing data
DELETE FROM guardian_intervention_signals;
DELETE FROM guardian_school_hour_flags;
DELETE FROM guardian_identity_drift;
DELETE FROM guardian_device_intelligence;
DELETE FROM guardian_operator_risk_summary;
DELETE FROM guardian_province_risk_summary;
DELETE FROM guardian_minor_risk_scores;

-- Seed Device Intelligence (120 records, 34 high-risk)
INSERT INTO guardian_device_intelligence (device_id, casino_id, ip_address, ip_consistency_score, login_pattern_cluster, session_overlap_detected, fingerprint_shift_score, shared_device_probability, device_identity_shift_score, linked_accounts_count, high_risk_device, repeat_flagged, device_reuse_frequency, first_seen_at, last_seen_at)
SELECT
  'DEV-' || LPAD(gs::text, 5, '0'),
  CASE gs % 3
    WHEN 0 THEN '11111111-1111-1111-1111-111111111111'::uuid
    WHEN 1 THEN '22222222-2222-2222-2222-222222222222'::uuid
    ELSE '33333333-3333-3333-3333-333333333333'::uuid
  END,
  '41.' || (100 + gs % 50)::text || '.' || (gs % 255)::text || '.' || (gs % 200)::text,
  ROUND((0.300 + random() * 0.700)::numeric, 3),
  CASE gs % 5
    WHEN 0 THEN 'morning_cluster'
    WHEN 1 THEN 'school_hour_cluster'
    WHEN 2 THEN 'late_night_cluster'
    WHEN 3 THEN 'weekend_cluster'
    ELSE 'erratic_cluster'
  END,
  gs % 7 = 0,
  ROUND((random() * 0.900)::numeric, 3),
  ROUND((random() * 0.950)::numeric, 3),
  ROUND((random() * 1.000)::numeric, 3),
  (gs % 8) + 1,
  gs <= 34,
  gs <= 20,
  (gs % 15) + 1,
  now() - (random() * 365 || ' days')::interval,
  now() - (random() * 30 || ' days')::interval
FROM generate_series(1, 120) gs;

-- Seed Minor Risk Scores for players (300 records with varied risk levels)
INSERT INTO guardian_minor_risk_scores (player_id, casino_id, risk_score, risk_category, risk_trend, risk_change_delta, betting_velocity_score, reaction_time_score, micro_bet_frequency, session_anomaly_score, school_hour_activity_flag, game_switch_impulsivity, loss_chasing_score, device_mismatch_score, calculated_at)
SELECT
  p.id,
  p.casino_id,
  CASE
    WHEN p.rn <= 60 THEN ROUND((80.000 + random() * 20.000)::numeric, 3)
    WHEN p.rn <= 150 THEN ROUND((60.000 + random() * 19.999)::numeric, 3)
    WHEN p.rn <= 240 THEN ROUND((30.000 + random() * 29.999)::numeric, 3)
    ELSE ROUND((random() * 29.999)::numeric, 3)
  END,
  CASE
    WHEN p.rn <= 60 THEN 'Critical'
    WHEN p.rn <= 150 THEN 'High'
    WHEN p.rn <= 240 THEN 'Medium'
    ELSE 'Low'
  END,
  CASE p.rn % 3 WHEN 0 THEN 'increasing' WHEN 1 THEN 'stable' ELSE 'decreasing' END,
  ROUND((-15.000 + random() * 30.000)::numeric, 3),
  ROUND((random() * 100.000)::numeric, 3),
  ROUND((random() * 100.000)::numeric, 3),
  ROUND((random() * 100.000)::numeric, 3),
  ROUND((random() * 100.000)::numeric, 3),
  p.rn <= 150,
  ROUND((random() * 100.000)::numeric, 3),
  ROUND((random() * 100.000)::numeric, 3),
  ROUND((random() * 100.000)::numeric, 3),
  now() - (random() * 30 || ' days')::interval
FROM (
  SELECT id, casino_id, ROW_NUMBER() OVER (ORDER BY random()) AS rn
  FROM players
  WHERE casino_id IN (
    '11111111-1111-1111-1111-111111111111'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid,
    '33333333-3333-3333-3333-333333333333'::uuid
  )
  LIMIT 300
) p;

-- Seed Identity Drift (78 records)
INSERT INTO guardian_identity_drift (player_id, device_id, casino_id, drift_score, behavioral_signature_change, time_of_day_shift, stake_size_shift, gameplay_pattern_deviation, drift_threshold_exceeded, drift_spike_detected, repeat_drift_flag, cross_account_similarity_score, intervention_recommended, detected_at)
SELECT
  p.id,
  'DEV-' || LPAD((1 + (p.rn % 120))::text, 5, '0'),
  p.casino_id,
  ROUND((0.400 + random() * 0.600)::numeric, 3),
  true,
  p.rn % 3 = 0,
  p.rn % 2 = 0,
  true,
  p.rn <= 45,
  p.rn <= 25,
  p.rn <= 15,
  ROUND((0.500 + random() * 0.500)::numeric, 3),
  p.rn <= 45,
  now() - (random() * 180 || ' days')::interval
FROM (
  SELECT id, casino_id, ROW_NUMBER() OVER (ORDER BY random()) AS rn
  FROM players
  WHERE casino_id IN (
    '11111111-1111-1111-1111-111111111111'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid,
    '33333333-3333-3333-3333-333333333333'::uuid
  )
  LIMIT 78
) p;

-- Seed School Hour Flags (300 records)
INSERT INTO guardian_school_hour_flags (player_id, casino_id, session_start, session_end, is_school_hours, is_weekday, province, geo_latitude, geo_longitude, within_school_zone, school_hour_activity_ratio, risk_multiplier)
SELECT
  p.id,
  p.casino_id,
  (now() - (p.rn * 1.2 || ' days')::interval)::date::timestamptz + (CASE WHEN p.rn % 10 < 7 THEN ((8 + (random() * 7)::int) || ' hours')::interval ELSE ((16 + (random() * 6)::int) || ' hours')::interval END),
  (now() - (p.rn * 1.2 || ' days')::interval)::date::timestamptz + (CASE WHEN p.rn % 10 < 7 THEN ((10 + (random() * 5)::int) || ' hours')::interval ELSE ((19 + (random() * 4)::int) || ' hours')::interval END),
  p.rn % 10 < 7,
  p.rn % 7 < 5,
  CASE p.rn % 3
    WHEN 0 THEN 'Gauteng'
    WHEN 1 THEN 'Western Cape'
    ELSE 'KwaZulu-Natal'
  END,
  CASE p.rn % 3
    WHEN 0 THEN -26.195 + (random() * 0.500 - 0.250)
    WHEN 1 THEN -33.925 + (random() * 0.500 - 0.250)
    ELSE -29.858 + (random() * 0.500 - 0.250)
  END,
  CASE p.rn % 3
    WHEN 0 THEN 28.034 + (random() * 0.500 - 0.250)
    WHEN 1 THEN 18.424 + (random() * 0.500 - 0.250)
    ELSE 31.021 + (random() * 0.500 - 0.250)
  END,
  p.rn % 5 = 0,
  ROUND((0.100 + random() * 0.900)::numeric, 3),
  CASE WHEN p.rn % 10 < 7 THEN ROUND((1.200 + random() * 0.800)::numeric, 3) ELSE 1.000 END
FROM (
  SELECT id, casino_id, ROW_NUMBER() OVER (ORDER BY random()) AS rn
  FROM players
  WHERE casino_id IN (
    '11111111-1111-1111-1111-111111111111'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid,
    '33333333-3333-3333-3333-333333333333'::uuid
  )
  LIMIT 300
) p;

-- Seed Intervention Signals (300 records, 45 escalations)
INSERT INTO guardian_intervention_signals (player_id, casino_id, signal_type, trigger_reason, risk_score, casino_response_status, response_time_minutes, action_taken, escalation_stage, resolution_outcome, resolved_at)
SELECT
  p.id,
  p.casino_id,
  CASE p.rn % 5
    WHEN 0 THEN 'Compliance escalation triggered'
    WHEN 1 THEN 'Re-verification recommended'
    WHEN 2 THEN 'Biometric re-check suggested'
    WHEN 3 THEN 'Session review required'
    ELSE 'Temporary freeze suggested'
  END,
  CASE p.rn % 8
    WHEN 0 THEN 'School-hour activity detected during term time'
    WHEN 1 THEN 'Identity drift score exceeded 0.750 threshold'
    WHEN 2 THEN 'Device shared across 5+ accounts'
    WHEN 3 THEN 'Micro-bet frequency spike in school hours'
    WHEN 4 THEN 'Behavioral signature mismatch detected'
    WHEN 5 THEN 'Loss chasing pattern at 08:30 on weekday'
    WHEN 6 THEN 'Reaction time anomaly: 120ms avg (minor indicator)'
    ELSE 'Cross-account similarity score 0.890'
  END,
  ROUND((40.000 + random() * 60.000)::numeric, 3),
  CASE p.rn % 6
    WHEN 0 THEN 'pending'
    WHEN 1 THEN 'acknowledged'
    WHEN 2 THEN 'investigating'
    WHEN 3 THEN 'action_taken'
    WHEN 4 THEN 'resolved'
    ELSE 'dismissed'
  END,
  CASE WHEN p.rn % 6 > 0 THEN (5 + (random() * 120)::int) ELSE NULL END,
  CASE p.rn % 6
    WHEN 3 THEN 'KYC document re-requested from player'
    WHEN 4 THEN 'Account verified — adult confirmed, risk downgraded'
    WHEN 5 THEN 'Signal dismissed after manual review'
    ELSE NULL
  END,
  CASE WHEN p.rn <= 45 THEN 3 WHEN p.rn <= 100 THEN 2 ELSE 1 END,
  CASE p.rn % 6
    WHEN 4 THEN 'Verified adult — no further action'
    WHEN 5 THEN 'False positive — dismissed'
    ELSE NULL
  END,
  CASE WHEN p.rn % 6 IN (4, 5) THEN now() - (random() * 30 || ' days')::interval ELSE NULL END
FROM (
  SELECT id, casino_id, ROW_NUMBER() OVER (ORDER BY random()) AS rn
  FROM players
  WHERE casino_id IN (
    '11111111-1111-1111-1111-111111111111'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid,
    '33333333-3333-3333-3333-333333333333'::uuid
  )
  LIMIT 300
) p;

-- Seed Operator Risk Summaries (3 casinos x 12 months)
INSERT INTO guardian_operator_risk_summary (casino_id, summary_date, underage_suspicion_rate, device_risk_index, average_response_time_minutes, escalation_compliance_percent, total_minor_risk_alerts, total_identity_drift_alerts, total_device_shifts, total_interventions, interventions_resolved, interventions_pending, national_risk_ranking)
VALUES
  ('11111111-1111-1111-1111-111111111111'::uuid, CURRENT_DATE - INTERVAL '0 months', 8.423, 0.672, 34.500, 87.500, 98, 24, 12, 87, 52, 35, 1),
  ('11111111-1111-1111-1111-111111111111'::uuid, CURRENT_DATE - INTERVAL '1 months', 7.891, 0.645, 38.200, 84.200, 91, 21, 10, 82, 48, 34, 1),
  ('11111111-1111-1111-1111-111111111111'::uuid, CURRENT_DATE - INTERVAL '2 months', 7.234, 0.612, 42.100, 81.700, 85, 19, 9, 76, 44, 32, 1),
  ('11111111-1111-1111-1111-111111111111'::uuid, CURRENT_DATE - INTERVAL '3 months', 6.892, 0.589, 45.800, 79.300, 79, 17, 8, 71, 41, 30, 1),
  ('11111111-1111-1111-1111-111111111111'::uuid, CURRENT_DATE - INTERVAL '4 months', 6.547, 0.567, 49.200, 77.100, 73, 15, 7, 65, 37, 28, 1),
  ('11111111-1111-1111-1111-111111111111'::uuid, CURRENT_DATE - INTERVAL '5 months', 6.123, 0.542, 53.700, 74.600, 67, 14, 6, 59, 34, 25, 1),
  ('11111111-1111-1111-1111-111111111111'::uuid, CURRENT_DATE - INTERVAL '6 months', 5.789, 0.518, 58.100, 72.000, 61, 12, 5, 53, 30, 23, 2),
  ('11111111-1111-1111-1111-111111111111'::uuid, CURRENT_DATE - INTERVAL '7 months', 5.432, 0.493, 62.400, 69.500, 55, 11, 5, 48, 27, 21, 2),
  ('11111111-1111-1111-1111-111111111111'::uuid, CURRENT_DATE - INTERVAL '8 months', 5.018, 0.467, 67.200, 67.100, 49, 9, 4, 42, 23, 19, 2),
  ('11111111-1111-1111-1111-111111111111'::uuid, CURRENT_DATE - INTERVAL '9 months', 4.712, 0.441, 71.800, 64.700, 43, 8, 3, 36, 20, 16, 2),
  ('11111111-1111-1111-1111-111111111111'::uuid, CURRENT_DATE - INTERVAL '10 months', 4.345, 0.414, 76.500, 62.200, 37, 6, 3, 31, 16, 15, 3),
  ('11111111-1111-1111-1111-111111111111'::uuid, CURRENT_DATE - INTERVAL '11 months', 3.982, 0.387, 81.300, 59.800, 31, 5, 2, 25, 13, 12, 3),

  ('22222222-2222-2222-2222-222222222222'::uuid, CURRENT_DATE - INTERVAL '0 months', 5.218, 0.421, 52.300, 91.200, 62, 16, 8, 55, 38, 17, 3),
  ('22222222-2222-2222-2222-222222222222'::uuid, CURRENT_DATE - INTERVAL '1 months', 5.034, 0.408, 55.100, 89.800, 58, 15, 7, 51, 35, 16, 3),
  ('22222222-2222-2222-2222-222222222222'::uuid, CURRENT_DATE - INTERVAL '2 months', 4.812, 0.392, 57.900, 88.300, 54, 13, 7, 47, 33, 14, 3),
  ('22222222-2222-2222-2222-222222222222'::uuid, CURRENT_DATE - INTERVAL '3 months', 4.591, 0.376, 60.800, 86.700, 50, 12, 6, 44, 30, 14, 3),
  ('22222222-2222-2222-2222-222222222222'::uuid, CURRENT_DATE - INTERVAL '4 months', 4.378, 0.359, 63.600, 85.200, 46, 11, 5, 40, 28, 12, 3),
  ('22222222-2222-2222-2222-222222222222'::uuid, CURRENT_DATE - INTERVAL '5 months', 4.164, 0.343, 66.400, 83.600, 42, 9, 5, 36, 25, 11, 3),
  ('22222222-2222-2222-2222-222222222222'::uuid, CURRENT_DATE - INTERVAL '6 months', 3.952, 0.326, 69.300, 82.100, 38, 8, 4, 33, 22, 11, 3),
  ('22222222-2222-2222-2222-222222222222'::uuid, CURRENT_DATE - INTERVAL '7 months', 3.739, 0.309, 72.100, 80.500, 34, 7, 4, 29, 20, 9, 3),
  ('22222222-2222-2222-2222-222222222222'::uuid, CURRENT_DATE - INTERVAL '8 months', 3.527, 0.292, 74.900, 78.900, 30, 6, 3, 25, 17, 8, 3),
  ('22222222-2222-2222-2222-222222222222'::uuid, CURRENT_DATE - INTERVAL '9 months', 3.314, 0.275, 77.800, 77.400, 26, 5, 3, 22, 15, 7, 3),
  ('22222222-2222-2222-2222-222222222222'::uuid, CURRENT_DATE - INTERVAL '10 months', 3.102, 0.258, 80.600, 75.800, 22, 4, 2, 18, 12, 6, 3),
  ('22222222-2222-2222-2222-222222222222'::uuid, CURRENT_DATE - INTERVAL '11 months', 2.889, 0.241, 83.400, 74.200, 18, 3, 2, 15, 10, 5, 3),

  ('33333333-3333-3333-3333-333333333333'::uuid, CURRENT_DATE - INTERVAL '0 months', 6.847, 0.543, 41.200, 83.700, 76, 20, 9, 67, 44, 23, 2),
  ('33333333-3333-3333-3333-333333333333'::uuid, CURRENT_DATE - INTERVAL '1 months', 6.621, 0.524, 44.500, 81.900, 71, 18, 9, 62, 41, 21, 2),
  ('33333333-3333-3333-3333-333333333333'::uuid, CURRENT_DATE - INTERVAL '2 months', 6.395, 0.504, 47.800, 80.100, 66, 16, 8, 57, 38, 19, 2),
  ('33333333-3333-3333-3333-333333333333'::uuid, CURRENT_DATE - INTERVAL '3 months', 6.169, 0.485, 51.200, 78.300, 61, 15, 7, 52, 35, 17, 2),
  ('33333333-3333-3333-3333-333333333333'::uuid, CURRENT_DATE - INTERVAL '4 months', 5.942, 0.465, 54.500, 76.500, 56, 13, 7, 47, 31, 16, 2),
  ('33333333-3333-3333-3333-333333333333'::uuid, CURRENT_DATE - INTERVAL '5 months', 5.716, 0.446, 57.900, 74.700, 51, 12, 6, 43, 28, 15, 2),
  ('33333333-3333-3333-3333-333333333333'::uuid, CURRENT_DATE - INTERVAL '6 months', 5.490, 0.426, 61.200, 72.900, 46, 10, 5, 38, 25, 13, 2),
  ('33333333-3333-3333-3333-333333333333'::uuid, CURRENT_DATE - INTERVAL '7 months', 5.263, 0.407, 64.600, 71.100, 41, 9, 5, 33, 22, 11, 2),
  ('33333333-3333-3333-3333-333333333333'::uuid, CURRENT_DATE - INTERVAL '8 months', 5.037, 0.387, 67.900, 69.300, 36, 7, 4, 29, 19, 10, 2),
  ('33333333-3333-3333-3333-333333333333'::uuid, CURRENT_DATE - INTERVAL '9 months', 4.810, 0.368, 71.300, 67.500, 31, 6, 4, 24, 16, 8, 2),
  ('33333333-3333-3333-3333-333333333333'::uuid, CURRENT_DATE - INTERVAL '10 months', 4.584, 0.348, 74.600, 65.700, 26, 5, 3, 19, 13, 6, 2),
  ('33333333-3333-3333-3333-333333333333'::uuid, CURRENT_DATE - INTERVAL '11 months', 4.357, 0.329, 78.000, 63.900, 22, 3, 2, 15, 10, 5, 2)
ON CONFLICT (casino_id, summary_date) DO UPDATE SET
  underage_suspicion_rate = EXCLUDED.underage_suspicion_rate,
  device_risk_index = EXCLUDED.device_risk_index,
  average_response_time_minutes = EXCLUDED.average_response_time_minutes,
  escalation_compliance_percent = EXCLUDED.escalation_compliance_percent,
  total_minor_risk_alerts = EXCLUDED.total_minor_risk_alerts,
  total_identity_drift_alerts = EXCLUDED.total_identity_drift_alerts,
  total_device_shifts = EXCLUDED.total_device_shifts,
  total_interventions = EXCLUDED.total_interventions,
  interventions_resolved = EXCLUDED.interventions_resolved,
  interventions_pending = EXCLUDED.interventions_pending,
  national_risk_ranking = EXCLUDED.national_risk_ranking;

-- Seed Province Risk Summaries (3 provinces x 12 months)
INSERT INTO guardian_province_risk_summary (province, summary_date, province_risk_index, school_hour_risk_score, total_flagged_sessions, total_operators, high_risk_operators, average_operator_response_time, compliance_rate, school_holiday_comparison)
VALUES
  ('Gauteng', CURRENT_DATE, 7.234, 58.420, 287, 3, 2, 42.700, 83.200, 12.400),
  ('Gauteng', CURRENT_DATE - INTERVAL '1 month', 6.987, 55.810, 264, 3, 2, 45.300, 81.600, 10.200),
  ('Gauteng', CURRENT_DATE - INTERVAL '2 months', 6.740, 53.190, 241, 3, 2, 47.900, 80.000, 8.100),
  ('Gauteng', CURRENT_DATE - INTERVAL '3 months', 6.493, 50.580, 218, 3, 1, 50.500, 78.400, 6.000),
  ('Gauteng', CURRENT_DATE - INTERVAL '4 months', 6.246, 47.970, 195, 3, 1, 53.100, 76.800, 3.900),
  ('Gauteng', CURRENT_DATE - INTERVAL '5 months', 5.999, 45.360, 172, 3, 1, 55.700, 75.200, 1.800),
  ('Gauteng', CURRENT_DATE - INTERVAL '6 months', 5.752, 42.750, 149, 3, 1, 58.300, 73.600, -0.300),
  ('Gauteng', CURRENT_DATE - INTERVAL '7 months', 5.505, 40.140, 126, 3, 1, 60.900, 72.000, -2.400),
  ('Gauteng', CURRENT_DATE - INTERVAL '8 months', 5.258, 37.530, 103, 3, 1, 63.500, 70.400, -4.500),
  ('Gauteng', CURRENT_DATE - INTERVAL '9 months', 5.011, 34.920, 80, 3, 0, 66.100, 68.800, -6.600),
  ('Gauteng', CURRENT_DATE - INTERVAL '10 months', 4.764, 32.310, 57, 3, 0, 68.700, 67.200, -8.700),
  ('Gauteng', CURRENT_DATE - INTERVAL '11 months', 4.517, 29.700, 34, 3, 0, 71.300, 65.600, -10.800),

  ('Western Cape', CURRENT_DATE, 4.812, 38.650, 189, 3, 1, 51.800, 89.400, 8.200),
  ('Western Cape', CURRENT_DATE - INTERVAL '1 month', 4.634, 37.100, 174, 3, 1, 53.700, 87.900, 6.800),
  ('Western Cape', CURRENT_DATE - INTERVAL '2 months', 4.456, 35.550, 159, 3, 1, 55.600, 86.400, 5.400),
  ('Western Cape', CURRENT_DATE - INTERVAL '3 months', 4.278, 34.000, 144, 3, 0, 57.500, 84.900, 4.000),
  ('Western Cape', CURRENT_DATE - INTERVAL '4 months', 4.100, 32.450, 129, 3, 0, 59.400, 83.400, 2.600),
  ('Western Cape', CURRENT_DATE - INTERVAL '5 months', 3.922, 30.900, 114, 3, 0, 61.300, 81.900, 1.200),
  ('Western Cape', CURRENT_DATE - INTERVAL '6 months', 3.744, 29.350, 99, 3, 0, 63.200, 80.400, -0.200),
  ('Western Cape', CURRENT_DATE - INTERVAL '7 months', 3.566, 27.800, 84, 3, 0, 65.100, 78.900, -1.600),
  ('Western Cape', CURRENT_DATE - INTERVAL '8 months', 3.388, 26.250, 69, 3, 0, 67.000, 77.400, -3.000),
  ('Western Cape', CURRENT_DATE - INTERVAL '9 months', 3.210, 24.700, 54, 3, 0, 68.900, 75.900, -4.400),
  ('Western Cape', CURRENT_DATE - INTERVAL '10 months', 3.032, 23.150, 39, 3, 0, 70.800, 74.400, -5.800),
  ('Western Cape', CURRENT_DATE - INTERVAL '11 months', 2.854, 21.600, 24, 3, 0, 72.700, 72.900, -7.200),

  ('KwaZulu-Natal', CURRENT_DATE, 6.018, 47.930, 234, 3, 1, 45.600, 86.100, 10.700),
  ('KwaZulu-Natal', CURRENT_DATE - INTERVAL '1 month', 5.812, 45.990, 215, 3, 1, 47.800, 84.700, 9.100),
  ('KwaZulu-Natal', CURRENT_DATE - INTERVAL '2 months', 5.606, 44.050, 196, 3, 1, 50.000, 83.300, 7.500),
  ('KwaZulu-Natal', CURRENT_DATE - INTERVAL '3 months', 5.400, 42.110, 177, 3, 1, 52.200, 81.900, 5.900),
  ('KwaZulu-Natal', CURRENT_DATE - INTERVAL '4 months', 5.194, 40.170, 158, 3, 0, 54.400, 80.500, 4.300),
  ('KwaZulu-Natal', CURRENT_DATE - INTERVAL '5 months', 4.988, 38.230, 139, 3, 0, 56.600, 79.100, 2.700),
  ('KwaZulu-Natal', CURRENT_DATE - INTERVAL '6 months', 4.782, 36.290, 120, 3, 0, 58.800, 77.700, 1.100),
  ('KwaZulu-Natal', CURRENT_DATE - INTERVAL '7 months', 4.576, 34.350, 101, 3, 0, 61.000, 76.300, -0.500),
  ('KwaZulu-Natal', CURRENT_DATE - INTERVAL '8 months', 4.370, 32.410, 82, 3, 0, 63.200, 74.900, -2.100),
  ('KwaZulu-Natal', CURRENT_DATE - INTERVAL '9 months', 4.164, 30.470, 63, 3, 0, 65.400, 73.500, -3.700),
  ('KwaZulu-Natal', CURRENT_DATE - INTERVAL '10 months', 3.958, 28.530, 44, 3, 0, 67.600, 72.100, -5.300),
  ('KwaZulu-Natal', CURRENT_DATE - INTERVAL '11 months', 3.752, 26.590, 25, 3, 0, 69.800, 70.700, -6.900)
ON CONFLICT (province, summary_date) DO UPDATE SET
  province_risk_index = EXCLUDED.province_risk_index,
  school_hour_risk_score = EXCLUDED.school_hour_risk_score,
  total_flagged_sessions = EXCLUDED.total_flagged_sessions,
  total_operators = EXCLUDED.total_operators,
  high_risk_operators = EXCLUDED.high_risk_operators,
  average_operator_response_time = EXCLUDED.average_operator_response_time,
  compliance_rate = EXCLUDED.compliance_rate,
  school_holiday_comparison = EXCLUDED.school_holiday_comparison;
