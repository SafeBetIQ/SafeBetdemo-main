/*
  # Fix Database Security and Performance Issues - Final

  ## Summary
  Fixes 87 database security and performance issues identified by Supabase

  ## Changes
    1. Added 14 missing foreign key indexes
    2. Removed 73 unused indexes
    3. Optimized 46 RLS policies with cached auth.uid()
    4. Fixed 8 function search paths (3 have dependencies that cannot be modified safely)

  ## Performance Impact
    - 10-100x faster RLS policy evaluation at scale
    - Reduced index maintenance overhead on writes
    - Enhanced query planner efficiency for JOINs
    - Closed security vulnerabilities in function search paths
*/

-- =====================================================
-- SECTION 1: ADD MISSING FOREIGN KEY INDEXES (14)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_compliance_certificates_issued_by ON compliance_certificates(issued_by);
CREATE INDEX IF NOT EXISTS idx_csv_batch_imports_partner_id ON csv_batch_imports(partner_id);
CREATE INDEX IF NOT EXISTS idx_intervention_history_risk_profile_id ON intervention_history(risk_profile_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_question_id ON quiz_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_staff_auth_user_id ON staff(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_training_assignments_assigned_by ON staff_training_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_training_assignment_templates_created_by ON training_assignment_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_training_certificates_enrollment_id ON training_certificates(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_training_certificates_quiz_attempt_id ON training_certificates(quiz_attempt_id);
CREATE INDEX IF NOT EXISTS idx_training_credits_enrollment_id ON training_credits(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_training_credits_module_id ON training_credits(module_id);
CREATE INDEX IF NOT EXISTS idx_training_enrollments_assigned_by ON training_enrollments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_training_lesson_progress_lesson_id ON training_lesson_progress(lesson_id);

-- =====================================================
-- SECTION 2: DROP UNUSED INDEXES (73)
-- =====================================================

DROP INDEX IF EXISTS idx_users_role, idx_users_casino_id, idx_users_user_role;
DROP INDEX IF EXISTS idx_risk_scores_player_id, idx_risk_scores_recorded_at;
DROP INDEX IF EXISTS idx_interventions_casino_id, idx_interventions_created_at;
DROP INDEX IF EXISTS idx_players_risk_level, idx_players_is_active;
DROP INDEX IF EXISTS idx_gaming_sessions_is_active, idx_gaming_sessions_player_id, idx_player_bets_player_id;
DROP INDEX IF EXISTS idx_staff_status, idx_staff_user_role;
DROP INDEX IF EXISTS idx_training_modules_category, idx_training_modules_casino_id;
DROP INDEX IF EXISTS idx_training_enrollments_staff, idx_training_enrollments_status;
DROP INDEX IF EXISTS idx_training_certificates_staff_id, idx_training_certificates_module_id, idx_training_certificates_verification_code;
DROP INDEX IF EXISTS idx_training_categories_casino_id, idx_module_quizzes_module_id, idx_quiz_questions_quiz_id;
DROP INDEX IF EXISTS idx_quiz_attempts_enrollment_id, idx_quiz_attempts_staff_id, idx_quiz_answers_attempt_id;
DROP INDEX IF EXISTS idx_staff_training_assignments_staff_id, idx_staff_training_assignments_module_id;
DROP INDEX IF EXISTS idx_staff_training_assignments_due_date, idx_staff_training_assignments_casino_id;
DROP INDEX IF EXISTS idx_training_assignment_templates_casino_id, idx_staff_training_preferences_staff_id;
DROP INDEX IF EXISTS idx_api_requests_partner_id, idx_api_requests_created_at;
DROP INDEX IF EXISTS idx_risk_score_events_partner_id, idx_risk_score_events_player_id;
DROP INDEX IF EXISTS idx_player_limit_actions_partner_id, idx_player_limit_actions_player_id, idx_integration_partners_casino_id;
DROP INDEX IF EXISTS idx_audit_logs_casino_timestamp, idx_audit_logs_player, idx_audit_logs_risk_level;
DROP INDEX IF EXISTS idx_audit_logs_status, idx_audit_logs_triggered_by;
DROP INDEX IF EXISTS idx_certificates_casino, idx_certificates_status, idx_settings_casino;
DROP INDEX IF EXISTS idx_behavioral_risk_player, idx_behavioral_risk_casino, idx_behavioral_risk_score, idx_behavioral_risk_analyzed_at;
DROP INDEX IF EXISTS idx_esg_casino, idx_esg_player, idx_esg_grade, idx_esg_created_at;
DROP INDEX IF EXISTS idx_intervention_player, idx_intervention_casino, idx_intervention_triggered_at, idx_role_permissions_role;
DROP INDEX IF EXISTS idx_demo_players_casino_id, idx_demo_players_risk_score, idx_demo_players_persona_type;
DROP INDEX IF EXISTS idx_demo_behavioral_insights_player_id, idx_demo_behavioral_insights_casino_id, idx_demo_behavioral_insights_timestamp;
DROP INDEX IF EXISTS idx_demo_esg_scores_casino_id, idx_demo_esg_scores_esg_grade, idx_demo_esg_scores_period;
DROP INDEX IF EXISTS idx_login_activity_user_email, idx_login_activity_casino_id, idx_login_activity_timestamp, idx_login_activity_user_id;

-- =====================================================
-- SECTION 3: OPTIMIZE RLS POLICIES (46)
-- =====================================================

DROP POLICY IF EXISTS "Staff can view own certificates" ON training_certificates;
CREATE POLICY "Staff can view own certificates" ON training_certificates FOR SELECT TO authenticated USING (staff_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view relevant assignments" ON staff_training_assignments;
CREATE POLICY "Users can view relevant assignments" ON staff_training_assignments FOR SELECT TO authenticated 
USING (staff_id = (select auth.uid()) OR assigned_by = (select auth.uid()) OR EXISTS (SELECT 1 FROM staff WHERE auth_user_id = (select auth.uid()) AND casino_id = staff_training_assignments.casino_id AND role IN ('manager', 'compliance_officer')));

DROP POLICY IF EXISTS "Staff can view own preferences" ON staff_training_preferences;
CREATE POLICY "Staff can view own preferences" ON staff_training_preferences FOR SELECT TO authenticated USING (staff_id = (select auth.uid()));

DROP POLICY IF EXISTS "Staff can insert own preferences" ON staff_training_preferences;
CREATE POLICY "Staff can insert own preferences" ON staff_training_preferences FOR INSERT TO authenticated WITH CHECK (staff_id = (select auth.uid()));

DROP POLICY IF EXISTS "Staff can update own preferences" ON staff_training_preferences;
CREATE POLICY "Staff can update own preferences" ON staff_training_preferences FOR UPDATE TO authenticated USING (staff_id = (select auth.uid())) WITH CHECK (staff_id = (select auth.uid()));

DROP POLICY IF EXISTS "Staff can delete own preferences" ON staff_training_preferences;
CREATE POLICY "Staff can delete own preferences" ON staff_training_preferences FOR DELETE TO authenticated USING (staff_id = (select auth.uid()));

DROP POLICY IF EXISTS "Allow viewing enrollments" ON training_enrollments;
CREATE POLICY "Allow viewing enrollments" ON training_enrollments FOR SELECT TO authenticated 
USING (staff_id = (select auth.uid()) OR assigned_by = (select auth.uid()) OR EXISTS (SELECT 1 FROM staff s JOIN staff s2 ON s.casino_id = s2.casino_id WHERE s.auth_user_id = (select auth.uid()) AND s2.auth_user_id = training_enrollments.staff_id AND s.role IN ('manager', 'compliance_officer')));

DROP POLICY IF EXISTS "Allow inserting enrollments" ON training_enrollments;
CREATE POLICY "Allow inserting enrollments" ON training_enrollments FOR INSERT TO authenticated 
WITH CHECK (staff_id = (select auth.uid()) OR EXISTS (SELECT 1 FROM staff s JOIN staff s2 ON s.casino_id = s2.casino_id WHERE s.auth_user_id = (select auth.uid()) AND s2.auth_user_id = training_enrollments.staff_id AND s.role IN ('manager', 'compliance_officer')));

DROP POLICY IF EXISTS "Allow updating enrollments" ON training_enrollments;
CREATE POLICY "Allow updating enrollments" ON training_enrollments FOR UPDATE TO authenticated 
USING (staff_id = (select auth.uid()) OR assigned_by = (select auth.uid()) OR EXISTS (SELECT 1 FROM staff s JOIN staff s2 ON s.casino_id = s2.casino_id WHERE s.auth_user_id = (select auth.uid()) AND s2.auth_user_id = training_enrollments.staff_id AND s.role IN ('manager', 'compliance_officer'))) 
WITH CHECK (staff_id = (select auth.uid()) OR assigned_by = (select auth.uid()) OR EXISTS (SELECT 1 FROM staff s JOIN staff s2 ON s.casino_id = s2.casino_id WHERE s.auth_user_id = (select auth.uid()) AND s2.auth_user_id = training_enrollments.staff_id AND s.role IN ('manager', 'compliance_officer')));

DROP POLICY IF EXISTS "Staff can view own quiz attempts" ON quiz_attempts;
CREATE POLICY "Staff can view own quiz attempts" ON quiz_attempts FOR SELECT TO authenticated USING (staff_id = (select auth.uid()));

DROP POLICY IF EXISTS "Staff can create own quiz attempts" ON quiz_attempts;
CREATE POLICY "Staff can create own quiz attempts" ON quiz_attempts FOR INSERT TO authenticated WITH CHECK (staff_id = (select auth.uid()));

DROP POLICY IF EXISTS "Staff can update own quiz attempts" ON quiz_attempts;
CREATE POLICY "Staff can update own quiz attempts" ON quiz_attempts FOR UPDATE TO authenticated USING (staff_id = (select auth.uid())) WITH CHECK (staff_id = (select auth.uid()));

DROP POLICY IF EXISTS "Staff can view own quiz answers" ON quiz_answers;
CREATE POLICY "Staff can view own quiz answers" ON quiz_answers FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM quiz_attempts WHERE id = quiz_answers.attempt_id AND staff_id = (select auth.uid())));

DROP POLICY IF EXISTS "Staff can create own quiz answers" ON quiz_answers;
CREATE POLICY "Staff can create own quiz answers" ON quiz_answers FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM quiz_attempts WHERE id = quiz_answers.attempt_id AND staff_id = (select auth.uid())));

DROP POLICY IF EXISTS "Staff can update own basic profile" ON staff;
CREATE POLICY "Staff can update own basic profile" ON staff FOR UPDATE TO authenticated USING (auth_user_id = (select auth.uid())) WITH CHECK (auth_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view staff" ON staff;
CREATE POLICY "Users can view staff" ON staff FOR SELECT TO authenticated 
USING (auth_user_id = (select auth.uid()) OR EXISTS (SELECT 1 FROM staff s WHERE s.auth_user_id = (select auth.uid()) AND (s.casino_id = staff.casino_id OR s.user_role IN ('REGULATOR', 'EXECUTIVE'))) OR EXISTS (SELECT 1 FROM users WHERE id = (select auth.uid()) AND role IN ('super_admin', 'regulator')));

DROP POLICY IF EXISTS "Staff can read own profile" ON staff;
CREATE POLICY "Staff can read own profile" ON staff FOR SELECT TO authenticated USING (auth_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users FOR UPDATE TO authenticated USING (id = (select auth.uid())) WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Super admins full access to audit logs" ON compliance_audit_logs;
CREATE POLICY "Super admins full access to audit logs" ON compliance_audit_logs TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = (select auth.uid()) AND role = 'super_admin'));

DROP POLICY IF EXISTS "Casino admins view own audit logs" ON compliance_audit_logs;
CREATE POLICY "Casino admins view own audit logs" ON compliance_audit_logs FOR SELECT TO authenticated USING (casino_id IN (SELECT casino_id FROM users WHERE id = (select auth.uid()) AND role = 'casino_admin'));

DROP POLICY IF EXISTS "Regulator admins view all audit logs" ON compliance_audit_logs;
CREATE POLICY "Regulator admins view all audit logs" ON compliance_audit_logs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = (select auth.uid()) AND role = 'regulator'));

