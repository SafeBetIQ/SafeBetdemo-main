
/*
  # Fix Auth Identity Email Mismatches

  ## Problem
  Several auth.identities records have stale email values in identity_data that don't match
  the current auth.users email. Supabase uses identity_data.email for login matching,
  causing login failures even though passwords are correct.

  ## Changes
  - Update identity_data emails to match auth.users emails for all affected accounts
  - Affected: superadmin@safebetiq.com, admin@royalpalace.safebetiq.com, and any others
*/

UPDATE auth.identities
SET identity_data = jsonb_set(identity_data, '{email}', to_jsonb(u.email))
FROM auth.users u
WHERE auth.identities.user_id = u.id
  AND auth.identities.provider = 'email'
  AND (auth.identities.identity_data->>'email') IS DISTINCT FROM u.email;
