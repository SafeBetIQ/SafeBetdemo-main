/*
  # Seed: sen_breach_detections — Cross-Operator Compliance Demo Data

  Inserts 10 realistic breach detection records across the three primary demo
  casinos (Royal Palace 11111111, Golden Dragon 22222222, Silver Star 33333333).

  All foreign keys reference existing sen_protection_broadcasts,
  sen_exclusion_events, and casinos rows. No schema changes are made.

  STATUS MIX  (per requirement)
  ─────────────────────────────
    open       6 records  60%   — awaiting action
    responded  2 records  20%   — operator has acted
    reported   1 record   10%   — escalated to regulator
    closed     1 record   10%   — fully resolved

  SCENARIOS
  ─────────────────────────────────────────────────────────────────────────
  #  Detecting Casino        Originating Casino    Method         Severity  Status
  1  Golden Dragon (2222)    Royal Palace (1111)   deposit_trigger  critical  open
  2  Royal Palace  (1111)    Golden Dragon (2222)  login_trigger    high      open
  3  Royal Palace  (1111)    Silver Star   (3333)  deposit_trigger  critical  responded
  4  Silver Star   (3333)    Casino K      (4444)  manual_check     high      open
  5  Golden Dragon (2222)    Casino D      (aaaa)  biometric        high      closed
  6  Silver Star   (3333)    Casino I      (eeee)  token_match      critical  open
  7  Silver Star   (3333)    Golden Dragon (2222)  deposit_trigger  critical  open
  8  Silver Star   (3333)    Royal Palace  (1111)  manual_check     high      reported
  9  Silver Star   (3333)    Golden Dragon (2222)  login_trigger    high      responded
  10 Golden Dragon (2222)    Silver Star   (3333)  biometric        critical  open

  Scenarios 8 & 9 reuse existing broadcasts (same pseudonymised player
  detected at a third operator — realistic multi-hop cross-operator breach).

  Safe for demo: purely synthetic, no schema changes, no deletes.
*/

INSERT INTO public.sen_breach_detections (
  id,
  broadcast_id,
  exclusion_event_id,
  detecting_casino_id,
  originating_casino_id,
  player_id,
  pseudonym_token,
  detection_method,
  detection_context,
  response_action,
  response_time_minutes,
  cross_operator_alert_id,
  amount_deposited_before_detection,
  session_duration_before_detection,
  severity,
  status,
  regulatory_report_filed,
  nrgp_notified,
  detected_at,
  responded_at,
  created_at,
  updated_at
) VALUES

-- ── 1. Golden Dragon detects Royal Palace exclusion violator ─────────────────
-- Player originally self-excluded at Royal Palace; walked into Golden Dragon
-- and made a R2,750 deposit before the token match fired.
(
  'bd100001-0000-0000-0000-000000000001',
  'e3b3c098-54ed-40bc-aac7-38aad12e353c',   -- broadcast
  '927007a8-00c4-410a-af3b-21b6a717a765',   -- exclusion event (Royal Palace)
  '22222222-2222-2222-2222-222222222222',   -- detecting: Golden Dragon
  '11111111-1111-1111-1111-111111111111',   -- originating: Royal Palace
  NULL,
  'ee73e6cc903769b426da87dc66b60d91ad0ea0fec07030d3dba7586380277bb4',
  'deposit_trigger',
  'deposit',
  NULL,
  NULL,
  NULL,
  2750.00,
  45,
  'critical',
  'open',
  false,
  false,
  now() - interval '2 days',
  NULL,
  now() - interval '2 days',
  now() - interval '2 days'
),

-- ── 2. Royal Palace detects Golden Dragon exclusion violator ─────────────────
-- Player self-excluded at Golden Dragon; attempted login at Royal Palace.
-- Detection fired at login — no funds deposited.
(
  'bd100002-0000-0000-0000-000000000002',
  'baaf8569-9dd4-45c7-af95-757abb378f66',   -- broadcast
  'efa40e8c-44c7-46b5-a835-e28961ed220c',   -- exclusion event (Golden Dragon)
  '11111111-1111-1111-1111-111111111111',   -- detecting: Royal Palace
  '22222222-2222-2222-2222-222222222222',   -- originating: Golden Dragon
  NULL,
  '3ad86e995d237f1e8bc97038f559cba9bd6cbd4d804ec58cb4f1c893c9ee750f',
  'login_trigger',
  'login',
  NULL,
  NULL,
  NULL,
  0.00,
  5,
  'high',
  'open',
  false,
  false,
  now() - interval '3 days',
  NULL,
  now() - interval '3 days',
  now() - interval '3 days'
),

