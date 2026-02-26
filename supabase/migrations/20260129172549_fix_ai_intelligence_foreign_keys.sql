/*
  # Fix AI Intelligence Foreign Keys

  This migration adds missing foreign key constraints to enable proper joins.

  ## Changes
    - Add foreign key constraint from ai_reason_stacks.player_id to players.id
    - Add foreign key constraint from ai_intervention_recommendations.player_id to players.id
    - Add foreign key constraint from ai_intervention_outcomes.player_id to players.id
    - Add foreign key constraint from ai_learning_metrics.player_id to players.id

  These foreign keys will allow Supabase to properly resolve joins when querying with embedded resources.
*/

-- Add foreign key from ai_reason_stacks to players
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'ai_reason_stacks_player_id_fkey'
  ) THEN
    ALTER TABLE ai_reason_stacks
    ADD CONSTRAINT ai_reason_stacks_player_id_fkey
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key from ai_intervention_recommendations to players
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'ai_intervention_recommendations_player_id_fkey'
  ) THEN
    ALTER TABLE ai_intervention_recommendations
    ADD CONSTRAINT ai_intervention_recommendations_player_id_fkey
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key from ai_intervention_outcomes to players (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_intervention_outcomes') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'ai_intervention_outcomes_player_id_fkey'
    ) THEN
      ALTER TABLE ai_intervention_outcomes
      ADD CONSTRAINT ai_intervention_outcomes_player_id_fkey
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Add foreign key from ai_learning_metrics to players (if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_learning_metrics' AND column_name = 'player_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'ai_learning_metrics_player_id_fkey'
    ) THEN
      ALTER TABLE ai_learning_metrics
      ADD CONSTRAINT ai_learning_metrics_player_id_fkey
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Create indexes for better join performance
CREATE INDEX IF NOT EXISTS idx_ai_reason_stacks_player_id ON ai_reason_stacks(player_id);
CREATE INDEX IF NOT EXISTS idx_ai_intervention_recommendations_player_id ON ai_intervention_recommendations(player_id);
CREATE INDEX IF NOT EXISTS idx_ai_intervention_outcomes_player_id ON ai_intervention_outcomes(player_id);
