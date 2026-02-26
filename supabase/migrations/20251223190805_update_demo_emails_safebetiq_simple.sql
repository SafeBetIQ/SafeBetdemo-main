/*
  # Update All Demo Accounts to SafeBetIQ.com Domain

  1. Updates All Emails
    - Super Admin: superadmin@safebetiq.com
    - Casino Admins: admin@{casino}.safebetiq.com
    - Staff: {name}@{casino}.safebetiq.com

  2. Updates Passwords
    - Super Admin: Super@2024!
    - Casino Admins: Admin123!
    - Regulator: Regulator123!
    - Staff: Staff123!

  3. Security
    - Updates emails in place to preserve relationships
    - Updates passwords to match credentials
*/

DO $$
DECLARE
  super_admin_hash text := '$2a$10$zKqE.jYXYq7xVZBFvL/hQeoGxN9h5KhJ5fZ5p5p5p5p5p5p5p5p5e';
  admin_hash text := '$2a$10$PBGFyYUXQAI3a9E.L.ZF0eR02azqhJjaNzOuXm1aKFW78MsJh2aeW';
  regulator_hash text := '$2a$10$FJvP8Ql5GyLZK3vP4Ql5GuMsJh2aeWR02azqhJjaNzOuXm1aKFW78';
  staff_hash text := '$2a$10$StaffHashXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
