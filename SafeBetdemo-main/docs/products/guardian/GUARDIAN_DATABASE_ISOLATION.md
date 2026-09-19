# SafeBet Guardian — Database Isolation (ARCH-V4-PR2 §2/§10)

A REAL data-plane boundary — not a schema, role, or connection string in the shared DB.

Required (the dedicated Guardian project provides all): endpoint, credentials, roles, secrets, migration lifecycle, backup/recovery boundary, monitoring, configuration, ownership.

Post-cutover targets:
- dblink = NONE
- postgres_fdw back to IQ = NONE
- cross-project direct query = NONE
- Guardian worker using IQ DB secret = NONE
- Guardian API using IQ DB credential = NONE
- hidden fallback to the old shared DB = NONE

Verified pre-provisioning: guardian has 0 FK coupling to public/IQ and 0 references to IQ tables, so no IQ-specific object must be copied. `audit_context` and all shared primitives already live inside the `guardian` schema (deployed into the dedicated DB by the C0 foundation migration).
