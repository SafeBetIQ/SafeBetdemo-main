/*
  # Fix XAI Table Column Names

  ## Changes
  Renames columns to match the expected names used by seed data and frontend:
  - ai_reason_stacks: confidence_score -> ai_confidence_score
  - ai_intervention_recommendations: intervention_type -> recommended_intervention_type
  - ai_intervention_recommendations: staff_decision_rationale -> decision_rationale
  - ai_intervention_recommendations: decided_by -> staff_id
*/

-- Fix ai_reason_stacks column name
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_reason_stacks' AND column_name = 'confidence_score'
  ) THEN
    ALTER TABLE ai_reason_stacks RENAME COLUMN confidence_score TO ai_confidence_score;
  END IF;
END $$;

-- Fix ai_intervention_recommendations column names
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_intervention_recommendations' AND column_name = 'intervention_type'
  ) THEN
    ALTER TABLE ai_intervention_recommendations RENAME COLUMN intervention_type TO recommended_intervention_type;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_intervention_recommendations' AND column_name = 'staff_decision_rationale'
  ) THEN
    ALTER TABLE ai_intervention_recommendations RENAME COLUMN staff_decision_rationale TO decision_rationale;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_intervention_recommendations' AND column_name = 'decided_by'
  ) THEN
    ALTER TABLE ai_intervention_recommendations RENAME COLUMN decided_by TO staff_id;
  END IF;
END $$;

-- Update check constraints to use new column names
DO $$
BEGIN
  -- Drop old constraint on intervention_type if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname LIKE '%intervention_type%'
    AND conrelid = 'ai_intervention_recommendations'::regclass
  ) THEN
    ALTER TABLE ai_intervention_recommendations DROP CONSTRAINT IF EXISTS ai_intervention_recommendations_intervention_type_check;
  END IF;

  -- Add new constraint with correct column name
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_intervention_recommendations_recommended_intervention_type_check'
  ) THEN
    ALTER TABLE ai_intervention_recommendations
    ADD CONSTRAINT ai_intervention_recommendations_recommended_intervention_type_check
    CHECK (recommended_intervention_type IN (
      'soft_message',
      'cooling_off',
      'deposit_limit',
      'session_limit',
      'self_exclusion',
      'staff_contact',
      'escalation',
      'monitor_only'
    ));
  END IF;
END $$;