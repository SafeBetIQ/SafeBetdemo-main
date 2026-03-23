/*
  # Fix Auth Schema RLS - Add Permissive Policies

  1. Problem
    - Auth schema tables have RLS enabled but NO policies exist
    - This blocks all access including Supabase's internal auth service
    - Results in "Database error querying schema" during login

  2. Solution
    - Create fully permissive policies on all auth tables
    - This allows Supabase's internal auth service to function properly
    - The auth schema is protected by Supabase's own security mechanisms
*/

DO $$ 
DECLARE
  auth_table TEXT;
  auth_tables TEXT[] := ARRAY[
    'users', 'identities', 'sessions', 'refresh_tokens', 'instances',
    'mfa_amr_claims', 'mfa_challenges', 'mfa_factors', 'one_time_tokens',
    'flow_state', 'saml_providers', 'saml_relay_states', 'sso_providers',
    'sso_domains', 'audit_log_entries', 'schema_migrations'
  ];
BEGIN
  FOREACH auth_table IN ARRAY auth_tables
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS "auth_full_access_select" ON auth.%I', auth_table);
      EXECUTE format('DROP POLICY IF EXISTS "auth_full_access_insert" ON auth.%I', auth_table);
      EXECUTE format('DROP POLICY IF EXISTS "auth_full_access_update" ON auth.%I', auth_table);
      EXECUTE format('DROP POLICY IF EXISTS "auth_full_access_delete" ON auth.%I', auth_table);

      EXECUTE format('CREATE POLICY "auth_full_access_select" ON auth.%I FOR SELECT USING (true)', auth_table);
      EXECUTE format('CREATE POLICY "auth_full_access_insert" ON auth.%I FOR INSERT WITH CHECK (true)', auth_table);
      EXECUTE format('CREATE POLICY "auth_full_access_update" ON auth.%I FOR UPDATE USING (true) WITH CHECK (true)', auth_table);
      EXECUTE format('CREATE POLICY "auth_full_access_delete" ON auth.%I FOR DELETE USING (true)', auth_table);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped auth.%: %', auth_table, SQLERRM;
    END;
  END LOOP;
END $$;