DROP POLICY IF EXISTS "Super admins full access to certificates" ON compliance_certificates;
CREATE POLICY "Super admins full access to certificates" ON compliance_certificates TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = (select auth.uid()) AND role = 'super_admin'));

DROP POLICY IF EXISTS "Casino admins view own certificates" ON compliance_certificates;
CREATE POLICY "Casino admins view own certificates" ON compliance_certificates FOR SELECT TO authenticated USING (casino_id IN (SELECT casino_id FROM users WHERE id = (select auth.uid()) AND role = 'casino_admin'));

DROP POLICY IF EXISTS "Regulator admins view all certificates" ON compliance_certificates;
CREATE POLICY "Regulator admins view all certificates" ON compliance_certificates FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = (select auth.uid()) AND role = 'regulator'));

DROP POLICY IF EXISTS "Staff can view own lesson progress" ON training_lesson_progress;
CREATE POLICY "Staff can view own lesson progress" ON training_lesson_progress FOR SELECT TO authenticated USING (enrollment_id IN (SELECT id FROM training_enrollments WHERE staff_id = (select auth.uid())));

DROP POLICY IF EXISTS "Staff can update own lesson progress" ON training_lesson_progress;
CREATE POLICY "Staff can update own lesson progress" ON training_lesson_progress FOR UPDATE TO authenticated USING (enrollment_id IN (SELECT id FROM training_enrollments WHERE staff_id = (select auth.uid()))) WITH CHECK (enrollment_id IN (SELECT id FROM training_enrollments WHERE staff_id = (select auth.uid())));

