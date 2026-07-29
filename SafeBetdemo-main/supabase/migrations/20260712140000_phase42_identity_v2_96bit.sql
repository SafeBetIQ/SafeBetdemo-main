/*
  # Phase 4.2 — Enterprise Identity Integrity & Evolution (ADR-001)
  Closes certification condition C3: SB-PLR widened from 32-bit (8 hex) to the
  96-bit production standard (24 hex, sha256-v2). Collision probability at
  1e9 identities falls from ~2.7e-2 to ~6.3e-12.

  Backward-compatible by construction: a v1 id is the exact PREFIX of its v2
  id (same SHA-256 preimage 'sbiq-v1:<casino>:<ref>', wider truncation). The
  check constraints below accept BOTH widths so historical events replay and
  any legacy id continues to validate (Constitution §9 — additive).

  Data is demonstration-only, so the synthetic identity map, event log, and
  projections are disposed for a clean, deterministic v2 reseed. No production
  data exists. Projections are disposable and rebuild from the event log; the
  event log reseeds from the casino-simulator producer under sha256-v2.
*/

-- ── 1. Widen the id format constraints (accept v1 8-hex OR v2 24-hex) ─────────

alter table safebet_identity_map  drop constraint if exists safebet_identity_map_safebet_format;
alter table safebet_identity_map
  add constraint safebet_identity_map_safebet_format
  check (safebet_player_id ~ '^SB-PLR-[0-9A-F]{8}([0-9A-F]{16})?$');

alter table casino_event_log      drop constraint if exists casino_event_log_safebet_player_id_check;
alter table casino_event_log
  add constraint casino_event_log_safebet_player_id_check
  check (safebet_player_id ~ '^SB-PLR-[0-9A-F]{8}([0-9A-F]{16})?$');

alter table projection_player_state drop constraint if exists projection_player_state_safebet_player_id_check;
alter table projection_player_state
  add constraint projection_player_state_safebet_player_id_check
  check (safebet_player_id ~ '^SB-PLR-[0-9A-F]{8}([0-9A-F]{16})?$');

-- ── 2. Dispose synthetic identities + events + projections (demo data only) ──
-- Deterministic and fully repeatable: the same references reseed to the same
-- v2 ids. Order respects FKs (projections/events reference no identity FK, so
-- order is not constrained, but we clear derived state first).

truncate table projection_player_state;
truncate table projection_session_state;
truncate table projection_machine_state;
truncate table casino_event_log;
truncate table safebet_identity_map;

comment on table safebet_identity_map is
  'Anonymous per-casino identity map. Production standard: sha256-v2 (96-bit, 24 hex). Legacy sha256-v1 (8 hex) ids remain valid for historical replay. See ADR-001.';
