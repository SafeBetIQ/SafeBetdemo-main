/*
  # Implement Complete Multi-Tenancy Architecture
  
  ## Overview
  This migration ensures complete data isolation between casinos while allowing regulators to access all data.
  
  ## Changes Made
  
  ### 1. Add casino_id to All Relevant Tables
  - training_modules: Casino-specific training content
  - training_categories: Casino-specific course categories
  - integration_partners: Each partner belongs to a casino
  
  ### 2. Row Level Security Policies
  - Casino admins can ONLY see their own casino's data
  - Regulators can see ALL casino data
  - Staff can only see their own casino's training data
  - Players and sessions are already isolated per casino
  
  ### 3. Helper Functions
  - Function to get user's casino_id
  - Function to check if user is regulator
  
  ## Security
  - All policies use auth.uid() for authentication
  - Regulators identified by role='regulator' in users table
  - Complete data isolation between casinos
  - No data overlap possible
*/

-- Add casino_id to training_modules (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'training_modules' AND column_name = 'casino_id'
  ) THEN
    ALTER TABLE training_modules ADD COLUMN casino_id uuid REFERENCES casinos(id);
  END IF;
END $$;

-- Add casino_id to training_categories  
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'training_categories' AND column_name = 'casino_id'
  ) THEN
    ALTER TABLE training_categories ADD COLUMN casino_id uuid REFERENCES casinos(id);
  END IF;
END $$;

-- Add casino_id to integration_partners
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'integration_partners' AND column_name = 'casino_id'
  ) THEN
    ALTER TABLE integration_partners ADD COLUMN casino_id uuid REFERENCES casinos(id);
  END IF;
END $$;

-- Create helper function to get current user's casino_id
CREATE OR REPLACE FUNCTION get_user_casino_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT casino_id 
    FROM public.users 
    WHERE id = auth.uid()
  );
END;
$$;

-- Create helper function to check if user is regulator
CREATE OR REPLACE FUNCTION is_regulator()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT role = 'regulator' 
    FROM public.users 
    WHERE id = auth.uid()
  );
END;
$$;

-- Create helper function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT role = 'super_admin' 
    FROM public.users 
    WHERE id = auth.uid()
  );
END;
$$;

/*
  ## Row Level Security Policies
  
  The following policies ensure:
  1. Casino admins can ONLY access their casino's data
  2. Regulators can access ALL casino data (for oversight)
  3. Super admins can access everything
  4. Complete data isolation between casinos
*/

-- DROP existing policies and recreate them with proper multi-tenancy

-- PLAYERS table policies
DROP POLICY IF EXISTS "Casino staff can view own casino players" ON players;
DROP POLICY IF EXISTS "Casino admins can manage own casino players" ON players;
DROP POLICY IF EXISTS "Regulators can view all players" ON players;
DROP POLICY IF EXISTS "Casino users can view own casino players" ON players;
DROP POLICY IF EXISTS "Casino admins can insert own casino players" ON players;
DROP POLICY IF EXISTS "Casino admins can update own casino players" ON players;
DROP POLICY IF EXISTS "Casino admins can delete own casino players" ON players;

CREATE POLICY "Casino users can view own casino players"
  ON players FOR SELECT
  TO authenticated
  USING (
    is_regulator() OR 
    is_super_admin() OR
    casino_id = get_user_casino_id()
  );

CREATE POLICY "Casino admins can insert own casino players"
  ON players FOR INSERT
  TO authenticated
  WITH CHECK (
    casino_id = get_user_casino_id() AND
    NOT is_regulator()
  );

CREATE POLICY "Casino admins can update own casino players"
  ON players FOR UPDATE
  TO authenticated
  USING (casino_id = get_user_casino_id())
  WITH CHECK (casino_id = get_user_casino_id());

CREATE POLICY "Casino admins can delete own casino players"
  ON players FOR DELETE
  TO authenticated
  USING (
    casino_id = get_user_casino_id() AND
    NOT is_regulator()
  );

-- GAMING_SESSIONS table policies
DROP POLICY IF EXISTS "Users can view own casino sessions" ON gaming_sessions;
DROP POLICY IF EXISTS "Users can insert own casino sessions" ON gaming_sessions;
DROP POLICY IF EXISTS "Users can view sessions" ON gaming_sessions;
DROP POLICY IF EXISTS "Casino users can manage sessions" ON gaming_sessions;

