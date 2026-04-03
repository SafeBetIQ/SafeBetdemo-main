# SafeBet IQ — Database Migration Workflow

This document is the single source of truth for how database migrations
are written, validated, and applied to the Demo and Production environments.

---

## Prerequisites

### 1. Install Supabase CLI

```bash
# macOS / Linux
brew install supabase/tap/supabase

# Windows (Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# npm (any platform)
npm install -g supabase
```

Verify:
```bash
supabase --version   # should be ≥ 1.200.0
```

### 2. Authenticate

```bash
supabase login
# Opens browser → paste the access token shown at
# https://supabase.com/dashboard/account/tokens
```

### 3. Set environment variables

**macOS / Linux / WSL — add to `~/.zshrc` or `~/.bashrc`:**
```bash
export SUPABASE_DEMO_PROJECT_REF=<your-demo-project-ref>
export SUPABASE_PROD_PROJECT_REF=<your-prod-project-ref>
```

**Windows PowerShell (session only):**
```powershell
$env:SUPABASE_DEMO_PROJECT_REF = "<your-demo-project-ref>"
$env:SUPABASE_PROD_PROJECT_REF = "<your-prod-project-ref>"
```

**Where to find your Project Reference ID:**
1. Go to https://supabase.com/dashboard
2. Select the project (Demo or Production)
3. Navigate to **Project Settings → General**
4. Copy the **Reference ID** (e.g. `abcdefghijklmnop`)

> The project reference is NOT a secret — it is safe to commit once known.
> Replace the placeholder in `config.demo.toml` / `config.prod.toml`.

---

## Project Structure

```
supabase/
├── config.toml           # Local dev config (supabase start)
├── config.demo.toml      # Demo environment settings + project_id
├── config.prod.toml      # Production environment settings + project_id
├── seed.sql              # Loaded by `supabase db reset` (local only)
├── MIGRATION_WORKFLOW.md # This file
├── migrations/           # 231 migration files — NEVER delete or reorder
│   ├── 20251123085055_create_demo_users_v2.sql
│   ├── ...
│   └── 20260403210000_rebuild_demo_accounts.sql
└── functions/            # 19 Edge Functions (Deno)
    ├── api-ingest/
    └── ...
```

---

## The Golden Rule

```
Demo first. Production second. Never skip Demo.
```

Every migration MUST be applied to Demo and verified before Production.

---

## Writing a New Migration

```bash
# Creates supabase/migrations/$(date +%Y%m%d%H%M%S)_<name>.sql
supabase migration new <descriptive_snake_case_name>

# Or using the npm script:
npm run migration:new -- <descriptive_snake_case_name>
```

### Naming rules
- Format: `YYYYMMDDHHMMSS_name.sql` — enforced by the CLI
- Name must be lowercase, underscores only, no spaces
- Name must describe the change, not the date

### Migration checklist
Before committing a new migration:

- [ ] Uses `IF NOT EXISTS` / `IF EXISTS` for all DDL operations
- [ ] Uses `ON CONFLICT DO NOTHING` or `ON CONFLICT DO UPDATE` for INSERTs
- [ ] Does NOT use bare `DROP TABLE` (use `DROP TABLE IF EXISTS`)
- [ ] Does NOT use bare `TRUNCATE` unless it is a seed-only migration
  with a clear `-- SEED ONLY` comment at the top
- [ ] Does NOT use `DELETE FROM <table>` without a `WHERE` clause
  unless it is a seed-only migration
- [ ] RLS policies use `CREATE POLICY IF NOT EXISTS` or drop first
- [ ] SECURITY DEFINER functions have `SET search_path = public`
- [ ] Tested locally with `supabase db reset` before pushing

---

## Applying Migrations

### Option A — npm scripts (recommended)

```bash
# Push to Demo
npm run db:push:demo

# Push to Production (after verifying Demo)
npm run db:push:prod
```

### Option B — Supabase CLI directly

