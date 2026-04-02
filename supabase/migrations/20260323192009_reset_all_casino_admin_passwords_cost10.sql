/*
  # Reset all demo account passwords with cost factor 10

  Previous passwords used cost factor 6 which may cause auth service issues.
  This migration resets all demo passwords with proper bcrypt cost factor 10.

  Passwords:
  - Casino admins: Casino@Admin1
  - National regulator: National@Reg1
  - Provincial regulators: Province@Reg1
  - Super admin: Admin@SafeBet1
*/

UPDATE auth.users
SET encrypted_password = crypt('Casino@Admin1', gen_salt('bf', 10)),
    updated_at = now()
WHERE email IN (
  'admin@capewin.safebetiq.com',
  'admin@casinodurban.safebetiq.com',
  'admin@easternlcasino.safebetiq.com',
  'admin@emperorspalace.safebetiq.com',
  'admin@flamingo.safebetiq.com',
  'admin@goldreef.safebetiq.com',
  'admin@goldendragon.safebetiq.com',
  'admin@graceland.safebetiq.com',
  'admin@meropa.safebetiq.com',
  'admin@mmabatho.safebetiq.com',
  'admin@montecasino.safebetiq.com',
  'admin@platinumbets.safebetiq.com',
  'admin@royalpalace.safebetiq.com',
  'admin@sibaya.safebetiq.com',
  'admin@silverstar.safebetiq.com',
  'admin@sunintcpt.safebetiq.com',
  'admin@sunbet.safebetiq.com',
  'admin@windmill.safebetiq.com'
);

UPDATE auth.users
SET encrypted_password = crypt('National@Reg1', gen_salt('bf', 10)),
    updated_at = now()
WHERE email = 'regulator@ngb.gov.za';

UPDATE auth.users
SET encrypted_password = crypt('Province@Reg1', gen_salt('bf', 10)),
    updated_at = now()
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

UPDATE auth.users
SET encrypted_password = crypt('Admin@SafeBet1', gen_salt('bf', 10)),
    updated_at = now()
WHERE email = 'superadmin@safebetiq.com';