DROP POLICY IF EXISTS "Staff can insert own lesson progress" ON training_lesson_progress;
CREATE POLICY "Staff can insert own lesson progress" ON training_lesson_progress FOR INSERT TO authenticated WITH CHECK (enrollment_id IN (SELECT id FROM training_enrollments WHERE staff_id = (select auth.uid())));

DROP POLICY IF EXISTS "Super admins full access to settings" ON compliance_settings;
CREATE POLICY "Super admins full access to settings" ON compliance_settings TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = (select auth.uid()) AND role = 'super_admin'));

DROP POLICY IF EXISTS "Casino admins manage own settings" ON compliance_settings;
CREATE POLICY "Casino admins manage own settings" ON compliance_settings TO authenticated USING (casino_id IN (SELECT casino_id FROM users WHERE id = (select auth.uid()) AND role = 'casino_admin'));

DROP POLICY IF EXISTS "Regulator admins view all settings" ON compliance_settings;
CREATE POLICY "Regulator admins view all settings" ON compliance_settings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = (select auth.uid()) AND role = 'regulator'));

DROP POLICY IF EXISTS "Authorized roles can view demo players" ON demo_players;
CREATE POLICY "Authorized roles can view demo players" ON demo_players FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM users WHERE id = (select auth.uid()) AND (user_role IN ('RISK_ANALYST', 'COMPLIANCE', 'EXECUTIVE', 'REGULATOR') OR role IN ('super_admin', 'casino_admin', 'regulator'))));

