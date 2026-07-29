/*
  # Continuous Audit Assurance & Chain-Scope Hardening

  Chain boundary decision (Phase 1): in SafeBet IQ demo a user maps to exactly
  ONE casino (users.casino_id) — casino IS the tenant boundary (Outcome A).
  chain_scope = casino (uuid) or 'platform'.

  Adds: scope-aware authorisation, verification RUNS + CHECKPOINTS (distinct from
  the insertion chain head), independent integrity ALERTS, a scheduled verifier
  (pg_cron), a health read model, range verification, and break-glass hardening.
  The verifier stays read-only and never repairs.
*/

-- ── Phase 2: scope authorisation helper (mirrors principalMayAccessCasino) ──
create or replace function sbiq_may_access_chain_scope(p_scope text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select
    auth.uid() is null  -- internal (cron / service role, no JWT)
    or exists (
      select 1 from users u left join casinos c on c.id::text = p_scope
      where u.id = auth.uid() and coalesce(u.is_active, true)
        and ( u.role = 'super_admin'
          or (p_scope = 'platform' and u.role = 'national_regulator')
          or (u.role in ('casino_admin','compliance_officer') and u.casino_id::text = p_scope)
          or (u.role in ('national_regulator','regulator') and c.jurisdiction = u.jurisdiction)
          or (u.role = 'provincial_regulator' and c.jurisdiction = u.jurisdiction and c.province = u.province) )
    );
$$;
grant execute on function sbiq_may_access_chain_scope(text) to authenticated;

-- Scope-aware chain-head read (replaces the permissive policy).
drop policy if exists ach_read on audit_chain_head;
create policy ach_read on audit_chain_head for select to authenticated
  using (sbiq_may_access_chain_scope(chain_scope));

-- ── Phase 15: break-glass hardening ─────────────────────────────────────────
revoke update, delete on audit_events from authenticated, anon;
create or replace function sbiq_audit_events_immutable()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  -- Break-glass is honoured ONLY for the owner/service role AND only when the
  -- transaction-local flag is set (authorised backfill/repair). Ordinary users
  -- also lack update/delete grants, so this is defence in depth.
  if coalesce(current_setting('sbiq.audit_breakglass', true), '') = 'on'
     and current_user in ('postgres','service_role','supabase_admin','supabase_storage_admin') then
    return case when TG_OP = 'DELETE' then OLD else NEW end;
  end if;
  raise exception 'audit_events is append-only (op %, event %)', TG_OP, coalesce(OLD.event_id, NEW.event_id)
    using errcode = 'check_violation';
end $$;

-- ── Phase 4/7: verification runs + checkpoints + integrity alerts ───────────
create table if not exists audit_verification_run (
  id uuid primary key default gen_random_uuid(),
  run_id text not null,
  chain_scope text not null,
  mode text not null check (mode in ('incremental','full','range','manual','export-ref')),
  first_sequence bigint, last_sequence bigint, events_checked bigint,
  expected_head text, actual_head text,
  result text not null check (result in ('verified','broken','unavailable')),
  first_failing_sequence bigint, failure_reason text,
  started_at timestamptz not null default now(), completed_at timestamptz, duration_ms integer
);
create index if not exists idx_avr_scope_time on audit_verification_run (chain_scope, started_at desc);
alter table audit_verification_run enable row level security;
drop policy if exists avr_read on audit_verification_run;
create policy avr_read on audit_verification_run for select to authenticated using (sbiq_may_access_chain_scope(chain_scope));

-- Verification checkpoint: latest INDEPENDENTLY VERIFIED event (≠ chain head).
create table if not exists audit_chain_checkpoint (
  chain_scope text primary key,
  verified_through_sequence bigint not null,
  verified_head_hash text not null,
  verification_run_id text,
  result text not null,
  verifier_version text not null default 'sql-v1',
  verified_at timestamptz not null default now()
);
alter table audit_chain_checkpoint enable row level security;
drop policy if exists acc_read on audit_chain_checkpoint;
create policy acc_read on audit_chain_checkpoint for select to authenticated using (sbiq_may_access_chain_scope(chain_scope));

-- Independent integrity alert channel (NOT part of any chain).
create table if not exists platform_integrity_alert (
  id uuid primary key default gen_random_uuid(),
  chain_scope text not null, first_failing_sequence bigint, failure_category text,
  expected_hash text, actual_hash text, verification_run_id text, correlation_id text,
  severity text not null default 'critical', detected_at timestamptz not null default now(),
  resolved boolean not null default false
);
alter table platform_integrity_alert enable row level security;
drop policy if exists pia_read on platform_integrity_alert;
create policy pia_read on platform_integrity_alert for select to authenticated using (sbiq_may_access_chain_scope(chain_scope));

-- ── Phase 8: scope-checked full + range verification RPC ────────────────────
create or replace function sbiq_verify_audit_chain_range(p_scope text, p_from bigint default null, p_to bigint default null)
returns jsonb language plpgsql stable security definer set search_path to 'public','extensions' as $$
declare r record; v_prev text := repeat('0',64); v_seq bigint := 0; v_expected text; n bigint := 0; v_first bigint; v_last bigint;
begin
  if auth.uid() is not null and not sbiq_may_access_chain_scope(p_scope) then
    return jsonb_build_object('scope',p_scope,'status','unavailable','reason','not authorised for this chain scope');
  end if;
  -- Range verification still walks from genesis to preserve linkage, but only
  -- REPORTS the requested window; linkage/hash are checked throughout.
  for r in select * from audit_events where chain_scope = p_scope order by chain_sequence asc loop
    v_seq := v_seq + 1;
    if r.chain_sequence <> v_seq then
      return jsonb_build_object('scope',p_scope,'status','broken','events_checked',n,'first_failing_sequence',r.chain_sequence,'reason','sequence gap or duplicate'); end if;
    if r.previous_hash <> v_prev then
      return jsonb_build_object('scope',p_scope,'status','broken','events_checked',n,'first_failing_sequence',r.chain_sequence,'reason','previous_hash linkage broken'); end if;
    v_expected := sbiq_audit_event_hash('v1',p_scope,r.chain_sequence,r.previous_hash,r.event_id,r.event_type,r.user_id::text,r.user_role,r.casino_id::text,r.resource_type,r.resource_id,r.outcome,r.created_at,r.correlation_id,r.metadata);
    if r.hash <> v_expected then
      return jsonb_build_object('scope',p_scope,'status','broken','events_checked',n,'first_failing_sequence',r.chain_sequence,'reason','recomputed hash mismatch'); end if;
    if (p_from is null or r.chain_sequence >= p_from) and (p_to is null or r.chain_sequence <= p_to) then
      n := n + 1; if v_first is null then v_first := r.chain_sequence; end if; v_last := r.chain_sequence;
    end if;
    v_prev := r.hash;
  end loop;
  return jsonb_build_object('scope',p_scope,'status','verified','events_checked',n,
    'requested_from',p_from,'requested_to',p_to,'verified_from',v_first,'verified_to',v_last,
    'expected_head',v_prev,'verified_at',now());
end $$;
grant execute on function sbiq_verify_audit_chain_range(text,bigint,bigint) to authenticated;

-- Add scope-check to the existing verifier (internal cron bypasses via null uid).
create or replace function sbiq_verify_audit_chain(p_scope text)
returns jsonb language plpgsql stable security definer set search_path to 'public','extensions' as $$
declare r record; v_prev text := repeat('0',64); v_seq bigint := 0; v_expected text; n bigint := 0;
begin
  if auth.uid() is not null and not sbiq_may_access_chain_scope(p_scope) then
    return jsonb_build_object('scope',p_scope,'status','unavailable','reason','not authorised for this chain scope','verified_at',now());
  end if;
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

-- ── Phase 3/4/6: verification RUN (records run, advances checkpoint on success,
--    raises an INDEPENDENT integrity alert on failure — never repairs). ───────
create or replace function sbiq_run_audit_verification(p_mode text default 'incremental')
returns jsonb language plpgsql security definer set search_path to 'public','extensions' as $$
declare v_scope text; v_run text; v_res jsonb; v_start timestamptz; v_status text;
        v_verified int := 0; v_broken int := 0; v_total int := 0;
begin
  for v_scope in select chain_scope from audit_chain_head order by chain_scope loop
    v_total := v_total + 1;
    v_run := gen_random_uuid()::text; v_start := clock_timestamp();
    v_res := sbiq_verify_audit_chain(v_scope);   -- internal (no JWT) ⇒ no scope block
    v_status := v_res->>'status';
    insert into audit_verification_run (run_id, chain_scope, mode, last_sequence, events_checked,
      expected_head, actual_head, result, first_failing_sequence, failure_reason, started_at, completed_at, duration_ms)
    values (v_run, v_scope, p_mode, (v_res->>'last_sequence')::bigint, (v_res->>'events_checked')::bigint,
      v_res->>'expected_head', (select head_hash from audit_chain_head where chain_scope=v_scope), v_status,
      (v_res->>'first_failing_sequence')::bigint, v_res->>'reason', v_start, clock_timestamp(),
      round(extract(milliseconds from clock_timestamp()-v_start))::int);
    if v_status = 'verified' then
      v_verified := v_verified + 1;
      insert into audit_chain_checkpoint (chain_scope, verified_through_sequence, verified_head_hash, verification_run_id, result, verifier_version, verified_at)
      values (v_scope, (v_res->>'last_sequence')::bigint, v_res->>'expected_head', v_run, 'verified', 'sql-v1', now())
      on conflict (chain_scope) do update set verified_through_sequence=excluded.verified_through_sequence,
        verified_head_hash=excluded.verified_head_hash, verification_run_id=excluded.verification_run_id,
        result='verified', verified_at=now();
    else
      v_broken := v_broken + 1;
      -- Independent alert (NOT inserted into the failed chain); checkpoint NOT advanced.
      insert into platform_integrity_alert (chain_scope, first_failing_sequence, failure_category, verification_run_id, severity)
      values (v_scope, (v_res->>'first_failing_sequence')::bigint, v_res->>'reason', v_run, 'critical');
      update audit_chain_checkpoint set result='broken', verified_at=now() where chain_scope=v_scope;
    end if;
  end loop;
  return jsonb_build_object('mode',p_mode,'chains',v_total,'verified',v_verified,'broken',v_broken,'ran_at',now());
end $$;

-- ── Phase 4/5: verification health read model ───────────────────────────────
create or replace view projection_audit_verification_health as
select
  h.chain_scope,
  case when h.chain_scope='platform' then 'platform' else 'casino' end as boundary_type,
  h.chain_sequence as head_sequence, h.head_hash,
  cp.verified_through_sequence, cp.verified_head_hash, cp.result as checkpoint_result, cp.verified_at,
  (select max(started_at) from audit_verification_run r where r.chain_scope=h.chain_scope and r.mode='full' and r.result='verified') as last_full_verified_at,
  (select max(started_at) from audit_verification_run r where r.chain_scope=h.chain_scope and r.result='verified') as last_verified_at,
  case
    when cp.chain_scope is null then 'unavailable'
    when cp.result = 'broken' then 'broken'
    when cp.result='verified' and cp.verified_through_sequence = h.chain_sequence and cp.verified_at > now() - interval '1 day' then 'healthy'
    when cp.result='verified' and (cp.verified_through_sequence < h.chain_sequence or cp.verified_at <= now() - interval '1 day') then 'warning'
    else 'degraded'
  end as integrity_status
from audit_chain_head h
left join audit_chain_checkpoint cp on cp.chain_scope = h.chain_scope;
alter view projection_audit_verification_health set (security_invoker = true);