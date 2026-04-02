
/*
  # Create Casino Admin Accounts for 5 Missing Casinos (v2)

  ## Summary
  Five casinos were added in a recent migration but have no casino_admin accounts.
  This creates auth users, identities, and public.users records for each.

  ## New Casino Admins
  - admin@capewin.safebetiq.com — CapeWin Casino
  - admin@casinodurban.safebetiq.com — Casino Durban
  - admin@goldreef.safebetiq.com — Gold Reef Gaming
  - admin@platinumbets.safebetiq.com — Platinum Bets
  - admin@sunbet.safebetiq.com — SunBet SA

  Password: Demo1234! (same as all other demo casino admins)
*/

DO $$
DECLARE
  v_capewin_id   uuid := '74af4a9b-a774-46c9-bc20-18c72a21526e';
  v_durban_id    uuid := 'f310e9c0-f374-4ffa-8e2f-e87c2818e60f';
  v_goldreef_id  uuid := '63c6faf0-e89c-48b4-8ae1-a14aee52cd9c';
  v_platinum_id  uuid := '1f67f803-e16e-46c6-8483-7c47f5e15792';
  v_sunbet_id    uuid := 'd34d86d0-babc-48a3-8f03-650126e5ad98';

  v_capewin_user_id  uuid := gen_random_uuid();
  v_durban_user_id   uuid := gen_random_uuid();
  v_goldreef_user_id uuid := gen_random_uuid();
  v_platinum_user_id uuid := gen_random_uuid();
  v_sunbet_user_id   uuid := gen_random_uuid();

  v_hash text := '$2a$06$YNJ.Zmoe4JKgMK2gRQF1u.wxUObxG8fLyoDmNy.6AEU6I95cfyQH2';
  v_now  timestamptz := now();
BEGIN

  -- CapeWin Casino
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
  VALUES (v_capewin_user_id, '00000000-0000-0000-0000-000000000000', 'admin@capewin.safebetiq.com', v_hash, v_now, '{"provider":"email","providers":["email"]}', '{"full_name":"CapeWin Admin"}', v_now, v_now, 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_capewin_user_id, 'admin@capewin.safebetiq.com', jsonb_build_object('sub', v_capewin_user_id::text, 'email', 'admin@capewin.safebetiq.com'), 'email', v_now, v_now, v_now)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.users (id, email, password_hash, full_name, role, casino_id, is_active, created_at)
  VALUES (v_capewin_user_id, 'admin@capewin.safebetiq.com', v_hash, 'CapeWin Admin', 'casino_admin', v_capewin_id, true, v_now)
  ON CONFLICT (id) DO NOTHING;

  -- Casino Durban
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
  VALUES (v_durban_user_id, '00000000-0000-0000-0000-000000000000', 'admin@casinodurban.safebetiq.com', v_hash, v_now, '{"provider":"email","providers":["email"]}', '{"full_name":"Casino Durban Admin"}', v_now, v_now, 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_durban_user_id, 'admin@casinodurban.safebetiq.com', jsonb_build_object('sub', v_durban_user_id::text, 'email', 'admin@casinodurban.safebetiq.com'), 'email', v_now, v_now, v_now)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.users (id, email, password_hash, full_name, role, casino_id, is_active, created_at)
  VALUES (v_durban_user_id, 'admin@casinodurban.safebetiq.com', v_hash, 'Casino Durban Admin', 'casino_admin', v_durban_id, true, v_now)
  ON CONFLICT (id) DO NOTHING;

  -- Gold Reef Gaming
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
  VALUES (v_goldreef_user_id, '00000000-0000-0000-0000-000000000000', 'admin@goldreef.safebetiq.com', v_hash, v_now, '{"provider":"email","providers":["email"]}', '{"full_name":"Gold Reef Admin"}', v_now, v_now, 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_goldreef_user_id, 'admin@goldreef.safebetiq.com', jsonb_build_object('sub', v_goldreef_user_id::text, 'email', 'admin@goldreef.safebetiq.com'), 'email', v_now, v_now, v_now)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.users (id, email, password_hash, full_name, role, casino_id, is_active, created_at)
  VALUES (v_goldreef_user_id, 'admin@goldreef.safebetiq.com', v_hash, 'Gold Reef Admin', 'casino_admin', v_goldreef_id, true, v_now)
  ON CONFLICT (id) DO NOTHING;

  -- Platinum Bets
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
  VALUES (v_platinum_user_id, '00000000-0000-0000-0000-000000000000', 'admin@platinumbets.safebetiq.com', v_hash, v_now, '{"provider":"email","providers":["email"]}', '{"full_name":"Platinum Bets Admin"}', v_now, v_now, 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_platinum_user_id, 'admin@platinumbets.safebetiq.com', jsonb_build_object('sub', v_platinum_user_id::text, 'email', 'admin@platinumbets.safebetiq.com'), 'email', v_now, v_now, v_now)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.users (id, email, password_hash, full_name, role, casino_id, is_active, created_at)
  VALUES (v_platinum_user_id, 'admin@platinumbets.safebetiq.com', v_hash, 'Platinum Bets Admin', 'casino_admin', v_platinum_id, true, v_now)
  ON CONFLICT (id) DO NOTHING;

  -- SunBet SA
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
  VALUES (v_sunbet_user_id, '00000000-0000-0000-0000-000000000000', 'admin@sunbet.safebetiq.com', v_hash, v_now, '{"provider":"email","providers":["email"]}', '{"full_name":"SunBet SA Admin"}', v_now, v_now, 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_sunbet_user_id, 'admin@sunbet.safebetiq.com', jsonb_build_object('sub', v_sunbet_user_id::text, 'email', 'admin@sunbet.safebetiq.com'), 'email', v_now, v_now, v_now)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.users (id, email, password_hash, full_name, role, casino_id, is_active, created_at)
  VALUES (v_sunbet_user_id, 'admin@sunbet.safebetiq.com', v_hash, 'SunBet SA Admin', 'casino_admin', v_sunbet_id, true, v_now)
  ON CONFLICT (id) DO NOTHING;

END $$;
