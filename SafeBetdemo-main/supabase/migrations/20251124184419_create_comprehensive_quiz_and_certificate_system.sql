/*
  # Create Comprehensive Quiz and Certificate System

  1. Purpose
    - Add professional quiz system for each module
    - Track quiz attempts and scores
    - Implement 80% passmark requirement
    - Enable auto-retry for failed attempts
    - Generate certificates upon passing
    
  2. New Tables
    - module_quizzes: Quiz configuration per module
    - quiz_questions: Question bank for each module
    - quiz_attempts: Track each quiz attempt
    - quiz_answers: Store staff answers
    
  3. Business Rules
    - Minimum 10 questions per quiz
    - 80% passmark required
    - Auto-retry on failure
    - Certificate generated on pass
    - View correct answers after completion
*/

-- Create module quizzes table
CREATE TABLE IF NOT EXISTS module_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  pass_percentage INTEGER NOT NULL DEFAULT 80,
  time_limit_minutes INTEGER,
  shuffle_questions BOOLEAN DEFAULT TRUE,
  show_correct_answers BOOLEAN DEFAULT TRUE,
  max_attempts INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(module_id)
);

-- Create quiz questions table
CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES module_quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice',
  options JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  points INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (question_type IN ('multiple_choice', 'scenario_based', 'true_false'))
);

-- Create quiz attempts table
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES training_enrollments(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES module_quizzes(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  score_percentage DECIMAL(5,2) NOT NULL,
  points_earned INTEGER NOT NULL,
  total_points INTEGER NOT NULL,
  passed BOOLEAN NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  time_spent_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create quiz answers table
CREATE TABLE IF NOT EXISTS quiz_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  selected_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  points_awarded INTEGER DEFAULT 0,
  answered_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update training_certificates table if needed
ALTER TABLE training_certificates
ADD COLUMN IF NOT EXISTS quiz_attempt_id UUID REFERENCES quiz_attempts(id),
ADD COLUMN IF NOT EXISTS certificate_html TEXT,
ADD COLUMN IF NOT EXISTS certificate_metadata JSONB;

-- Enable RLS
ALTER TABLE module_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for module_quizzes
CREATE POLICY "Anyone can view quizzes"
  ON module_quizzes
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for quiz_questions
CREATE POLICY "Staff can view quiz questions"
  ON quiz_questions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM module_quizzes mq
      JOIN training_modules tm ON tm.id = mq.module_id
      WHERE mq.id = quiz_questions.quiz_id
    )
  );

-- RLS Policies for quiz_attempts
CREATE POLICY "Staff can view own quiz attempts"
  ON quiz_attempts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = quiz_attempts.staff_id
      AND staff.email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Staff can create own quiz attempts"
  ON quiz_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = quiz_attempts.staff_id
      AND staff.email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Staff can update own quiz attempts"
  ON quiz_attempts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = quiz_attempts.staff_id
      AND staff.email = auth.jwt()->>'email'
    )
  );

-- RLS Policies for quiz_answers
CREATE POLICY "Staff can view own quiz answers"
  ON quiz_answers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quiz_attempts qa
      JOIN staff s ON s.id = qa.staff_id
      WHERE qa.id = quiz_answers.attempt_id
      AND s.email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Staff can create own quiz answers"
  ON quiz_answers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quiz_attempts qa
      JOIN staff s ON s.id = qa.staff_id
      WHERE qa.id = quiz_answers.attempt_id
      AND s.email = auth.jwt()->>'email'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_module_quizzes_module_id ON module_quizzes(module_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_enrollment_id ON quiz_attempts(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_staff_id ON quiz_attempts(staff_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_attempt_id ON quiz_answers(attempt_id);

-- Create function to auto-generate certificate
CREATE OR REPLACE FUNCTION generate_certificate_on_pass()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate certificate if passed and doesn't already exist
  IF NEW.passed = true AND NOT EXISTS (
    SELECT 1 FROM training_certificates 
    WHERE enrollment_id = NEW.enrollment_id
  ) THEN
    INSERT INTO training_certificates (
      staff_id,
      module_id,
      enrollment_id,
      quiz_attempt_id,
      certificate_number,
      issued_date,
      final_score,
      credits_awarded,
      verification_code
    )
    SELECT
      NEW.staff_id,
      te.module_id,
      NEW.enrollment_id,
      NEW.id,
      'CERT-' || UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 12)),
      NOW(),
      NEW.score_percentage::INTEGER,
      tm.credits_awarded,
      UPPER(SUBSTRING(MD5(random()::text || NOW()::text) FROM 1 FOR 16))
    FROM training_enrollments te
    JOIN training_modules tm ON tm.id = te.module_id
    WHERE te.id = NEW.enrollment_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for certificate generation
DROP TRIGGER IF EXISTS trigger_generate_certificate ON quiz_attempts;
CREATE TRIGGER trigger_generate_certificate
  AFTER INSERT OR UPDATE ON quiz_attempts
  FOR EACH ROW
  WHEN (NEW.passed = true)
  EXECUTE FUNCTION generate_certificate_on_pass();