DROP POLICY IF EXISTS "Risk analysts can manage demo players" ON demo_players;
CREATE POLICY "Risk analysts can manage demo players" ON demo_players TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = (select auth.uid()) AND (user_role = 'RISK_ANALYST' OR role = 'super_admin')));

DROP POLICY IF EXISTS "Authorized roles can view behavioral insights" ON demo_behavioral_insights;
CREATE POLICY "Authorized roles can view behavioral insights" ON demo_behavioral_insights FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM users WHERE id = (select auth.uid()) AND (user_role IN ('RISK_ANALYST', 'COMPLIANCE', 'EXECUTIVE', 'REGULATOR') OR role IN ('super_admin', 'casino_admin', 'regulator'))));

DROP POLICY IF EXISTS "Risk analysts can manage behavioral insights" ON demo_behavioral_insights;
CREATE POLICY "Risk analysts can manage behavioral insights" ON demo_behavioral_insights TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = (select auth.uid()) AND (user_role = 'RISK_ANALYST' OR role = 'super_admin')));

DROP POLICY IF EXISTS "Executives and regulators can view ESG scores" ON demo_esg_scores;
CREATE POLICY "Executives and regulators can view ESG scores" ON demo_esg_scores FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM users WHERE id = (select auth.uid()) AND (user_role IN ('EXECUTIVE', 'REGULATOR', 'COMPLIANCE') OR role IN ('super_admin', 'casino_admin', 'regulator'))));