-- ── 3. Royal Palace detects Silver Star exclusion violator (RESPONDED) ───────
-- Player self-excluded at Silver Star; deposited R4,200 over 87 minutes at
-- Royal Palace. Account suspended within 3 hours of detection.
(
  'bd100003-0000-0000-0000-000000000003',
  'f91c6529-7e39-4c4f-b991-d87d69cfecde',   -- broadcast
  '1bd98ba0-15bf-4f0d-bdc6-4bdaa42e07f0',   -- exclusion event (Silver Star)
  '11111111-1111-1111-1111-111111111111',   -- detecting: Royal Palace
  '33333333-3333-3333-3333-333333333333',   -- originating: Silver Star
  NULL,
  'e30a6600e46120e3823691d7fc9c09b10738b8f30c16832497a0bcac687ee0e5',
  'deposit_trigger',
  'deposit',
  'account_suspended',
  183,
  NULL,
  4200.00,
  87,
  'critical',
  'responded',
  false,
  true,
  now() - interval '8 days',
  now() - interval '8 days' + interval '3 hours 3 minutes',
  now() - interval '8 days',
  now() - interval '8 days'
),

-- ── 4. Silver Star detects Casino K exclusion violator ───────────────────────
-- KYC check at Silver Star returned a pseudonym-token match against Casino K's
-- broadcast. Player had deposited R800 before the KYC stage triggered the flag.
(
  'bd100004-0000-0000-0000-000000000004',
  '44b5e677-3f17-43b4-b50c-8598b0e88b89',   -- broadcast
  '8b7fdd91-3d49-4ae0-a5a8-00a09d2d3c00',   -- exclusion event (Casino K)
  '33333333-3333-3333-3333-333333333333',   -- detecting: Silver Star
  '44444444-5555-6666-7777-888888888888',   -- originating: Casino K
  NULL,
  'fff0106cc334a6dd2a70a3486f16b8188532c5519f3d59beac1c70d5d150ec8a',
  'manual_check',
  'kyc_check',
  NULL,
  NULL,
  NULL,
  800.00,
  20,
  'high',
  'open',
  false,
  false,
  now() - interval '1 day',
  NULL,
  now() - interval '1 day',
  now() - interval '1 day'
),

-- ── 5. Golden Dragon detects Casino D exclusion violator (CLOSED) ────────────
-- Biometric match during session start at Golden Dragon. Player originally
-- excluded at Casino D. Full regulatory cycle completed — case closed.
(
  'bd100005-0000-0000-0000-000000000005',
  'dfad937b-f059-4547-9798-1ca1f8dc696e',   -- broadcast
  '69738a5b-273a-4961-9701-3bbc18f667bd',   -- exclusion event (Casino D)
  '22222222-2222-2222-2222-222222222222',   -- detecting: Golden Dragon
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',   -- originating: Casino D
  NULL,
  '59bc38bf948da39ea2ab8793717adfa7becfa4e7e29c5e137525ed774eb53f02',
  'biometric',
  'session_start',
  'reported_to_regulator',
  47,
  NULL,
  1500.00,
  35,
  'high',
  'closed',
  true,
  true,
  now() - interval '10 days',
  now() - interval '10 days' + interval '47 minutes',
  now() - interval '10 days',
  now() - interval '10 days'
),

-- ── 6. Silver Star detects Casino I exclusion violator ───────────────────────
-- Token match fired at session start. Player self-excluded at Casino I;
-- R3,100 deposited across 62-minute session before detection.
(
  'bd100006-0000-0000-0000-000000000006',
  '8525de6f-72db-4f15-bf2c-cbeee16fbbcf',   -- broadcast
  'eeb0f0d4-f071-4c00-9a4a-f08cfb381a83',   -- exclusion event (Casino I)
  '33333333-3333-3333-3333-333333333333',   -- detecting: Silver Star
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',   -- originating: Casino I
  NULL,
  '4efa7a354cc926362272ff5dc5fca3fcd722038eed7f4f01f44c37582e2107bf',
  'token_match',
  'session_start',
  NULL,
  NULL,
  NULL,
  3100.00,
  62,
  'critical',
  'open',
  false,
  false,
  now() - interval '4 days',
  NULL,
  now() - interval '4 days',
  now() - interval '4 days'
),

