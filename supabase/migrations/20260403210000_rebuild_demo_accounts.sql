/*
  # Rebuild Demo Accounts — Passwords & Provincial Regulators

  ## What this migration does

  1. Standardises ALL existing demo account passwords to: Demo@SafeBet2025!
  2. Ensures role column is correct for existing accounts
  3. Creates the 9 missing provincial regulator accounts in both
     auth.users and public.users

  ## After this migration the following credentials are valid:

  ┌──────────────────────────────────────────────┬─────────────────────┬────────────────────────┐
  │ Email                                        │ Role                │ Password               │
  ├──────────────────────────────────────────────┼─────────────────────┼────────────────────────┤
  │ superadmin@safebetiq.com                     │ super_admin         │ Demo@SafeBet2025!      │
  │ admin@royalpalace.safebetiq.com              │ casino_admin        │ Demo@SafeBet2025!      │
  │ admin@goldendragon.safebetiq.com             │ casino_admin        │ Demo@SafeBet2025!      │
  │ admin@silverstar.safebetiq.com               │ casino_admin        │ Demo@SafeBet2025!      │
  │ regulator@ngb.gov.za                         │ national_regulator  │ Demo@SafeBet2025!      │
  │ regulator@gauteng.pgb.gov.za                 │ provincial_regulator│ Demo@SafeBet2025!      │
  │ regulator@westerncape.pgb.gov.za             │ provincial_regulator│ Demo@SafeBet2025!      │
  │ regulator@kwazulunatal.pgb.gov.za            │ provincial_regulator│ Demo@SafeBet2025!      │
  │ regulator@mpumalanga.pgb.gov.za              │ provincial_regulator│ Demo@SafeBet2025!      │
  │ regulator@limpopo.pgb.gov.za                 │ provincial_regulator│ Demo@SafeBet2025!      │
  │ regulator@freestate.pgb.gov.za               │ provincial_regulator│ Demo@SafeBet2025!      │
  │ regulator@easterncape.pgb.gov.za             │ provincial_regulator│ Demo@SafeBet2025!      │
  │ regulator@northwest.pgb.gov.za               │ provincial_regulator│ Demo@SafeBet2025!      │
  │ regulator@northerncape.pgb.gov.za            │ provincial_regulator│ Demo@SafeBet2025!      │
  └──────────────────────────────────────────────┴─────────────────────┴────────────────────────┘

  Casino IDs (for reference):
    Royal Palace  → 11111111-1111-1111-1111-111111111111
    Golden Dragon → 22222222-2222-2222-2222-222222222222
    Silver Star   → 33333333-3333-3333-3333-333333333333
*/

DO $$
DECLARE
  demo_hash text;
  stub_hash text;

  -- Provincial regulator UUIDs — deterministic, easy to inspect
  uuid_gauteng     uuid := 'f1000001-0000-0000-0000-000000000001';
  uuid_westerncape uuid := 'f1000001-0000-0000-0000-000000000002';
  uuid_kzn         uuid := 'f1000001-0000-0000-0000-000000000003';
  uuid_mpumalanga  uuid := 'f1000001-0000-0000-0000-000000000004';
  uuid_limpopo     uuid := 'f1000001-0000-0000-0000-000000000005';
  uuid_freestate   uuid := 'f1000001-0000-0000-0000-000000000006';
  uuid_easterncape uuid := 'f1000001-0000-0000-0000-000000000007';
  uuid_northwest   uuid := 'f1000001-0000-0000-0000-000000000008';
  uuid_northerncape uuid := 'f1000001-0000-0000-0000-000000000009';

