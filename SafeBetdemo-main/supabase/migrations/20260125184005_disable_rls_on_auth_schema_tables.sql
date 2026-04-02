/*
  # Disable RLS on Auth Schema Tables

  1. Problem
    - Auth schema tables have RLS enabled, causing "Database error querying schema"
    - Supabase's internal auth service cannot query auth tables when RLS is enabled
    - The auth schema is managed by Supabase and should NOT have RLS

  2. Solution
    - Disable RLS on all auth schema tables
    - Drop all RLS policies we previously created
    - The auth schema is protected by Supabase's internal security mechanisms

  3. Tables Fixed
    - auth.users
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
    - Disabling RLS on auth schema is the correct approach
    - Auth schema is managed and secured by Supabase internally
    - This is the standard Supabase configuration
*/

-- Disable RLS and drop policies for all auth tables
DO $$ 
DECLARE
  auth_table TEXT;
  auth_tables TEXT[] := ARRAY[
    'users',
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
    BEGIN
      -- Drop all policies on the table
      EXECUTE format('DROP POLICY IF EXISTS "Allow auth service to select %I" ON auth.%I', auth_table, auth_table);
      EXECUTE format('DROP POLICY IF EXISTS "Allow auth service to insert %I" ON auth.%I', auth_table, auth_table);
      EXECUTE format('DROP POLICY IF EXISTS "Allow auth service to update %I" ON auth.%I', auth_table, auth_table);
      EXECUTE format('DROP POLICY IF EXISTS "Allow auth service to delete %I" ON auth.%I', auth_table, auth_table);
      
      -- Disable RLS on the table
      EXECUTE format('ALTER TABLE auth.%I DISABLE ROW LEVEL SECURITY', auth_table);
      
      RAISE NOTICE 'Disabled RLS on auth.%', auth_table;
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Cannot modify % - insufficient privileges', auth_table;
      WHEN OTHERS THEN
        RAISE NOTICE 'Error modifying %: %', auth_table, SQLERRM;
    END;
  END LOOP;
END $$;
