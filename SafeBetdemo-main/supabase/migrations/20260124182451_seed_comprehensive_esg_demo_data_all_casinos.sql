/*
  # Seed Comprehensive ESG Demo Data for All Casinos
  
  1. Purpose
    - Ensure all three casinos have complete ESG metrics and related data
    - Enable regulators and super admins to view comprehensive ESG dashboards
    - Provide realistic demo values for all ESG categories
  
  2. Data Added
    - ESG metrics (environmental, social, governance)
    - Responsible gambling contributions (NRGP and other)
    - Self-exclusion registry entries
    - Player protection interventions
    - Employee RG training records
  
  3. Casinos Covered
    - Royal Palace Casino (11111111-1111-1111-1111-111111111111)
    - Golden Dragon Gaming (22222222-2222-2222-2222-222222222222)
    - Silver Star Resort (33333333-3333-3333-3333-333333333333)
*/

-- Delete old 2026 data and insert fresh comprehensive ESG metrics for all casinos
DELETE FROM esg_metrics WHERE reporting_period = '2026-01-01' AND period_type = 'annual';

INSERT INTO esg_metrics (
  casino_id,
  reporting_period,
  period_type,
  nrgp_contribution_amount,
  total_players_screened,
  high_risk_players_identified,
  interventions_performed,
  successful_interventions,
  self_exclusions_active,
  self_exclusions_new,
  employees_trained,
  training_completion_rate,
  training_hours_delivered,
  problem_gambling_referrals,
  helpline_contacts,
  counseling_sessions_funded,
  community_investment_amount,
  local_jobs_created,
  compliance_audits_passed,
  compliance_issues_resolved,
  regulatory_violations,
  renewable_energy_kwh,
  carbon_emissions_tons
) VALUES
-- Royal Palace Casino - 2026 data
(
  '11111111-1111-1111-1111-111111111111',
  '2026-01-01',
  'annual',
  1850000,
  12500,
  890,
  245,
  198,
  34,
  12,
  156,
  92.5,
  624,
  89,
  234,
  156,
  3500000,
  125,
  12,
  8,
  0,
  2500000,
  850
),
-- Golden Dragon Gaming - 2026 data
(
  '22222222-2222-2222-2222-222222222222',
  '2026-01-01',
  'annual',
  1450000,
  9800,
  678,
  198,
  156,
  28,
  9,
  124,
  88.2,
  496,
  67,
  189,
  123,
  2800000,
  98,
  10,
  6,
  1,
  1800000,
  920
),
-- Silver Star Resort - 2026 data
(
  '33333333-3333-3333-3333-333333333333',
  '2026-01-01',
  'annual',
  1650000,
  11200,
  756,
  220,
  178,
  31,
  11,
  142,
  90.8,
  568,
  78,
  212,
  145,
  3200000,
  112,
  11,
  7,
  0,
  2100000,
  780
);

-- Add NRGP contributions for all casinos (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM responsible_gambling_contributions WHERE casino_id = '11111111-1111-1111-1111-111111111111' AND contribution_date = '2026-01-15') THEN
    INSERT INTO responsible_gambling_contributions (casino_id, contribution_type, contribution_amount, contribution_date, recipient_organization, program_name, notes)
    VALUES ('11111111-1111-1111-1111-111111111111', 'nrgp', 450000, '2026-01-15', 'National Responsible Gambling Programme', 'NRGP Levy', 'Q1 2026 quarterly contribution');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM responsible_gambling_contributions WHERE casino_id = '11111111-1111-1111-1111-111111111111' AND contribution_date = '2025-10-15') THEN
    INSERT INTO responsible_gambling_contributions (casino_id, contribution_type, contribution_amount, contribution_date, recipient_organization, program_name, notes)
    VALUES ('11111111-1111-1111-1111-111111111111', 'nrgp', 480000, '2025-10-15', 'National Responsible Gambling Programme', 'NRGP Levy', 'Q4 2025 quarterly contribution');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM responsible_gambling_contributions WHERE casino_id = '11111111-1111-1111-1111-111111111111' AND contribution_date = '2025-11-20') THEN
    INSERT INTO responsible_gambling_contributions (casino_id, contribution_type, contribution_amount, contribution_date, recipient_organization, program_name, notes)
    VALUES ('11111111-1111-1111-1111-111111111111', 'research', 125000, '2025-11-20', 'SARGF', 'Research Fund', 'Problem Gambling Research Initiative');
  END IF;
  
  -- Golden Dragon Gaming
  IF NOT EXISTS (SELECT 1 FROM responsible_gambling_contributions WHERE casino_id = '22222222-2222-2222-2222-222222222222' AND contribution_date = '2026-01-15') THEN
    INSERT INTO responsible_gambling_contributions (casino_id, contribution_type, contribution_amount, contribution_date, recipient_organization, program_name, notes)
    VALUES ('22222222-2222-2222-2222-222222222222', 'nrgp', 350000, '2026-01-15', 'National Responsible Gambling Programme', 'NRGP Levy', 'Q1 2026 quarterly contribution');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM responsible_gambling_contributions WHERE casino_id = '22222222-2222-2222-2222-222222222222' AND contribution_date = '2025-10-15') THEN
    INSERT INTO responsible_gambling_contributions (casino_id, contribution_type, contribution_amount, contribution_date, recipient_organization, program_name, notes)
    VALUES ('22222222-2222-2222-2222-222222222222', 'nrgp', 380000, '2025-10-15', 'National Responsible Gambling Programme', 'NRGP Levy', 'Q4 2025 quarterly contribution');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM responsible_gambling_contributions WHERE casino_id = '22222222-2222-2222-2222-222222222222' AND contribution_date = '2025-12-10') THEN
    INSERT INTO responsible_gambling_contributions (casino_id, contribution_type, contribution_amount, contribution_date, recipient_organization, program_name, notes)
    VALUES ('22222222-2222-2222-2222-222222222222', 'treatment_program', 95000, '2025-12-10', 'SANCA', 'Treatment Centres', 'Gambling Treatment Support');
  END IF;
  
  -- Silver Star Resort
  IF NOT EXISTS (SELECT 1 FROM responsible_gambling_contributions WHERE casino_id = '33333333-3333-3333-3333-333333333333' AND contribution_date = '2026-01-15') THEN
    INSERT INTO responsible_gambling_contributions (casino_id, contribution_type, contribution_amount, contribution_date, recipient_organization, program_name, notes)
    VALUES ('33333333-3333-3333-3333-333333333333', 'nrgp', 400000, '2026-01-15', 'National Responsible Gambling Programme', 'NRGP Levy', 'Q1 2026 quarterly contribution');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM responsible_gambling_contributions WHERE casino_id = '33333333-3333-3333-3333-333333333333' AND contribution_date = '2025-10-15') THEN
    INSERT INTO responsible_gambling_contributions (casino_id, contribution_type, contribution_amount, contribution_date, recipient_organization, program_name, notes)
    VALUES ('33333333-3333-3333-3333-333333333333', 'nrgp', 420000, '2025-10-15', 'National Responsible Gambling Programme', 'NRGP Levy', 'Q4 2025 quarterly contribution');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM responsible_gambling_contributions WHERE casino_id = '33333333-3333-3333-3333-333333333333' AND contribution_date = '2025-11-25') THEN
    INSERT INTO responsible_gambling_contributions (casino_id, contribution_type, contribution_amount, contribution_date, recipient_organization, program_name, notes)
    VALUES ('33333333-3333-3333-3333-333333333333', 'education', 110000, '2025-11-25', 'SARGF', 'Public Awareness', 'Responsible Gambling Education Campaign');
  END IF;
