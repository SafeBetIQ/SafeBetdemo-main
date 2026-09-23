# SafeBet Guardian — Backup & Recovery (ARCH-V4-PR2 §62, ISO 22301)

The dedicated Guardian project provides an independent backup/recovery boundary (Supabase managed daily backups + point-in-time within plan limits on Pro). Recovery is independent of SafeBet IQ.

- Backups: provider-managed for the dedicated Guardian project only; no shared-fate with IQ after cutover.
- The authoritative reconstruction path is repository-driven: the 23 `arch_v4` migrations rebuild the schema and a controlled data copy restores synthetic state — so the database is reproducible from source + the retained legacy source, independent of provider backups.
- Retained legacy Guardian data on the shared DB remains an additional rollback source during the transition window.
- Monitoring: the dedicated project has its own dashboards/quota. The free-tier DB-size pressure that drove the shared-DB "DB Size Exceeded" grace period is an **IQ event-log volume issue** (~665 MB of `casino_event_log` partitions) and does **not** apply to the ~5 MB Guardian database; the approved Supabase Pro upgrade (8 GB/project) resolves it before 19 Oct 2026.