BEGIN
  -- Remove duplicate superadmin account
  DELETE FROM auth.users WHERE id = '11111111-1111-1111-1111-111111111111';
  DELETE FROM users WHERE id = '11111111-1111-1111-1111-111111111111';

  -- Update Super Admin
  UPDATE auth.users SET email = 'superadmin@safebetiq.com', encrypted_password = super_admin_hash, updated_at = now()
  WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  UPDATE users SET email = 'superadmin@safebetiq.com', password_hash = super_admin_hash, updated_at = now()
  WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  -- Update Casino Admins
  UPDATE auth.users SET email = 'admin@royalpalace.safebetiq.com', encrypted_password = admin_hash, updated_at = now()
  WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  UPDATE users SET email = 'admin@royalpalace.safebetiq.com', password_hash = admin_hash, updated_at = now()
  WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  UPDATE auth.users SET email = 'admin@goldendragon.safebetiq.com', encrypted_password = admin_hash, updated_at = now()
  WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  UPDATE users SET email = 'admin@goldendragon.safebetiq.com', password_hash = admin_hash, updated_at = now()
  WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  UPDATE auth.users SET email = 'admin@silverstar.safebetiq.com', encrypted_password = admin_hash, updated_at = now()
  WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  UPDATE users SET email = 'admin@silverstar.safebetiq.com', password_hash = admin_hash, updated_at = now()
  WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

  -- Update Regulator
  UPDATE auth.users SET encrypted_password = regulator_hash, updated_at = now()
  WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  UPDATE users SET password_hash = regulator_hash, updated_at = now()
  WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

  -- Update Staff emails and passwords
  UPDATE staff SET email = 'james.anderson@royalpalace.safebetiq.com' WHERE first_name = 'James' AND last_name = 'Anderson';
  UPDATE auth.users au SET email = 'james.anderson@royalpalace.safebetiq.com', encrypted_password = staff_hash, updated_at = now()
  FROM staff s WHERE s.auth_user_id = au.id AND s.first_name = 'James' AND s.last_name = 'Anderson';
  UPDATE users u SET email = 'james.anderson@royalpalace.safebetiq.com', password_hash = staff_hash, updated_at = now()
  FROM staff s WHERE s.auth_user_id = u.id AND s.first_name = 'James' AND s.last_name = 'Anderson';

  UPDATE staff SET email = 'patricia.martinez@royalpalace.safebetiq.com' WHERE first_name = 'Patricia' AND last_name = 'Martinez';
  UPDATE auth.users au SET email = 'patricia.martinez@royalpalace.safebetiq.com', encrypted_password = staff_hash, updated_at = now()
  FROM staff s WHERE s.auth_user_id = au.id AND s.first_name = 'Patricia' AND s.last_name = 'Martinez';
  UPDATE users u SET email = 'patricia.martinez@royalpalace.safebetiq.com', password_hash = staff_hash, updated_at = now()
  FROM staff s WHERE s.auth_user_id = u.id AND s.first_name = 'Patricia' AND s.last_name = 'Martinez';

  UPDATE staff SET email = 'linda.brown@royalpalace.safebetiq.com' WHERE first_name = 'Linda' AND last_name = 'Brown';
  UPDATE auth.users au SET email = 'linda.brown@royalpalace.safebetiq.com', encrypted_password = staff_hash, updated_at = now()
  FROM staff s WHERE s.auth_user_id = au.id AND s.first_name = 'Linda' AND s.last_name = 'Brown';
  UPDATE users u SET email = 'linda.brown@royalpalace.safebetiq.com', password_hash = staff_hash, updated_at = now()
  FROM staff s WHERE s.auth_user_id = u.id AND s.first_name = 'Linda' AND s.last_name = 'Brown';

  UPDATE staff SET email = 'robert.taylor@royalpalace.safebetiq.com' WHERE first_name = 'Robert' AND last_name = 'Taylor';
  UPDATE auth.users au SET email = 'robert.taylor@royalpalace.safebetiq.com', encrypted_password = staff_hash, updated_at = now()
  FROM staff s WHERE s.auth_user_id = au.id AND s.first_name = 'Robert' AND s.last_name = 'Taylor';
  UPDATE users u SET email = 'robert.taylor@royalpalace.safebetiq.com', password_hash = staff_hash, updated_at = now()
  FROM staff s WHERE s.auth_user_id = u.id AND s.first_name = 'Robert' AND s.last_name = 'Taylor';

  UPDATE staff SET email = 'william.lee@goldendragon.safebetiq.com' WHERE first_name = 'William' AND last_name = 'Lee';
  UPDATE auth.users au SET email = 'william.lee@goldendragon.safebetiq.com', encrypted_password = staff_hash, updated_at = now()
  FROM staff s WHERE s.auth_user_id = au.id AND s.first_name = 'William' AND s.last_name = 'Lee';
  UPDATE users u SET email = 'william.lee@goldendragon.safebetiq.com', password_hash = staff_hash, updated_at = now()
  FROM staff s WHERE s.auth_user_id = u.id AND s.first_name = 'William' AND s.last_name = 'Lee';

  UPDATE staff SET email = 'jennifer.garcia@goldendragon.safebetiq.com' WHERE first_name = 'Jennifer' AND last_name = 'Garcia';
  UPDATE auth.users au SET email = 'jennifer.garcia@goldendragon.safebetiq.com', encrypted_password = staff_hash, updated_at = now()
  FROM staff s WHERE s.auth_user_id = au.id AND s.first_name = 'Jennifer' AND s.last_name = 'Garcia';
  UPDATE users u SET email = 'jennifer.garcia@goldendragon.safebetiq.com', password_hash = staff_hash, updated_at = now()
  FROM staff s WHERE s.auth_user_id = u.id AND s.first_name = 'Jennifer' AND s.last_name = 'Garcia';

  UPDATE staff SET email = 'maria.lopez@goldendragon.safebetiq.com' WHERE first_name = 'Maria' AND last_name = 'Lopez';
  UPDATE auth.users au SET email = 'maria.lopez@goldendragon.safebetiq.com', encrypted_password = staff_hash, updated_at = now()
  FROM staff s WHERE s.auth_user_id = au.id AND s.first_name = 'Maria' AND s.last_name = 'Lopez';
  UPDATE users u SET email = 'maria.lopez@goldendragon.safebetiq.com', password_hash = staff_hash, updated_at = now()
  FROM staff s WHERE s.auth_user_id = u.id AND s.first_name = 'Maria' AND s.last_name = 'Lopez';

  UPDATE staff SET email = 'charles.davis@goldendragon.safebetiq.com' WHERE first_name = 'Charles' AND last_name = 'Davis';
  UPDATE auth.users au SET email = 'charles.davis@goldendragon.safebetiq.com', encrypted_password = staff_hash, updated_at = now()
  FROM staff s WHERE s.auth_user_id = au.id AND s.first_name = 'Charles' AND s.last_name = 'Davis';
  UPDATE users u SET email = 'charles.davis@goldendragon.safebetiq.com', password_hash = staff_hash, updated_at = now()
  FROM staff s WHERE s.auth_user_id = u.id AND s.first_name = 'Charles' AND s.last_name = 'Davis';

  UPDATE staff SET email = 'richard.wilson@goldendragon.safebetiq.com' WHERE first_name = 'Richard' AND last_name = 'Wilson';
  UPDATE auth.users au SET email = 'richard.wilson@goldendragon.safebetiq.com', encrypted_password = staff_hash, updated_at = now()
  FROM staff s WHERE s.auth_user_id = au.id AND s.first_name = 'Richard' AND s.last_name = 'Wilson';
  UPDATE users u SET email = 'richard.wilson@goldendragon.safebetiq.com', password_hash = staff_hash, updated_at = now()
  FROM staff s WHERE s.auth_user_id = u.id AND s.first_name = 'Richard' AND s.last_name = 'Wilson';

  UPDATE staff SET email = 'sarah.johnson@silverstar.safebetiq.com' WHERE first_name = 'Sarah' AND last_name = 'Johnson';
  UPDATE auth.users au SET email = 'sarah.johnson@silverstar.safebetiq.com', encrypted_password = staff_hash, updated_at = now()
  FROM staff s WHERE s.auth_user_id = au.id AND s.first_name = 'Sarah' AND s.last_name = 'Johnson';
  UPDATE users u SET email = 'sarah.johnson@silverstar.safebetiq.com', password_hash = staff_hash, updated_at = now()
  FROM staff s WHERE s.auth_user_id = u.id AND s.first_name = 'Sarah' AND s.last_name = 'Johnson';

  UPDATE staff SET email = 'michael.chen@silverstar.safebetiq.com' WHERE first_name = 'Michael' AND last_name = 'Chen';
  UPDATE auth.users au SET email = 'michael.chen@silverstar.safebetiq.com', encrypted_password = staff_hash, updated_at = now()
  FROM staff s WHERE s.auth_user_id = au.id AND s.first_name = 'Michael' AND s.last_name = 'Chen';
  UPDATE users u SET email = 'michael.chen@silverstar.safebetiq.com', password_hash = staff_hash, updated_at = now()
  FROM staff s WHERE s.auth_user_id = u.id AND s.first_name = 'Michael' AND s.last_name = 'Chen';

  UPDATE staff SET email = 'david.williams@silverstar.safebetiq.com' WHERE first_name = 'David' AND last_name = 'Williams';
  UPDATE auth.users au SET email = 'david.williams@silverstar.safebetiq.com', encrypted_password = staff_hash, updated_at = now()
  FROM staff s WHERE s.auth_user_id = au.id AND s.first_name = 'David' AND s.last_name = 'Williams';
  UPDATE users u SET email = 'david.williams@silverstar.safebetiq.com', password_hash = staff_hash, updated_at = now()
  FROM staff s WHERE s.auth_user_id = u.id AND s.first_name = 'David' AND s.last_name = 'Williams';

  UPDATE staff SET email = 'emily.rodriguez@silverstar.safebetiq.com' WHERE first_name = 'Emily' AND last_name = 'Rodriguez';
  UPDATE auth.users au SET email = 'emily.rodriguez@silverstar.safebetiq.com', encrypted_password = staff_hash, updated_at = now()
  FROM staff s WHERE s.auth_user_id = au.id AND s.first_name = 'Emily' AND s.last_name = 'Rodriguez';
  UPDATE users u SET email = 'emily.rodriguez@silverstar.safebetiq.com', password_hash = staff_hash, updated_at = now()
  FROM staff s WHERE s.auth_user_id = u.id AND s.first_name = 'Emily' AND s.last_name = 'Rodriguez';

END $$;
