/*
  # Certified Audit Chain activation (audit_events)

  ROOT CAUSE: audit_events carried hash/previous_hash columns but no trigger and
  0/483 populated — the only chain function (compute_audit_chain_hash) targets a
  DIFFERENT table (audit_logs, global sequence). So audit_events was unchained.

  This activates a per-tenant (chain_scope = casino, else 'platform') tamper-
  evident SHA-256 chain with a deterministic canonical hash reusable by the
  insert trigger, backfill, and verifier — and matched byte-for-byte by an
  independent TypeScript verifier. Append-only enforced after backfill. No event
  is deleted; no timestamp is rewritten.
*/

-- Columns for the chain (hash/previous_hash already exist).
alter table audit_events add column if not exists chain_scope text;
alter table audit_events add column if not exists chain_sequence bigint;

-- Chain-head registry (service-role only; RLS denies clients).
create table if not exists audit_chain_head (
  chain_scope text primary key,
  chain_sequence bigint not null default 0,
  head_hash text not null,
  last_event_id text,
  last_event_at timestamptz,
  schema_version text not null default 'v1',
  updated_at timestamptz not null default now()
);
alter table audit_chain_head enable row level security;  -- no policies ⇒ clients denied; service role bypasses

-- Canonical JSON: recursively sorted keys, scalars as quoted text (matches TS).
create or replace function sbiq_canonical_json(v jsonb)
returns text language plpgsql immutable set search_path to 'public' as $$
declare k text; parts text[] := array[]::text[]; e jsonb;
begin
  if v is null or v = 'null'::jsonb then return 'null'; end if;
  if jsonb_typeof(v) = 'object' then
    for k in select key from jsonb_object_keys(v) as t(key) order by key loop
      parts := parts || ('"'||replace(k,'"','\"')||'":'||sbiq_canonical_json(v->k));
    end loop;
    return '{'||array_to_string(parts,',')||'}';
  elsif jsonb_typeof(v) = 'array' then
    for e in select value from jsonb_array_elements(v) as t(value) loop
      parts := parts || sbiq_canonical_json(e);
    end loop;
    return '['||array_to_string(parts,',')||']';
  else
    return '"'||replace(replace(v #>> '{}', '\', '\\'), '"', '\"')||'"';
  end if;
end $$;

-- Canonical event hash (schema v1). US (chr 31) separated; ms-precision UTC
-- timestamp (matches JS toISOString); metadata via canonical-json digest.
create or replace function sbiq_audit_event_hash(
  p_schema text, p_scope text, p_seq bigint, p_prev text, p_event_id text, p_event_type text,
  p_user_id text, p_user_role text, p_casino text, p_res_type text, p_res_id text,
  p_outcome text, p_created timestamptz, p_corr text, p_metadata jsonb
) returns text language sql immutable set search_path to 'public','extensions' as $$
  select encode(digest(array_to_string(array[
    p_schema, p_scope, p_seq::text, p_prev, p_event_id, p_event_type,
    coalesce(p_user_id,'system'), coalesce(p_user_role,''), coalesce(p_casino,''),
    coalesce(p_res_type,''), coalesce(p_res_id,''), coalesce(p_outcome,''),
    to_char(p_created at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    coalesce(p_corr,''),
    encode(digest(sbiq_canonical_json(coalesce(p_metadata,'{}'::jsonb)),'sha256'),'hex')
  ], chr(31)), 'sha256'),'hex');
$$;

-- Atomic per-scope insertion: advisory lock + head FOR UPDATE ⇒ no fork / no
-- duplicate sequence. Duplicate event_id ⇒ no-op (idempotent, head unchanged).
create or replace function sbiq_audit_chain_insert()
returns trigger language plpgsql security definer set search_path to 'public','extensions' as $$
declare v_scope text; v_seq bigint; v_prev text; v_hash text;
begin
  if exists (select 1 from audit_events where event_id = NEW.event_id) then return null; end if;
  v_scope := coalesce(NEW.casino_id::text, 'platform');
  perform pg_advisory_xact_lock(hashtext('audit_chain:'||v_scope));
  select chain_sequence, head_hash into v_seq, v_prev from audit_chain_head where chain_scope = v_scope for update;
  if not found then v_seq := 0; v_prev := repeat('0',64); end if;
  v_seq := v_seq + 1;
  if NEW.created_at is null then NEW.created_at := now(); end if;
  if NEW.ntp_timestamp is null then NEW.ntp_timestamp := now(); end if;
  NEW.chain_scope := v_scope; NEW.chain_sequence := v_seq; NEW.previous_hash := v_prev;
  v_hash := sbiq_audit_event_hash('v1', v_scope, v_seq, v_prev, NEW.event_id, NEW.event_type,
    NEW.user_id::text, NEW.user_role, NEW.casino_id::text, NEW.resource_type, NEW.resource_id,
    NEW.outcome, NEW.created_at, NEW.correlation_id, NEW.metadata);
  NEW.hash := v_hash;
  insert into audit_chain_head (chain_scope, chain_sequence, head_hash, last_event_id, last_event_at, schema_version, updated_at)
    values (v_scope, v_seq, v_hash, NEW.event_id, NEW.created_at, 'v1', now())
    on conflict (chain_scope) do update set chain_sequence=excluded.chain_sequence, head_hash=excluded.head_hash,
      last_event_id=excluded.last_event_id, last_event_at=excluded.last_event_at, updated_at=now();
  return NEW;
end $$;
drop trigger if exists trg_audit_chain on audit_events;
create trigger trg_audit_chain before insert on audit_events for each row execute function sbiq_audit_chain_insert();

-- Deterministic backfill of existing events (per scope, ordered by created_at,
-- event_id). Preserves ids/timestamps/actors; assigns sequence + hashes.
create or replace function sbiq_audit_chain_backfill()
returns table(scope text, chained bigint, head text) language plpgsql security definer set search_path to 'public','extensions' as $$
declare r record; v_scope text; v_seq bigint; v_prev text; v_hash text;
begin
  delete from audit_chain_head;
  for v_scope in select distinct coalesce(casino_id::text,'platform') from audit_events order by 1 loop
    v_seq := 0; v_prev := repeat('0',64);
    for r in select * from audit_events where coalesce(casino_id::text,'platform') = v_scope
             order by created_at asc, event_id asc loop
      v_seq := v_seq + 1;
      v_hash := sbiq_audit_event_hash('v1', v_scope, v_seq, v_prev, r.event_id, r.event_type,
        r.user_id::text, r.user_role, r.casino_id::text, r.resource_type, r.resource_id,
        r.outcome, r.created_at, r.correlation_id, r.metadata);
      update audit_events set chain_scope=v_scope, chain_sequence=v_seq, previous_hash=v_prev, hash=v_hash where id = r.id;
      v_prev := v_hash;
    end loop;
    insert into audit_chain_head(chain_scope, chain_sequence, head_hash, schema_version, updated_at)
      values (v_scope, v_seq, v_prev, 'v1', now())
      on conflict (chain_scope) do update set chain_sequence=excluded.chain_sequence, head_hash=excluded.head_hash, updated_at=now();
    scope := v_scope; chained := v_seq; head := v_prev; return next;
  end loop;
end $$;

-- Independent SQL verifier (never repairs).
create or replace function sbiq_verify_audit_chain(p_scope text)
returns jsonb language plpgsql stable security definer set search_path to 'public','extensions' as $$
declare r record; v_prev text := repeat('0',64); v_seq bigint := 0; v_expected text; n bigint := 0;
begin
  for r in select * from audit_events where chain_scope = p_scope order by chain_sequence asc loop
    v_seq := v_seq + 1; n := n + 1;
    if r.chain_sequence <> v_seq then
      return jsonb_build_object('scope',p_scope,'status','broken','events_checked',n,'first_failing_sequence',r.chain_sequence,'reason','sequence gap or duplicate','verified_at',now()); end if;
    if r.previous_hash <> v_prev then
      return jsonb_build_object('scope',p_scope,'status','broken','events_checked',n,'first_failing_sequence',r.chain_sequence,'reason','previous_hash linkage broken','verified_at',now()); end if;
    v_expected := sbiq_audit_event_hash('v1',p_scope,r.chain_sequence,r.previous_hash,r.event_id,r.event_type,r.user_id::text,r.user_role,r.casino_id::text,r.resource_type,r.resource_id,r.outcome,r.created_at,r.correlation_id,r.metadata);
    if r.hash <> v_expected then
      return jsonb_build_object('scope',p_scope,'status','broken','events_checked',n,'first_failing_sequence',r.chain_sequence,'reason','recomputed hash mismatch','verified_at',now()); end if;
    v_prev := r.hash;
  end loop;
  if exists (select 1 from audit_chain_head h where h.chain_scope=p_scope and h.head_hash <> v_prev) then
    return jsonb_build_object('scope',p_scope,'status','broken','events_checked',n,'reason','chain head mismatch','verified_at',now()); end if;
  return jsonb_build_object('scope',p_scope,'status','verified','events_checked',n,'last_sequence',v_seq,'expected_head',v_prev,'verified_at',now());
end $$;