-- ── 7. Silver Star detects Golden Dragon exclusion violator ──────────────────
-- Player self-excluded at Golden Dragon; deposit trigger fired at Silver Star
-- after R1,800 transaction. Second known detection for this player in network.
(
  'bd100007-0000-0000-0000-000000000007',
  '5ad3a27d-6d48-461f-b6bc-1b47f98bb1a7',   -- broadcast
  '061d176b-35d7-4c68-92ff-dbd521d38185',   -- exclusion event (Golden Dragon)
  '33333333-3333-3333-3333-333333333333',   -- detecting: Silver Star
  '22222222-2222-2222-2222-222222222222',   -- originating: Golden Dragon
  NULL,
  'c0289c9f0763996b6098837fea71a2f1962319daa75959438a9b0ce5250b00b0',
  'deposit_trigger',
  'deposit',
  NULL,
  NULL,
  NULL,
  1800.00,
  28,
  'critical',
  'open',
  false,
  false,
  now() - interval '6 days',
  NULL,
  now() - interval '6 days',
  now() - interval '6 days'
),

-- ── 8. Silver Star detects the SAME Royal Palace violator (REPORTED) ─────────
-- Same pseudonymised token as breach #1 — this player bounced from Royal Palace
-- to Golden Dragon (#1) and then to Silver Star. Reuses the same broadcast.
-- Silver Star filed the regulatory report; NRGP notified.
(
  'bd100008-0000-0000-0000-000000000008',
  'e3b3c098-54ed-40bc-aac7-38aad12e353c',   -- same broadcast as breach #1
  '927007a8-00c4-410a-af3b-21b6a717a765',   -- same exclusion event
  '33333333-3333-3333-3333-333333333333',   -- detecting: Silver Star
  '11111111-1111-1111-1111-111111111111',   -- originating: Royal Palace
  NULL,
  'ee73e6cc903769b426da87dc66b60d91ad0ea0fec07030d3dba7586380277bb4',
  'manual_check',
  'manual_review',
  'deposit_blocked',
  68,
  NULL,
  500.00,
  15,
  'high',
  'reported',
  true,
  true,
  now() - interval '5 days',
  now() - interval '5 days' + interval '1 hour 8 minutes',
  now() - interval '5 days',
  now() - interval '5 days'
),

-- ── 9. Silver Star detects Golden Dragon violator — earlier incident (RESPONDED)
-- Earlier detection of the same player as breach #7 — first time this player
-- appeared in the network. Session terminated immediately.
(
  'bd100009-0000-0000-0000-000000000009',
  'baaf8569-9dd4-45c7-af95-757abb378f66',   -- reuses Golden Dragon broadcast
  'efa40e8c-44c7-46b5-a835-e28961ed220c',   -- exclusion event (Golden Dragon)
  '33333333-3333-3333-3333-333333333333',   -- detecting: Silver Star
  '22222222-2222-2222-2222-222222222222',   -- originating: Golden Dragon
  NULL,
  '3ad86e995d237f1e8bc97038f559cba9bd6cbd4d804ec58cb4f1c893c9ee750f',
  'login_trigger',
  'login',
  'session_terminated',
  12,
  NULL,
  0.00,
  8,
  'high',
  'responded',
  false,
  false,
  now() - interval '11 days',
  now() - interval '11 days' + interval '12 minutes',
  now() - interval '11 days',
  now() - interval '11 days'
),

-- ── 10. Golden Dragon detects Silver Star exclusion violator ─────────────────
-- Biometric check at Golden Dragon's KYC stage matched Silver Star exclusion.
-- Player deposited R2,200 across 40 minutes. No action taken yet.
(
  'bd100010-0000-0000-0000-000000000010',
  'f91c6529-7e39-4c4f-b991-d87d69cfecde',   -- same broadcast as breach #3
  '1bd98ba0-15bf-4f0d-bdc6-4bdaa42e07f0',   -- exclusion event (Silver Star)
  '22222222-2222-2222-2222-222222222222',   -- detecting: Golden Dragon
  '33333333-3333-3333-3333-333333333333',   -- originating: Silver Star
  NULL,
  'e30a6600e46120e3823691d7fc9c09b10738b8f30c16832497a0bcac687ee0e5',
  'biometric',
  'kyc_check',
  NULL,
  NULL,
  NULL,
  2200.00,
  40,
  'critical',
  'open',
  false,
  false,
  now() - interval '7 days',
  NULL,
  now() - interval '7 days',
  now() - interval '7 days'
);
