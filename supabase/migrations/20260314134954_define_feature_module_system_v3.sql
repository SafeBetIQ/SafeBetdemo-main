/*
  # Define Feature Module System v3

  ## Summary
  Establishes the 7 canonical feature modules and auto-enables default modules
  for all existing casinos. casino_modules.casino_id references the casinos table.

  ## Default Modules (auto-enabled for all casinos)
  1. Behavioural Risk Intelligence
  2. Responsible Gambling Alerts
  3. Compliance Reporting

  ## Optional Modules (Super Admin enables per casino)
  4. Cross Operator Monitoring
  5. Self Exclusion Network
  6. AI Risk Forecasting
  7. Regulator Intelligence

  ## Changes
  - Adds is_default and icon columns to software_modules
  - Clears stale module seeds and inserts the 7 canonical modules
  - Auto-enables 3 default modules for all casinos in the casinos table
*/

-- 1. Add missing columns if not present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'software_modules' AND column_name = 'is_default'
  ) THEN
    ALTER TABLE software_modules ADD COLUMN is_default boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'software_modules' AND column_name = 'icon'
  ) THEN
    ALTER TABLE software_modules ADD COLUMN icon text DEFAULT 'shield';
  END IF;
END $$;

-- 2. Remove casino_modules rows referencing modules we are replacing
DELETE FROM casino_modules
WHERE module_id IN (
  SELECT id FROM software_modules
  WHERE slug NOT IN (
    'behavioural-risk-intelligence',
    'responsible-gambling-alerts',
    'compliance-reporting',
    'cross-operator-monitoring',
    'self-exclusion-network',
    'ai-risk-forecasting',
    'regulator-intelligence'
  )
);

-- 3. Remove old module definitions
DELETE FROM software_modules
WHERE slug NOT IN (
  'behavioural-risk-intelligence',
  'responsible-gambling-alerts',
  'compliance-reporting',
  'cross-operator-monitoring',
  'self-exclusion-network',
  'ai-risk-forecasting',
  'regulator-intelligence'
);

-- 4. Upsert the 7 canonical modules
INSERT INTO software_modules (name, slug, description, category, price_tier, is_active, is_default, icon, sort_order)
VALUES
  (
    'Behavioural Risk Intelligence',
    'behavioural-risk-intelligence',
    'AI-powered player behaviour analysis with real-time risk scoring, trend detection, and automated risk profiling across all player sessions.',
    'core',
    'standard',
    true,
    true,
    'brain',
    1
  ),
  (
    'Responsible Gambling Alerts',
    'responsible-gambling-alerts',
    'Automated intervention alerts, threshold rules, and escalation workflows to protect players showing signs of problem gambling.',
    'core',
    'standard',
    true,
    true,
    'bell',
    2
  ),
  (
    'Compliance Reporting',
    'compliance-reporting',
    'Automated regulatory compliance reports, NGA obligation tracking, audit trails, and downloadable compliance packages.',
    'core',
    'standard',
    true,
    true,
    'file-check',
    3
  ),
  (
    'Cross Operator Monitoring',
    'cross-operator-monitoring',
    'Intelligence sharing across licensed operators to identify multi-venue problem gambling patterns and coordinated risk profiles.',
    'intelligence',
    'premium',
    true,
    false,
    'network',
    4
  ),
  (
    'Self Exclusion Network',
    'self-exclusion-network',
    'SARGF-compliant self exclusion register with cross-venue enforcement, breach detection, and reinstatement workflow management.',
    'compliance',
    'premium',
    true,
    false,
    'user-x',
    5
  ),
  (
    'AI Risk Forecasting',
    'ai-risk-forecasting',
    'Predictive AI models that forecast player risk escalation up to 30 days ahead using session patterns, cognitive fatigue signals, and behavioural drift.',
    'ai',
    'enterprise',
    true,
    false,
    'sparkles',
    6
  ),
  (
    'Regulator Intelligence',
    'regulator-intelligence',
    'Dedicated regulator-facing dashboards with national and provincial gambling behaviour insights, high-risk player analytics, and intervention statistics.',
    'compliance',
    'enterprise',
    true,
    false,
    'landmark',
    7
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  price_tier = EXCLUDED.price_tier,
  is_active = EXCLUDED.is_active,
  is_default = EXCLUDED.is_default,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- 5. Auto-enable all 3 default modules for every casino in the casinos table
INSERT INTO casino_modules (casino_id, module_id, enabled_at, enabled_by)
SELECT
  c.id AS casino_id,
  sm.id AS module_id,
  now() AS enabled_at,
  NULL AS enabled_by
FROM casinos c
CROSS JOIN software_modules sm
WHERE sm.is_default = true
  AND sm.is_active = true
ON CONFLICT (casino_id, module_id) DO NOTHING;
