/*
  # Seed Compliance Demo Data

  1. Creates compliance settings for existing casinos
  2. Seeds demo audit logs with various risk levels and intervention types
  3. Creates compliance certificates for demonstration
*/

-- Insert compliance settings for all casinos
INSERT INTO compliance_settings (
  casino_id,
  ai_monitoring_active,
  simulation_mode,
  risk_threshold_low,
  risk_threshold_medium,
  risk_threshold_high,
  risk_threshold_critical,
  session_limit_3h,
  session_limit_5h,
  session_limit_7h,
  wellness_interventions_enabled,
  forced_lockout_enabled,
  whatsapp_integration_active,
  email_integration_active,
  sms_integration_active,
  auto_intervention_enabled,
  intervention_cooldown_minutes,
  compliance_contact_email,
  last_policy_update
)
SELECT 
  id as casino_id,
  true as ai_monitoring_active,
  true as simulation_mode,
  40 as risk_threshold_low,
  60 as risk_threshold_medium,
  80 as risk_threshold_high,
  90 as risk_threshold_critical,
  true as session_limit_3h,
  true as session_limit_5h,
  true as session_limit_7h,
  true as wellness_interventions_enabled,
  true as forced_lockout_enabled,
  true as whatsapp_integration_active,
  true as email_integration_active,
  true as sms_integration_active,
  true as auto_intervention_enabled,
  30 as intervention_cooldown_minutes,
  'compliance@' || lower(replace(name, ' ', '')) || '.com' as compliance_contact_email,
  now() - interval '30 days' as last_policy_update
FROM casinos
ON CONFLICT (casino_id) DO NOTHING;

-- Seed demo audit logs for the last 30 days
DO $$
DECLARE
  casino_record RECORD;
  player_record RECORD;
  day_offset INT;
  log_count INT;
BEGIN
  FOR casino_record IN SELECT id FROM casinos LIMIT 3 LOOP
    FOR player_record IN SELECT id, player_id FROM players WHERE casino_id = casino_record.id LIMIT 20 LOOP
      FOR day_offset IN 0..29 LOOP
        log_count := floor(random() * 5)::int + 1;
        
        FOR i IN 1..log_count LOOP
          INSERT INTO compliance_audit_logs (
            casino_id,
            player_id,
            player_identifier,
            timestamp,
            session_minutes,
            risk_score_before,
            risk_score_after,
            risk_level,
            message_type,
            message_content,
            status,
            reason,
            triggered_by,
            game_type,
            bet_amount,
            total_wagered,
            intervention_details
          ) VALUES (
            casino_record.id,
            player_record.id,
            player_record.player_id,
            now() - (day_offset || ' days')::interval - (i || ' hours')::interval,
            floor(random() * 300)::int + 30,
            floor(random() * 100)::int,
            floor(random() * 100)::int,
            CASE 
              WHEN random() < 0.5 THEN 'low'
              WHEN random() < 0.75 THEN 'medium'
              WHEN random() < 0.9 THEN 'high'
              ELSE 'critical'
            END,
            CASE floor(random() * 6)::int
              WHEN 0 THEN 'WHATSAPP'
              WHEN 1 THEN 'EMAIL'
              WHEN 2 THEN 'SMS'
              WHEN 3 THEN 'LOCKOUT'
              WHEN 4 THEN 'SUGGESTION'
              ELSE 'WARNING'
            END,
            CASE floor(random() * 3)::int
              WHEN 0 THEN 'We noticed youve been playing for an extended period. Consider taking a break.'
              WHEN 1 THEN 'Your risk score has increased. Please review your gambling limits.'
              ELSE 'URGENT: Critical risk threshold exceeded. Account temporarily restricted.'
            END,
            CASE 
              WHEN random() < 0.9 THEN 'SENT'
              WHEN random() < 0.95 THEN 'DELIVERED'
              ELSE 'FAILED'
            END,
            CASE floor(random() * 5)::int
              WHEN 0 THEN 'Extended session duration'
              WHEN 1 THEN 'Increasing bet pattern'
              WHEN 2 THEN 'Loss chasing behavior'
              WHEN 3 THEN 'Risk threshold exceeded'
              ELSE 'Gambling disorder pattern detected'
            END,
            CASE 
              WHEN random() < 0.8 THEN 'AI'
              WHEN random() < 0.95 THEN 'SYSTEM'
              ELSE 'MANUAL'
            END,
            CASE floor(random() * 5)::int
              WHEN 0 THEN 'blackjack'
              WHEN 1 THEN 'roulette'
              WHEN 2 THEN 'slots'
              WHEN 3 THEN 'poker'
              ELSE 'baccarat'
            END,
            (random() * 5000 + 100)::decimal(10,2),
            (random() * 50000 + 1000)::decimal(12,2),
            jsonb_build_object(
              'ai_confidence', (random() * 40 + 60)::int,
              'behavioral_flags', ARRAY['rapid_betting', 'extended_session'],
              'intervention_recommended', random() < 0.5
            )
          );
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- Create compliance certificates for each casino
INSERT INTO compliance_certificates (
  casino_id,
  certificate_number,
  valid_from,
  valid_to,
  status,
  ai_monitoring_enabled,
  intervention_system_enabled,
  lockout_system_enabled,
  audit_trail_enabled,
  notes
)
SELECT 
  id as casino_id,
  'CERT-' || upper(substring(md5(random()::text) from 1 for 8)) as certificate_number,
  now() - interval '90 days' as valid_from,
  now() + interval '275 days' as valid_to,
  'ACTIVE' as status,
  true as ai_monitoring_enabled,
  true as intervention_system_enabled,
  true as lockout_system_enabled,
  true as audit_trail_enabled,
  'This casino has demonstrated compliance with AI-based responsible gambling monitoring systems.' as notes
FROM casinos;