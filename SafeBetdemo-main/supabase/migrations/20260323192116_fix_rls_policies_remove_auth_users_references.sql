/*
  # Fix RLS Policies - Remove auth.users Cross-Schema References

  Several RLS policies on public tables query auth.users directly.
  This creates a cross-schema dependency that causes PostgREST schema
  introspection to fail when auth.users has RLS enabled, producing
  "Database error querying schema" for all logins.

  Fix: Replace auth.users references with public.users lookups,
  which already contain role and casino_id.

  Tables fixed:
  - cross_operator_alerts (5 policies)
  - cross_operator_signal_log (4 policies)
  - player_pseudonym_tokens (4 policies)
  - sen_breach_detections (5 policies)
  - sen_broadcast_acknowledgements (4 policies)
  - sen_exclusion_events (5 policies)
  - sen_operator_subscriptions (5 policies)
  - sen_protection_broadcasts (5 policies)
*/

-- ============================================================
-- cross_operator_alerts
-- ============================================================
DROP POLICY IF EXISTS "Regulator read access to cross operator alerts" ON cross_operator_alerts;
DROP POLICY IF EXISTS "Super admin full access to cross operator alerts" ON cross_operator_alerts;
DROP POLICY IF EXISTS "Casino admin reads own casino cross operator alerts" ON cross_operator_alerts;
DROP POLICY IF EXISTS "Casino admin inserts own casino cross operator alerts" ON cross_operator_alerts;
DROP POLICY IF EXISTS "Casino admin updates own casino cross operator alerts" ON cross_operator_alerts;

CREATE POLICY "Regulator read access to cross operator alerts"
  ON cross_operator_alerts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('regulator', 'national_regulator', 'provincial_regulator')));

CREATE POLICY "Super admin full access to cross operator alerts"
  ON cross_operator_alerts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));

CREATE POLICY "Casino admin reads own casino cross operator alerts"
  ON cross_operator_alerts FOR SELECT TO authenticated
  USING (casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid() AND u.role = 'casino_admin'));

CREATE POLICY "Casino admin inserts own casino cross operator alerts"
  ON cross_operator_alerts FOR INSERT TO authenticated
  WITH CHECK (casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid() AND u.role = 'casino_admin'));

CREATE POLICY "Casino admin updates own casino cross operator alerts"
  ON cross_operator_alerts FOR UPDATE TO authenticated
  USING (casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid() AND u.role IN ('casino_admin', 'super_admin')));

-- ============================================================
-- cross_operator_signal_log
-- ============================================================
DROP POLICY IF EXISTS "Super admin full access to signal log" ON cross_operator_signal_log;
DROP POLICY IF EXISTS "Casino admin reads own signal log" ON cross_operator_signal_log;
DROP POLICY IF EXISTS "Casino admin inserts own signal log" ON cross_operator_signal_log;
DROP POLICY IF EXISTS "Regulator read access to signal log" ON cross_operator_signal_log;

CREATE POLICY "Super admin full access to signal log"
  ON cross_operator_signal_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));

CREATE POLICY "Casino admin reads own signal log"
  ON cross_operator_signal_log FOR SELECT TO authenticated
  USING (casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid() AND u.role = 'casino_admin'));

CREATE POLICY "Casino admin inserts own signal log"
  ON cross_operator_signal_log FOR INSERT TO authenticated
  WITH CHECK (casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid() AND u.role = 'casino_admin'));

CREATE POLICY "Regulator read access to signal log"
  ON cross_operator_signal_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('regulator', 'national_regulator', 'provincial_regulator')));

-- ============================================================
-- player_pseudonym_tokens
-- ============================================================
DROP POLICY IF EXISTS "Super admin full access to pseudonym tokens" ON player_pseudonym_tokens;
DROP POLICY IF EXISTS "Casino admin reads own casino pseudonym tokens" ON player_pseudonym_tokens;
DROP POLICY IF EXISTS "Casino admin inserts own casino pseudonym tokens" ON player_pseudonym_tokens;
DROP POLICY IF EXISTS "Casino admin updates own casino pseudonym tokens" ON player_pseudonym_tokens;

