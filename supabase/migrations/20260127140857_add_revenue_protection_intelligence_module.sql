/*
  # Add Revenue Protection Intelligence Module

  ## Problem
  The Revenue Protection Intelligence (RPI) feature exists but there's no
  corresponding module in the software_modules table, so casinos can't access it.

  ## Solution
  - Add revenue-protection-intelligence module to software_modules
  - Assign it to all active casinos via casino_modules
  - Make it part of the Enterprise tier for proper pricing

  ## Security
  - All casinos get the module enabled for demo purposes
  - Super admins can manage module assignments
*/

-- Insert the Revenue Protection Intelligence module
INSERT INTO software_modules (
  id,
  name,
  slug,
  description,
  category,
  price_tier,
  price_monthly,
  is_active,
  sort_order,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Revenue Protection Intelligence',
  'revenue-protection-intelligence',
  'AI-powered revenue protection through player retention and fraud prevention',
  'analytics',
  'enterprise',
  15000.00,
  true,
  40,
  NOW(),
  NOW()
) ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Assign the module to all active casinos
INSERT INTO casino_modules (casino_id, module_id, enabled_at, enabled_by)
SELECT 
  c.id,
  (SELECT id FROM software_modules WHERE slug = 'revenue-protection-intelligence'),
  NOW(),
  (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)
FROM casinos c
WHERE c.is_active = true
ON CONFLICT (casino_id, module_id) DO NOTHING;

-- Log the changes
DO $$
DECLARE
  v_module_id UUID;
  v_casino_count INTEGER;
BEGIN
  SELECT id INTO v_module_id 
  FROM software_modules 
  WHERE slug = 'revenue-protection-intelligence';
  
  SELECT COUNT(*) INTO v_casino_count
  FROM casino_modules
  WHERE module_id = v_module_id;
  
  RAISE NOTICE '=== Revenue Protection Intelligence Module Added ===';
  RAISE NOTICE 'Module ID: %', v_module_id;
  RAISE NOTICE 'Assigned to % casinos', v_casino_count;
  RAISE NOTICE 'All casinos can now access RPI features!';
END $$;
