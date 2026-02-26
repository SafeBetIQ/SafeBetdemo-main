/*
  # Add Missing Columns to XAI Tables

  Adds explanation_summary column to ai_reason_stacks table
  to support full explainability features.
*/

-- Add explanation_summary column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_reason_stacks' AND column_name = 'explanation_summary'
  ) THEN
    ALTER TABLE ai_reason_stacks ADD COLUMN explanation_summary text;
  END IF;
END $$;
