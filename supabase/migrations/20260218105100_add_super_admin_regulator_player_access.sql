/*
  # Add Super Admin and Regulator Access to Players and Gaming Sessions

  1. Security Changes
    - Add SELECT policy for super_admin to view all players
    - Add SELECT policy for regulator to view all players
    - Add SELECT policy for super_admin to view all gaming_sessions
    - Add SELECT policy for regulator to view all gaming_sessions
  
  2. Purpose
    - Enable super_admin and regulator roles to view behavioral risk intelligence data across all casinos
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'players' 
    AND policyname = 'Super admins can view all players'
  ) THEN
    CREATE POLICY "Super admins can view all players"
      ON players FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()
          AND u.role = 'super_admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'players' 
    AND policyname = 'Regulators can view all players'
  ) THEN
    CREATE POLICY "Regulators can view all players"
      ON players FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()
          AND u.role = 'regulator'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'gaming_sessions' 
    AND policyname = 'Super admins can view all gaming sessions'
  ) THEN
    CREATE POLICY "Super admins can view all gaming sessions"
      ON gaming_sessions FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()
          AND u.role = 'super_admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'gaming_sessions' 
    AND policyname = 'Regulators can view all gaming sessions'
  ) THEN
    CREATE POLICY "Regulators can view all gaming sessions"
      ON gaming_sessions FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()
          AND u.role = 'regulator'
        )
      );
  END IF;
END $$;
