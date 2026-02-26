/*
  # Allow Public Access to Course Library
  
  ## Overview
  This migration enables unauthenticated users to view the public course catalog
  on the marketing website while maintaining security for all other operations.
  
  ## Changes
  1. Add anon SELECT policy for training_modules
  2. Add anon SELECT policy for training_categories
  3. Add anon SELECT policy for training_lessons (for course previews)
  
  ## Security
  - Anon users can ONLY view courses (SELECT)
  - All INSERT/UPDATE/DELETE operations still require authentication
  - Course enrollment and progress tracking still requires authentication
  - Only system-wide courses (casino_id IS NULL) are visible to anon users
*/

-- Allow anonymous users to view system-wide training modules
CREATE POLICY "Anyone can view public training modules"
  ON training_modules FOR SELECT
  TO anon
  USING (casino_id IS NULL);

-- Allow anonymous users to view system-wide training categories
CREATE POLICY "Anyone can view public training categories"
  ON training_categories FOR SELECT
  TO anon
  USING (casino_id IS NULL);

-- Allow anonymous users to view lessons for public modules
CREATE POLICY "Anyone can view public training lessons"
  ON training_lessons FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM training_modules
      WHERE training_modules.id = training_lessons.module_id
      AND training_modules.casino_id IS NULL
    )
  );

-- Update the authenticated user policy to include anon in addition to their existing logic
DROP POLICY IF EXISTS "Users can view relevant training modules" ON training_modules;

CREATE POLICY "Users can view relevant training modules"
  ON training_modules FOR SELECT
  TO authenticated
  USING (
    is_regulator() OR 
    is_super_admin() OR
    casino_id IS NULL OR
    casino_id = get_user_casino_id()
  );

DROP POLICY IF EXISTS "Users can view relevant categories" ON training_categories;

CREATE POLICY "Users can view relevant categories"
  ON training_categories FOR SELECT
  TO authenticated
  USING (
    is_regulator() OR 
    is_super_admin() OR
    casino_id IS NULL OR
    casino_id = get_user_casino_id()
  );

-- Ensure all existing system-wide courses have NULL casino_id
UPDATE training_modules 
SET casino_id = NULL 
WHERE casino_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM casinos WHERE casinos.id = training_modules.casino_id
);

UPDATE training_categories 
SET casino_id = NULL 
WHERE casino_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM casinos WHERE casinos.id = training_categories.casino_id
);

-- Add comment explaining the public access
COMMENT ON POLICY "Anyone can view public training modules" ON training_modules 
IS 'Allows unauthenticated users to browse system-wide courses on the public website';

COMMENT ON POLICY "Anyone can view public training categories" ON training_categories 
IS 'Allows unauthenticated users to view system-wide course categories on the public website';

COMMENT ON POLICY "Anyone can view public training lessons" ON training_lessons 
IS 'Allows unauthenticated users to preview lessons for system-wide courses';