DROP POLICY IF EXISTS "Risk analysts can manage ESG scores" ON demo_esg_scores;
CREATE POLICY "Risk analysts can manage ESG scores" ON demo_esg_scores TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = (select auth.uid()) AND (user_role = 'RISK_ANALYST' OR role = 'super_admin')));

DROP POLICY IF EXISTS "Casino users can view their casino sessions" ON gaming_sessions;
CREATE POLICY "Casino users can view their casino sessions" ON gaming_sessions FOR SELECT TO authenticated USING (player_id IN (SELECT id FROM players WHERE casino_id IN (SELECT casino_id FROM users WHERE id = (select auth.uid()))));

DROP POLICY IF EXISTS "Casino users can insert sessions" ON gaming_sessions;
CREATE POLICY "Casino users can insert sessions" ON gaming_sessions FOR INSERT TO authenticated WITH CHECK (player_id IN (SELECT id FROM players WHERE casino_id IN (SELECT casino_id FROM users WHERE id = (select auth.uid()))));

DROP POLICY IF EXISTS "Casino users can update their sessions" ON gaming_sessions;
CREATE POLICY "Casino users can update their sessions" ON gaming_sessions FOR UPDATE TO authenticated 
USING (player_id IN (SELECT id FROM players WHERE casino_id IN (SELECT casino_id FROM users WHERE id = (select auth.uid())))) WITH CHECK (player_id IN (SELECT id FROM players WHERE casino_id IN (SELECT casino_id FROM users WHERE id = (select auth.uid()))));

DROP POLICY IF EXISTS "Casino users can view their casino bets" ON player_bets;
CREATE POLICY "Casino users can view their casino bets" ON player_bets FOR SELECT TO authenticated USING (player_id IN (SELECT id FROM players WHERE casino_id IN (SELECT casino_id FROM users WHERE id = (select auth.uid()))));

DROP POLICY IF EXISTS "Casino users can insert bets" ON player_bets;
CREATE POLICY "Casino users can insert bets" ON player_bets FOR INSERT TO authenticated WITH CHECK (player_id IN (SELECT id FROM players WHERE casino_id IN (SELECT casino_id FROM users WHERE id = (select auth.uid()))));

DROP POLICY IF EXISTS "Super admins can view all login activity" ON login_activity;
CREATE POLICY "Super admins can view all login activity" ON login_activity FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = (select auth.uid()) AND role = 'super_admin'));

DROP POLICY IF EXISTS "Regulators can view all login activity" ON login_activity;
CREATE POLICY "Regulators can view all login activity" ON login_activity FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = (select auth.uid()) AND role = 'regulator'));

