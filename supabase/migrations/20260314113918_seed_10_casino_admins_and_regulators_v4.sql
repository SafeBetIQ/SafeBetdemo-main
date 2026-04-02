/*
  # Seed 10 New Casino Admin Users + 9 Provincial Regulators (v4)

  All UUIDs use valid hexadecimal characters only (0-9, a-f).
*/

-- ============================================================
-- STEP 1: auth.users for 10 casino admins
-- ============================================================

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
VALUES
  ('aa000001-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'admin@emperorspalace.safebetiq.com', crypt('Casino123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', ''),
  ('bb000001-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'admin@sunintcpt.safebetiq.com', crypt('Casino123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', ''),
  ('cc000001-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 'admin@sibaya.safebetiq.com', crypt('Casino123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', ''),
  ('dd000001-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000000', 'admin@graceland.safebetiq.com', crypt('Casino123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', ''),
  ('ee000001-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000000', 'admin@meropa.safebetiq.com', crypt('Casino123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', ''),
  ('ff000001-ffff-ffff-ffff-ffffffffffff', '00000000-0000-0000-0000-000000000000', 'admin@windmill.safebetiq.com', crypt('Casino123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', ''),
  ('ab000001-abab-abab-abab-abababababab', '00000000-0000-0000-0000-000000000000', 'admin@easternlcasino.safebetiq.com', crypt('Casino123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', ''),
  ('ac000001-acac-acac-acac-acacacacacac', '00000000-0000-0000-0000-000000000000', 'admin@mmabatho.safebetiq.com', crypt('Casino123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', ''),
  ('ad000001-adad-adad-adad-adadadadadad', '00000000-0000-0000-0000-000000000000', 'admin@flamingo.safebetiq.com', crypt('Casino123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', ''),
  ('ae000001-aeae-aeae-aeae-aeaeaeaeaeae', '00000000-0000-0000-0000-000000000000', 'admin@montecasino.safebetiq.com', crypt('Casino123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 2: auth.users for 9 provincial regulators
-- (using all-numeric last segment for valid hex UUIDs)
-- ============================================================

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
VALUES
  ('b0000001-0001-0001-0001-000000000001', '00000000-0000-0000-0000-000000000000', 'regulator@gauteng.pgb.gov.za', crypt('Regulator123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', ''),
  ('b0000002-0002-0002-0002-000000000002', '00000000-0000-0000-0000-000000000000', 'regulator@westerncape.pgb.gov.za', crypt('Regulator123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', ''),
  ('b0000003-0003-0003-0003-000000000003', '00000000-0000-0000-0000-000000000000', 'regulator@kwazulunatal.pgb.gov.za', crypt('Regulator123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', ''),
  ('b0000004-0004-0004-0004-000000000004', '00000000-0000-0000-0000-000000000000', 'regulator@mpumalanga.pgb.gov.za', crypt('Regulator123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', ''),
  ('b0000005-0005-0005-0005-000000000005', '00000000-0000-0000-0000-000000000000', 'regulator@limpopo.pgb.gov.za', crypt('Regulator123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', ''),
  ('b0000006-0006-0006-0006-000000000006', '00000000-0000-0000-0000-000000000000', 'regulator@freestate.pgb.gov.za', crypt('Regulator123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', ''),
  ('b0000007-0007-0007-0007-000000000007', '00000000-0000-0000-0000-000000000000', 'regulator@easterncape.pgb.gov.za', crypt('Regulator123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', ''),
  ('b0000008-0008-0008-0008-000000000008', '00000000-0000-0000-0000-000000000000', 'regulator@northwest.pgb.gov.za', crypt('Regulator123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', ''),
  ('b0000009-0009-0009-0009-000000000009', '00000000-0000-0000-0000-000000000000', 'regulator@northerncape.pgb.gov.za', crypt('Regulator123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now(), now(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 3: auth.identities for casino admins
-- ============================================================

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
  ('aa000001-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aa000001-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@emperorspalace.safebetiq.com', '{"sub":"aa000001-aaaa-aaaa-aaaa-aaaaaaaaaaaa","email":"admin@emperorspalace.safebetiq.com"}', 'email', now(), now(), now()),
  ('bb000001-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bb000001-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'admin@sunintcpt.safebetiq.com', '{"sub":"bb000001-bbbb-bbbb-bbbb-bbbbbbbbbbbb","email":"admin@sunintcpt.safebetiq.com"}', 'email', now(), now(), now()),
  ('cc000001-cccc-cccc-cccc-cccccccccccc', 'cc000001-cccc-cccc-cccc-cccccccccccc', 'admin@sibaya.safebetiq.com', '{"sub":"cc000001-cccc-cccc-cccc-cccccccccccc","email":"admin@sibaya.safebetiq.com"}', 'email', now(), now(), now()),
  ('dd000001-dddd-dddd-dddd-dddddddddddd', 'dd000001-dddd-dddd-dddd-dddddddddddd', 'admin@graceland.safebetiq.com', '{"sub":"dd000001-dddd-dddd-dddd-dddddddddddd","email":"admin@graceland.safebetiq.com"}', 'email', now(), now(), now()),
  ('ee000001-eeee-eeee-eeee-eeeeeeeeeeee', 'ee000001-eeee-eeee-eeee-eeeeeeeeeeee', 'admin@meropa.safebetiq.com', '{"sub":"ee000001-eeee-eeee-eeee-eeeeeeeeeeee","email":"admin@meropa.safebetiq.com"}', 'email', now(), now(), now()),
  ('ff000001-ffff-ffff-ffff-ffffffffffff', 'ff000001-ffff-ffff-ffff-ffffffffffff', 'admin@windmill.safebetiq.com', '{"sub":"ff000001-ffff-ffff-ffff-ffffffffffff","email":"admin@windmill.safebetiq.com"}', 'email', now(), now(), now()),
  ('ab000001-abab-abab-abab-abababababab', 'ab000001-abab-abab-abab-abababababab', 'admin@easternlcasino.safebetiq.com', '{"sub":"ab000001-abab-abab-abab-abababababab","email":"admin@easternlcasino.safebetiq.com"}', 'email', now(), now(), now()),
  ('ac000001-acac-acac-acac-acacacacacac', 'ac000001-acac-acac-acac-acacacacacac', 'admin@mmabatho.safebetiq.com', '{"sub":"ac000001-acac-acac-acac-acacacacacac","email":"admin@mmabatho.safebetiq.com"}', 'email', now(), now(), now()),
  ('ad000001-adad-adad-adad-adadadadadad', 'ad000001-adad-adad-adad-adadadadadad', 'admin@flamingo.safebetiq.com', '{"sub":"ad000001-adad-adad-adad-adadadadadad","email":"admin@flamingo.safebetiq.com"}', 'email', now(), now(), now()),
  ('ae000001-aeae-aeae-aeae-aeaeaeaeaeae', 'ae000001-aeae-aeae-aeae-aeaeaeaeaeae', 'admin@montecasino.safebetiq.com', '{"sub":"ae000001-aeae-aeae-aeae-aeaeaeaeaeae","email":"admin@montecasino.safebetiq.com"}', 'email', now(), now(), now())
ON CONFLICT (provider, provider_id) DO NOTHING;

-- ============================================================
-- STEP 4: auth.identities for provincial regulators
-- ============================================================

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
  ('b0000001-0001-0001-0001-000000000001', 'b0000001-0001-0001-0001-000000000001', 'regulator@gauteng.pgb.gov.za', '{"sub":"b0000001-0001-0001-0001-000000000001","email":"regulator@gauteng.pgb.gov.za"}', 'email', now(), now(), now()),
  ('b0000002-0002-0002-0002-000000000002', 'b0000002-0002-0002-0002-000000000002', 'regulator@westerncape.pgb.gov.za', '{"sub":"b0000002-0002-0002-0002-000000000002","email":"regulator@westerncape.pgb.gov.za"}', 'email', now(), now(), now()),
  ('b0000003-0003-0003-0003-000000000003', 'b0000003-0003-0003-0003-000000000003', 'regulator@kwazulunatal.pgb.gov.za', '{"sub":"b0000003-0003-0003-0003-000000000003","email":"regulator@kwazulunatal.pgb.gov.za"}', 'email', now(), now(), now()),
  ('b0000004-0004-0004-0004-000000000004', 'b0000004-0004-0004-0004-000000000004', 'regulator@mpumalanga.pgb.gov.za', '{"sub":"b0000004-0004-0004-0004-000000000004","email":"regulator@mpumalanga.pgb.gov.za"}', 'email', now(), now(), now()),
  ('b0000005-0005-0005-0005-000000000005', 'b0000005-0005-0005-0005-000000000005', 'regulator@limpopo.pgb.gov.za', '{"sub":"b0000005-0005-0005-0005-000000000005","email":"regulator@limpopo.pgb.gov.za"}', 'email', now(), now(), now()),
  ('b0000006-0006-0006-0006-000000000006', 'b0000006-0006-0006-0006-000000000006', 'regulator@freestate.pgb.gov.za', '{"sub":"b0000006-0006-0006-0006-000000000006","email":"regulator@freestate.pgb.gov.za"}', 'email', now(), now(), now()),
  ('b0000007-0007-0007-0007-000000000007', 'b0000007-0007-0007-0007-000000000007', 'regulator@easterncape.pgb.gov.za', '{"sub":"b0000007-0007-0007-0007-000000000007","email":"regulator@easterncape.pgb.gov.za"}', 'email', now(), now(), now()),
  ('b0000008-0008-0008-0008-000000000008', 'b0000008-0008-0008-0008-000000000008', 'regulator@northwest.pgb.gov.za', '{"sub":"b0000008-0008-0008-0008-000000000008","email":"regulator@northwest.pgb.gov.za"}', 'email', now(), now(), now()),
  ('b0000009-0009-0009-0009-000000000009', 'b0000009-0009-0009-0009-000000000009', 'regulator@northerncape.pgb.gov.za', '{"sub":"b0000009-0009-0009-0009-000000000009","email":"regulator@northerncape.pgb.gov.za"}', 'email', now(), now(), now())
ON CONFLICT (provider, provider_id) DO NOTHING;

-- ============================================================
-- STEP 5: public.users for 10 casino admins
-- ============================================================

INSERT INTO public.users (id, email, password_hash, full_name, role, casino_id, is_active, created_at)
VALUES
  ('aa000001-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@emperorspalace.safebetiq.com', crypt('Casino123!', gen_salt('bf')), 'Emperors Palace Admin', 'casino_admin', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, now()),
  ('bb000001-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'admin@sunintcpt.safebetiq.com', crypt('Casino123!', gen_salt('bf')), 'Sun International Cape Town Admin', 'casino_admin', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true, now()),
  ('cc000001-cccc-cccc-cccc-cccccccccccc', 'admin@sibaya.safebetiq.com', crypt('Casino123!', gen_salt('bf')), 'Sibaya Casino Admin', 'casino_admin', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true, now()),
  ('dd000001-dddd-dddd-dddd-dddddddddddd', 'admin@graceland.safebetiq.com', crypt('Casino123!', gen_salt('bf')), 'Graceland Casino Admin', 'casino_admin', 'dddddddd-dddd-dddd-dddd-dddddddddddd', true, now()),
  ('ee000001-eeee-eeee-eeee-eeeeeeeeeeee', 'admin@meropa.safebetiq.com', crypt('Casino123!', gen_salt('bf')), 'Meropa Casino Admin', 'casino_admin', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', true, now()),
  ('ff000001-ffff-ffff-ffff-ffffffffffff', 'admin@windmill.safebetiq.com', crypt('Casino123!', gen_salt('bf')), 'Windmill Casino Admin', 'casino_admin', 'ffffffff-ffff-ffff-ffff-ffffffffffff', true, now()),
  ('ab000001-abab-abab-abab-abababababab', 'admin@easternlcasino.safebetiq.com', crypt('Casino123!', gen_salt('bf')), 'East London Casino Admin', 'casino_admin', '11111111-2222-3333-4444-555555555555', true, now()),
  ('ac000001-acac-acac-acac-acacacacacac', 'admin@mmabatho.safebetiq.com', crypt('Casino123!', gen_salt('bf')), 'Mmabatho Palms Admin', 'casino_admin', '22222222-3333-4444-5555-666666666666', true, now()),
  ('ad000001-adad-adad-adad-adadadadadad', 'admin@flamingo.safebetiq.com', crypt('Casino123!', gen_salt('bf')), 'Flamingo Casino Admin', 'casino_admin', '33333333-4444-5555-6666-777777777777', true, now()),
  ('ae000001-aeae-aeae-aeae-aeaeaeaeaeae', 'admin@montecasino.safebetiq.com', crypt('Casino123!', gen_salt('bf')), 'Montecasino Admin', 'casino_admin', '44444444-5555-6666-7777-888888888888', true, now())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 6: public.users for 9 provincial regulators
-- ============================================================

INSERT INTO public.users (id, email, password_hash, full_name, role, casino_id, is_active, created_at)
VALUES
  ('b0000001-0001-0001-0001-000000000001', 'regulator@gauteng.pgb.gov.za', crypt('Regulator123!', gen_salt('bf')), 'Gauteng Provincial Gaming Board', 'provincial_regulator', NULL, true, now()),
  ('b0000002-0002-0002-0002-000000000002', 'regulator@westerncape.pgb.gov.za', crypt('Regulator123!', gen_salt('bf')), 'Western Cape Gambling & Racing Board', 'provincial_regulator', NULL, true, now()),
  ('b0000003-0003-0003-0003-000000000003', 'regulator@kwazulunatal.pgb.gov.za', crypt('Regulator123!', gen_salt('bf')), 'KwaZulu-Natal Gaming & Betting Board', 'provincial_regulator', NULL, true, now()),
  ('b0000004-0004-0004-0004-000000000004', 'regulator@mpumalanga.pgb.gov.za', crypt('Regulator123!', gen_salt('bf')), 'Mpumalanga Gaming Board', 'provincial_regulator', NULL, true, now()),
  ('b0000005-0005-0005-0005-000000000005', 'regulator@limpopo.pgb.gov.za', crypt('Regulator123!', gen_salt('bf')), 'Limpopo Gambling Board', 'provincial_regulator', NULL, true, now()),
  ('b0000006-0006-0006-0006-000000000006', 'regulator@freestate.pgb.gov.za', crypt('Regulator123!', gen_salt('bf')), 'Free State Gambling, Liquor & Tourism Authority', 'provincial_regulator', NULL, true, now()),
  ('b0000007-0007-0007-0007-000000000007', 'regulator@easterncape.pgb.gov.za', crypt('Regulator123!', gen_salt('bf')), 'Eastern Cape Gambling & Betting Board', 'provincial_regulator', NULL, true, now()),
  ('b0000008-0008-0008-0008-000000000008', 'regulator@northwest.pgb.gov.za', crypt('Regulator123!', gen_salt('bf')), 'North West Gambling Board', 'provincial_regulator', NULL, true, now()),
  ('b0000009-0009-0009-0009-000000000009', 'regulator@northerncape.pgb.gov.za', crypt('Regulator123!', gen_salt('bf')), 'Northern Cape Gambling Board', 'provincial_regulator', NULL, true, now())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 7: regulators table records
-- ============================================================

INSERT INTO regulators (user_id, full_name, email, jurisdiction_type, province, organisation_name, license_authority, is_active)
VALUES
  ((SELECT id FROM public.users WHERE email = 'regulator@ngb.gov.za' LIMIT 1),
   'National Gambling Board',
   'regulator@ngb.gov.za',
   'national', NULL,
   'National Gambling Board of South Africa', 'NGB', true),
  ('b0000001-0001-0001-0001-000000000001', 'Gauteng Gaming Regulator', 'regulator@gauteng.pgb.gov.za', 'provincial', 'Gauteng', 'Gauteng Gambling Board', 'GGB', true),
  ('b0000002-0002-0002-0002-000000000002', 'Western Cape Gaming Regulator', 'regulator@westerncape.pgb.gov.za', 'provincial', 'Western Cape', 'Western Cape Gambling & Racing Board', 'WCGRB', true),
  ('b0000003-0003-0003-0003-000000000003', 'KwaZulu-Natal Gaming Regulator', 'regulator@kwazulunatal.pgb.gov.za', 'provincial', 'KwaZulu-Natal', 'KwaZulu-Natal Gaming & Betting Board', 'KZNGBB', true),
  ('b0000004-0004-0004-0004-000000000004', 'Mpumalanga Gaming Regulator', 'regulator@mpumalanga.pgb.gov.za', 'provincial', 'Mpumalanga', 'Mpumalanga Gaming Board', 'MGB', true),
  ('b0000005-0005-0005-0005-000000000005', 'Limpopo Gaming Regulator', 'regulator@limpopo.pgb.gov.za', 'provincial', 'Limpopo', 'Limpopo Gambling Board', 'LGB', true),
  ('b0000006-0006-0006-0006-000000000006', 'Free State Gaming Regulator', 'regulator@freestate.pgb.gov.za', 'provincial', 'Free State', 'Free State Gambling, Liquor & Tourism Authority', 'FSGLTA', true),
  ('b0000007-0007-0007-0007-000000000007', 'Eastern Cape Gaming Regulator', 'regulator@easterncape.pgb.gov.za', 'provincial', 'Eastern Cape', 'Eastern Cape Gambling & Betting Board', 'ECGBB', true),
  ('b0000008-0008-0008-0008-000000000008', 'North West Gaming Regulator', 'regulator@northwest.pgb.gov.za', 'provincial', 'North West', 'North West Gambling Board', 'NWGB', true),
  ('b0000009-0009-0009-0009-000000000009', 'Northern Cape Gaming Regulator', 'regulator@northerncape.pgb.gov.za', 'provincial', 'Northern Cape', 'Northern Cape Gambling Board', 'NCGB', true)
ON CONFLICT (email) DO NOTHING;
