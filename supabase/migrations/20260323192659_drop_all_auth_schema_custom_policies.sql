/*
  # Drop ALL custom RLS policies from auth schema tables

  Having any custom RLS policies on auth schema tables (even permissive ones)
  causes Supabase GoTrue to throw "Database error querying schema" during login.
  
  The auth schema tables are owned by supabase_auth_admin which automatically
  bypasses RLS (since FORCE ROW LEVEL SECURITY = false). Adding custom policies
  actually interferes with GoTrue's internal operation because GoTrue connects
  as a different session context when validating the schema.

  Solution: Remove ALL custom policies we added to auth schema tables.
  The tables will still have RLS "enabled" in pg_class but with no policies,
  the owner (supabase_auth_admin) still has full access. Other roles simply
  cannot access auth tables directly which is correct behavior.
*/

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT cls.relname AS tbl, p.polname AS pol
    FROM pg_policy p
    JOIN pg_class cls ON p.polrelid = cls.oid
    JOIN pg_namespace nsp ON cls.relnamespace = nsp.oid
    WHERE nsp.nspname = 'auth'
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON auth.%I', pol.pol, pol.tbl);
      RAISE NOTICE 'Dropped policy % on auth.%', pol.pol, pol.tbl;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not drop % on auth.%: %', pol.pol, pol.tbl, SQLERRM;
    END;
  END LOOP;
END $$;
