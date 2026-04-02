/*
  # Grant supabase_auth_admin full access to auth schema tables

  1. Problem
    - "Database error querying schema" during login
    - supabase_auth_admin role (used by GoTrue auth service) lacks table privileges
    - auth.schema_migrations only grants SELECT to postgres, not supabase_auth_admin

  2. Solution
    - Grant ALL privileges on all auth schema tables to supabase_auth_admin
    - Grant USAGE on auth schema to supabase_auth_admin
    - This restores the standard Supabase auth service permissions
*/

GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;

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
      EXECUTE format('GRANT ALL ON auth.%I TO supabase_auth_admin', auth_table);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not grant on auth.%: %', auth_table, SQLERRM;
    END;
  END LOOP;
END $$;