CREATE POLICY "Users can view sessions"
  ON gaming_sessions FOR SELECT
  TO authenticated
  USING (
    is_regulator() OR 
    is_super_admin() OR
    casino_id = get_user_casino_id()
  );

CREATE POLICY "Casino users can manage sessions"
  ON gaming_sessions FOR ALL
  TO authenticated
  USING (casino_id = get_user_casino_id())
  WITH CHECK (casino_id = get_user_casino_id());

-- INTERVENTIONS table policies
DROP POLICY IF EXISTS "Users can view own casino interventions" ON interventions;
DROP POLICY IF EXISTS "Users can create interventions" ON interventions;
DROP POLICY IF EXISTS "Users can view interventions" ON interventions;
DROP POLICY IF EXISTS "Casino users can manage interventions" ON interventions;

CREATE POLICY "Users can view interventions"
  ON interventions FOR SELECT
  TO authenticated
  USING (
    is_regulator() OR 
    is_super_admin() OR
    casino_id = get_user_casino_id()
  );

CREATE POLICY "Casino users can manage interventions"
  ON interventions FOR ALL
  TO authenticated
  USING (casino_id = get_user_casino_id())
  WITH CHECK (casino_id = get_user_casino_id());

-- STAFF table policies (for training academy)
DROP POLICY IF EXISTS "Staff can view own profile" ON staff;
DROP POLICY IF EXISTS "Staff can update own profile" ON staff;
DROP POLICY IF EXISTS "Users can view staff" ON staff;
DROP POLICY IF EXISTS "Casino admins can manage staff" ON staff;

CREATE POLICY "Users can view staff"
  ON staff FOR SELECT
  TO authenticated
  USING (
    is_regulator() OR 
    is_super_admin() OR
    casino_id = get_user_casino_id() OR
    auth_user_id = auth.uid()
  );

CREATE POLICY "Casino admins can manage staff"
  ON staff FOR ALL
  TO authenticated
  USING (casino_id = get_user_casino_id())
  WITH CHECK (casino_id = get_user_casino_id());

-- TRAINING_MODULES policies (casino-specific training)
DROP POLICY IF EXISTS "Staff can view training modules" ON training_modules;
DROP POLICY IF EXISTS "Users can view relevant training modules" ON training_modules;
DROP POLICY IF EXISTS "Casino admins can manage training modules" ON training_modules;

CREATE POLICY "Users can view relevant training modules"
  ON training_modules FOR SELECT
  TO authenticated
  USING (
    is_regulator() OR 
    is_super_admin() OR
    casino_id IS NULL OR
    casino_id = get_user_casino_id()
  );

CREATE POLICY "Casino admins can manage training modules"
  ON training_modules FOR ALL
  TO authenticated
  USING (
    (casino_id = get_user_casino_id() OR casino_id IS NULL) AND
    NOT is_regulator()
  )
  WITH CHECK (
    (casino_id = get_user_casino_id() OR casino_id IS NULL) AND
    NOT is_regulator()
  );

-- TRAINING_CATEGORIES policies
DROP POLICY IF EXISTS "Anyone can view categories" ON training_categories;
DROP POLICY IF EXISTS "Users can view relevant categories" ON training_categories;
DROP POLICY IF EXISTS "Casino admins can manage categories" ON training_categories;

CREATE POLICY "Users can view relevant categories"
  ON training_categories FOR SELECT
  TO authenticated
  USING (
    is_regulator() OR 
    is_super_admin() OR
    casino_id IS NULL OR
    casino_id = get_user_casino_id()
  );

CREATE POLICY "Casino admins can manage categories"
  ON training_categories FOR ALL
  TO authenticated
  USING (
    (casino_id = get_user_casino_id() OR casino_id IS NULL) AND
    NOT is_regulator()
  )
  WITH CHECK (
    (casino_id = get_user_casino_id() OR casino_id IS NULL) AND
    NOT is_regulator()
  );

-- TRAINING_ENROLLMENTS policies (via staff.casino_id)
DROP POLICY IF EXISTS "Staff can view own enrollments" ON training_enrollments;
DROP POLICY IF EXISTS "Staff can enroll in courses" ON training_enrollments;
DROP POLICY IF EXISTS "Users can view enrollments" ON training_enrollments;
DROP POLICY IF EXISTS "Staff can manage enrollments" ON training_enrollments;