CREATE POLICY "Super admin full access to pseudonym tokens"
  ON player_pseudonym_tokens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));

CREATE POLICY "Casino admin reads own casino pseudonym tokens"
  ON player_pseudonym_tokens FOR SELECT TO authenticated
  USING (casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid() AND u.role = 'casino_admin'));

CREATE POLICY "Casino admin inserts own casino pseudonym tokens"
  ON player_pseudonym_tokens FOR INSERT TO authenticated
  WITH CHECK (casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid() AND u.role = 'casino_admin'));

CREATE POLICY "Casino admin updates own casino pseudonym tokens"
  ON player_pseudonym_tokens FOR UPDATE TO authenticated
  USING (casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid() AND u.role IN ('casino_admin', 'super_admin')));

-- ============================================================
-- sen_breach_detections
-- ============================================================
DROP POLICY IF EXISTS "Regulator read access to breach detections" ON sen_breach_detections;
DROP POLICY IF EXISTS "Super admin full access to breach detections" ON sen_breach_detections;
DROP POLICY IF EXISTS "Casino admin reads own breach detections" ON sen_breach_detections;
DROP POLICY IF EXISTS "Casino admin inserts breach detections" ON sen_breach_detections;
DROP POLICY IF EXISTS "Casino admin updates own breach detections" ON sen_breach_detections;

CREATE POLICY "Super admin full access to breach detections"
  ON sen_breach_detections FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));

CREATE POLICY "Regulator read access to breach detections"
  ON sen_breach_detections FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('regulator', 'national_regulator', 'provincial_regulator')));

CREATE POLICY "Casino admin reads own breach detections"
  ON sen_breach_detections FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'casino_admin'
      AND (u.casino_id = sen_breach_detections.detecting_casino_id OR u.casino_id = sen_breach_detections.originating_casino_id))
  );

CREATE POLICY "Casino admin inserts breach detections"
  ON sen_breach_detections FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'casino_admin'));

CREATE POLICY "Casino admin updates own breach detections"
  ON sen_breach_detections FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('casino_admin', 'super_admin')));

-- ============================================================
-- sen_broadcast_acknowledgements
-- ============================================================
DROP POLICY IF EXISTS "Super admin full access to acknowledgements" ON sen_broadcast_acknowledgements;
DROP POLICY IF EXISTS "Casino admin reads own acknowledgements" ON sen_broadcast_acknowledgements;
DROP POLICY IF EXISTS "Casino admin submits acknowledgements" ON sen_broadcast_acknowledgements;
DROP POLICY IF EXISTS "Regulator read access to acknowledgements" ON sen_broadcast_acknowledgements;

CREATE POLICY "Super admin full access to acknowledgements"
  ON sen_broadcast_acknowledgements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));

CREATE POLICY "Casino admin reads own acknowledgements"
  ON sen_broadcast_acknowledgements FOR SELECT TO authenticated
  USING (receiving_casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid() AND u.role = 'casino_admin'));

CREATE POLICY "Casino admin submits acknowledgements"
  ON sen_broadcast_acknowledgements FOR INSERT TO authenticated
  WITH CHECK (receiving_casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid() AND u.role = 'casino_admin'));

CREATE POLICY "Regulator read access to acknowledgements"
  ON sen_broadcast_acknowledgements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('regulator', 'national_regulator', 'provincial_regulator')));

-- ============================================================
-- sen_exclusion_events
-- ============================================================
DROP POLICY IF EXISTS "Super admin full access to exclusion events" ON sen_exclusion_events;
DROP POLICY IF EXISTS "Casino admin reads own casino exclusion events" ON sen_exclusion_events;
DROP POLICY IF EXISTS "Regulator read access to exclusion events" ON sen_exclusion_events;
DROP POLICY IF EXISTS "Casino admin updates own exclusion events" ON sen_exclusion_events;
DROP POLICY IF EXISTS "Casino admin submits exclusion events" ON sen_exclusion_events;

