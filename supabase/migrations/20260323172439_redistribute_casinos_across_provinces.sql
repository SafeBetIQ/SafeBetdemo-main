/*
  # Redistribute Casinos Across All Provinces

  ## Summary
  Randomly redistributes the 18 demo casinos across all 9 South African provinces
  so that each provincial regulator has 2 casinos to oversee.

  ## Changes
  - Updates the `province` column on the `casinos` table
  - Each province gets exactly 2 casinos (18 casinos / 9 provinces = 2 each)
  - Distribution is intentional to ensure every provincial regulator dashboard
    has meaningful data to display

  ## Province Assignments
  - Gauteng: Casino A, Casino B
  - Western Cape: Casino C, Casino D
  - KwaZulu-Natal: Casino E, Casino F
  - Eastern Cape: Casino G, Casino H
  - Free State: Casino I, Casino J
  - Mpumalanga: Casino K, Casino L
  - Limpopo: Casino M, Casino N
  - North West: Casino O, Casino P
  - Northern Cape: Casino Q, Casino R
*/

UPDATE casinos SET province = 'Gauteng'       WHERE name = 'Casino A';
UPDATE casinos SET province = 'Gauteng'       WHERE name = 'Casino B';
UPDATE casinos SET province = 'Western Cape'  WHERE name = 'Casino C';
UPDATE casinos SET province = 'Western Cape'  WHERE name = 'Casino D';
UPDATE casinos SET province = 'KwaZulu-Natal' WHERE name = 'Casino E';
UPDATE casinos SET province = 'KwaZulu-Natal' WHERE name = 'Casino F';
UPDATE casinos SET province = 'Eastern Cape'  WHERE name = 'Casino G';
UPDATE casinos SET province = 'Eastern Cape'  WHERE name = 'Casino H';
UPDATE casinos SET province = 'Free State'    WHERE name = 'Casino I';
UPDATE casinos SET province = 'Free State'    WHERE name = 'Casino J';
UPDATE casinos SET province = 'Mpumalanga'    WHERE name = 'Casino K';
UPDATE casinos SET province = 'Mpumalanga'    WHERE name = 'Casino L';
UPDATE casinos SET province = 'Limpopo'       WHERE name = 'Casino M';
UPDATE casinos SET province = 'Limpopo'       WHERE name = 'Casino N';
UPDATE casinos SET province = 'North West'    WHERE name = 'Casino O';
UPDATE casinos SET province = 'North West'    WHERE name = 'Casino P';
UPDATE casinos SET province = 'Northern Cape' WHERE name = 'Casino Q';
UPDATE casinos SET province = 'Northern Cape' WHERE name = 'Casino R';
