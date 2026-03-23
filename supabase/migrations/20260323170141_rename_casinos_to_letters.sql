/*
  # Rename all casinos to Casino A through Casino R

  Updates all casino names to generic letter-based names (Casino A, Casino B, etc.)
  ordered alphabetically by current name to ensure consistent assignment.
*/

DO $$
DECLARE
  casino_ids uuid[];
  letters text[] := ARRAY['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R'];
  i int;
BEGIN
  SELECT ARRAY(SELECT id FROM casinos ORDER BY name)
  INTO casino_ids;

  FOR i IN 1..array_length(casino_ids, 1) LOOP
    UPDATE casinos
    SET name = 'Casino ' || letters[i]
    WHERE id = casino_ids[i];
  END LOOP;
END $$;
