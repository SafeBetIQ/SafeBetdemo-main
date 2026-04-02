
/*
  # Fix supabase_auth_admin grants on auth schema tables

  ## Problem
  A previous migration stripped supabase_auth_admin down to SELECT-only on
  auth.sessions, auth.refresh_tokens, auth.audit_log_entries, auth.identities,
  and other auth tables. GoTrue connects as supabase_auth_admin to INSERT new
  sessions and refresh tokens on every login — without INSERT/UPDATE/DELETE
  it throws "Database error querying schema".

  ## Fix
  Restore full privileges to supabase_auth_admin on all auth schema tables
  it needs to operate.
*/

-- Restore INSERT/UPDATE/DELETE to supabase_auth_admin on critical auth tables
GRANT INSERT, UPDATE, DELETE ON auth.sessions TO supabase_auth_admin;
GRANT INSERT, UPDATE, DELETE ON auth.refresh_tokens TO supabase_auth_admin;
GRANT INSERT, UPDATE, DELETE ON auth.audit_log_entries TO supabase_auth_admin;
GRANT INSERT, UPDATE, DELETE ON auth.users TO supabase_auth_admin;
GRANT INSERT, UPDATE, DELETE ON auth.identities TO supabase_auth_admin;
GRANT INSERT, UPDATE, DELETE ON auth.mfa_factors TO supabase_auth_admin;
GRANT INSERT, UPDATE, DELETE ON auth.mfa_challenges TO supabase_auth_admin;
GRANT INSERT, UPDATE, DELETE ON auth.mfa_amr_claims TO supabase_auth_admin;
GRANT INSERT, UPDATE, DELETE ON auth.flow_state TO supabase_auth_admin;
GRANT INSERT, UPDATE, DELETE ON auth.one_time_tokens TO supabase_auth_admin;
GRANT INSERT, UPDATE, DELETE ON auth.saml_providers TO supabase_auth_admin;
GRANT INSERT, UPDATE, DELETE ON auth.saml_relay_states TO supabase_auth_admin;
GRANT INSERT, UPDATE, DELETE ON auth.sso_providers TO supabase_auth_admin;
GRANT INSERT, UPDATE, DELETE ON auth.sso_domains TO supabase_auth_admin;
GRANT INSERT, UPDATE, DELETE ON auth.instances TO supabase_auth_admin;
GRANT INSERT, UPDATE, DELETE ON auth.schema_migrations TO supabase_auth_admin;

-- Ensure sequence access too
GRANT USAGE ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;
