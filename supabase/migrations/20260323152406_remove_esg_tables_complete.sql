/*
  # Remove ESG Tables - Complete Cleanup

  This migration permanently removes all ESG (Environmental, Social, Governance)
  related tables, columns, indexes, and functions from the SafeBet IQ platform.

  ## Tables Dropped
  - esg_metrics
  - esg_scores
  - responsible_gambling_contributions
  - social_impact_metrics
  - employee_rg_training
  - king_iv_principles
  - king_iv_outcomes
  - king_iv_compliance_status
  - esg_compliance_scores

  ## Columns Removed
  - casinos.overall_esg_score
  - casinos.environmental_score
  - casinos.social_score
  - casinos.governance_score

  ## Functions Dropped
  - calculate_king_iv_score
  - calculate_esg_score

  ## Security
  - All associated RLS policies are dropped automatically with their tables.

  ## Notes
  - Uses DROP TABLE IF EXISTS to ensure safe execution even if tables don't exist.
  - This is a permanent, irreversible removal of all ESG data.
*/

-- Drop ESG-specific tables
DROP TABLE IF EXISTS king_iv_compliance_status CASCADE;
DROP TABLE IF EXISTS king_iv_outcomes CASCADE;
DROP TABLE IF EXISTS king_iv_principles CASCADE;
DROP TABLE IF EXISTS esg_scores CASCADE;
DROP TABLE IF EXISTS esg_metrics CASCADE;
DROP TABLE IF EXISTS esg_compliance_scores CASCADE;
DROP TABLE IF EXISTS responsible_gambling_contributions CASCADE;
DROP TABLE IF EXISTS social_impact_metrics CASCADE;
DROP TABLE IF EXISTS employee_rg_training CASCADE;

-- Remove ESG columns from casinos table if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'casinos' AND column_name = 'overall_esg_score'
  ) THEN
    ALTER TABLE casinos DROP COLUMN overall_esg_score;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'casinos' AND column_name = 'environmental_score'
  ) THEN
    ALTER TABLE casinos DROP COLUMN environmental_score;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'casinos' AND column_name = 'social_score'
  ) THEN
    ALTER TABLE casinos DROP COLUMN social_score;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'casinos' AND column_name = 'governance_score'
  ) THEN
    ALTER TABLE casinos DROP COLUMN governance_score;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'casinos' AND column_name = 'esg_grade'
  ) THEN
    ALTER TABLE casinos DROP COLUMN esg_grade;
  END IF;
END $$;

-- Drop ESG-related functions if they exist
DROP FUNCTION IF EXISTS calculate_king_iv_score(uuid) CASCADE;
DROP FUNCTION IF EXISTS calculate_esg_score(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_casino_esg_summary(uuid) CASCADE;
DROP FUNCTION IF EXISTS refresh_esg_metrics() CASCADE;
