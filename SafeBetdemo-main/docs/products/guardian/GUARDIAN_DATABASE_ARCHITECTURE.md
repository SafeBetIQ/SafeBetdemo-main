# SafeBet Guardian — Database Architecture (ARCH-V4-PR2)

Target: Guardian runs on an independently governed non-production PostgreSQL database, separate from SafeBet IQ.

- **Source (current, shared):** Supabase project `SafeBet Demo` `uexdjngogzunjxkpxwll` (us-west-2) — shared with SafeBet IQ. Guardian schema footprint ~5.3 MB / 110 tables / 437 synthetic rows.
- **Target (dedicated):** Supabase project `SafeBet Guardian - Demo` (eu-west-1, Micro, NON-PRODUCTION, synthetic only). Own endpoint, credentials, roles, secrets, migration ledger, backup/recovery, monitoring and ownership.
- **Boundary proof:** 0 foreign keys from `guardian` to any non-guardian schema; 0 references to `public`/IQ tables. Guardian reconstructs cleanly from its own 23 `arch_v4` migrations.
- **Runtime:** Guardian API + 10 workers connect ONLY to the dedicated Guardian DB after cutover. No dblink, no postgres_fdw, no cross-project query, no IQ DB secret, no hidden fallback.
- **SafeBet IQ:** remains on `uexdjngogzunjxkpxwll` (Demo) and `ilibvipqbkugqkppzdmh` (Production), unchanged. PR2 is Guardian-only.
