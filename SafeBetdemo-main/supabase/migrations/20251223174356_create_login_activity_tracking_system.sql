/*
  # Create Login Activity Tracking System

  1. New Tables
    - `login_activity`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users.id or auth.users.id)
      - `user_email` (text)
      - `user_type` (enum: 'admin', 'staff', 'regulator')
      - `login_timestamp` (timestamptz)
      - `ip_address` (text, nullable)
      - `user_agent` (text, nullable)
      - `login_method` (text: 'direct', 'impersonation')
      - `impersonated_by` (uuid, nullable - who performed the impersonation)
      - `casino_id` (uuid, nullable)
      - `session_id` (text, nullable)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `login_activity` table
    - Super admins can view all login activity
    - Regulators can view all login activity
    - Casino admins can view login activity for their casino
    - Managers and compliance officers can view login activity for their casino
    - Staff can view only their own login activity

  3. Indexes
    - Index on user_email for fast lookups
    - Index on casino_id for casino-specific queries
    - Index on login_timestamp for time-based queries
*/

-- Create login_activity table
CREATE TABLE IF NOT EXISTS login_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text NOT NULL,
  user_type text NOT NULL CHECK (user_type IN ('admin', 'staff', 'regulator')),
  login_timestamp timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  login_method text NOT NULL DEFAULT 'direct' CHECK (login_method IN ('direct', 'impersonation')),
  impersonated_by uuid,
  casino_id uuid REFERENCES casinos(id),
  session_id text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE login_activity ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_login_activity_user_email ON login_activity(user_email);
CREATE INDEX IF NOT EXISTS idx_login_activity_casino_id ON login_activity(casino_id);
CREATE INDEX IF NOT EXISTS idx_login_activity_timestamp ON login_activity(login_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_login_activity_user_id ON login_activity(user_id);

-- Policy: Super admins can view all login activity
CREATE POLICY "Super admins can view all login activity"
  ON login_activity
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Policy: Regulators can view all login activity
CREATE POLICY "Regulators can view all login activity"
  ON login_activity
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'regulator'
    )
  );

-- Policy: Casino admins can view login activity for their casino
CREATE POLICY "Casino admins can view their casino login activity"
  ON login_activity
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'casino_admin'
      AND users.casino_id = login_activity.casino_id
    )
  );

-- Policy: Managers and compliance officers can view their casino login activity
CREATE POLICY "Managers and compliance can view their casino login activity"
  ON login_activity
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
      AND (staff.role = 'manager' OR staff.role = 'compliance_officer')
      AND staff.casino_id = login_activity.casino_id
    )
  );

-- Policy: Staff can view only their own login activity
CREATE POLICY "Staff can view own login activity"
  ON login_activity
  FOR SELECT
  TO authenticated
  USING (
    user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Policy: Allow insert for all authenticated users (for logging)
CREATE POLICY "Allow insert login activity"
  ON login_activity
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create a function to get recent login activity summary
CREATE OR REPLACE FUNCTION get_recent_logins(p_casino_id uuid DEFAULT NULL, p_limit integer DEFAULT 10)
RETURNS TABLE (
  user_email text,
  user_type text,
  login_timestamp timestamptz,
  login_method text,
  impersonated_by_email text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    la.user_email,
    la.user_type,
    la.login_timestamp,
    la.login_method,
    u.email as impersonated_by_email
  FROM login_activity la
  LEFT JOIN users u ON la.impersonated_by = u.id
  WHERE (p_casino_id IS NULL OR la.casino_id = p_casino_id)
  ORDER BY la.login_timestamp DESC
  LIMIT p_limit;
END;
$$;
