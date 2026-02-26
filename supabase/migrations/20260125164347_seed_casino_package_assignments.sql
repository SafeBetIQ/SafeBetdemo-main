/*
  # Assign Packages to Demo Casinos

  1. Package Assignments
    - Assign different packages to different casinos for demo purposes
    - Standard: Some casinos
    - Enterprise: Other casinos
    - Premium: Top-tier casinos

  2. Update Casino Modules
    - Update existing casino_modules to match their assigned packages
*/

DO $$
DECLARE
  standard_pkg_id uuid := '11111111-1111-1111-1111-111111111111';
  enterprise_pkg_id uuid := '22222222-2222-2222-2222-222222222222';
  premium_pkg_id uuid := '33333333-3333-3333-3333-333333333333';
  super_admin_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  casino_ids uuid[];
  casino_id uuid;
BEGIN
  -- Get all casino IDs
  SELECT array_agg(id) INTO casino_ids FROM casinos;

  -- Assign packages to casinos (distribute them across different tiers)
  FOR i IN 1..array_length(casino_ids, 1) LOOP
    casino_id := casino_ids[i];
    
    -- Distribute casinos across packages
    IF i % 3 = 1 THEN
      -- Assign Standard package (33%)
      INSERT INTO casino_packages (casino_id, package_id, activated_by, is_active)
      VALUES (casino_id, standard_pkg_id, super_admin_id, true)
      ON CONFLICT DO NOTHING;
      
    ELSIF i % 3 = 2 THEN
      -- Assign Enterprise package (33%)
      INSERT INTO casino_packages (casino_id, package_id, activated_by, is_active)
      VALUES (casino_id, enterprise_pkg_id, super_admin_id, true)
      ON CONFLICT DO NOTHING;
      
    ELSE
      -- Assign Premium package (33%)
      INSERT INTO casino_packages (casino_id, package_id, activated_by, is_active)
      VALUES (casino_id, premium_pkg_id, super_admin_id, true)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RAISE NOTICE 'Successfully assigned packages to % casinos', array_length(casino_ids, 1);
END $$;
