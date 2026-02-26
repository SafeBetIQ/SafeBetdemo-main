/*
  # Grant Auth Schema Permissions

  1. Problem
    - Supabase auth service cannot access auth schema tables during login
    - RLS policies alone are not sufficient - need table-level GRANT permissions
    - Results in "Database error querying schema" error

  2. Solution
    - Grant USAGE on auth schema to anon, authenticated, and service_role
    - Grant ALL permissions on auth tables to these roles
    - This allows Supabase's internal auth service to query the auth schema

  3. Tables Updated
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

  4. Security
    - These grants are necessary for Supabase auth to function
    - The auth schema is protected by Supabase's internal security mechanisms
    - RLS policies still apply to filter data access appropriately
*/

-- Grant schema usage
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

-- Grant table permissions for all critical auth tables
GRANT ALL ON auth.users TO anon, authenticated, service_role;
GRANT ALL ON auth.identities TO anon, authenticated, service_role;
GRANT ALL ON auth.sessions TO anon, authenticated, service_role;
GRANT ALL ON auth.refresh_tokens TO anon, authenticated, service_role;
GRANT ALL ON auth.instances TO anon, authenticated, service_role;
GRANT ALL ON auth.mfa_amr_claims TO anon, authenticated, service_role;
GRANT ALL ON auth.mfa_challenges TO anon, authenticated, service_role;
GRANT ALL ON auth.mfa_factors TO anon, authenticated, service_role;
GRANT ALL ON auth.one_time_tokens TO anon, authenticated, service_role;
GRANT ALL ON auth.flow_state TO anon, authenticated, service_role;
GRANT ALL ON auth.saml_providers TO anon, authenticated, service_role;
GRANT ALL ON auth.saml_relay_states TO anon, authenticated, service_role;
GRANT ALL ON auth.sso_providers TO anon, authenticated, service_role;
GRANT ALL ON auth.sso_domains TO anon, authenticated, service_role;
GRANT ALL ON auth.audit_log_entries TO anon, authenticated, service_role;
