/*
  # Seed ESG Demo Data - Sun International Aligned (Corrected)
  
  Populates realistic ESG data based on Sun International's 2024 ESG Report:
  - R7M+ annual NRGP contributions
  - Employee training metrics
  - Self-exclusion program data
  - Player protection interventions
  - Social impact metrics
  - ESG performance data for all demo casinos
*/

-- Get casino IDs for demo data
DO $$
DECLARE
  royal_palace_id uuid := '11111111-1111-1111-1111-111111111111';
  golden_dragon_id uuid := '22222222-2222-2222-2222-222222222222';
  silver_star_id uuid := '33333333-3333-3333-3333-333333333333';
  current_month_start date;
  last_month_start date;
  current_quarter_start date;
  current_year_start date;
BEGIN
  -- Set reporting periods
  current_month_start := date_trunc('month', CURRENT_DATE);
  last_month_start := date_trunc('month', CURRENT_DATE - interval '1 month');
  current_quarter_start := date_trunc('quarter', CURRENT_DATE);
  current_year_start := date_trunc('year', CURRENT_DATE);

  -- ESG Metrics for Royal Palace Casino (flagship property - aligned with Sun International)
  INSERT INTO esg_metrics (
    casino_id, reporting_period, period_type,
    nrgp_contribution_amount, total_players_screened, high_risk_players_identified,
    interventions_performed, successful_interventions, self_exclusions_active, self_exclusions_new,
    employees_trained, training_completion_rate, training_hours_delivered,
    problem_gambling_referrals, helpline_contacts, counseling_sessions_funded,
    community_investment_amount, local_jobs_created,
    compliance_audits_passed, compliance_issues_resolved, regulatory_violations,
    renewable_energy_kwh, carbon_emissions_tons
  ) VALUES
  (royal_palace_id, current_year_start, 'annual', 
   2400000.00, 45823, 892, 1247, 1089, 34, 12,
   287, 94.50, 2296.00,
   47, 189, 156,
   620000.00, 23,
   4, 12, 0,
   1450000.00, 342.50),
  (royal_palace_id, current_quarter_start, 'quarterly',
   600000.00, 11456, 234, 312, 276, 34, 4,
   72, 96.00, 576.00,
   12, 47, 39,
   155000.00, 6,
   1, 3, 0,
   362500.00, 85.60),
  (royal_palace_id, current_month_start, 'monthly',
   200000.00, 3819, 78, 104, 92, 34, 2,
   24, 95.00, 192.00,
   4, 16, 13,
   51667.00, 2,
   0, 1, 0,
   120833.00, 28.50);

  -- ESG Metrics for Golden Dragon Gaming
  INSERT INTO esg_metrics (
    casino_id, reporting_period, period_type,
    nrgp_contribution_amount, total_players_screened, high_risk_players_identified,
    interventions_performed, successful_interventions, self_exclusions_active, self_exclusions_new,
    employees_trained, training_completion_rate, training_hours_delivered,
    problem_gambling_referrals, helpline_contacts, counseling_sessions_funded,
    community_investment_amount, local_jobs_created,
    compliance_audits_passed, compliance_issues_resolved, regulatory_violations,
    renewable_energy_kwh, carbon_emissions_tons
  ) VALUES
  (golden_dragon_id, current_year_start, 'annual',
   2800000.00, 52103, 1014, 1423, 1245, 41, 15,
   312, 96.20, 2496.00,
   54, 217, 179,
   725000.00, 27,
   4, 9, 0,
   1698000.00, 389.20),
  (golden_dragon_id, current_quarter_start, 'quarterly',
   700000.00, 13026, 264, 356, 311, 41, 5,
   78, 97.00, 624.00,
   14, 54, 45,
   181250.00, 7,
   1, 2, 0,
   424500.00, 97.30);

  -- ESG Metrics for Silver Star Resort
  INSERT INTO esg_metrics (
    casino_id, reporting_period, period_type,
    nrgp_contribution_amount, total_players_screened, high_risk_players_identified,
    interventions_performed, successful_interventions, self_exclusions_active, self_exclusions_new,
    employees_trained, training_completion_rate, training_hours_delivered,
    problem_gambling_referrals, helpline_contacts, counseling_sessions_funded,
    community_investment_amount, local_jobs_created,
    compliance_audits_passed, compliance_issues_resolved, regulatory_violations,
    renewable_energy_kwh, carbon_emissions_tons
  ) VALUES
  (silver_star_id, current_year_start, 'annual',
   1800000.00, 38756, 756, 1061, 928, 29, 10,
   243, 91.80, 1944.00,
   41, 166, 137,
   515000.00, 20,
   4, 10, 0,
   1189000.00, 298.30);

  -- Responsible Gambling Contributions (Total ~R7M across all properties)
  INSERT INTO responsible_gambling_contributions (
    casino_id, contribution_date, program_name, contribution_amount, 
    recipient_organization, contribution_type, notes
  ) VALUES
  (royal_palace_id, '2024-01-15', 'National Responsible Gambling Programme', 2400000.00, 
   'NRGP / University of Cape Town', 'nrgp', 'Annual NRGP contribution aligned with Sun International ESG commitment'),
  (royal_palace_id, '2024-03-20', 'SARGF Training Programme', 95000.00,
   'South African Responsible Gambling Foundation', 'education', 'Employee responsible gambling training - SARGF certified'),
  (royal_palace_id, '2024-06-10', 'Problem Gambling Treatment Fund', 145000.00,
   'SARGF Treatment Network', 'treatment_program', 'Funding for counseling and treatment services'),
  (golden_dragon_id, '2024-01-15', 'National Responsible Gambling Programme', 2800000.00,
   'NRGP / University of Cape Town', 'nrgp', 'Annual NRGP contribution - largest property contribution'),
  (golden_dragon_id, '2024-04-12', 'Responsible Gambling Research Initiative', 85000.00,
   'University of Cape Town - Centre for Gambling Studies', 'research', 'Research funding for problem gambling prevention'),
  (silver_star_id, '2024-01-15', 'National Responsible Gambling Programme', 1800000.00,
   'NRGP / University of Cape Town', 'nrgp', 'Annual NRGP contribution for 2024'),
  (silver_star_id, '2024-05-08', 'Community Awareness Campaign', 72000.00,
   'Local Community Organizations', 'education', 'Responsible gambling awareness in local communities');

  -- Self-Exclusion Registry (6-month minimum as per Sun International policy)
  INSERT INTO self_exclusion_registry (
    casino_id, player_id, exclusion_start_date, exclusion_end_date,
    minimum_period_months, exclusion_type, treatment_required,
    counseling_sessions_completed, counseling_sessions_required, status
  )
  SELECT 
    royal_palace_id,
    p.id,
    CURRENT_DATE - (random() * 180)::integer,
    CURRENT_DATE + (180 + random() * 180)::integer,
    6,
    (ARRAY['self_requested', 'self_requested', 'operator_initiated'])[floor(random() * 3 + 1)],
    true,
    floor(random() * 7)::integer,
    6,
    (ARRAY['active', 'active', 'active', 'completed'])[floor(random() * 4 + 1)]
  FROM players p
  WHERE p.casino_id = royal_palace_id
  AND p.risk_level IN ('HIGH', 'CRITICAL')
  LIMIT 12;

  INSERT INTO self_exclusion_registry (
    casino_id, player_id, exclusion_start_date, exclusion_end_date,
    minimum_period_months, exclusion_type, treatment_required,
    counseling_sessions_completed, counseling_sessions_required, status
  )
  SELECT 
    golden_dragon_id,
    p.id,
    CURRENT_DATE - (random() * 180)::integer,
    CURRENT_DATE + (180 + random() * 180)::integer,
    6,
    (ARRAY['self_requested', 'self_requested', 'operator_initiated'])[floor(random() * 3 + 1)],
    true,
    floor(random() * 7)::integer,
    6,
    (ARRAY['active', 'active', 'active', 'completed'])[floor(random() * 4 + 1)]
  FROM players p
  WHERE p.casino_id = golden_dragon_id
  AND p.risk_level IN ('HIGH', 'CRITICAL')
  LIMIT 15;

  INSERT INTO self_exclusion_registry (
    casino_id, player_id, exclusion_start_date, exclusion_end_date,
    minimum_period_months, exclusion_type, treatment_required,
    counseling_sessions_completed, counseling_sessions_required, status
  )
  SELECT 
    silver_star_id,
    p.id,
    CURRENT_DATE - (random() * 180)::integer,
    CURRENT_DATE + (180 + random() * 180)::integer,
    6,
    (ARRAY['self_requested', 'self_requested', 'operator_initiated'])[floor(random() * 3 + 1)],
    true,
    floor(random() * 7)::integer,
    6,
    (ARRAY['active', 'active', 'active', 'completed'])[floor(random() * 4 + 1)]
  FROM players p
  WHERE p.casino_id = silver_star_id
  AND p.risk_level IN ('HIGH', 'CRITICAL')
  LIMIT 10;

  -- Player Protection Interventions (AI-driven as per SafeBet IQ capabilities)
  INSERT INTO player_protection_interventions (
    casino_id, player_id, intervention_date, intervention_type,
    risk_score, trigger_reason, action_taken, outcome
  )
  SELECT 
    p.casino_id,
    p.id,
    CURRENT_DATE - (random() * 90)::integer,
    (ARRAY['ai_alert', 'limit_setting', 'timeout', 'self_exclusion_referral', 'helpline_referral', 'counseling_referral'])[floor(random() * 6 + 1)],
    70 + floor(random() * 30)::integer,
    (ARRAY[
      'AI detected behavioral pattern anomaly',
      'Loss threshold exceeded - intervention required',
      'Excessive session duration detected',
      'Rapid bet escalation pattern observed',
      'Behavioral indicators of gambling distress',
      'Cognitive fatigue markers detected'
    ])[floor(random() * 6 + 1)],
    (ARRAY[
      'Deposit limit recommended and applied',
      'Referred to NRGP helpline (0800 006 008)',
      'Self-exclusion information provided',
      '24-hour cooling-off period initiated',
      'Manager consultation scheduled',
      'Referred to SARGF treatment professional'
    ])[floor(random() * 6 + 1)],
    (ARRAY['accepted', 'accepted', 'declined', 'successful', 'pending'])[floor(random() * 5 + 1)]
  FROM players p
  WHERE p.risk_level IN ('MEDIUM', 'HIGH', 'CRITICAL')
  LIMIT 650;

  -- Employee Training Records (SARGF certified training)
  INSERT INTO employee_rg_training (
    casino_id, staff_id, training_program, training_provider,
    training_date, completion_status, certificate_issued, 
    certificate_number, hours_completed, score, next_training_due
  )
  SELECT 
    s.casino_id,
    s.id,
    'Responsible Gambling 101',
    'SARGF',
    CURRENT_DATE - (random() * 365)::integer,
    (ARRAY['completed', 'completed', 'completed', 'completed', 'pending'])[floor(random() * 5 + 1)],
    true,
    'SARGF-RG101-' || floor(random() * 10000)::text,
    8.0,
    75 + floor(random() * 25)::numeric,
    CURRENT_DATE + (365 - (random() * 90)::integer)
  FROM staff s
  WHERE s.status = 'active'
  LIMIT 842;

  -- Social Impact Metrics
  INSERT INTO social_impact_metrics (
    casino_id, metric_date,
    community_investment_amount, beneficiaries_reached, programs_supported,
    local_jobs_total, jobs_created_period, youth_employed, skills_development_investment,
    awareness_campaigns_conducted, people_reached, educational_materials_distributed
  ) VALUES
  (royal_palace_id, current_year_start,
   620000.00, 13250, 16,
   287, 23, 72, 268000.00,
   9, 48900, 13200),
  (golden_dragon_id, current_year_start,
   725000.00, 15480, 19,
   312, 27, 84, 312000.00,
   11, 57200, 15400),
  (silver_star_id, current_year_start,
   515000.00, 11010, 14,
   243, 20, 61, 223000.00,
   7, 40600, 10900);

  -- Helpline Interactions (0800 006 008 - NRGP Helpline)
  INSERT INTO helpline_interactions (
    casino_id, interaction_date, caller_type, issue_category, outcome, follow_up_required,
    anonymized_notes
  )
  SELECT 
    (ARRAY[royal_palace_id, golden_dragon_id, silver_star_id])[floor(random() * 3 + 1)],
    CURRENT_DATE - (random() * 365)::integer,
    (ARRAY['player', 'family_member', 'concerned_party', 'anonymous'])[floor(random() * 4 + 1)],
    (ARRAY['problem_gambling', 'self_exclusion', 'information', 'treatment_referral', 'complaint'])[floor(random() * 5 + 1)],
    (ARRAY['referred_to_treatment', 'information_provided', 'self_exclusion_initiated', 'follow_up_scheduled', 'resolved'])[floor(random() * 5 + 1)],
    random() < 0.35,
    'Caller contacted NRGP helpline for support'
  FROM generate_series(1, 572);

END $$;