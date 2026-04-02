/*
  # Fix Demo Account Passwords with Proper Hashes

  1. Updates
    - Generate proper bcrypt hashes using pgcrypto
    - Update all admin, regulator, and staff passwords
    - Ensure passwords match credentials in documentation

  2. Passwords
    - Super Admin: Super@2024!
    - Casino Admins: Admin123!
    - Regulator: Regulator123!
    - Staff: Staff123!
*/

DO $$
DECLARE
  super_admin_hash text;
  admin_hash text;
  regulator_hash text;
  staff_hash text;
BEGIN
  -- Generate proper bcrypt hashes using pgcrypto extension
  super_admin_hash := crypt('Super@2024!', gen_salt('bf'));
  admin_hash := crypt('Admin123!', gen_salt('bf'));
  regulator_hash := crypt('Regulator123!', gen_salt('bf'));
  staff_hash := crypt('Staff123!', gen_salt('bf'));

  -- Update Super Admin
  UPDATE auth.users 
  SET encrypted_password = super_admin_hash, updated_at = now()
  WHERE email = 'superadmin@safebetiq.com';
  
  UPDATE users 
  SET password_hash = super_admin_hash, updated_at = now()
  WHERE email = 'superadmin@safebetiq.com';

  -- Update Casino Admins
  UPDATE auth.users 
  SET encrypted_password = admin_hash, updated_at = now()
  WHERE email IN (
    'admin@royalpalace.safebetiq.com',
    'admin@goldendragon.safebetiq.com',
    'admin@silverstar.safebetiq.com'
  );
  
  UPDATE users 
  SET password_hash = admin_hash, updated_at = now()
  WHERE email IN (
    'admin@royalpalace.safebetiq.com',
    'admin@goldendragon.safebetiq.com',
    'admin@silverstar.safebetiq.com'
  );

  -- Update Regulator
  UPDATE auth.users 
  SET encrypted_password = regulator_hash, updated_at = now()
  WHERE email = 'regulator@ngb.gov.za';
  
  UPDATE users 
  SET password_hash = regulator_hash, updated_at = now()
  WHERE email = 'regulator@ngb.gov.za';

  -- Update Staff passwords
  UPDATE auth.users au
  SET encrypted_password = staff_hash, updated_at = now()
  FROM staff s
  WHERE s.auth_user_id = au.id;
  
  UPDATE users u
  SET password_hash = staff_hash, updated_at = now()
  FROM staff s
  WHERE s.auth_user_id = u.id;

  RAISE NOTICE 'Password hashes updated successfully';
END $$;
