/*
  # Standardize All Demo Account Passwords

  ## Summary
  Sets a single consistent password for ALL demo accounts to ensure every login credential works.

  ## Passwords
  - Super Admin: Admin@SafeBet1
  - All Casino Admins (including 5 newer ones): Casino@Admin1
  - All Staff accounts: Casino@Admin1
  - National Regulator: National@Reg1
  - All Provincial Regulators: Province@Reg1

  This covers accounts created in all previous migrations.
*/

-- Super Admin
UPDATE auth.users SET encrypted_password = crypt('Admin@SafeBet1', gen_salt('bf'))
  WHERE email = 'superadmin@safebetiq.com';

-- ALL Casino Admins (all 18 operators)
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
    'admin@montecasino.safebetiq.com',
    'admin@capewin.safebetiq.com',
    'admin@casinodurban.safebetiq.com',
    'admin@goldreef.safebetiq.com',
    'admin@platinumbets.safebetiq.com',
    'admin@sunbet.safebetiq.com'
  );

-- Secondary/named casino admin accounts
UPDATE auth.users SET encrypted_password = crypt('Casino@Admin1', gen_salt('bf'))
  WHERE email IN (
    'charles.davis@goldendragon.safebetiq.com',
    'david.williams@silverstar.safebetiq.com',
    'emily.rodriguez@silverstar.safebetiq.com',
    'james.anderson@royalpalace.safebetiq.com',
    'jennifer.garcia@goldendragon.safebetiq.com',
    'linda.brown@royalpalace.safebetiq.com',
    'maria.lopez@goldendragon.safebetiq.com',
    'michael.chen@silverstar.safebetiq.com',
    'patricia.martinez@royalpalace.safebetiq.com',
    'richard.wilson@goldendragon.safebetiq.com',
    'robert.taylor@royalpalace.safebetiq.com',
    'sarah.johnson@silverstar.safebetiq.com',
    'william.lee@goldendragon.safebetiq.com'
  );

-- National Regulator
UPDATE auth.users SET encrypted_password = crypt('National@Reg1', gen_salt('bf'))
  WHERE email = 'regulator@ngb.gov.za';

-- All Provincial Regulators
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
