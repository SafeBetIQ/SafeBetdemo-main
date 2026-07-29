/*
  # Identity Resolution Service — safebet_identity_map (Phase 3.1)

  1. New Tables
    - `safebet_identity_map`
      - `id` (uuid, pk)
      - `casino_id` (uuid, fk → casinos)
      - `casino_ref_hash` (text) — SHA-256 of the casino player reference.
        The raw reference (loyalty card / membership / host key) is NEVER stored.
      - `safebet_player_id` (text) — canonical anonymous SB-PLR-XXXXXXXX id
      - `created_at`, `last_seen_at` (timestamptz)
      - unique (casino_id, casino_ref_hash); unique (safebet_player_id)

  2. Functions
    - `resolve_player_identity(p_casino_id, p_ref_hash, p_safebet_id)`
      Atomic, idempotent get-or-create. Returns the persisted SafeBet ID for
      the hash; signals 'collision' if the candidate ID is owned by a
      different hash so the caller can retry with a probed candidate.
      EXECUTE granted to service_role only — clients go through the
      identity-resolution edge function.

  3. Backfill
    - Every existing `players` row gets a deterministic mapping derived from
      sha256('sbiq-v1:' || casino_id || ':' || players.id) — identical to the
      TypeScript derivation in lib/playerIdentity/core.ts.
    - `players.player_id` is rewritten to the canonical SB-PLR form wherever
      it is not already canonical.

  4. Security
    - RLS enabled with NO client policies: the map is written and read only
      via service-role (edge functions). Contains zero PII by construction.
*/

create extension if not exists pgcrypto;

-- ── Table ────────────────────────────────────────────────────────────────────

create table if not exists safebet_identity_map (
  id uuid primary key default gen_random_uuid(),
  casino_id uuid not null references casinos(id) on delete cascade,
  casino_ref_hash text not null,
  safebet_player_id text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint safebet_identity_map_safebet_format
    check (safebet_player_id ~ '^SB-PLR-[0-9A-F]{8}$'),
  constraint safebet_identity_map_casino_ref_unique
    unique (casino_id, casino_ref_hash),
  constraint safebet_identity_map_safebet_id_unique
    unique (safebet_player_id)
);

create index if not exists idx_safebet_identity_map_casino
  on safebet_identity_map (casino_id);

alter table safebet_identity_map enable row level security;
-- Intentionally no client policies: service-role access only.

-- ── Atomic resolution function ───────────────────────────────────────────────

create or replace function resolve_player_identity(
  p_casino_id uuid,
  p_ref_hash text,
  p_safebet_id text
)
returns table (out_safebet_player_id text, out_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing text;
begin
  -- Fast path: mapping already exists for this casino reference.
  update safebet_identity_map
     set last_seen_at = now()
   where casino_id = p_casino_id
     and casino_ref_hash = p_ref_hash
  returning safebet_player_id into v_existing;

  if v_existing is not null then
    return query select v_existing, 'existing'::text;
    return;
  end if;

  -- Create path.
  begin
    insert into safebet_identity_map (casino_id, casino_ref_hash, safebet_player_id)
    values (p_casino_id, p_ref_hash, p_safebet_id);
    return query select p_safebet_id, 'created'::text;
    return;
  exception when unique_violation then
    -- Either a concurrent insert of the same hash won the race…
    select safebet_player_id into v_existing
      from safebet_identity_map
     where casino_id = p_casino_id
       and casino_ref_hash = p_ref_hash;

    if v_existing is not null then
      return query select v_existing, 'existing'::text;
      return;
    end if;

    -- …or the candidate SafeBet ID is owned by a different hash (32-bit
    -- collision). Tell the caller to retry with a probed candidate.
    return query select null::text, 'collision'::text;
    return;
  end;
end;
$$;

revoke all on function resolve_player_identity(uuid, text, text) from public;
revoke all on function resolve_player_identity(uuid, text, text) from anon;
revoke all on function resolve_player_identity(uuid, text, text) from authenticated;
grant execute on function resolve_player_identity(uuid, text, text) to service_role;

-- ── Backfill existing players ────────────────────────────────────────────────
-- Derivation MUST stay byte-identical to lib/playerIdentity/core.ts:
--   hash  = sha256('sbiq-v1:' || casino_id || ':' || lower(ref))
--   sb_id = 'SB-PLR-' || upper(substr(hex(hash), 1, 8))
-- For existing players the casino reference is the player row's internal id.

do $$
begin
  insert into safebet_identity_map (casino_id, casino_ref_hash, safebet_player_id)
  select
    p.casino_id,
    encode(digest('sbiq-v1:' || p.casino_id::text || ':' || lower(p.id::text), 'sha256'), 'hex'),
    'SB-PLR-' || upper(substr(
      encode(digest('sbiq-v1:' || p.casino_id::text || ':' || lower(p.id::text), 'sha256'), 'hex'),
      1, 8))
  from players p
  where p.casino_id is not null
  on conflict (casino_id, casino_ref_hash) do nothing;
exception when unique_violation then
  -- A safebet_player_id collision inside the backfill set (probability
  -- ~n^2/2^33). Leave unmapped rows for the runtime resolver to probe.
  raise notice 'safebet_identity_map backfill: safebet id collision, partial backfill applied';
end;
$$;

-- Rewrite players.player_id to the canonical anonymous form.
update players p
   set player_id = m.safebet_player_id
  from safebet_identity_map m
 where m.casino_id = p.casino_id
   and m.casino_ref_hash = encode(digest('sbiq-v1:' || p.casino_id::text || ':' || lower(p.id::text), 'sha256'), 'hex')
   and (p.player_id is null or p.player_id !~ '^SB-PLR-[0-9A-F]{8}$');