BEGIN
  -- pgcrypto (crypt / gen_salt) is installed by Supabase in the extensions schema.
  -- SET LOCAL inside a DO block is valid (runs in the current transaction).
  SET LOCAL search_path TO public, extensions;

  -- Generate hashes once — avoids 14 separate bcrypt calls
  demo_hash := crypt('Demo@SafeBet2025!', gen_salt('bf'));
  stub_hash := crypt('__unusable__', gen_salt('bf'));

  -- ──────────────────────────────────────────────────────────────────────────
  -- 0. Remove any existing provincial_regulator rows whose email matches our
  --    canonical list but may have been created with different UUIDs.
  --    We then re-insert with deterministic UUIDs below.
  --    auth.identities rows are cascade-deleted via FK, or deleted explicitly.
  -- ──────────────────────────────────────────────────────────────────────────
  DELETE FROM auth.identities
  WHERE provider_id IN (
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

  DELETE FROM public.users
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

  DELETE FROM auth.users
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

  -- ──────────────────────────────────────────────────────────────────────────
  -- 1. Standardise passwords for the 5 existing accounts
  -- ──────────────────────────────────────────────────────────────────────────

  UPDATE auth.users
  SET encrypted_password = demo_hash, updated_at = now()
  WHERE email IN (
    'superadmin@safebetiq.com',
    'admin@royalpalace.safebetiq.com',
    'admin@goldendragon.safebetiq.com',
    'admin@silverstar.safebetiq.com',
    'regulator@ngb.gov.za'
  );

  UPDATE public.users
  SET password_hash = demo_hash, updated_at = now()
  WHERE email IN (
    'superadmin@safebetiq.com',
    'admin@royalpalace.safebetiq.com',
    'admin@goldendragon.safebetiq.com',
    'admin@silverstar.safebetiq.com',
    'regulator@ngb.gov.za'
  );

  -- Ensure national_regulator role is set correctly (older migrations used 'regulator')
  UPDATE public.users
  SET role = 'national_regulator', updated_at = now()
  WHERE email = 'regulator@ngb.gov.za'
    AND role IN ('regulator', 'national_regulator');

  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{role}', '"national_regulator"'
      ),
      updated_at = now()
  WHERE email = 'regulator@ngb.gov.za';

  -- ──────────────────────────────────────────────────────────────────────────
  -- 2. Create the 9 provincial regulator accounts
  --    Pattern: upsert auth.users, auth.identities, public.users
  -- ──────────────────────────────────────────────────────────────────────────

  -- Helper macro (declared as an anonymous procedure) —
  -- We duplicate the INSERT block for each province to keep the SQL readable
  -- and avoid dynamic SQL.

  -- ── Gauteng ──
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    uuid_gauteng, '00000000-0000-0000-0000-000000000000',
    'regulator@gauteng.pgb.gov.za', demo_hash, now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Gauteng Gambling Board","role":"provincial_regulator"}',
    'authenticated', 'authenticated', now(), now(), '', '', '', ''
  ) ON CONFLICT (id) DO UPDATE SET encrypted_password = demo_hash, updated_at = now();

  INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
  VALUES (gen_random_uuid(), uuid_gauteng, uuid_gauteng::text, 'email',
    jsonb_build_object('sub', uuid_gauteng::text, 'email', 'regulator@gauteng.pgb.gov.za', 'email_verified', true),
    now(), now())
  ON CONFLICT (provider, provider_id) DO NOTHING;

  INSERT INTO public.users (id, email, full_name, role, casino_id, is_active, password_hash, created_at, updated_at)
  VALUES (uuid_gauteng, 'regulator@gauteng.pgb.gov.za', 'Gauteng Gambling Board', 'provincial_regulator', NULL, true, stub_hash, now(), now())
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role, updated_at = now();

  -- ── Western Cape ──
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    uuid_westerncape, '00000000-0000-0000-0000-000000000000',
    'regulator@westerncape.pgb.gov.za', demo_hash, now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Western Cape Gambling & Racing Board","role":"provincial_regulator"}',
    'authenticated', 'authenticated', now(), now(), '', '', '', ''
  ) ON CONFLICT (id) DO UPDATE SET encrypted_password = demo_hash, updated_at = now();

  INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
  VALUES (gen_random_uuid(), uuid_westerncape, uuid_westerncape::text, 'email',
    jsonb_build_object('sub', uuid_westerncape::text, 'email', 'regulator@westerncape.pgb.gov.za', 'email_verified', true),
    now(), now())
  ON CONFLICT (provider, provider_id) DO NOTHING;

  INSERT INTO public.users (id, email, full_name, role, casino_id, is_active, password_hash, created_at, updated_at)
  VALUES (uuid_westerncape, 'regulator@westerncape.pgb.gov.za', 'Western Cape Gambling & Racing Board', 'provincial_regulator', NULL, true, stub_hash, now(), now())
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role, updated_at = now();

  -- ── KwaZulu-Natal ──
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    uuid_kzn, '00000000-0000-0000-0000-000000000000',
    'regulator@kwazulunatal.pgb.gov.za', demo_hash, now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"KwaZulu-Natal Gaming & Betting Board","role":"provincial_regulator"}',
    'authenticated', 'authenticated', now(), now(), '', '', '', ''
  ) ON CONFLICT (id) DO UPDATE SET encrypted_password = demo_hash, updated_at = now();

  INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
  VALUES (gen_random_uuid(), uuid_kzn, uuid_kzn::text, 'email',
    jsonb_build_object('sub', uuid_kzn::text, 'email', 'regulator@kwazulunatal.pgb.gov.za', 'email_verified', true),
    now(), now())
  ON CONFLICT (provider, provider_id) DO NOTHING;

  INSERT INTO public.users (id, email, full_name, role, casino_id, is_active, password_hash, created_at, updated_at)
  VALUES (uuid_kzn, 'regulator@kwazulunatal.pgb.gov.za', 'KwaZulu-Natal Gaming & Betting Board', 'provincial_regulator', NULL, true, stub_hash, now(), now())
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role, updated_at = now();

  -- ── Mpumalanga ──
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    uuid_mpumalanga, '00000000-0000-0000-0000-000000000000',
    'regulator@mpumalanga.pgb.gov.za', demo_hash, now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Mpumalanga Gaming Board","role":"provincial_regulator"}',
    'authenticated', 'authenticated', now(), now(), '', '', '', ''
  ) ON CONFLICT (id) DO UPDATE SET encrypted_password = demo_hash, updated_at = now();

  INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
  VALUES (gen_random_uuid(), uuid_mpumalanga, uuid_mpumalanga::text, 'email',
    jsonb_build_object('sub', uuid_mpumalanga::text, 'email', 'regulator@mpumalanga.pgb.gov.za', 'email_verified', true),
    now(), now())
  ON CONFLICT (provider, provider_id) DO NOTHING;

  INSERT INTO public.users (id, email, full_name, role, casino_id, is_active, password_hash, created_at, updated_at)
  VALUES (uuid_mpumalanga, 'regulator@mpumalanga.pgb.gov.za', 'Mpumalanga Gaming Board', 'provincial_regulator', NULL, true, stub_hash, now(), now())
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role, updated_at = now();

  -- ── Limpopo ──
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    uuid_limpopo, '00000000-0000-0000-0000-000000000000',
    'regulator@limpopo.pgb.gov.za', demo_hash, now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Limpopo Gambling Board","role":"provincial_regulator"}',
    'authenticated', 'authenticated', now(), now(), '', '', '', ''
  ) ON CONFLICT (id) DO UPDATE SET encrypted_password = demo_hash, updated_at = now();

  INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
  VALUES (gen_random_uuid(), uuid_limpopo, uuid_limpopo::text, 'email',
    jsonb_build_object('sub', uuid_limpopo::text, 'email', 'regulator@limpopo.pgb.gov.za', 'email_verified', true),
    now(), now())
  ON CONFLICT (provider, provider_id) DO NOTHING;

  INSERT INTO public.users (id, email, full_name, role, casino_id, is_active, password_hash, created_at, updated_at)
  VALUES (uuid_limpopo, 'regulator@limpopo.pgb.gov.za', 'Limpopo Gambling Board', 'provincial_regulator', NULL, true, stub_hash, now(), now())
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role, updated_at = now();

  -- ── Free State ──
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    uuid_freestate, '00000000-0000-0000-0000-000000000000',
    'regulator@freestate.pgb.gov.za', demo_hash, now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Free State Gambling, Liquor & Tourism","role":"provincial_regulator"}',
    'authenticated', 'authenticated', now(), now(), '', '', '', ''
  ) ON CONFLICT (id) DO UPDATE SET encrypted_password = demo_hash, updated_at = now();

  INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
  VALUES (gen_random_uuid(), uuid_freestate, uuid_freestate::text, 'email',
    jsonb_build_object('sub', uuid_freestate::text, 'email', 'regulator@freestate.pgb.gov.za', 'email_verified', true),
    now(), now())
  ON CONFLICT (provider, provider_id) DO NOTHING;

  INSERT INTO public.users (id, email, full_name, role, casino_id, is_active, password_hash, created_at, updated_at)
  VALUES (uuid_freestate, 'regulator@freestate.pgb.gov.za', 'Free State Gambling, Liquor & Tourism', 'provincial_regulator', NULL, true, stub_hash, now(), now())
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role, updated_at = now();

  -- ── Eastern Cape ──
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    uuid_easterncape, '00000000-0000-0000-0000-000000000000',
    'regulator@easterncape.pgb.gov.za', demo_hash, now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Eastern Cape Gambling & Betting Board","role":"provincial_regulator"}',
    'authenticated', 'authenticated', now(), now(), '', '', '', ''
  ) ON CONFLICT (id) DO UPDATE SET encrypted_password = demo_hash, updated_at = now();

  INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
  VALUES (gen_random_uuid(), uuid_easterncape, uuid_easterncape::text, 'email',
    jsonb_build_object('sub', uuid_easterncape::text, 'email', 'regulator@easterncape.pgb.gov.za', 'email_verified', true),
    now(), now())
  ON CONFLICT (provider, provider_id) DO NOTHING;

  INSERT INTO public.users (id, email, full_name, role, casino_id, is_active, password_hash, created_at, updated_at)
  VALUES (uuid_easterncape, 'regulator@easterncape.pgb.gov.za', 'Eastern Cape Gambling & Betting Board', 'provincial_regulator', NULL, true, stub_hash, now(), now())
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role, updated_at = now();

  -- ── North West ──
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    uuid_northwest, '00000000-0000-0000-0000-000000000000',
    'regulator@northwest.pgb.gov.za', demo_hash, now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"North West Gambling Board","role":"provincial_regulator"}',
    'authenticated', 'authenticated', now(), now(), '', '', '', ''
  ) ON CONFLICT (id) DO UPDATE SET encrypted_password = demo_hash, updated_at = now();

  INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
  VALUES (gen_random_uuid(), uuid_northwest, uuid_northwest::text, 'email',
    jsonb_build_object('sub', uuid_northwest::text, 'email', 'regulator@northwest.pgb.gov.za', 'email_verified', true),
    now(), now())
  ON CONFLICT (provider, provider_id) DO NOTHING;

  INSERT INTO public.users (id, email, full_name, role, casino_id, is_active, password_hash, created_at, updated_at)
  VALUES (uuid_northwest, 'regulator@northwest.pgb.gov.za', 'North West Gambling Board', 'provincial_regulator', NULL, true, stub_hash, now(), now())
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role, updated_at = now();

  -- ── Northern Cape ──
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    uuid_northerncape, '00000000-0000-0000-0000-000000000000',
    'regulator@northerncape.pgb.gov.za', demo_hash, now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Northern Cape Gambling Board","role":"provincial_regulator"}',
    'authenticated', 'authenticated', now(), now(), '', '', '', ''
  ) ON CONFLICT (id) DO UPDATE SET encrypted_password = demo_hash, updated_at = now();

  INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
  VALUES (gen_random_uuid(), uuid_northerncape, uuid_northerncape::text, 'email',
    jsonb_build_object('sub', uuid_northerncape::text, 'email', 'regulator@northerncape.pgb.gov.za', 'email_verified', true),
    now(), now())
  ON CONFLICT (provider, provider_id) DO NOTHING;

  INSERT INTO public.users (id, email, full_name, role, casino_id, is_active, password_hash, created_at, updated_at)
  VALUES (uuid_northerncape, 'regulator@northerncape.pgb.gov.za', 'Northern Cape Gambling Board', 'provincial_regulator', NULL, true, stub_hash, now(), now())
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role, updated_at = now();

  RAISE NOTICE 'Demo accounts rebuilt successfully. All accounts now use: Demo@SafeBet2025!';
END $$;
