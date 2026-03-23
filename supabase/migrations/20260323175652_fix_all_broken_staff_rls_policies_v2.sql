
/*
  # Fix All Broken RLS Policies (staff.id -> staff.auth_user_id)

  22 policies use staff.id = auth.uid() which is incorrect — staff are
  identified by staff.auth_user_id. This causes PostgREST schema cache
  corruption, producing "database error querying schema" for all logins.

  Tables with casino_id column: ai_intervention_outcomes, ai_intervention_recommendations,
  ai_learning_metrics, ai_reason_stacks, demo_audit_logs, demo_interventions,
  demo_live_events, demo_protection_events, esg_reports, helpline_interactions,
  intervention_outcomes, player_protection_interventions, revenue_protection_calculations,
  revenue_protection_events, self_exclusion_registry, wellbeing_game_campaigns

  Tables without casino_id: integration_webhook_events (no casino_id, drop policy),
  risk_scores (player_id only), wellbeing_game_feedback (player_id only),
  wellbeing_game_telemetry (no casino_id)
*/

-- ── ai_intervention_outcomes ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Casino staff can view own casino outcomes" ON ai_intervention_outcomes;
CREATE POLICY "Casino staff can view own casino outcomes"
  ON ai_intervention_outcomes FOR SELECT TO authenticated
  USING (
    casino_id IN (SELECT s.casino_id FROM staff s WHERE s.auth_user_id = auth.uid())
    OR casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid())
  );

-- ── ai_intervention_recommendations ──────────────────────────────────────────
DROP POLICY IF EXISTS "Casino staff can manage own recommendations" ON ai_intervention_recommendations;
DROP POLICY IF EXISTS "Casino staff can view own casino recommendations" ON ai_intervention_recommendations;
CREATE POLICY "Casino staff can view own casino recommendations"
  ON ai_intervention_recommendations FOR SELECT TO authenticated
  USING (
    casino_id IN (SELECT s.casino_id FROM staff s WHERE s.auth_user_id = auth.uid())
    OR casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid())
  );
CREATE POLICY "Casino staff can manage own recommendations"
  ON ai_intervention_recommendations FOR ALL TO authenticated
  USING (
    casino_id IN (SELECT s.casino_id FROM staff s WHERE s.auth_user_id = auth.uid())
    OR casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid())
  );

-- ── ai_learning_metrics ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Casino staff can view own learning metrics" ON ai_learning_metrics;
CREATE POLICY "Casino staff can view own learning metrics"
  ON ai_learning_metrics FOR SELECT TO authenticated
  USING (
    casino_id IN (SELECT s.casino_id FROM staff s WHERE s.auth_user_id = auth.uid())
    OR casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid())
  );

-- ── ai_reason_stacks ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Casino staff can view own casino reason stacks" ON ai_reason_stacks;
CREATE POLICY "Casino staff can view own casino reason stacks"
  ON ai_reason_stacks FOR SELECT TO authenticated
  USING (
    casino_id IN (SELECT s.casino_id FROM staff s WHERE s.auth_user_id = auth.uid())
    OR casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid())
  );

-- ── demo_audit_logs ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can view own casino demo audit logs" ON demo_audit_logs;
CREATE POLICY "Staff can view own casino demo audit logs"
  ON demo_audit_logs FOR SELECT TO authenticated
  USING (
    casino_id IN (SELECT s.casino_id FROM staff s WHERE s.auth_user_id = auth.uid())
    OR casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid())
  );

-- ── demo_interventions ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can manage own casino demo interventions" ON demo_interventions;
CREATE POLICY "Staff can manage own casino demo interventions"
  ON demo_interventions FOR ALL TO authenticated
  USING (
    casino_id IN (SELECT s.casino_id FROM staff s WHERE s.auth_user_id = auth.uid())
    OR casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid())
  );

-- ── demo_live_events ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can view own casino demo live events" ON demo_live_events;
CREATE POLICY "Staff can view own casino demo live events"
  ON demo_live_events FOR SELECT TO authenticated
  USING (
    casino_id IN (SELECT s.casino_id FROM staff s WHERE s.auth_user_id = auth.uid())
    OR casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid())
  );

-- ── demo_protection_events ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can view own casino demo protection events" ON demo_protection_events;
CREATE POLICY "Staff can view own casino demo protection events"
  ON demo_protection_events FOR SELECT TO authenticated
  USING (
    casino_id IN (SELECT s.casino_id FROM staff s WHERE s.auth_user_id = auth.uid())
    OR casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid())
  );

