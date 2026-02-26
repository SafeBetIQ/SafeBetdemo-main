/*
  # Seed Comprehensive Casino Login Activity V2
  
  ## Summary
  Seeds realistic login activity data for all casinos to populate the
  Security Audit Trail in the casino dashboard.
  
  ## Data Added
  - 40+ login records per casino over the last 30 days
  - Various user types: admins, staff (managers, compliance officers, frontline)
  - Realistic timestamps (business hours and some after-hours activity)
  - Varied login methods and IP addresses
  - Realistic user agents (desktop and mobile)
  
  ## Casinos
  - Royal Palace Casino: 45 logins
  - Golden Dragon Gaming: 50 logins
  - Silver Star Resort: 42 logins
  
  ## User Types
  - admin: Casino administrators
  - staff: Managers, compliance officers, frontline staff, VIP hosts
  - regulator: Regulatory oversight (not seeded here)
*/

DO $$
DECLARE
  royal_palace_id UUID := '11111111-1111-1111-1111-111111111111';
  golden_dragon_id UUID := '22222222-2222-2222-2222-222222222222';
  silver_star_id UUID := '33333333-3333-3333-3333-333333333333';
  
  -- User IDs for Royal Palace
  rp_admin_1 UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  rp_admin_2 UUID := '3fa13a9d-7b7e-43e6-aa3f-57e48936b699';
  rp_admin_3 UUID := 'e4e698a5-836d-4194-b56c-1a65bafc5b16';
  rp_manager UUID := '5019fe84-0cd3-4ac3-a25e-315371b07c48';
  rp_compliance UUID := 'e4e698a5-836d-4194-b56c-1a65bafc5b16';
  
  -- User IDs for Golden Dragon
  gd_admin_1 UUID := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  gd_admin_2 UUID := '9376bc5e-b86e-4685-b48d-fc46e8095c4d';
  gd_manager UUID := 'd6dd358a-4987-46e7-8ebc-c138ddcdfad3';
  gd_compliance UUID := '9cdb388a-9d43-4bd9-a30e-eb8f8fca6ecd';
  gd_vip_host UUID := 'd4ecbb5c-24af-4bff-97d8-9393f50b6a6c';
  
  -- User IDs for Silver Star (check if ss_admin_1 exists)
  ss_manager UUID := 'e548fc37-7552-4cfa-bcae-a9bcc6b449c2';
  ss_compliance UUID := '7f869448-8316-4c68-93d4-9c04b1aff0f0';
  ss_vip_host UUID := 'e6a1815d-d532-436a-9f3a-c444b5d63696';
  ss_frontline UUID := 'f4254443-5022-438b-a6dc-b421b11ff627';
  
  user_agents TEXT[] := ARRAY[
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1'
  ];
  
  ip_addresses TEXT[] := ARRAY[
    '41.76.42.123',
    '41.76.43.89',
    '102.68.145.34',
    '102.68.146.78',
    '196.201.123.45',
    '196.201.124.90',
    '41.76.50.210',
    '102.68.152.165'
  ];
  
  i INT;
  days_ago INT;
  hour INT;
  minute INT;
