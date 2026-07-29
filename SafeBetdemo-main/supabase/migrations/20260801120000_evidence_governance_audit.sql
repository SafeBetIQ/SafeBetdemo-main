/*
  # Evidence & Governance audit integration

  Records financial/activity GOVERNANCE changes in the EXISTING audit_events
  hash chain (no parallel audit framework):
    * financial capability profile changes
    * shift-policy changes
    * session-lifecycle policy changes
    * synthetic financial seeding

  Volume control (Phase 10): these are configuration/administrative operations
  (low frequency) → one audit event per operation. Per-row automatic
  supersession is deliberately NOT audited row-by-row (that would flood); the
  per-row evidence remains in projection_session_state.ended_reason='superseded'.
  Evidence ACCESS/EXPORT events are written by the evidence-gateway (view events
  dedupe per hour via the unique event_id).
*/

create or replace function sbiq_audit_config_change()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into audit_events (
    event_id, event_type, event_category, action, resource_type, resource_id,
    casino_id, description, old_value, new_value, severity, outcome, metadata)
  values (
    'cfg:'||TG_TABLE_NAME||':'||gen_random_uuid()::text,
    upper(TG_TABLE_NAME)||'_'||TG_OP,
    'governance', lower(TG_OP), TG_TABLE_NAME,
    coalesce(NEW.casino_id::text, 'platform'), NEW.casino_id,
    TG_TABLE_NAME||' '||lower(TG_OP),
    case when TG_OP='UPDATE' then to_jsonb(OLD) else null end,
    to_jsonb(NEW), 'info', 'success',
    jsonb_build_object('table', TG_TABLE_NAME, 'scope', NEW.scope));
  return NEW;
end $$;

drop trigger if exists trg_audit_fsc on financial_source_capability;
create trigger trg_audit_fsc after insert or update on financial_source_capability
  for each row execute function sbiq_audit_config_change();

drop trigger if exists trg_audit_fsp on financial_shift_policy;
create trigger trg_audit_fsp after insert or update on financial_shift_policy
  for each row execute function sbiq_audit_config_change();

drop trigger if exists trg_audit_slp on session_lifecycle_policy;
create trigger trg_audit_slp after insert or update on session_lifecycle_policy
  for each row execute function sbiq_audit_config_change();

-- Synthetic financial seeding emits ONE governance audit event per call.
create or replace function sbiq_seed_demo_financials(p_casino uuid, p_player text default 'SB-PLR-859D2993145EFF36E3FC3986')
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  spec record; n int := 0;
begin
  for spec in
    select * from (values
      ('10 minutes'::interval, 250::numeric, 0::numeric,   'shift-1'),
      ('35 minutes'::interval, 500::numeric, 180::numeric, 'shift-2'),
      ('90 minutes'::interval, 300::numeric, 300::numeric, 'today-1'),
      ('6 hours'::interval,    750::numeric, 200::numeric, 'today-2'),
      ('3 days'::interval,     400::numeric, 0::numeric,   'mtd-1'),
      ('12 days'::interval,    600::numeric, 950::numeric, 'mtd-2')
    ) as t(off_ago, stake, win, tag)
  loop
    insert into casino_event_log (event_id, correlation_id, trace_id, tenant_id, casino_id, jurisdiction,
      safebet_player_id, session_id, machine_id, producer, schema_version, event_type,
      occurred_at, received_at, processed_at, replay_number, dedupe_key, payload)
    values (
      md5('sbiq-fin-demo:'||p_casino::text||':'||spec.tag)::uuid,
      'fin-demo', '11111111-1111-4111-8111-111111111111', p_casino, p_casino, 'ZA',
      p_player, 'fin-demo-session', 'M-001', 'sbiq-demo-fin-sim', 1, 'BET_PLACED',
      now() - spec.off_ago, now(), now(), 0,
      'fin-demo:'||p_casino::text||':'||spec.tag,
      jsonb_build_object('bet_amount', spec.stake, 'win_amount', spec.win,
        'currency','ZAR','game_type','slots','is_simulated', true, 'synthetic', true))
    on conflict do nothing;
    n := n + 1;
  end loop;
  insert into audit_events (event_id, event_type, event_category, action, resource_type, resource_id,
    casino_id, description, severity, outcome, metadata)
  values ('seed:'||p_casino::text||':'||gen_random_uuid()::text, 'SYNTHETIC_FINANCIAL_SEED', 'governance',
    'seed', 'financial.synthetic', p_casino::text, p_casino,
    'synthetic financial events seeded (demo)', 'notice', 'success',
    jsonb_build_object('events', n, 'player', p_player));
  return n;
end $$;
