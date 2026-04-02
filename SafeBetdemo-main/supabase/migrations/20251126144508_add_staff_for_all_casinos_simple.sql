-- Add staff members for Royal Palace Casino and Golden Dragon Gaming
-- Staff members are isolated per casino - each casino has its own staff

-- Royal Palace Casino staff (casino_id: 11111111-1111-1111-1111-111111111111)
INSERT INTO staff (first_name, last_name, email, role, status, casino_id, hire_date)
SELECT 'James', 'Anderson', 'james.anderson@royalpalace.com', 'frontline', 'active', '11111111-1111-1111-1111-111111111111', '2024-01-15'
WHERE NOT EXISTS (SELECT 1 FROM staff WHERE email = 'james.anderson@royalpalace.com');

INSERT INTO staff (first_name, last_name, email, role, status, casino_id, hire_date)
SELECT 'Patricia', 'Martinez', 'patricia.martinez@royalpalace.com', 'vip_host', 'active', '11111111-1111-1111-1111-111111111111', '2024-02-01'
WHERE NOT EXISTS (SELECT 1 FROM staff WHERE email = 'patricia.martinez@royalpalace.com');

INSERT INTO staff (first_name, last_name, email, role, status, casino_id, hire_date)
SELECT 'Robert', 'Taylor', 'robert.taylor@royalpalace.com', 'manager', 'active', '11111111-1111-1111-1111-111111111111', '2024-03-10'
WHERE NOT EXISTS (SELECT 1 FROM staff WHERE email = 'robert.taylor@royalpalace.com');

INSERT INTO staff (first_name, last_name, email, role, status, casino_id, hire_date)
SELECT 'Linda', 'Brown', 'linda.brown@royalpalace.com', 'compliance_officer', 'active', '11111111-1111-1111-1111-111111111111', '2024-01-20'
WHERE NOT EXISTS (SELECT 1 FROM staff WHERE email = 'linda.brown@royalpalace.com');

-- Golden Dragon Gaming staff (casino_id: 22222222-2222-2222-2222-222222222222)
INSERT INTO staff (first_name, last_name, email, role, status, casino_id, hire_date)
SELECT 'William', 'Lee', 'william.lee@goldendragon.com', 'frontline', 'active', '22222222-2222-2222-2222-222222222222', '2024-02-15'
WHERE NOT EXISTS (SELECT 1 FROM staff WHERE email = 'william.lee@goldendragon.com');

INSERT INTO staff (first_name, last_name, email, role, status, casino_id, hire_date)
SELECT 'Jennifer', 'Garcia', 'jennifer.garcia@goldendragon.com', 'vip_host', 'active', '22222222-2222-2222-2222-222222222222', '2024-03-01'
WHERE NOT EXISTS (SELECT 1 FROM staff WHERE email = 'jennifer.garcia@goldendragon.com');

INSERT INTO staff (first_name, last_name, email, role, status, casino_id, hire_date)
SELECT 'Richard', 'Wilson', 'richard.wilson@goldendragon.com', 'manager', 'active', '22222222-2222-2222-2222-222222222222', '2024-01-05'
WHERE NOT EXISTS (SELECT 1 FROM staff WHERE email = 'richard.wilson@goldendragon.com');

INSERT INTO staff (first_name, last_name, email, role, status, casino_id, hire_date)
SELECT 'Maria', 'Lopez', 'maria.lopez@goldendragon.com', 'compliance_officer', 'active', '22222222-2222-2222-2222-222222222222', '2024-02-20'
WHERE NOT EXISTS (SELECT 1 FROM staff WHERE email = 'maria.lopez@goldendragon.com');

INSERT INTO staff (first_name, last_name, email, role, status, casino_id, hire_date)
SELECT 'Charles', 'Davis', 'charles.davis@goldendragon.com', 'call_centre', 'active', '22222222-2222-2222-2222-222222222222', '2024-03-15'
WHERE NOT EXISTS (SELECT 1 FROM staff WHERE email = 'charles.davis@goldendragon.com');
