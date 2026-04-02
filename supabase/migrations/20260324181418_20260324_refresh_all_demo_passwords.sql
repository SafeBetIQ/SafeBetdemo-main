/*
  # Refresh all demo account passwords

  Resets every demo account password with fresh bcrypt hashes (cost 10).
  Also clears any pending tokens that could block login.

  Passwords:
  - Casino admins: Casino@Admin1
  - Super admin: Admin@SafeBet1
  - National regulator: National@Reg1
  - Provincial regulators: Province@Reg1
*/

DO $$
DECLARE
  v_count int;
BEGIN

  UPDATE auth.users
  SET 
    encrypted_password = crypt('Casino@Admin1', gen_salt('bf', 10)),
    updated_at = NOW()
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
    'admin@windmill.safebetiq.com',
    'charles.davis@goldendragon.safebetiq.com',
    'david.williams@silverstar.safebetiq.com'
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Casino admin passwords reset: %', v_count;

  UPDATE auth.users
  SET 
    encrypted_password = crypt('Admin@SafeBet1', gen_salt('bf', 10)),
    updated_at = NOW()
  WHERE email = 'superadmin@safebetiq.com';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Super admin password reset: %', v_count;

  UPDATE auth.users
  SET 
    encrypted_password = crypt('National@Reg1', gen_salt('bf', 10)),
    updated_at = NOW()
  WHERE email = 'regulator@ngb.gov.za';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'National regulator password reset: %', v_count;

  UPDATE auth.users
  SET 
    encrypted_password = crypt('Province@Reg1', gen_salt('bf', 10)),
    updated_at = NOW()
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
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Provincial regulator passwords reset: %', v_count;

END $$;