BEGIN
  -- Delete existing demo data to avoid duplicates
  DELETE FROM login_activity WHERE casino_id IN (royal_palace_id, golden_dragon_id, silver_star_id);
  
  -- ============================================================
  -- ROYAL PALACE CASINO - Seed 45 login records
  -- ============================================================
  
  FOR i IN 1..45 LOOP
    days_ago := (i / 2)::INT;
    hour := CASE 
      WHEN i % 3 = 0 THEN 8 + (RANDOM() * 4)::INT  -- Morning logins
      WHEN i % 3 = 1 THEN 13 + (RANDOM() * 3)::INT  -- Afternoon logins
      ELSE 18 + (RANDOM() * 2)::INT  -- Evening logins
    END;
    minute := (RANDOM() * 59)::INT;
    
    INSERT INTO login_activity (
      user_id,
      user_email,
      user_type,
      login_timestamp,
      ip_address,
      user_agent,
      login_method,
      casino_id,
      session_id
    ) VALUES (
      CASE 
        WHEN i % 5 = 0 THEN rp_admin_1
        WHEN i % 5 = 1 THEN rp_admin_2
        WHEN i % 5 = 2 THEN rp_manager
        WHEN i % 5 = 3 THEN rp_compliance
        ELSE rp_admin_3
      END,
      CASE 
        WHEN i % 5 = 0 THEN 'admin@royalpalace.safebetiq.com'
        WHEN i % 5 = 1 THEN 'james.anderson@royalpalace.safebetiq.com'
        WHEN i % 5 = 2 THEN 'robert.taylor@royalpalace.safebetiq.com'
        WHEN i % 5 = 3 THEN 'linda.brown@royalpalace.safebetiq.com'
        ELSE 'patricia.martinez@royalpalace.safebetiq.com'
      END,
      CASE 
        WHEN i % 5 = 0 THEN 'admin'
        WHEN i % 5 = 1 THEN 'admin'
        WHEN i % 5 = 4 THEN 'admin'
        ELSE 'staff'
      END,
      NOW() - (days_ago || ' days')::INTERVAL + (hour || ' hours')::INTERVAL + (minute || ' minutes')::INTERVAL,
      ip_addresses[1 + (i % array_length(ip_addresses, 1))],
      user_agents[1 + (i % array_length(user_agents, 1))],
      'direct',
      royal_palace_id,
      'sess_rp_' || gen_random_uuid()::TEXT
    );
  END LOOP;
  
  -- ============================================================
  -- GOLDEN DRAGON GAMING - Seed 50 login records
  -- ============================================================
  
  FOR i IN 1..50 LOOP
    days_ago := (i / 2)::INT;
    hour := CASE 
      WHEN i % 4 = 0 THEN 7 + (RANDOM() * 3)::INT  -- Early morning
      WHEN i % 4 = 1 THEN 11 + (RANDOM() * 3)::INT  -- Late morning
      WHEN i % 4 = 2 THEN 14 + (RANDOM() * 3)::INT  -- Afternoon
      ELSE 19 + (RANDOM() * 2)::INT  -- Evening
    END;
    minute := (RANDOM() * 59)::INT;
    
    INSERT INTO login_activity (
      user_id,
      user_email,
      user_type,
      login_timestamp,
      ip_address,
      user_agent,
      login_method,
      casino_id,
      session_id
    ) VALUES (
      CASE 
        WHEN i % 6 = 0 THEN gd_admin_1
        WHEN i % 6 = 1 THEN gd_admin_2
        WHEN i % 6 = 2 THEN gd_manager
        WHEN i % 6 = 3 THEN gd_compliance
        WHEN i % 6 = 4 THEN gd_vip_host
        ELSE gd_admin_1
      END,
      CASE 
        WHEN i % 6 = 0 THEN 'admin@goldendragon.safebetiq.com'
        WHEN i % 6 = 1 THEN 'charles.davis@goldendragon.safebetiq.com'
        WHEN i % 6 = 2 THEN 'richard.wilson@goldendragon.safebetiq.com'
        WHEN i % 6 = 3 THEN 'maria.lopez@goldendragon.safebetiq.com'
        WHEN i % 6 = 4 THEN 'jennifer.garcia@goldendragon.safebetiq.com'
        ELSE 'william.lee@goldendragon.safebetiq.com'
      END,
      CASE 
        WHEN i % 6 = 0 OR i % 6 = 1 OR i % 6 = 5 THEN 'admin'
        ELSE 'staff'
      END,
      NOW() - (days_ago || ' days')::INTERVAL + (hour || ' hours')::INTERVAL + (minute || ' minutes')::INTERVAL,
      ip_addresses[1 + (i % array_length(ip_addresses, 1))],
      user_agents[1 + (i % array_length(user_agents, 1))],
      'direct',
      golden_dragon_id,
      'sess_gd_' || gen_random_uuid()::TEXT
    );
  END LOOP;
  
  -- ============================================================
  -- SILVER STAR RESORT - Seed 42 login records
  -- ============================================================
  
  FOR i IN 1..42 LOOP
    days_ago := (i / 2)::INT;
    hour := CASE 
      WHEN i % 3 = 0 THEN 8 + (RANDOM() * 3)::INT  -- Morning
      WHEN i % 3 = 1 THEN 12 + (RANDOM() * 4)::INT  -- Midday
      ELSE 17 + (RANDOM() * 3)::INT  -- Late afternoon
    END;
    minute := (RANDOM() * 59)::INT;
    
    INSERT INTO login_activity (
      user_id,
      user_email,
      user_type,
      login_timestamp,
      ip_address,
      user_agent,
      login_method,
      casino_id,
      session_id
    ) VALUES (
      CASE 
        WHEN i % 4 = 0 THEN ss_manager
        WHEN i % 4 = 1 THEN ss_compliance
        WHEN i % 4 = 2 THEN ss_vip_host
        ELSE ss_frontline
      END,
      CASE 
        WHEN i % 4 = 0 THEN 'emily.rodriguez@silverstar.safebetiq.com'
        WHEN i % 4 = 1 THEN 'david.williams@silverstar.safebetiq.com'
        WHEN i % 4 = 2 THEN 'michael.chen@silverstar.safebetiq.com'
        ELSE 'sarah.johnson@silverstar.safebetiq.com'
      END,
      'staff',
      NOW() - (days_ago || ' days')::INTERVAL + (hour || ' hours')::INTERVAL + (minute || ' minutes')::INTERVAL,
      ip_addresses[1 + (i % array_length(ip_addresses, 1))],
      user_agents[1 + (i % array_length(user_agents, 1))],
      'direct',
      silver_star_id,
      'sess_ss_' || gen_random_uuid()::TEXT
    );
  END LOOP;
  
  -- Add a few super admin impersonation logins for auditing
  INSERT INTO login_activity (
    user_id,
    user_email,
    user_type,
    login_timestamp,
    ip_address,
    user_agent,
    login_method,
    casino_id,
    session_id,
    impersonated_by
  ) VALUES 
    (
      rp_admin_1,
      'admin@royalpalace.safebetiq.com',
      'admin',
      NOW() - INTERVAL '7 days' + INTERVAL '10 hours',
      '41.76.42.50',
      user_agents[1],
      'impersonation',
      royal_palace_id,
      'sess_imp_' || gen_random_uuid()::TEXT,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    ),
    (
      gd_admin_1,
      'admin@goldendragon.safebetiq.com',
      'admin',
      NOW() - INTERVAL '12 days' + INTERVAL '14 hours',
      '41.76.42.50',
      user_agents[2],
      'impersonation',
      golden_dragon_id,
      'sess_imp_' || gen_random_uuid()::TEXT,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    ),
    (
      ss_manager,
      'emily.rodriguez@silverstar.safebetiq.com',
      'staff',
      NOW() - INTERVAL '5 days' + INTERVAL '9 hours',
      '41.76.42.50',
      user_agents[3],
      'impersonation',
      silver_star_id,
      'sess_imp_' || gen_random_uuid()::TEXT,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    );
  
END $$;
