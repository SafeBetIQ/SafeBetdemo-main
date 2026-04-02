/*
  # Update Pricing to South African Rand (ZAR) and Add AI Feature to Standard Plan

  1. Changes to Pricing Packages
    - Convert all pricing from USD to ZAR (South African Rand)
    - **Standard Package**: R75,000/month (R750,000/year) - added 1 AI feature
    - **Enterprise Package**: R145,000/month (R1,450,000/year)
    - **Premium Package**: R215,000/month (R2,150,000/year)

  2. Standard Package Enhancement
    - Added "AI Monitoring" module to Standard package
    - This gives Standard customers basic AI-powered player monitoring capabilities
    - Updated features list to include "AI Monitoring & Early Warning System"

  3. Market Positioning
    - Pricing adjusted for South African B2B SaaS market
    - Competitive rates for SA casino operators
    - Annual pricing offers ~10 months for 12 (2 months free)
*/

-- Update pricing packages with ZAR pricing
UPDATE pricing_packages
SET 
  price_monthly = 75000.00,
  price_annual = 750000.00,
  features = '[
    "Live Casino Dashboard",
    "Player & Staff Management", 
    "Real-Time Analytics",
    "AI Monitoring & Early Warning System",
    "Basic Compliance Reporting",
    "Certification Tracking",
    "Email Support"
  ]'::jsonb,
  updated_at = now()
WHERE slug = 'standard';

UPDATE pricing_packages
SET 
  price_monthly = 145000.00,
  price_annual = 1450000.00,
  updated_at = now()
WHERE slug = 'enterprise';

UPDATE pricing_packages
SET 
  price_monthly = 215000.00,
  price_annual = 2150000.00,
  updated_at = now()
WHERE slug = 'premium';

-- Add AI Monitoring module to Standard package
DO $$
DECLARE
  standard_pkg_id uuid := '11111111-1111-1111-1111-111111111111';
  ai_monitoring_module_id uuid;
BEGIN
  -- Get the ai-monitoring module ID
  SELECT id INTO ai_monitoring_module_id
  FROM software_modules
  WHERE slug = 'ai-monitoring';

  -- Check if it exists and add to standard package if not already there
  IF ai_monitoring_module_id IS NOT NULL THEN
    INSERT INTO package_modules (package_id, module_id, is_included, is_addon)
    VALUES (standard_pkg_id, ai_monitoring_module_id, true, false)
    ON CONFLICT (package_id, module_id) DO UPDATE 
    SET is_included = true, is_addon = false;
    
    RAISE NOTICE 'Successfully added AI Monitoring to Standard package';
  ELSE
    RAISE WARNING 'AI Monitoring module not found';
  END IF;
END $$;