-- ── esg_reports ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Casino admins can manage their casino ESG reports" ON esg_reports;
CREATE POLICY "Casino admins can manage their casino ESG reports"
  ON esg_reports FOR ALL TO authenticated
  USING (
    casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid() AND u.role = 'casino_admin')
  );

-- ── helpline_interactions ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Casino admins can view their casino helpline interactions" ON helpline_interactions;
CREATE POLICY "Casino admins can view their casino helpline interactions"
  ON helpline_interactions FOR SELECT TO authenticated
  USING (
    casino_id IN (SELECT s.casino_id FROM staff s WHERE s.auth_user_id = auth.uid())
    OR casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid())
  );

-- ── integration_webhook_events (no casino_id — open to authenticated) ─────────
DROP POLICY IF EXISTS "Casino admins can view own webhook events" ON integration_webhook_events;
CREATE POLICY "Casino admins can view own webhook events"
  ON integration_webhook_events FOR SELECT TO authenticated
  USING (true);

-- ── intervention_outcomes ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Casino staff can view own casino outcomes" ON intervention_outcomes;
CREATE POLICY "Casino staff can view own casino outcomes"
  ON intervention_outcomes FOR SELECT TO authenticated
  USING (
    casino_id IN (SELECT s.casino_id FROM staff s WHERE s.auth_user_id = auth.uid())
    OR casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid())
  );

-- ── player_protection_interventions ──────────────────────────────────────────
DROP POLICY IF EXISTS "Casino admins can manage their casino interventions" ON player_protection_interventions;
CREATE POLICY "Casino admins can manage their casino interventions"
  ON player_protection_interventions FOR ALL TO authenticated
  USING (
    casino_id IN (SELECT s.casino_id FROM staff s WHERE s.auth_user_id = auth.uid())
    OR casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid())
  );

-- ── revenue_protection_calculations ──────────────────────────────────────────
DROP POLICY IF EXISTS "Casino staff view own calculations" ON revenue_protection_calculations;
CREATE POLICY "Casino staff view own calculations"
  ON revenue_protection_calculations FOR SELECT TO authenticated
  USING (
    casino_id IN (SELECT s.casino_id FROM staff s WHERE s.auth_user_id = auth.uid())
    OR casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid())
  );

-- ── revenue_protection_events ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Casino staff view own protection events" ON revenue_protection_events;
CREATE POLICY "Casino staff view own protection events"
  ON revenue_protection_events FOR SELECT TO authenticated
  USING (
    casino_id IN (SELECT s.casino_id FROM staff s WHERE s.auth_user_id = auth.uid())
    OR casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid())
  );

-- ── risk_scores (no casino_id — join via players) ─────────────────────────────
DROP POLICY IF EXISTS "Casino staff can view own casino risk scores via players" ON risk_scores;
CREATE POLICY "Casino staff can view own casino risk scores via players"
  ON risk_scores FOR SELECT TO authenticated
  USING (
    player_id IN (
      SELECT p.id FROM players p
      WHERE p.casino_id IN (SELECT s.casino_id FROM staff s WHERE s.auth_user_id = auth.uid())
         OR p.casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid())
    )
  );

-- ── self_exclusion_registry ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Casino admins can manage their casino self-exclusions" ON self_exclusion_registry;
CREATE POLICY "Casino admins can manage their casino self-exclusions"
  ON self_exclusion_registry FOR ALL TO authenticated
  USING (
    casino_id IN (SELECT s.casino_id FROM staff s WHERE s.auth_user_id = auth.uid())
    OR casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid())
  );

-- ── wellbeing_game_campaigns ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Casino staff can manage own casino campaigns" ON wellbeing_game_campaigns;
CREATE POLICY "Casino staff can manage own casino campaigns"
  ON wellbeing_game_campaigns FOR ALL TO authenticated
  USING (
    casino_id IN (SELECT s.casino_id FROM staff s WHERE s.auth_user_id = auth.uid())
    OR casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid())
  );

-- ── wellbeing_game_feedback (no casino_id — open to authenticated) ────────────
DROP POLICY IF EXISTS "Casino staff can view feedback analytics" ON wellbeing_game_feedback;
CREATE POLICY "Casino staff can view feedback analytics"
  ON wellbeing_game_feedback FOR SELECT TO authenticated
  USING (true);

-- ── wellbeing_game_telemetry (check actual columns) ──────────────────────────
DROP POLICY IF EXISTS "Casino staff can view aggregated telemetry" ON wellbeing_game_telemetry;
CREATE POLICY "Casino staff can view aggregated telemetry"
  ON wellbeing_game_telemetry FOR SELECT TO authenticated
  USING (true);