```bash
# Push to Demo
supabase db push --project-ref $SUPABASE_DEMO_PROJECT_REF

# Push to Production
supabase db push --project-ref $SUPABASE_PROD_PROJECT_REF
```

### Option C — Link then push (useful when switching projects)

```bash
# Link to Demo
supabase link --project-ref $SUPABASE_DEMO_PROJECT_REF
supabase db push

# Re-link to Production
supabase link --project-ref $SUPABASE_PROD_PROJECT_REF
supabase db push
```

> **Note:** `supabase db push` only runs migrations that have not yet been
> applied. Supabase tracks applied migrations in the `supabase_migrations`
> schema on the remote database. It will never re-run an already-applied
> migration.

---

## Checking Migration Status

```bash
# What has been applied to Demo?
supabase migration list --project-ref $SUPABASE_DEMO_PROJECT_REF

# What has been applied to Production?
supabase migration list --project-ref $SUPABASE_PROD_PROJECT_REF

# What's the diff between local and Demo?
npm run db:diff:demo

# What's the diff between local and Production?
npm run db:diff:prod
```

---

## Local Development

```bash
# Start local Supabase (Docker required)
supabase start

# Apply all migrations to local DB
supabase db reset

# Stop local Supabase
supabase stop
```

The local instance reads from `supabase/config.toml` and applies all
migrations in `supabase/migrations/` in timestamp order, then runs
`supabase/seed.sql`.

---

## Safe Deployment Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   1. Write migration                                                    │
│      supabase migration new <name>                                      │
│      # Edit the generated .sql file                                     │
│                                                                         │
│   2. Test locally (requires Docker)                                     │
│      supabase db reset                                                  │
│      # Verify the migration applied cleanly                             │
│                                                                         │
│   3. Push to Demo                                                       │
│      npm run db:push:demo                                               │
│      # Verify on https://demo.safebetiq.com                            │
│      # Check Supabase Dashboard → Table Editor → confirm schema        │
│                                                                         │
│   4. Push to Production                                                 │
│      npm run db:push:prod                                               │
│      # Verify on https://app.safebetiq.com                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Migration Audit — Known Issues

The following patterns were found in existing migrations.
They have been intentionally left in place as they were applied historically.
New migrations MUST NOT repeat these patterns.

### TRUNCATE (5 migrations — seed data only)
These are safe only because they target seed/analytics tables and were
applied once. They are idempotent in the sense that the seed data is
re-inserted after the truncate.

| Migration | Table |
|---|---|
| 20260125203257 | ai_reason_stacks |
| 20260128175627 | xai data tables |
| 20260129155643 | ai_intelligence tables |
| 20260129160845 | ai_intelligence tables |
| 20260129161638 | ai_learning_metrics |

### DELETE FROM without WHERE (10 migrations — seed data only)
| Migration | Table |
|---|---|
| 20251123085055 | users |
| 20251124165646 | auth.identities, auth.users |
| 20251124173216 | training_lesson_progress |
| 20251124180426 | training_lessons |
| 20260125203257 | ai_reason_stacks |
| 20260204165201 | integration_providers |
| 20260220181411 | guardian tables (3) |

**Risk:** If any of these migrations are ever re-applied (e.g. via a partial
restore), they will wipe the target table. These migrations are already in
the remote `supabase_migrations` history so `db push` will never re-run
them — but be aware when restoring from backup.

---

## Emergency Rollback

Supabase does not support automatic down-migrations.

In the event of a bad migration:
1. Write a new migration that reverses the change
2. Apply it via the normal Demo → Production workflow
3. Document what went wrong and why

**Do NOT manually modify the `supabase_migrations.schema_migrations` table.**

---

## Contacts

| Role | Contact |
|---|---|
| DB / DevOps | Team lead |
| Supabase Dashboard | https://supabase.com/dashboard |
| CLI Docs | https://supabase.com/docs/reference/cli |
| Migration Docs | https://supabase.com/docs/guides/cli/managing-environments |
