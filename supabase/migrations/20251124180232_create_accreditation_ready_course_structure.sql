/*
  # Create Accreditation-Ready Training Structure

  1. Purpose
    - Add fields required for SETA/NQF accreditation
    - Support professional training standards
    - Enable proper assessment and certification
    
  2. New Columns
    - learning_outcomes: Specific, measurable outcomes per NQF guidelines
    - assessment_criteria: How learners will be assessed
    - nqf_level: National Qualifications Framework level (1-10)
    - unit_standards: SAQA unit standard codes
    - prerequisite_modules: Required prior learning
    - pass_percentage: Minimum score to pass
    - certificate_template: Template for completion certificates
    
  3. Training Lesson Enhancements
    - quiz_questions: Structured assessments (already exists)
    - practical_activities: Hands-on exercises
    - case_studies: Real-world scenarios
    - resources: Additional learning materials
    
  4. Staff Progress Tracking
    - assessment_scores: Track quiz/test results
    - attempts: Number of times attempted
    - certificates: Store issued certificates
*/

-- Add accreditation fields to training_modules
ALTER TABLE training_modules
ADD COLUMN IF NOT EXISTS learning_outcomes TEXT[],
ADD COLUMN IF NOT EXISTS assessment_criteria TEXT[],
ADD COLUMN IF NOT EXISTS nqf_level INTEGER DEFAULT 4,
ADD COLUMN IF NOT EXISTS unit_standards TEXT[],
ADD COLUMN IF NOT EXISTS prerequisite_modules UUID[],
ADD COLUMN IF NOT EXISTS pass_percentage INTEGER DEFAULT 70,
ADD COLUMN IF NOT EXISTS accreditation_body TEXT DEFAULT 'National Gambling Board - South Africa',
ADD COLUMN IF NOT EXISTS version TEXT DEFAULT '1.0',
ADD COLUMN IF NOT EXISTS last_reviewed_date TIMESTAMPTZ DEFAULT NOW();

-- Add assessment tracking to training_lesson_progress
ALTER TABLE training_lesson_progress
ADD COLUMN IF NOT EXISTS assessment_score INTEGER,
ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS passed BOOLEAN DEFAULT FALSE;

-- Create certificates table
CREATE TABLE IF NOT EXISTS training_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id),
  module_id UUID NOT NULL REFERENCES training_modules(id),
  enrollment_id UUID NOT NULL REFERENCES training_enrollments(id),
  certificate_number TEXT UNIQUE NOT NULL,
  issued_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expiry_date TIMESTAMPTZ,
  final_score INTEGER NOT NULL,
  credits_awarded INTEGER NOT NULL,
  issuer_name TEXT DEFAULT 'SafePlay Academy',
  verification_code TEXT UNIQUE NOT NULL,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE training_certificates ENABLE ROW LEVEL SECURITY;

-- RLS policies for certificates
CREATE POLICY "Staff can view own certificates"
  ON training_certificates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = training_certificates.staff_id
      AND staff.email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Admins can view all certificates"
  ON training_certificates
  FOR SELECT
  TO authenticated
  USING (
    can_user_view_staff((SELECT casino_id FROM staff WHERE id = training_certificates.staff_id))
  );

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_training_certificates_staff_id ON training_certificates(staff_id);
CREATE INDEX IF NOT EXISTS idx_training_certificates_module_id ON training_certificates(module_id);
CREATE INDEX IF NOT EXISTS idx_training_certificates_verification_code ON training_certificates(verification_code);