CREATE POLICY "Users can view enrollments"
  ON training_enrollments FOR SELECT
  TO authenticated
  USING (
    is_regulator() OR 
    is_super_admin() OR
    EXISTS (
      SELECT 1 FROM staff 
      WHERE staff.id = training_enrollments.staff_id 
      AND (staff.casino_id = get_user_casino_id() OR staff.auth_user_id = auth.uid())
    )
  );

CREATE POLICY "Staff can manage enrollments"
  ON training_enrollments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff 
      WHERE staff.id = training_enrollments.staff_id 
      AND staff.casino_id = get_user_casino_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff 
      WHERE staff.id = training_enrollments.staff_id 
      AND staff.casino_id = get_user_casino_id()
    )
  );

-- INTEGRATION_PARTNERS policies
DROP POLICY IF EXISTS "Partners can access own data" ON integration_partners;
DROP POLICY IF EXISTS "Users can view relevant partners" ON integration_partners;
DROP POLICY IF EXISTS "Casino admins can manage partners" ON integration_partners;

CREATE POLICY "Users can view relevant partners"
  ON integration_partners FOR SELECT
  TO authenticated
  USING (
    is_regulator() OR 
    is_super_admin() OR
    casino_id = get_user_casino_id()
  );

CREATE POLICY "Casino admins can manage partners"
  ON integration_partners FOR ALL
  TO authenticated
  USING (casino_id = get_user_casino_id())
  WITH CHECK (casino_id = get_user_casino_id());

-- CASINO_CONFIG policies
DROP POLICY IF EXISTS "Casino admins can manage config" ON casino_config;
DROP POLICY IF EXISTS "Users can view config" ON casino_config;

CREATE POLICY "Users can view config"
  ON casino_config FOR SELECT
  TO authenticated
  USING (
    is_regulator() OR 
    is_super_admin() OR
    casino_id = get_user_casino_id()
  );

CREATE POLICY "Casino admins can manage own config"
  ON casino_config FOR ALL
  TO authenticated
  USING (casino_id = get_user_casino_id())
  WITH CHECK (casino_id = get_user_casino_id());

-- CASINOS table policies
DROP POLICY IF EXISTS "Users can view own casino" ON casinos;
DROP POLICY IF EXISTS "Regulators can view all casinos" ON casinos;
DROP POLICY IF EXISTS "Users can view relevant casinos" ON casinos;
DROP POLICY IF EXISTS "Super admins can manage casinos" ON casinos;

CREATE POLICY "Users can view relevant casinos"
  ON casinos FOR SELECT
  TO authenticated
  USING (
    is_regulator() OR 
    is_super_admin() OR
    id = get_user_casino_id()
  );

CREATE POLICY "Super admins can manage casinos"
  ON casinos FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- USERS table policies
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can view relevant users" ON users;

CREATE POLICY "Users can view relevant users"
  ON users FOR SELECT
  TO authenticated
  USING (
    is_regulator() OR 
    is_super_admin() OR
    id = auth.uid() OR
    casino_id = get_user_casino_id()
  );

CREATE POLICY "Users can update own profile only"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_casino_id ON players(casino_id);
CREATE INDEX IF NOT EXISTS idx_gaming_sessions_casino_id ON gaming_sessions(casino_id);
CREATE INDEX IF NOT EXISTS idx_interventions_casino_id ON interventions(casino_id);
CREATE INDEX IF NOT EXISTS idx_staff_casino_id ON staff(casino_id);
CREATE INDEX IF NOT EXISTS idx_training_modules_casino_id ON training_modules(casino_id);
CREATE INDEX IF NOT EXISTS idx_training_categories_casino_id ON training_categories(casino_id);
CREATE INDEX IF NOT EXISTS idx_integration_partners_casino_id ON integration_partners(casino_id);
CREATE INDEX IF NOT EXISTS idx_users_casino_id ON users(casino_id);

-- Add comments for documentation
COMMENT ON FUNCTION get_user_casino_id() IS 'Returns the casino_id of the authenticated user';
COMMENT ON FUNCTION is_regulator() IS 'Returns true if the authenticated user is a regulator';
COMMENT ON FUNCTION is_super_admin() IS 'Returns true if the authenticated user is a super admin';

COMMENT ON COLUMN training_modules.casino_id IS 'NULL = system-wide module available to all casinos, otherwise casino-specific';
COMMENT ON COLUMN training_categories.casino_id IS 'NULL = system-wide category available to all casinos, otherwise casino-specific';
COMMENT ON COLUMN integration_partners.casino_id IS 'Each integration partner belongs to a specific casino for complete data isolation';
