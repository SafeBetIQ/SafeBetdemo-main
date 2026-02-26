/*
  # Seed Pricing Packages and Module Assignments

  1. Package Definitions
    - **Standard Package** ($4,999/month): Core features + basic analytics, compliance, and training
    - **Enterprise Package** ($9,999/month): Standard + AI features + advanced analytics + full training suite
    - **Premium Package** ($14,999/month): Everything - complete AI suite, all advanced features

  2. Module Assignments
    - Maps each module to appropriate package(s)
    - Defines upsell opportunities from Standard → Enterprise → Premium
*/

-- Insert pricing packages
INSERT INTO pricing_packages (id, name, slug, description, price_monthly, price_annual, features, sort_order, is_active)
VALUES 
  (
    '11111111-1111-1111-1111-111111111111',
    'Standard',
    'standard',
    'Essential responsible gaming features for casinos getting started with AI-powered player protection',
    4999.00,
    49990.00,
    '[
      "Live Casino Dashboard",
      "Player & Staff Management", 
      "Real-Time Analytics",
      "Basic Compliance Reporting",
      "Certification Tracking",
      "Email Support"
    ]'::jsonb,
    1,
    true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Enterprise',
    'enterprise',
    'Advanced AI-powered risk detection with comprehensive training and behavioral analytics',
    9999.00,
    99990.00,
    '[
      "Everything in Standard",
      "AI Monitoring & Predictive Analytics",
      "Behavioral Risk Intelligence",
      "Full Training Academy",
      "Staff Training Assignments",
      "Course Management",
      "Priority Support",
      "Dedicated Account Manager"
    ]'::jsonb,
    2,
    true
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Premium',
    'premium',
    'Complete SafeBet IQ suite with cutting-edge AI, ESG reporting, and advanced behavioral monitoring',
    14999.00,
    149990.00,
    '[
      "Everything in Enterprise",
      "SafePlay AI Risk Engine",
      "Cognitive Fatigue Monitoring",
      "Persona Shift Detection",
      "ESG Reporting & King IV Compliance",
      "WhatsApp Integration",
      "API Access",
      "24/7 Premium Support",
      "Custom Integrations"
    ]'::jsonb,
    3,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_annual = EXCLUDED.price_annual,
  features = EXCLUDED.features,
  updated_at = now();

-- Get package IDs
DO $$
DECLARE
  standard_pkg_id uuid := '11111111-1111-1111-1111-111111111111';
  enterprise_pkg_id uuid := '22222222-2222-2222-2222-222222222222';
  premium_pkg_id uuid := '33333333-3333-3333-3333-333333333333';
BEGIN
  -- Clear existing package modules to avoid conflicts
  DELETE FROM package_modules;

  -- STANDARD PACKAGE MODULES
  -- Core (included in all packages)
  INSERT INTO package_modules (package_id, module_id, is_included, is_addon)
  SELECT standard_pkg_id, id, true, false
  FROM software_modules
  WHERE category = 'core';

  -- Analytics: Basic features
  INSERT INTO package_modules (package_id, module_id, is_included, is_addon)
  SELECT standard_pkg_id, id, true, false
  FROM software_modules
  WHERE slug IN ('real-time-analytics', 'live-feed');

  -- Compliance: Basic features
  INSERT INTO package_modules (package_id, module_id, is_included, is_addon)
  SELECT standard_pkg_id, id, true, false
  FROM software_modules
  WHERE slug IN ('compliance-audit', 'intervention-history', 'regulatory-reporting');

  -- Training: Basic certification
  INSERT INTO package_modules (package_id, module_id, is_included, is_addon)
  SELECT standard_pkg_id, id, true, false
  FROM software_modules
  WHERE slug = 'certification-tracking';

  -- ENTERPRISE PACKAGE MODULES
  -- Everything from Standard
  INSERT INTO package_modules (package_id, module_id, is_included, is_addon)
  SELECT enterprise_pkg_id, id, true, false
  FROM software_modules
  WHERE category = 'core'
     OR slug IN ('real-time-analytics', 'live-feed', 'compliance-audit', 'intervention-history', 'regulatory-reporting', 'certification-tracking');

  -- AI: Entry-level AI features (UPSELL from Standard)
  INSERT INTO package_modules (package_id, module_id, is_included, is_addon)
  SELECT enterprise_pkg_id, id, true, false
  FROM software_modules
  WHERE slug IN ('predictive-analytics', 'ai-monitoring');

  -- Analytics: Advanced behavioral intelligence (UPSELL)
  INSERT INTO package_modules (package_id, module_id, is_included, is_addon)
  SELECT enterprise_pkg_id, id, true, false
  FROM software_modules
  WHERE slug = 'behavioral-risk';

  -- Training: Full training suite (UPSELL)
  INSERT INTO package_modules (package_id, module_id, is_included, is_addon)
  SELECT enterprise_pkg_id, id, true, false
  FROM software_modules
  WHERE slug IN ('training-academy', 'course-management', 'training-assignments');

  -- PREMIUM PACKAGE MODULES (Everything)
  -- All modules from Enterprise
  INSERT INTO package_modules (package_id, module_id, is_included, is_addon)
  SELECT premium_pkg_id, id, true, false
  FROM software_modules
  WHERE category = 'core'
     OR slug IN (
       'real-time-analytics', 'live-feed', 'compliance-audit', 'intervention-history', 
       'regulatory-reporting', 'certification-tracking', 'predictive-analytics', 
       'ai-monitoring', 'behavioral-risk', 'training-academy', 'course-management', 
       'training-assignments'
     );

  -- AI: Top-tier AI engine (UPSELL from Enterprise)
  INSERT INTO package_modules (package_id, module_id, is_included, is_addon)
  SELECT premium_pkg_id, id, true, false
  FROM software_modules
  WHERE slug = 'safeplay-ai';

  -- Analytics: Advanced monitoring (UPSELL)
  INSERT INTO package_modules (package_id, module_id, is_included, is_addon)
  SELECT premium_pkg_id, id, true, false
  FROM software_modules
  WHERE slug IN ('cognitive-fatigue', 'persona-shift');

  -- Compliance: ESG reporting (UPSELL)
  INSERT INTO package_modules (package_id, module_id, is_included, is_addon)
  SELECT premium_pkg_id, id, true, false
  FROM software_modules
  WHERE slug = 'esg-reporting';

  RAISE NOTICE 'Successfully configured package modules';
END $$;