DROP POLICY IF EXISTS "Casino admins can view their casino login activity" ON login_activity;
CREATE POLICY "Casino admins can view their casino login activity" ON login_activity FOR SELECT TO authenticated USING (casino_id IN (SELECT casino_id FROM users WHERE id = (select auth.uid()) AND role = 'casino_admin'));

DROP POLICY IF EXISTS "Managers and compliance can view their casino login activity" ON login_activity;
CREATE POLICY "Managers and compliance can view their casino login activity" ON login_activity FOR SELECT TO authenticated USING (casino_id IN (SELECT casino_id FROM staff WHERE auth_user_id = (select auth.uid()) AND role IN ('manager', 'compliance_officer')));

DROP POLICY IF EXISTS "Staff can view own login activity" ON login_activity;
CREATE POLICY "Staff can view own login activity" ON login_activity FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

-- =====================================================
-- SECTION 4: FIX FUNCTION SEARCH PATHS (8)
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_casino_id() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN RETURN (SELECT casino_id FROM users WHERE id = auth.uid()); END; $$;

CREATE OR REPLACE FUNCTION is_regulator() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN RETURN EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'regulator'); END; $$;

CREATE OR REPLACE FUNCTION get_auth_casino_id() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN RETURN (SELECT casino_id FROM users WHERE id = auth.uid()); END; $$;

CREATE OR REPLACE FUNCTION is_super_admin() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN RETURN EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'); END; $$;

CREATE OR REPLACE FUNCTION update_compliance_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION update_enrollment_progress() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE total_lessons int; completed_lessons int; new_progress decimal;
BEGIN SELECT COUNT(*) INTO total_lessons FROM training_lessons WHERE module_id = (SELECT module_id FROM training_enrollments WHERE id = NEW.enrollment_id);
SELECT COUNT(*) INTO completed_lessons FROM training_lesson_progress WHERE enrollment_id = NEW.enrollment_id AND completed = true;
IF total_lessons > 0 THEN new_progress := (completed_lessons::decimal / total_lessons::decimal) * 100;
UPDATE training_enrollments SET progress_percentage = new_progress::integer, 
status = CASE WHEN new_progress >= 100 THEN 'completed' WHEN new_progress > 0 THEN 'in_progress' ELSE status END,
completed_at = CASE WHEN new_progress >= 100 AND completed_at IS NULL THEN NOW() ELSE completed_at END WHERE id = NEW.enrollment_id; END IF;
RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION award_training_credits() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_staff_id uuid; v_module_id uuid; v_credits decimal;
BEGIN IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
SELECT staff_id, module_id INTO v_staff_id, v_module_id FROM training_enrollments WHERE id = NEW.id;
SELECT credit_hours INTO v_credits FROM training_modules WHERE id = v_module_id;
INSERT INTO training_credits (staff_id, enrollment_id, module_id, credits_earned) VALUES (v_staff_id, NEW.id, v_module_id, v_credits); END IF;
RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION generate_certificate_on_pass() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_enrollment record; v_module record; v_verification_code text;
BEGIN IF NEW.passed = true AND NEW.score >= 80 THEN
SELECT * INTO v_enrollment FROM training_enrollments WHERE id = NEW.enrollment_id;
SELECT * INTO v_module FROM training_modules WHERE id = v_enrollment.module_id;
v_verification_code := 'CERT-' || UPPER(SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR 8));
INSERT INTO training_certificates (staff_id, module_id, enrollment_id, quiz_attempt_id, certificate_name, issued_date, expiry_date, verification_code, credits_earned)
VALUES (v_enrollment.staff_id, v_enrollment.module_id, NEW.enrollment_id, NEW.id, v_module.title, NOW(),
CASE WHEN v_module.validity_period_months IS NOT NULL THEN NOW() + (v_module.validity_period_months || ' months')::interval ELSE NULL END,
v_verification_code, v_module.credit_hours) ON CONFLICT (enrollment_id) DO NOTHING; END IF; RETURN NEW; END; $$;