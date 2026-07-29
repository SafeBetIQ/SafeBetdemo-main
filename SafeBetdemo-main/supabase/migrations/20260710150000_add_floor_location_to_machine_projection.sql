/*
  # Projection v2 — materialize gaming-floor location (Phase 3.4)

  The Enterprise Casino Digital Twin models gaming floors. Floor location is
  an EVENT FACT (payload.metadata.casino_floor_location, recorded by the
  producer) — so it is materialized by the machine projection, never derived
  or calculated downstream. The Digital Twin merely groups the SAME machine
  read models by this column.

  Existing rows backfill automatically on the next projection rebuild
  (projections are disposable; the event log is truth).
*/

alter table projection_machine_state
  add column if not exists floor_location text;

comment on column projection_machine_state.floor_location is
  'Gaming-floor zone recorded on the event (metadata.casino_floor_location). Materialized fact — never derived.';
