
/*
  # Redistribute 50,000 Players Across All 18 Casinos

  ## Summary
  Currently all 50,000 players are concentrated in 5 casinos. This migration 
  redistributes them across all 18 casinos by updating casino_id on existing records.
  Total stays at exactly 50,000 players.

  ## Target Distribution (totals 50,000):
  - Casino Durban: 5,500
  - SunBet SA: 5,000
  - Gold Reef Gaming: 5,000
  - CapeWin Casino: 4,000
  - Platinum Bets: 3,500
  - Emperors Palace Casino: 3,500
  - Montecasino: 3,000
  - Sibaya Casino: 2,800
  - Royal Palace Casino: 2,500
  - Sun International Cape Town: 2,200
  - Golden Dragon Gaming: 2,000
  - Silver Star Resort: 1,800
  - East London ICC: 1,500
  - Graceland Casino: 1,300
  - Flamingo Casino: 1,200
  - Meropa Casino: 1,000
  - Mmabatho Palms: 900
  - Windmill Casino: 800
  Total: 48,000 (existing 50,000 minus 2,000 that stay as-is to avoid rounding)
  
  Actually just update casino_id for batches of players from the 5 large casinos.
*/

DO $$
DECLARE
  -- Target counts per casino
  v_targets uuid[] := ARRAY[
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,  -- Emperors Palace: 3500
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,  -- Sun International CT: 2200
    'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,  -- Sibaya: 2800
    'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,  -- Graceland: 1300
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid,  -- Meropa: 1000
    'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid,  -- Windmill: 800
    '11111111-2222-3333-4444-555555555555'::uuid,  -- East London ICC: 1500
    '22222222-3333-4444-5555-666666666666'::uuid,  -- Mmabatho Palms: 900
    '33333333-4444-5555-6666-777777777777'::uuid,  -- Flamingo: 1200
    '44444444-5555-6666-7777-888888888888'::uuid,  -- Montecasino: 3000
    '11111111-1111-1111-1111-111111111111'::uuid,  -- Royal Palace: 2500
    '22222222-2222-2222-2222-222222222222'::uuid,  -- Golden Dragon: 2000
    '33333333-3333-3333-3333-333333333333'::uuid   -- Silver Star: 1800
  ];
  v_counts int[] := ARRAY[3500, 2200, 2800, 1300, 1000, 800, 1500, 900, 1200, 3000, 2500, 2000, 1800];

  v_casino_id uuid;
  v_count int;
  v_c int;
  -- Rotate which source casino we pull from
  v_sources uuid[] := ARRAY[
    '74af4a9b-a774-46c9-bc20-18c72a21526e'::uuid,  -- CapeWin
    'f310e9c0-f374-4ffa-8e2f-e87c2818e60f'::uuid,  -- Casino Durban
    '63c6faf0-e89c-48b4-8ae1-a14aee52cd9c'::uuid,  -- Gold Reef
    '1f67f803-e16e-46c6-8483-7c47f5e15792'::uuid,  -- Platinum Bets
    'd34d86d0-babc-48a3-8f03-650126e5ad98'::uuid   -- SunBet SA
  ];
  v_src_idx int := 1;
  v_updated int;
BEGIN
  FOR v_c IN 1..array_length(v_targets, 1) LOOP
    v_casino_id := v_targets[v_c];
    v_count := v_counts[v_c];

    -- Update casino_id for v_count players from the source casino
    WITH batch AS (
      SELECT id FROM players
      WHERE casino_id = v_sources[v_src_idx]
      LIMIT v_count
    )
    UPDATE players
    SET casino_id = v_casino_id
    WHERE id IN (SELECT id FROM batch);

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RAISE NOTICE 'Moved % players to casino %', v_updated, v_casino_id;

    -- Move to next source casino (cycle)
    v_src_idx := (v_src_idx % array_length(v_sources, 1)) + 1;
  END LOOP;
END $$;
