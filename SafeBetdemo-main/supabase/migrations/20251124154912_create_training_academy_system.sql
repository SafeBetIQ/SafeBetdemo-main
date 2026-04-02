/*
  # SafePlay Academy Training System

  1. New Tables
    - `staff` - Casino staff members who can take training
    - `training_modules` - 50 training courses
    - `training_lessons` - Individual lessons within each module
    - `training_enrollments` - Staff enrollment in courses
    - `training_lesson_progress` - Progress tracking per lesson
    - `training_credits` - Credits awarded on completion
    - `training_categories` - Course categories
    
  2. Security
    - Enable RLS on all tables
    - Casino admins can manage their staff
    - Staff can view their own training
    - Regulators can view all training data
*/

-- ==========================================
-- ENUMS & TYPES
-- ==========================================

DO $$ BEGIN
  CREATE TYPE staff_role AS ENUM (
    'frontline',
    'vip_host',
    'call_centre',
    'manager',
    'compliance_officer',
    'regulator'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE staff_status AS ENUM ('active', 'inactive');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE enrollment_status AS ENUM ('not_started', 'in_progress', 'completed', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ==========================================
-- TRAINING CATEGORIES
-- ==========================================

CREATE TABLE IF NOT EXISTS training_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  icon text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE training_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view training categories"
  ON training_categories FOR SELECT
  TO authenticated
  USING (true);

-- ==========================================
-- STAFF TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid REFERENCES users(id),
  casino_id uuid REFERENCES casinos(id) NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  role staff_role NOT NULL,
  status staff_status DEFAULT 'active',
  hire_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(casino_id, email)
);

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino admins can view their staff"
  ON staff FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND (
        users.role IN ('super_admin', 'regulator')
        OR (users.role = 'casino_admin' AND users.casino_id = staff.casino_id)
      )
    )
  );

CREATE POLICY "Casino admins can manage their staff"
  ON staff FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND (
        users.role = 'super_admin'
        OR (users.role = 'casino_admin' AND users.casino_id = staff.casino_id)
      )
    )
  );

-- ==========================================
-- TRAINING MODULES
-- ==========================================

CREATE TABLE IF NOT EXISTS training_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES training_categories(id),
  title text NOT NULL,
  description text,
  estimated_minutes integer DEFAULT 30,
  credits_awarded integer DEFAULT 5,
  difficulty text CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  is_mandatory boolean DEFAULT false,
  target_roles staff_role[],
  thumbnail_url text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE training_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view training modules"
  ON training_modules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can manage training modules"
  ON training_modules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'super_admin'
    )
  );

-- ==========================================
-- TRAINING LESSONS
-- ==========================================

CREATE TABLE IF NOT EXISTS training_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid REFERENCES training_modules(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  estimated_minutes integer DEFAULT 10,
  sort_order integer DEFAULT 0,
  video_url text,
  quiz_questions jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE training_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view training lessons"
  ON training_lessons FOR SELECT
  TO authenticated
  USING (true);

-- ==========================================
-- TRAINING ENROLLMENTS
-- ==========================================

CREATE TABLE IF NOT EXISTS training_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid REFERENCES staff(id) ON DELETE CASCADE NOT NULL,
  module_id uuid REFERENCES training_modules(id) ON DELETE CASCADE NOT NULL,
  status enrollment_status DEFAULT 'not_started',
  assigned_by uuid REFERENCES users(id),
  assigned_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  progress_percentage integer DEFAULT 0,
  UNIQUE(staff_id, module_id)
);

ALTER TABLE training_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view enrollments"
  ON training_enrollments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN staff s ON s.casino_id = u.casino_id
      WHERE u.id = (select auth.uid())
      AND (
        u.role IN ('super_admin', 'regulator')
        OR (u.role = 'casino_admin' AND s.id = training_enrollments.staff_id)
      )
    )
  );

CREATE POLICY "Casino admins can manage enrollments"
  ON training_enrollments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN staff s ON s.casino_id = u.casino_id
      WHERE u.id = (select auth.uid())
      AND (
        u.role = 'super_admin'
        OR (u.role = 'casino_admin' AND s.id = training_enrollments.staff_id)
      )
    )
  );

-- ==========================================
-- TRAINING LESSON PROGRESS
-- ==========================================

CREATE TABLE IF NOT EXISTS training_lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid REFERENCES training_enrollments(id) ON DELETE CASCADE NOT NULL,
  lesson_id uuid REFERENCES training_lessons(id) ON DELETE CASCADE NOT NULL,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  time_spent_seconds integer DEFAULT 0,
  quiz_score integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE(enrollment_id, lesson_id)
);

