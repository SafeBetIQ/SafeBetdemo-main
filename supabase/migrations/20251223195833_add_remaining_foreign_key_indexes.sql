/*
  # Add Remaining Foreign Key Indexes

  ## Summary
  Adds 30 missing foreign key indexes to improve JOIN performance and query optimization

  ## New Indexes
    - api_requests_log.partner_id
    - behavioral_risk_profiles.casino_id
    - compliance_audit_logs (casino_id, player_id)
    - compliance_certificates.casino_id
    - demo_behavioral_insights.casino_id
    - demo_esg_scores.casino_id
    - esg_compliance_scores.casino_id
    - gaming_sessions.player_id
    - integration_partners.casino_id
    - intervention_history.casino_id
    - interventions.casino_id
    - login_activity.casino_id
    - player_bets.player_id
    - player_limit_actions.partner_id
    - quiz_answers.attempt_id
    - quiz_attempts (enrollment_id, staff_id)
    - quiz_questions.quiz_id
    - risk_score_events.partner_id
    - staff_training_assignments (casino_id, module_id, staff_id)
    - training_assignment_templates.casino_id
    - training_categories.casino_id
    - training_certificates (module_id, staff_id)
    - training_modules (casino_id, category_id)
    - users.casino_id

  ## Performance Impact
    - Dramatically improves JOIN operations on foreign keys
    - Enhances query planner efficiency
    - Reduces table scan operations
*/

-- API and Integration indexes
CREATE INDEX IF NOT EXISTS idx_api_requests_log_partner_id ON api_requests_log(partner_id);
CREATE INDEX IF NOT EXISTS idx_integration_partners_casino_id ON integration_partners(casino_id);
CREATE INDEX IF NOT EXISTS idx_player_limit_actions_partner_id ON player_limit_actions(partner_id);
CREATE INDEX IF NOT EXISTS idx_risk_score_events_partner_id ON risk_score_events(partner_id);

-- Behavioral Risk and ESG indexes
CREATE INDEX IF NOT EXISTS idx_behavioral_risk_profiles_casino_id ON behavioral_risk_profiles(casino_id);
CREATE INDEX IF NOT EXISTS idx_esg_compliance_scores_casino_id ON esg_compliance_scores(casino_id);
CREATE INDEX IF NOT EXISTS idx_intervention_history_casino_id ON intervention_history(casino_id);
CREATE INDEX IF NOT EXISTS idx_interventions_casino_id ON interventions(casino_id);

-- Compliance indexes
CREATE INDEX IF NOT EXISTS idx_compliance_audit_logs_casino_id ON compliance_audit_logs(casino_id);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_logs_player_id ON compliance_audit_logs(player_id);
CREATE INDEX IF NOT EXISTS idx_compliance_certificates_casino_id ON compliance_certificates(casino_id);

-- Demo mode indexes
CREATE INDEX IF NOT EXISTS idx_demo_behavioral_insights_casino_id ON demo_behavioral_insights(casino_id);
CREATE INDEX IF NOT EXISTS idx_demo_esg_scores_casino_id ON demo_esg_scores(casino_id);

-- Gaming and player indexes
CREATE INDEX IF NOT EXISTS idx_gaming_sessions_player_id ON gaming_sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_player_bets_player_id ON player_bets(player_id);

-- Login activity index
CREATE INDEX IF NOT EXISTS idx_login_activity_casino_id ON login_activity(casino_id);

-- Quiz system indexes
CREATE INDEX IF NOT EXISTS idx_quiz_answers_attempt_id ON quiz_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_enrollment_id ON quiz_attempts(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_staff_id ON quiz_attempts(staff_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);

-- Staff training indexes
CREATE INDEX IF NOT EXISTS idx_staff_training_assignments_casino_id ON staff_training_assignments(casino_id);
CREATE INDEX IF NOT EXISTS idx_staff_training_assignments_module_id ON staff_training_assignments(module_id);
CREATE INDEX IF NOT EXISTS idx_staff_training_assignments_staff_id ON staff_training_assignments(staff_id);

-- Training system indexes
CREATE INDEX IF NOT EXISTS idx_training_assignment_templates_casino_id ON training_assignment_templates(casino_id);
CREATE INDEX IF NOT EXISTS idx_training_categories_casino_id ON training_categories(casino_id);
CREATE INDEX IF NOT EXISTS idx_training_certificates_module_id ON training_certificates(module_id);
CREATE INDEX IF NOT EXISTS idx_training_certificates_staff_id ON training_certificates(staff_id);
CREATE INDEX IF NOT EXISTS idx_training_modules_casino_id ON training_modules(casino_id);
CREATE INDEX IF NOT EXISTS idx_training_modules_category_id ON training_modules(category_id);

-- Users index
CREATE INDEX IF NOT EXISTS idx_users_casino_id ON users(casino_id);