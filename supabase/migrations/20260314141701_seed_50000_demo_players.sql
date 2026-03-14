/*
  # Seed 50,000 Demo Players

  ## Summary
  Generates 50,000 pseudonymised demo players across 5 SA demo casinos.
  Distribution:
  - Casino Durban:    12,000 players
  - SunBet SA:        11,000 players
  - Gold Reef Gaming: 11,000 players
  - CapeWin Casino:    9,000 players
  - Platinum Bets:     7,000 players

  ## Design Decisions
  - Email uses pseudonymised token — no real PII
  - Risk levels use lowercase to match DB constraint: low/medium/high/critical
  - Risk distribution: 70% low, 20% medium, 7% high, 3% critical
  - VIP tiers weighted toward standard
  - Signup dates spread over 3 years
  - Wagering amounts scale with risk level
*/

DO $$
DECLARE
  v_casino_durban uuid := 'f310e9c0-f374-4ffa-8e2f-e87c2818e60f';
  v_sunbet        uuid := 'd34d86d0-babc-48a3-8f03-650126e5ad98';
  v_gold_reef     uuid := '63c6faf0-e89c-48b4-8ae1-a14aee52cd9c';
  v_capewin       uuid := '74af4a9b-a774-46c9-bc20-18c72a21526e';
  v_platinum      uuid := '1f67f803-e16e-46c6-8483-7c47f5e15792';

  first_names text[] := ARRAY[
    'Sipho','Thabo','Nomsa','Lerato','Kagiso','Zanele','Bongani','Ayanda','Nkosi','Thandeka',
    'Mandla','Lungelo','Nokwanda','Siyanda','Mthokozisi','Nompilo','Lwazi','Sifiso','Ntombi','Phiwayinkosi',
    'Johan','Pieter','Anrika','Liesel','Hendrik','Chantal','Ruan','Marelize','Dirk','Sonja',
    'Ahmed','Fatima','Yusuf','Aisha','Imran','Zahra','Tariq','Nadia','Bilal','Sameera',
    'Priya','Rajan','Meera','Vikram','Anita','Suresh','Kavita','Ashwin','Pooja','Dev',
    'Tebogo','Kefilwe','Mmabatho','Lesego','Modise','Kelebogile','Tlotlo','Boitumelo','Neo','Refilwe',
    'Amahle','Sithembile','Thulisile','Nothando','Lungisa','Sandile','Nokuthula','Mduduzi','Hlengiwe','Bhekani',
    'Francois','Adri','Jaco','Minette','Danie','Wilma','Luan','Elzette','Nico','Annalize',
    'Lindiwe','Busisiwe','Nomalanga','Ntombizodwa','Sikhumbuzo','Ntuthuko','Thokozani','Nhlanhla','Sphesihle','Melusi'
  ];

  last_names text[] := ARRAY[
    'Dlamini','Nkosi','Mthembu','Zulu','Ndlovu','Mkhize','Khumalo','Ntuli','Majola','Cele',
    'Botha','Pretorius','Du Plessis','Van der Merwe','Venter','Joubert','Steyn','Swart','Nel','Erasmus',
    'Patel','Khan','Moosa','Desai','Pillay','Naidoo','Govender','Chetty','Singh','Reddy',
    'Sithole','Zwane','Masondo','Mthethwa','Khoza','Bhengu','Gumede','Mchunu','Shabalala','Mhlongo',
    'Mahlangu','Nkuna','Chauke','Baloyi','Maluleke','Mathebula','Chabalala','Hlongwane','Ngobeni','Mabunda',
    'Williams','Johnson','Brown','Jones','Smith','Davis','Martin','Thompson','Wilson','Anderson',
    'Mokoena','Molefe','Molefi','Mogorosi','Modise','Motsepe','Moshoeshoe','Mofokeng','Mokgosi','Moagi'
  ];

  provinces text[] := ARRAY[
    'Gauteng','Gauteng','Gauteng','Western Cape','Western Cape',
    'KwaZulu-Natal','KwaZulu-Natal','Eastern Cape','Mpumalanga',
    'Limpopo','Free State','North West','Northern Cape'
  ];

  -- Weighted: ~70% low, ~20% medium, ~7% high, ~3% critical
  risk_weights text[] := ARRAY[
    'low','low','low','low','low','low','low',
    'medium','medium',
    'high',
    'critical'
  ];

  vip_weights text[] := ARRAY[
    'standard','standard','standard','standard','standard','standard',
    'bronze','bronze','bronze','bronze',
    'silver','silver','silver',
    'gold','gold',
    'platinum'
  ];

  casino_list uuid[] := ARRAY[v_casino_durban, v_sunbet, v_gold_reef, v_capewin, v_platinum];
  batch_sizes int[]  := ARRAY[12000, 11000, 11000, 9000, 7000];

  c_idx    int;
  casino   uuid;
  batch_n  int;
  i        int;
  r_level  text;
  r_score  int;
  v_tier   text;
  fn       text;
  ln       text;
  prov     text;
  days_ago int;
  wager    numeric;
  deposit  numeric;
  sessions int;
  p_status text;
  p_token  text;
  p_email  text;

