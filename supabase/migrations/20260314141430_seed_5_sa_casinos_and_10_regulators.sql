/*
  # Seed Demo: 5 SA Casino Operators + 10 Regulators

  ## Summary
  Inserts 5 required South African casino operators and 10 regulator records.
  Uses license_number as conflict key for casinos, email for regulators.

  Casinos:
  - Casino Durban (KwaZulu-Natal)
  - SunBet SA (Gauteng)
  - Gold Reef Gaming (Gauteng)
  - CapeWin Casino (Western Cape)
  - Platinum Bets (Gauteng)

  Regulators:
  - 1 National Gambling Board South Africa
  - 9 Provincial Gambling Boards
*/

-- ============================================================
-- 5 DEMO CASINO OPERATORS
-- ============================================================
INSERT INTO casinos (name, license_number, contact_email, contact_phone, address, province, country, is_active, simulation_mode, created_at)
VALUES
  ('Casino Durban',   'KZN-PGCB-2019-001', 'admin@casinodurban.co.za',  '+27310000001', '234 Marine Parade, Durban, 4001',               'KwaZulu-Natal', 'South Africa', true, true, now() - INTERVAL '2 years'),
  ('SunBet SA',       'GT-PAGC-2018-004',  'admin@sunbetsa.co.za',       '+27110000002', '1 Electron Avenue, Isando, Gauteng, 1609',      'Gauteng',        'South Africa', true, true, now() - INTERVAL '2 years 3 months'),
  ('Gold Reef Gaming','GT-PAGC-2020-007',  'admin@goldreefgaming.co.za', '+27110000003', 'Northern Parkway, Ormonde, Johannesburg, 2091', 'Gauteng',        'South Africa', true, true, now() - INTERVAL '18 months'),
  ('CapeWin Casino',  'WC-WCGRB-2021-003', 'admin@capewincasino.co.za',  '+27210000004', '1 Grand Parade, Cape Town, 8000',               'Western Cape',   'South Africa', true, true, now() - INTERVAL '14 months'),
  ('Platinum Bets',   'GT-PAGC-2022-011',  'admin@platinumbets.co.za',   '+27110000005', '22 Fredman Drive, Sandton, Gauteng, 2196',      'Gauteng',        'South Africa', true, true, now() - INTERVAL '10 months')
ON CONFLICT (license_number) DO UPDATE SET
  name             = EXCLUDED.name,
  contact_email    = EXCLUDED.contact_email,
  province         = EXCLUDED.province,
  is_active        = EXCLUDED.is_active,
  simulation_mode  = EXCLUDED.simulation_mode;

-- ============================================================
-- 10 REGULATOR RECORDS
-- ============================================================
INSERT INTO regulators (full_name, email, jurisdiction_type, province, organisation_name, license_authority, is_active)
VALUES
  ('National Gambling Board South Africa',   'info@ngb.org.za',    'national',  NULL,           'National Gambling Board',                   'Dept of Trade, Industry and Competition', true),
  ('Gauteng Gambling Board',                 'info@ggb.org.za',    'provincial','Gauteng',       'Gauteng Gambling Board',                    'Gauteng Provincial Government',           true),
  ('Western Cape Gambling and Racing Board', 'info@wcgrb.co.za',   'provincial','Western Cape',  'Western Cape Gambling and Racing Board',    'Western Cape Provincial Government',      true),
  ('KZN Provincial Gambling Board',          'info@pgcb.co.za',    'provincial','KwaZulu-Natal', 'KZN Provincial Gambling and Betting Board', 'KwaZulu-Natal Provincial Government',     true),
  ('Eastern Cape Gambling and Betting Board','info@ecgbb.org.za',  'provincial','Eastern Cape',  'Eastern Cape Gambling and Betting Board',   'Eastern Cape Provincial Government',      true),
  ('Mpumalanga Gambling Board',              'info@mgb.co.za',     'provincial','Mpumalanga',    'Mpumalanga Gambling Board',                 'Mpumalanga Provincial Government',        true),
  ('Limpopo Gambling Board',                 'info@lgb.co.za',     'provincial','Limpopo',       'Limpopo Gambling Board',                    'Limpopo Provincial Government',           true),
  ('Free State Gambling and Racing Board',   'info@fsgrb.co.za',   'provincial','Free State',    'Free State Gambling and Racing Board',      'Free State Provincial Government',        true),
  ('North West Gambling Board',              'info@nwgb.co.za',    'provincial','North West',    'North West Gambling Board',                 'North West Provincial Government',        true),
  ('Northern Cape Gambling Board',           'info@ncgb.co.za',    'provincial','Northern Cape', 'Northern Cape Gambling Board',              'Northern Cape Provincial Government',     true)
ON CONFLICT (email) DO UPDATE SET
  full_name         = EXCLUDED.full_name,
  organisation_name = EXCLUDED.organisation_name,
  is_active         = EXCLUDED.is_active;
