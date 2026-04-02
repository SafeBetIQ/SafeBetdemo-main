/*
  # Update Demo Player Names to Realistic South African Names

  1. Changes
    - Updates all players with "Player Demo-X" names to realistic South African names
    - Maintains diversity reflecting South Africa's multicultural population
    - Uses common South African first and last names
    
  2. Notes
    - Only updates players with first_name = 'Player'
    - Preserves player_id and all other data
    - Names are randomly assigned but deterministic based on player number
*/

-- Create a temporary function to generate realistic South African names
DO $$
DECLARE
  first_names TEXT[] := ARRAY[
    'Thabo', 'Lerato', 'Sipho', 'Nomsa', 'Mandla', 'Zanele', 'Bongani', 'Precious', 
    'Tshepo', 'Ntombi', 'Pieter', 'Annelie', 'Johan', 'Marietjie', 'Ahmed', 'Fatima',
    'Ravi', 'Priya', 'Chen', 'Mei', 'Lebo', 'Neo', 'Karabo', 'Palesa', 'Mpho',
    'Katlego', 'Dineo', 'Kagiso', 'Thandeka', 'Nkosinathi', 'Lindiwe', 'Sibusiso',
    'Nompumelelo', 'Themba', 'Zinhle', 'Andile', 'Ayanda', 'Sello', 'Refilwe',
    'Willem', 'Sannie', 'Francois', 'Louise', 'Dirk', 'Elsa', 'Mohammed', 'Aisha',
    'Rajesh', 'Nisha', 'Michael', 'Sarah', 'David', 'Rebecca', 'James', 'Emily',
    'Daniel', 'Jessica', 'Ryan', 'Chloe', 'Luke', 'Sophie'
  ];
  
  last_names TEXT[] := ARRAY[
    'Nkosi', 'Dlamini', 'Mthembu', 'Khumalo', 'Ndlovu', 'Zulu', 'Sithole', 'Zwane',
    'Mkhize', 'Nkomo', 'Van der Merwe', 'Botha', 'Pretorius', 'Du Plessis', 'Mohamed',
    'Abrahams', 'Patel', 'Naidoo', 'Singh', 'Chetty', 'Molefe', 'Mokoena', 'Phiri',
    'Dube', 'Mahlangu', 'Moyo', 'Ngcobo', 'Buthelezi', 'Maseko', 'Shabalala',
    'Cele', 'Mdluli', 'Radebe', 'Mokone', 'Steyn', 'Fourie', 'Nel', 'Venter',
    'Meyer', 'Muller', 'Jacobs', 'Adams', 'Williams', 'Smith', 'Johnson',
    'Brown', 'Davis', 'Wilson', 'Taylor', 'Anderson', 'Thomas', 'Lee'
  ];
  
  player_record RECORD;
  random_seed INTEGER;
  first_name_idx INTEGER;
  last_name_idx INTEGER;
BEGIN
  FOR player_record IN 
    SELECT id, player_id 
    FROM players 
    WHERE first_name = 'Player' AND last_name LIKE 'Demo-%'
  LOOP
    -- Extract number from player_id to use as seed
    random_seed := (regexp_match(player_record.player_id, '\d+$'))[1]::INTEGER;
    
    -- Generate deterministic but varied indexes
    first_name_idx := (random_seed * 17) % array_length(first_names, 1) + 1;
    last_name_idx := (random_seed * 23) % array_length(last_names, 1) + 1;
    
    -- Update the player with realistic names
    UPDATE players
    SET 
      first_name = first_names[first_name_idx],
      last_name = last_names[last_name_idx]
    WHERE id = player_record.id;
  END LOOP;
END $$;