ALTER TABLE training_lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view lesson progress"
  ON training_lesson_progress FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN staff s ON s.casino_id = u.casino_id
      JOIN training_enrollments e ON e.staff_id = s.id
      WHERE u.id = (select auth.uid())
      AND e.id = training_lesson_progress.enrollment_id
      AND (
        u.role IN ('super_admin', 'regulator')
        OR u.role = 'casino_admin'
      )
    )
  );

-- ==========================================
-- TRAINING CREDITS
-- ==========================================

CREATE TABLE IF NOT EXISTS training_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid REFERENCES staff(id) ON DELETE CASCADE NOT NULL,
  module_id uuid REFERENCES training_modules(id) ON DELETE CASCADE NOT NULL,
  enrollment_id uuid REFERENCES training_enrollments(id) ON DELETE CASCADE,
  credits_earned integer NOT NULL,
  earned_at timestamptz DEFAULT now(),
  certificate_url text,
  notes text
);

ALTER TABLE training_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view training credits"
  ON training_credits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN staff s ON s.casino_id = u.casino_id
      WHERE u.id = (select auth.uid())
      AND (
        u.role IN ('super_admin', 'regulator')
        OR (u.role = 'casino_admin' AND s.id = training_credits.staff_id)
      )
    )
  );

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_staff_casino_id ON staff(casino_id);
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);
CREATE INDEX IF NOT EXISTS idx_staff_status ON staff(status);
CREATE INDEX IF NOT EXISTS idx_training_modules_category ON training_modules(category_id);
CREATE INDEX IF NOT EXISTS idx_training_lessons_module ON training_lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_training_enrollments_staff ON training_enrollments(staff_id);
CREATE INDEX IF NOT EXISTS idx_training_enrollments_module ON training_enrollments(module_id);
CREATE INDEX IF NOT EXISTS idx_training_enrollments_status ON training_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_training_credits_staff ON training_credits(staff_id);

-- ==========================================
-- TRIGGER TO UPDATE ENROLLMENT PROGRESS
-- ==========================================

CREATE OR REPLACE FUNCTION update_enrollment_progress()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE training_enrollments
  SET
    progress_percentage = (
      SELECT ROUND((COUNT(*) FILTER (WHERE completed = true)::numeric / COUNT(*)::numeric) * 100)
      FROM training_lesson_progress
      WHERE enrollment_id = NEW.enrollment_id
    ),
    status = CASE
      WHEN (SELECT COUNT(*) FILTER (WHERE completed = true) FROM training_lesson_progress WHERE enrollment_id = NEW.enrollment_id) = 
           (SELECT COUNT(*) FROM training_lessons WHERE module_id = (SELECT module_id FROM training_enrollments WHERE id = NEW.enrollment_id))
      THEN 'completed'::enrollment_status
      WHEN (SELECT COUNT(*) FILTER (WHERE completed = true) FROM training_lesson_progress WHERE enrollment_id = NEW.enrollment_id) > 0
      THEN 'in_progress'::enrollment_status
      ELSE 'not_started'::enrollment_status
    END,
    started_at = CASE
      WHEN NEW.completed = true AND (SELECT started_at FROM training_enrollments WHERE id = NEW.enrollment_id) IS NULL
      THEN now()
      ELSE (SELECT started_at FROM training_enrollments WHERE id = NEW.enrollment_id)
    END,
    completed_at = CASE
      WHEN (SELECT COUNT(*) FILTER (WHERE completed = true) FROM training_lesson_progress WHERE enrollment_id = NEW.enrollment_id) = 
           (SELECT COUNT(*) FROM training_lessons WHERE module_id = (SELECT module_id FROM training_enrollments WHERE id = NEW.enrollment_id))
      THEN now()
      ELSE NULL
    END
  WHERE id = NEW.enrollment_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_enrollment_progress
  AFTER INSERT OR UPDATE ON training_lesson_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_enrollment_progress();

-- ==========================================
-- TRIGGER TO AWARD CREDITS ON COMPLETION
-- ==========================================

CREATE OR REPLACE FUNCTION award_training_credits()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    INSERT INTO training_credits (staff_id, module_id, enrollment_id, credits_earned)
    SELECT
      NEW.staff_id,
      NEW.module_id,
      NEW.id,
      tm.credits_awarded
    FROM training_modules tm
    WHERE tm.id = NEW.module_id
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_award_credits
  AFTER UPDATE ON training_enrollments
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION award_training_credits();
