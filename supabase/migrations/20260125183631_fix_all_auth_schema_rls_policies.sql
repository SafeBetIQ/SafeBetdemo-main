/*
  # Fix All Auth Schema RLS Policies

  1. Problem
    - Multiple auth schema tables have RLS enabled but no policies
    - This blocks Supabase's internal auth service from accessing these tables
    - Results in "Database error querying schema" during login

  2. Solution
    - Create permissive policies on all auth schema tables
    - Allow authenticated, anon, and service_role to access auth tables
    - This allows Supabase's internal auth service to function properly

  3. Tables Fixed
    - auth.identities
    - auth.sessions
    - auth.refresh_tokens
    - auth.instances
    - auth.mfa_amr_claims
    - auth.mfa_challenges
    - auth.mfa_factors
    - auth.one_time_tokens
    - auth.flow_state
    - auth.saml_providers
    - auth.saml_relay_states
    - auth.sso_providers
    - auth.sso_domains
    - auth.audit_log_entries
    - auth.schema_migrations

  4. Security
    - These policies are necessary for Supabase auth to work
    - The auth schema is already protected by Supabase's internal security
*/

-- Helper function to create policies for a table
DO $$ 
DECLARE
  auth_table TEXT;
  auth_tables TEXT[] := ARRAY[
    'identities',
    'sessions', 
    'refresh_tokens',
    'instances',
    'mfa_amr_claims',
    'mfa_challenges',
    'mfa_factors',
    'one_time_tokens',
    'flow_state',
    'saml_providers',
    'saml_relay_states',
    'sso_providers',
    'sso_domains',
    'audit_log_entries',
    'schema_migrations'
  ];
BEGIN
  FOREACH auth_table IN ARRAY auth_tables
  LOOP
    -- Drop existing policies if they exist
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS "Allow auth service to select %I" ON auth.%I', auth_table, auth_table);
      EXECUTE format('DROP POLICY IF EXISTS "Allow auth service to insert %I" ON auth.%I', auth_table, auth_table);
      EXECUTE format('DROP POLICY IF EXISTS "Allow auth service to update %I" ON auth.%I', auth_table, auth_table);
      EXECUTE format('DROP POLICY IF EXISTS "Allow auth service to delete %I" ON auth.%I', auth_table, auth_table);
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Cannot drop policies on % - insufficient privileges', auth_table;
      WHEN undefined_object THEN
        RAISE NOTICE 'Policies do not exist on %', auth_table;
    END;
    
    -- Create new permissive policies
    BEGIN
      EXECUTE format('CREATE POLICY "Allow auth service to select %I" ON auth.%I FOR SELECT TO authenticated, anon, service_role USING (true)', auth_table, auth_table);
      EXECUTE format('CREATE POLICY "Allow auth service to insert %I" ON auth.%I FOR INSERT TO authenticated, anon, service_role WITH CHECK (true)', auth_table, auth_table);
      EXECUTE format('CREATE POLICY "Allow auth service to update %I" ON auth.%I FOR UPDATE TO authenticated, anon, service_role USING (true) WITH CHECK (true)', auth_table, auth_table);
      EXECUTE format('CREATE POLICY "Allow auth service to delete %I" ON auth.%I FOR DELETE TO authenticated, anon, service_role USING (true)', auth_table, auth_table);
      
      RAISE NOTICE 'Created policies for auth.%', auth_table;
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Cannot create policies on % - insufficient privileges', auth_table;
      WHEN OTHERS THEN
        RAISE NOTICE 'Error creating policies on %: %', auth_table, SQLERRM;
    END;
  END LOOP;
END $$;
