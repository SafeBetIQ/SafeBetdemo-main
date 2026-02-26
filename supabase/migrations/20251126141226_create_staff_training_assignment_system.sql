-- Create Staff Training Assignment System
--
-- Overview:
-- This migration creates a comprehensive system for casino admins to manage
-- staff training assignments in bulk, including mandatory course tracking,
-- assignment history, and notification preferences.

-- Create staff_training_assignments table
CREATE TABLE IF NOT EXISTS staff_training_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES casinos(id),
  staff_id uuid NOT NULL REFERENCES staff(id),
  module_id uuid NOT NULL REFERENCES training_modules(id),
  assigned_by uuid NOT NULL REFERENCES users(id),
  assigned_at timestamptz DEFAULT now(),
  due_date timestamptz,
  is_mandatory boolean DEFAULT false,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  notes text,
  notification_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create training_assignment_templates table
CREATE TABLE IF NOT EXISTS training_assignment_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES casinos(id),
  name text NOT NULL,
  description text,
  target_roles staff_role[],
  module_ids uuid[],
  default_due_days integer DEFAULT 30,
  is_active boolean DEFAULT true,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create staff_training_preferences table
CREATE TABLE IF NOT EXISTS staff_training_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid UNIQUE NOT NULL REFERENCES staff(id),
  email_notifications boolean DEFAULT true,
  preferred_training_days text[],
  preferred_training_time text DEFAULT 'any' CHECK (preferred_training_time IN ('morning', 'afternoon', 'evening', 'any')),
  timezone text DEFAULT 'Africa/Johannesburg',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE staff_training_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_assignment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_training_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for staff_training_assignments
CREATE POLICY "Users can view relevant assignments"
  ON staff_training_assignments FOR SELECT
  TO authenticated
  USING (
    is_regulator() OR 
    is_super_admin() OR
    casino_id = get_user_casino_id() OR
    EXISTS (
      SELECT 1 FROM staff 
      WHERE staff.id = staff_training_assignments.staff_id 
      AND staff.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Casino admins can manage assignments"
  ON staff_training_assignments FOR ALL
  TO authenticated
  USING (casino_id = get_user_casino_id())
  WITH CHECK (casino_id = get_user_casino_id());

-- RLS Policies for training_assignment_templates
CREATE POLICY "Users can view relevant templates"
  ON training_assignment_templates FOR SELECT
  TO authenticated
  USING (
    is_regulator() OR 
    is_super_admin() OR
    casino_id = get_user_casino_id()
  );

CREATE POLICY "Casino admins can manage templates"
  ON training_assignment_templates FOR ALL
  TO authenticated
  USING (casino_id = get_user_casino_id())
  WITH CHECK (casino_id = get_user_casino_id());

-- RLS Policies for staff_training_preferences
CREATE POLICY "Staff can view own preferences"
  ON staff_training_preferences FOR SELECT
  TO authenticated
  USING (
    is_regulator() OR 
    is_super_admin() OR
    EXISTS (
      SELECT 1 FROM staff 
      WHERE staff.id = staff_training_preferences.staff_id 
      AND (staff.casino_id = get_user_casino_id() OR staff.auth_user_id = auth.uid())
    )
  );

CREATE POLICY "Staff can update own preferences"
  ON staff_training_preferences FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff 
      WHERE staff.id = staff_training_preferences.staff_id 
      AND staff.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff 
      WHERE staff.id = staff_training_preferences.staff_id 
      AND staff.auth_user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_training_assignments_casino_id ON staff_training_assignments(casino_id);
CREATE INDEX IF NOT EXISTS idx_staff_training_assignments_staff_id ON staff_training_assignments(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_training_assignments_module_id ON staff_training_assignments(module_id);
CREATE INDEX IF NOT EXISTS idx_staff_training_assignments_due_date ON staff_training_assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_training_assignment_templates_casino_id ON training_assignment_templates(casino_id);
CREATE INDEX IF NOT EXISTS idx_staff_training_preferences_staff_id ON staff_training_preferences(staff_id);

-- Add helpful comments
COMMENT ON TABLE staff_training_assignments IS 'Tracks casino admin assignments of training courses to staff members';
COMMENT ON TABLE training_assignment_templates IS 'Pre-configured templates for common training scenarios (e.g., new hire onboarding)';
COMMENT ON TABLE staff_training_preferences IS 'Staff member notification and learning preferences';