END $$;

-- Add demo self-exclusion entries using existing players
INSERT INTO self_exclusion_registry (
  casino_id,
  player_id,
  exclusion_start_date,
  exclusion_end_date,
  exclusion_type,
  status,
  counseling_sessions_required,
  counseling_sessions_completed,
  reinstatement_requested,
  notes
) 
SELECT 
  p.casino_id,
  p.id,
  CURRENT_DATE - (random() * 180)::int,
  CURRENT_DATE + 180,
  CASE WHEN random() < 0.5 THEN 'self_requested' ELSE 'operator_initiated' END,
  CASE WHEN random() < 0.8 THEN 'active' ELSE 'completed' END,
  6,
  floor(random() * 6)::int,
  random() < 0.1,
  'Demo exclusion entry for ESG reporting'
FROM (
  SELECT DISTINCT ON (casino_id) id, casino_id 
  FROM players 
  WHERE id NOT IN (SELECT player_id FROM self_exclusion_registry)
  ORDER BY casino_id, random()
) p
CROSS JOIN generate_series(1, 2)
WHERE (SELECT COUNT(*) FROM self_exclusion_registry WHERE casino_id = p.casino_id) < 10
LIMIT 15;

-- Add demo interventions using existing players
INSERT INTO player_protection_interventions (
  casino_id,
  player_id,
  intervention_date,
  intervention_type,
  risk_score,
  trigger_reason,
  action_taken,
  outcome,
  notes
)
SELECT 
  p.casino_id,
  p.id,
  CURRENT_DATE - (random() * 90)::int,
  CASE floor(random() * 4)
    WHEN 0 THEN 'ai_alert'
    WHEN 1 THEN 'helpline_referral'
    WHEN 2 THEN 'counseling_referral'
    ELSE 'limit_setting'
  END,
  50 + (random() * 50)::int,
  'AI detected high-risk betting pattern',
  'Player contacted and support resources provided',
  CASE WHEN random() < 0.6 THEN 'successful' 
       WHEN random() < 0.3 THEN 'accepted'
       ELSE 'declined' 
  END,
  'AI-detected risk pattern intervention'
FROM (
  SELECT id, casino_id 
  FROM players 
  ORDER BY random()
  LIMIT 20
) p
WHERE (SELECT COUNT(*) FROM player_protection_interventions WHERE casino_id = p.casino_id) < 30;

-- Add demo training records for staff members
INSERT INTO employee_rg_training (
  casino_id,
  staff_id,
  training_program,
  training_provider,
  training_date,
  completion_status,
  hours_completed,
  score,
  next_training_due
)
SELECT 
  c.id,
  s.id,
  'SARGF Certified Responsible Gambling Training',
  'South African Responsible Gambling Foundation',
  CURRENT_DATE - (random() * 180)::int,
  CASE WHEN random() < 0.85 THEN 'completed' ELSE 'in_progress' END,
  8,
  75 + (random() * 25)::int,
  CURRENT_DATE + 365
FROM casinos c
CROSS JOIN LATERAL (
  SELECT id FROM staff 
  WHERE casino_id = c.id 
  AND id NOT IN (SELECT staff_id FROM employee_rg_training WHERE casino_id = c.id)
  LIMIT 5
) s;