BEGIN
  FOR c_idx IN 1..5 LOOP
    casino  := casino_list[c_idx];
    batch_n := batch_sizes[c_idx];

    FOR i IN 1..batch_n LOOP
      r_level  := risk_weights[1 + floor(random() * array_length(risk_weights, 1))::int];
      r_score  := CASE r_level
                    WHEN 'low'      THEN 5  + floor(random() * 29)::int
                    WHEN 'medium'   THEN 35 + floor(random() * 29)::int
                    WHEN 'high'     THEN 65 + floor(random() * 19)::int
                    WHEN 'critical' THEN 85 + floor(random() * 14)::int
                    ELSE 20
                  END;
      v_tier   := vip_weights[1 + floor(random() * array_length(vip_weights, 1))::int];
      fn       := first_names[1 + floor(random() * array_length(first_names, 1))::int];
      ln       := last_names[1 + floor(random() * array_length(last_names, 1))::int];
      prov     := provinces[1 + floor(random() * array_length(provinces, 1))::int];
      days_ago := 14 + floor(random() * 1060)::int;
      wager    := CASE r_level
                    WHEN 'low'      THEN 50   + floor(random() * 1950)::int
                    WHEN 'medium'   THEN 500  + floor(random() * 7500)::int
                    WHEN 'high'     THEN 2000 + floor(random() * 23000)::int
                    WHEN 'critical' THEN 8000 + floor(random() * 72000)::int
                    ELSE 300
                  END;
      deposit  := round((wager * (0.4 + random() * 0.8))::numeric, 2);
      sessions := CASE r_level
                    WHEN 'low'      THEN 1  + floor(random() * 15)::int
                    WHEN 'medium'   THEN 8  + floor(random() * 40)::int
                    WHEN 'high'     THEN 25 + floor(random() * 75)::int
                    WHEN 'critical' THEN 60 + floor(random() * 180)::int
                    ELSE 5
                  END;
      p_status := CASE
                    WHEN random() < 0.015 THEN 'self_excluded'
                    WHEN random() < 0.02  THEN 'suspended'
                    ELSE 'active'
                  END;

      p_token := 'PTOKEN-' || lpad(floor(random() * 9999999)::text, 7, '0') || '-' || substr(md5(gen_random_uuid()::text), 1, 8);
      p_email := lower(replace(fn,' ','.')) || '.' || lower(replace(ln,' ','.')) || '+' || substr(md5(p_token), 1, 6) || '@demo.safebetiq.co.za';

      INSERT INTO players (
        casino_id, player_id, first_name, last_name, email,
        province, risk_score, risk_level,
        total_wagered, total_deposits,
        total_withdrawals, total_won,
        session_count, avg_session_duration,
        vip_tier, lifetime_value,
        is_active, status,
        signup_date, last_active, created_at
      ) VALUES (
        casino,
        p_token,
        fn, ln,
        p_email,
        prov,
        r_score, r_level,
        round(wager::numeric, 2),
        deposit,
        round((deposit * (0.15 + random() * 0.45))::numeric, 2),
        round((wager  * (0.25 + random() * 0.50))::numeric, 2),
        sessions,
        15 + floor(random() * 115)::int,
        v_tier,
        round((deposit * (0.7 + random() * 0.5))::numeric, 2),
        p_status = 'active',
        p_status,
        now() - (days_ago || ' days')::interval,
        now() - (floor(random() * 28)::text || ' days')::interval,
        now() - (days_ago || ' days')::interval
      );
    END LOOP;
  END LOOP;
END $$;
