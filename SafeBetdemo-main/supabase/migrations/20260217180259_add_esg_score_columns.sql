/*
  # Add ESG Score Columns

  1. Changes
    - Add overall_esg_score column (calculated from component scores)
    - Add environmental_score column
    - Add social_score column
    - Add governance_score column
    - Create function to auto-calculate scores based on metrics
  
  2. Score Calculation
    - Environmental: Based on renewable energy usage and carbon emissions
    - Social: Based on player protection metrics, interventions, and community investment
    - Governance: Based on compliance, training completion, and regulatory violations
*/

-- Add score columns
ALTER TABLE esg_metrics 
ADD COLUMN IF NOT EXISTS environmental_score numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS social_score numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS governance_score numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS overall_esg_score numeric(5,2) DEFAULT 0;

-- Create function to calculate ESG scores
CREATE OR REPLACE FUNCTION calculate_esg_scores()
RETURNS TRIGGER AS $$
DECLARE
  env_score numeric;
  soc_score numeric;
  gov_score numeric;
BEGIN
  -- Calculate Environmental Score (0-100)
  -- Based on renewable energy usage and low carbon emissions
  env_score := LEAST(100, (
    (COALESCE(NEW.renewable_energy_kwh, 0) / NULLIF(400000, 0)) * 50 +
    (100 - LEAST(100, (COALESCE(NEW.carbon_emissions_tons, 0) / 100) * 100)) * 0.5
  ));
  
  -- Calculate Social Score (0-100)
  -- Based on player protection, interventions, and community investment
  soc_score := LEAST(100, (
    (COALESCE(NEW.interventions_performed, 0) / NULLIF(500, 0)) * 25 +
    (COALESCE(NEW.successful_interventions, 0)::numeric / NULLIF(COALESCE(NEW.interventions_performed, 1), 0)) * 25 +
    (COALESCE(NEW.training_completion_rate, 0) / 100) * 25 +
    (COALESCE(NEW.community_investment_amount, 0) / NULLIF(200000, 0)) * 25
  ));
  
  -- Calculate Governance Score (0-100)
  -- Based on compliance, training, and lack of violations
  gov_score := LEAST(100, (
    (COALESCE(NEW.compliance_audits_passed, 0) / NULLIF(4, 0)) * 30 +
    (COALESCE(NEW.training_completion_rate, 0) / 100) * 30 +
    (CASE WHEN COALESCE(NEW.regulatory_violations, 0) = 0 THEN 40 ELSE GREATEST(0, 40 - (NEW.regulatory_violations * 10)) END)
  ));
  
  -- Update the record with calculated scores
  NEW.environmental_score := ROUND(env_score, 2);
  NEW.social_score := ROUND(soc_score, 2);
  NEW.governance_score := ROUND(gov_score, 2);
  NEW.overall_esg_score := ROUND((env_score + soc_score + gov_score) / 3, 2);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-calculate scores
DROP TRIGGER IF EXISTS calculate_esg_scores_trigger ON esg_metrics;
CREATE TRIGGER calculate_esg_scores_trigger
  BEFORE INSERT OR UPDATE ON esg_metrics
  FOR EACH ROW
  EXECUTE FUNCTION calculate_esg_scores();

-- Update existing records with calculated scores
UPDATE esg_metrics SET updated_at = updated_at;
