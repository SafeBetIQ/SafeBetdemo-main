/*
  # Reset All Demo Account Passwords

  ## Summary
  Sets clean, consistent passwords for all demo accounts:
  - Super Admin: Admin@SafeBet1
  - Casino Admins: Casino@Admin1
  - National Regulator: National@Reg1
  - Provincial Regulators: Province@Reg1

  Updates both auth.users (encrypted_password) and public.users (password_hash).
*/

-- Super Admin
UPDATE auth.users SET encrypted_password = crypt('Admin@SafeBet1', gen_salt('bf'))
  WHERE email = 'superadmin@safebetiq.com';
UPDATE public.users SET password_hash = crypt('Admin@SafeBet1', gen_salt('bf'))
  WHERE email = 'superadmin@safebetiq.com';

-- Casino Admins (all 13 operator accounts)
UPDATE auth.users SET encrypted_password = crypt('Casino@Admin1', gen_salt('bf'))
  WHERE email IN (
    'admin@royalpalace.safebetiq.com',
    'admin@goldendragon.safebetiq.com',
    'admin@silverstar.safebetiq.com',
    'admin@emperorspalace.safebetiq.com',
    'admin@sunintcpt.safebetiq.com',
    'admin@sibaya.safebetiq.com',
    'admin@graceland.safebetiq.com',
    'admin@meropa.safebetiq.com',
    'admin@windmill.safebetiq.com',
    'admin@easternlcasino.safebetiq.com',
    'admin@mmabatho.safebetiq.com',
    'admin@flamingo.safebetiq.com',
    'admin@montecasino.safebetiq.com'
  );
UPDATE public.users SET password_hash = crypt('Casino@Admin1', gen_salt('bf'))
  WHERE email IN (
    'admin@royalpalace.safebetiq.com',
    'admin@goldendragon.safebetiq.com',
    'admin@silverstar.safebetiq.com',
    'admin@emperorspalace.safebetiq.com',
    'admin@sunintcpt.safebetiq.com',
    'admin@sibaya.safebetiq.com',
    'admin@graceland.safebetiq.com',
    'admin@meropa.safebetiq.com',
    'admin@windmill.safebetiq.com',
    'admin@easternlcasino.safebetiq.com',
    'admin@mmabatho.safebetiq.com',
    'admin@flamingo.safebetiq.com',
    'admin@montecasino.safebetiq.com'
  );

-- National Regulator
UPDATE auth.users SET encrypted_password = crypt('National@Reg1', gen_salt('bf'))
  WHERE email = 'regulator@ngb.gov.za';
UPDATE public.users SET password_hash = crypt('National@Reg1', gen_salt('bf'))
  WHERE email = 'regulator@ngb.gov.za';

-- Provincial Regulators (all 9)
UPDATE auth.users SET encrypted_password = crypt('Province@Reg1', gen_salt('bf'))
  WHERE email IN (
    'regulator@gauteng.pgb.gov.za',
    'regulator@westerncape.pgb.gov.za',
    'regulator@kwazulunatal.pgb.gov.za',
    'regulator@mpumalanga.pgb.gov.za',
    'regulator@limpopo.pgb.gov.za',
    'regulator@freestate.pgb.gov.za',
    'regulator@easterncape.pgb.gov.za',
    'regulator@northwest.pgb.gov.za',
    'regulator@northerncape.pgb.gov.za'
  );
UPDATE public.users SET password_hash = crypt('Province@Reg1', gen_salt('bf'))
  WHERE email IN (
    'regulator@gauteng.pgb.gov.za',
    'regulator@westerncape.pgb.gov.za',
    'regulator@kwazulunatal.pgb.gov.za',
    'regulator@mpumalanga.pgb.gov.za',
    'regulator@limpopo.pgb.gov.za',
    'regulator@freestate.pgb.gov.za',
    'regulator@easterncape.pgb.gov.za',
    'regulator@northwest.pgb.gov.za',
    'regulator@northerncape.pgb.gov.za'
  );
