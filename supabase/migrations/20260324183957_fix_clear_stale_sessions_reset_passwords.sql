
/*
  # Clear stale auth sessions and reset passwords

  ## Problem
  "Database error querying schema" from GoTrue is triggered by stale/corrupted
  sessions or refresh tokens that interfere with new login attempts.

  ## Fix
  1. Delete all existing auth sessions (force fresh login for everyone)
  2. Delete all existing refresh tokens (clear stale state)
  3. Re-apply fresh bcrypt passwords for all demo accounts
*/

-- Step 1: Clear all existing sessions to force fresh logins
DELETE FROM auth.sessions;

-- Step 2: Clear all refresh tokens
DELETE FROM auth.refresh_tokens;

-- Step 3: Re-apply fresh passwords for all demo accounts
DO $$
DECLARE v_count int;
BEGIN
  UPDATE auth.users
  SET 
    encrypted_password = crypt('Casino@Admin1', gen_salt('bf', 10)),
    confirmation_token = '',
    recovery_token = '',
    email_change_token_new = '',
    email_change_token_current = '',
    reauthentication_token = '',
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
    confirmation_token = '',
    recovery_token = '',
    email_change_token_new = '',
    email_change_token_current = '',
    reauthentication_token = '',
    updated_at = NOW()
  WHERE email = 'superadmin@safebetiq.com';

  UPDATE auth.users
  SET
    encrypted_password = crypt('National@Reg1', gen_salt('bf', 10)),
    confirmation_token = '',
    recovery_token = '',
    email_change_token_new = '',
    email_change_token_current = '',
    reauthentication_token = '',
    updated_at = NOW()
  WHERE email = 'regulator@ngb.gov.za';

  UPDATE auth.users
  SET
    encrypted_password = crypt('Province@Reg1', gen_salt('bf', 10)),
    confirmation_token = '',
    recovery_token = '',
    email_change_token_new = '',
    email_change_token_current = '',
    reauthentication_token = '',
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

END $$;