CREATE POLICY "Super admin full access to exclusion events"
  ON sen_exclusion_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));

CREATE POLICY "Casino admin reads own casino exclusion events"
  ON sen_exclusion_events FOR SELECT TO authenticated
  USING (submitting_casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid() AND u.role = 'casino_admin'));

CREATE POLICY "Regulator read access to exclusion events"
  ON sen_exclusion_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('regulator', 'national_regulator', 'provincial_regulator')));

CREATE POLICY "Casino admin updates own exclusion events"
  ON sen_exclusion_events FOR UPDATE TO authenticated
  USING (submitting_casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid() AND u.role IN ('casino_admin', 'super_admin')));

CREATE POLICY "Casino admin submits exclusion events"
  ON sen_exclusion_events FOR INSERT TO authenticated
  WITH CHECK (submitting_casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid() AND u.role = 'casino_admin'));

-- ============================================================
-- sen_operator_subscriptions
-- ============================================================
DROP POLICY IF EXISTS "Super admin full access to subscriptions" ON sen_operator_subscriptions;
DROP POLICY IF EXISTS "Casino admin reads own subscription" ON sen_operator_subscriptions;
DROP POLICY IF EXISTS "Super admin manages subscriptions" ON sen_operator_subscriptions;
DROP POLICY IF EXISTS "Super admin updates subscriptions" ON sen_operator_subscriptions;
DROP POLICY IF EXISTS "Regulator read access to subscriptions" ON sen_operator_subscriptions;

CREATE POLICY "Super admin full access to subscriptions"
  ON sen_operator_subscriptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));

CREATE POLICY "Casino admin reads own subscription"
  ON sen_operator_subscriptions FOR SELECT TO authenticated
  USING (casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid() AND u.role = 'casino_admin'));

CREATE POLICY "Super admin manages subscriptions"
  ON sen_operator_subscriptions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));

CREATE POLICY "Super admin updates subscriptions"
  ON sen_operator_subscriptions FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid())
  );

CREATE POLICY "Regulator read access to subscriptions"
  ON sen_operator_subscriptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('regulator', 'national_regulator', 'provincial_regulator')));

-- ============================================================
-- sen_protection_broadcasts
-- ============================================================
DROP POLICY IF EXISTS "Regulator read access to broadcasts" ON sen_protection_broadcasts;
DROP POLICY IF EXISTS "Super admin updates broadcasts" ON sen_protection_broadcasts;
DROP POLICY IF EXISTS "Super admin inserts broadcasts" ON sen_protection_broadcasts;
DROP POLICY IF EXISTS "Casino admin reads broadcasts for own casino" ON sen_protection_broadcasts;
DROP POLICY IF EXISTS "Super admin full access to broadcasts" ON sen_protection_broadcasts;

CREATE POLICY "Super admin full access to broadcasts"
  ON sen_protection_broadcasts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));

CREATE POLICY "Super admin inserts broadcasts"
  ON sen_protection_broadcasts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));

CREATE POLICY "Super admin updates broadcasts"
  ON sen_protection_broadcasts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));

CREATE POLICY "Regulator read access to broadcasts"
  ON sen_protection_broadcasts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('regulator', 'national_regulator', 'provincial_regulator')));

CREATE POLICY "Casino admin reads broadcasts for own casino"
  ON sen_protection_broadcasts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'casino_admin'
      AND (
        u.casino_id = sen_protection_broadcasts.originating_casino_id
        OR sen_protection_broadcasts.broadcast_scope = 'full_network'
        OR (
          sen_protection_broadcasts.broadcast_scope = 'province_only'
          AND sen_protection_broadcasts.target_province = (SELECT c.province FROM casinos c WHERE c.id = u.casino_id)
        )
      )
    )
  );
