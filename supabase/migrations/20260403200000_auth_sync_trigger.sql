/*
  # Auth → public.users Sync Trigger

  Creates a trigger that automatically creates a public.users record every time
  a new user is added to auth.users.  This is the Supabase-recommended pattern
  for keeping an application profile table in sync with the auth layer.

  The trigger is safe to run on an existing project:
  - Uses ON CONFLICT DO NOTHING so it never clobbers existing rows.
  - If the auth user carries role/casino_id in raw_user_meta_data those values
    are honoured; otherwise safe defaults are applied.
  - password_hash is set to an unusable bcrypt stub — auth is handled
    exclusively by Supabase Auth (auth.users.encrypted_password).
*/

-- ── Trigger function ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    full_name,
    role,
    casino_id,
    is_active,
    password_hash,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    ),
    COALESCE(
      new.raw_user_meta_data->>'role',
      'casino_admin'
    )::user_role,
    CASE
      WHEN (new.raw_user_meta_data->>'casino_id') IS NOT NULL
        AND (new.raw_user_meta_data->>'casino_id') <> ''
      THEN (new.raw_user_meta_data->>'casino_id')::uuid
      ELSE NULL
    END,
    true,
    -- unusable stub hash — real auth handled by auth.users.encrypted_password
    -- Static non-matchable stub. public.users.password_hash is never
    -- checked during login — auth is handled by auth.users.encrypted_password.
    -- Avoids a pgcrypto dependency (gen_salt not guaranteed in search_path).
    '__no_password_set__',
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

-- ── Trigger on auth.users INSERT ─────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- ── Backfill: ensure every existing auth user has a public.users row ─────────
-- Safe because of ON CONFLICT DO NOTHING — existing rows are untouched.
INSERT INTO public.users (
  id, email, full_name, role, casino_id, is_active, password_hash, created_at, updated_at
)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
  COALESCE(au.raw_user_meta_data->>'role', 'casino_admin')::user_role,
  NULL,
  true,
  '__no_password_set__',
  au.created_at,
  now()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.id = au.id
);
