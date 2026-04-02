/*
  # Fix XAI Table RLS for Casino Admins

  1. Problem
    - Casino admins from users table cannot access XAI data
    - Only staff users can currently access XAI tables
    - Casino admins have role='casino_admin' in users table

  2. Solution
    - Add SELECT policies for casino_admin role on all XAI tables
    - Allow casino admins to view data for their own casino
    - Allow casino admins to update recommendations (staff decisions)

  3. Tables Affected
    - ai_reason_stacks
    - ai_intervention_recommendations
    - ai_intervention_outcomes
*/

-- Add casino admin access to ai_reason_stacks
CREATE POLICY "Casino admins view own casino reason stacks"
  ON ai_reason_stacks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'casino_admin'
        AND users.casino_id = ai_reason_stacks.casino_id
    )
  );

-- Add casino admin access to ai_intervention_recommendations
CREATE POLICY "Casino admins view own casino recommendations"
  ON ai_intervention_recommendations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'casino_admin'
        AND users.casino_id = ai_intervention_recommendations.casino_id
    )
  );

CREATE POLICY "Casino admins update own casino recommendations"
  ON ai_intervention_recommendations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'casino_admin'
        AND users.casino_id = ai_intervention_recommendations.casino_id
    )
  );

-- Add casino admin access to ai_intervention_outcomes
CREATE POLICY "Casino admins view own casino outcomes"
  ON ai_intervention_outcomes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'casino_admin'
        AND users.casino_id = ai_intervention_outcomes.casino_id
    )
  );
