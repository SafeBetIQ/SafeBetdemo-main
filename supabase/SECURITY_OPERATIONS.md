# SafeBet IQ — Security Operations Runbook
> Classification: INTERNAL — do not commit to public repositories  
> Standard: SOC2 Type II / ISO 27001 / POPIA / GDPR aligned

---

## CRITICAL: What this document must NEVER contain

- Plaintext secret values of any kind
- Output of `SELECT decrypted_secret FROM vault.decrypted_secrets`
- HMAC keys, service role keys, API keys, or tokens
- Any value from `vault.decrypted_secrets` at any depth

If a plaintext secret appears anywhere in this file, treat it as **compromised** and rotate immediately.

---

## HMAC Secret Rotation Procedure

Rotate the risk-engine signing key **every 90 days** or immediately after any suspected exposure.

**Rotation takes ≈5 minutes. The previous key remains valid for a 15-minute overlap window.**

### Prerequisites
- Direct database access (psql or Supabase Dashboard SQL editor — postgres role)
- Access to Supabase Dashboard → Edge Functions → Secrets
- ~15 minutes from start to finish

---

### Step-by-Step Rotation

**Step 1 — Execute rotation and receive a one-time retrieval token**

```sql
-- Returns a UUID token — NOT the secret value
-- The token is valid for 15 minutes and single-use
SELECT public.rotate_risk_engine_secret();
```

Copy the returned UUID. Example: `550e8400-e29b-41d4-a716-446655440000`

**Step 2 — Exchange the token for the new secret value (once)**

```sql
-- Replace with the UUID from step 1
-- Returns the new secret value ONCE — copy it immediately
-- After this call the token is permanently consumed
SELECT public.consume_secret_retrieval_token('550e8400-e29b-41d4-a716-446655440000');
```

Copy the returned hex string immediately. This is the only time it will be visible in plaintext.

**Step 3 — Retrieve previous secret for rotation window slot**

Do NOT run `SELECT decrypted_secret FROM vault...` — use the token pattern instead:

```sql
-- Issue a token for the previous secret slot
SELECT public.issue_secret_retrieval_token('risk_engine_hmac_secret_prev');
-- Then consume it:
SELECT public.consume_secret_retrieval_token('<token-from-above>');
```

**Step 4 — Update Edge Function secrets (within 5 minutes)**

```
Supabase Dashboard
→ Edge Functions → risk-engine → Secrets

Set:
  RISK_ENGINE_HMAC_SECRET      = <new value from step 2>
  RISK_ENGINE_HMAC_SECRET_PREV = <previous value from step 3>
```

Both secrets are now active simultaneously:
- PostgreSQL trigger signs all new requests with the NEW active key
- Edge Function verifies against BOTH old and new during the rotation window

**Step 5 — Monitor rotation window (15 minutes)**

Watch Edge Function logs for:
```
[risk-engine] ROTATION: previous secret used — complete Edge Function secret update now
```

If this appears, rotation is in progress and working correctly.

**Step 6 — Remove previous secret (after 15 minutes)**

```
Supabase Dashboard → Edge Functions → risk-engine → Secrets
→ Delete: RISK_ENGINE_HMAC_SECRET_PREV
```

Only the new secret is accepted. Rotation complete.

**Step 7 — Log the rotation**

```sql
INSERT INTO public.security_rotation_log (event_type, notes)
VALUES ('secret_rotation', 'Scheduled 90-day HMAC key rotation completed');
```

---

## Vault Audit Queries (safe — no secret values returned)

```sql
-- List all secrets (names and metadata only — no values)
SELECT name, created_at, description FROM vault.secrets ORDER BY name;

-- Verify a specific secret exists
SELECT public.fn_vault_secret_exists('risk_engine_hmac_secret');
SELECT public.fn_vault_secret_exists('risk_engine_hmac_secret_prev');

-- Review rotation history
SELECT * FROM public.security_rotation_log ORDER BY performed_at DESC;

-- Check rate limit state
SELECT key, hits, window_start, expires_at
FROM public.distributed_rate_limits
ORDER BY expires_at DESC
LIMIT 50;
```

**The following query is PROHIBITED in all operational contexts:**

```sql
-- ❌ NEVER RUN THIS — use fn_vault_secret_exists() or the token pattern instead
SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = '...';
```

---

## Risk Engine URL Configuration (per-environment GUC)

The `call_risk_engine()` PostgreSQL trigger reads its target URL from a database-level GUC.
**This must be set in every environment after applying migration `20260421000000`.**

### Set GUC — Demo project (`uexdjngogzunjxkpxwll`)
```sql
ALTER DATABASE postgres
  SET app.risk_engine_url =
    'https://uexdjngogzunjxkpxwll.supabase.co/functions/v1/risk-engine';
```

### Set GUC — Production project (`ilibvipqbkugqkppzdmh`)
```sql
ALTER DATABASE postgres
  SET app.risk_engine_url =
    'https://ilibvipqbkugqkppzdmh.supabase.co/functions/v1/risk-engine';
```

### Verify the GUC is set correctly
```sql
-- Returns the configured URL for this database
SELECT current_setting('app.risk_engine_url', true) AS risk_engine_url;
-- Expected: matches the Supabase project URL for THIS environment (not the other one)

-- Confirm no hardcoded URL remains in the function
SELECT prosrc ILIKE '%supabase.co%' AS has_hardcoded_url
FROM pg_proc WHERE proname = 'call_risk_engine';
-- Expected: false
```

**The function will log a WARNING and skip (not fail) if the GUC is unset.
It will never fall back to any hardcoded URL.**

---

## Security Events — Correct Logging Pattern

The `security_events` table stores hashed IPs, not plaintext. Always hash before insert.
This is the authoritative pattern used by all Edge Functions.

```typescript
import { createHash } from "node:crypto";  // Deno: use Web Crypto instead

// In Deno Edge Functions:
async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function logSecurityEvent(
  supabase: ReturnType<typeof createClient>,
  eventType: string,
  severity: "info" | "low" | "medium" | "high" | "critical",
  sourceIp: string,
  affectedSystem: string,
  title: string,
  rawMetadata: Record<string, unknown>,
  casinoId?: string,
): Promise<void> {
  try {
    const ipHash = await hashIp(sourceIp);
    await supabase.from("security_events").insert({
      casino_id:       casinoId ?? null,
      event_type:      eventType,
      severity,
      title,
      source_ip_hash:  ipHash,          // ✔ hashed — never plaintext IP
      affected_system: affectedSystem,
      raw_metadata:    rawMetadata,      // ✔ column name is raw_metadata
      is_resolved:     false,
      created_at:      new Date().toISOString(),
    });
  } catch {
    // Non-blocking — never fail the request because of audit logging
  }
}
```

**Column reference (correct names — do not use `source_ip` or `metadata`):**

| Correct column | Wrong name (do not use) | Notes |
|---|---|---|
| `source_ip_hash` | `source_ip` | Always SHA-256 hash before insert |
| `raw_metadata` | `metadata` | jsonb — arbitrary event detail |
| `affected_system` | `source` | String name of the calling system |

---

## Amplify Environment Variable Isolation (FIX 6)

Demo and Production branches MUST use different Supabase projects. Set variables **per branch** — never using "All branches".

### Demo branch (`demo`)
```
NEXT_PUBLIC_ENV                = demo
NEXT_PUBLIC_SUPABASE_URL       = https://uexdjngogzunjxkpxwll.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  = <demo anon key>
SUPABASE_SERVICE_ROLE_KEY      = <demo service role key>   [secret]
NEXT_PUBLIC_ENABLE_DEBUG       = true
NEXT_PUBLIC_ENABLE_MOCK_DATA   = true
FAILOVER_ENABLED               = false
NEXT_PUBLIC_TURNSTILE_SITE_KEY = <demo site key>
TURNSTILE_SECRET_KEY           = <demo turnstile secret>   [secret]
```

### Production branch (`Production`)
```
NEXT_PUBLIC_ENV                = production
NEXT_PUBLIC_SUPABASE_URL       = https://ilibvipqbkugqkppzdmh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  = <prod anon key>
SUPABASE_SERVICE_ROLE_KEY      = <prod service role key>   [secret]
NEXT_PUBLIC_ENABLE_DEBUG       = false
NEXT_PUBLIC_ENABLE_MOCK_DATA   = false
FAILOVER_ENABLED               = true
DR_AWS_REGION                  = eu-west-1
DR_S3_REGION                   = eu-north-1
DR_S3_BUCKET                   = safebetiq-backups-046276255259-eu-north-1
DR_LOG_GROUP                   = /aws/lambda/safebet-rds-failover
DR_CW_NAMESPACE                = SafeBetIQ/DR
NEXT_PUBLIC_TURNSTILE_SITE_KEY = <prod site key>
TURNSTILE_SECRET_KEY           = <prod turnstile secret>   [secret]
```

**How to set in Amplify Console:**
```
AWS Amplify → App → Environment variables
→ Select branch: demo → Add variables above
→ Select branch: Production → Add variables above
→ Do NOT set any variable on "All branches" unless it is truly identical
```

---

## Security Validation Checklist

Run after any deployment, rotation, or schema change.

### Database

```sql
-- 1. Zero hardcoded secrets in function bodies
SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND prosrc ILIKE '%eyJ%';
-- Expected: 0 rows

-- 2. All SECURITY DEFINER functions have pg_temp in search_path
SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef = true
  AND (proconfig IS NULL OR NOT (proconfig::text ILIKE '%pg_temp%'));
-- Expected: 0 rows

-- 3. Vault wrapper functions are execute-restricted
SELECT grantee, privilege_type FROM information_schema.role_routine_grants
WHERE routine_name IN ('fn_get_active_hmac_secret', 'fn_get_prev_hmac_secret',
                       'rotate_risk_engine_secret', 'issue_secret_retrieval_token',
                       'consume_secret_retrieval_token')
  AND grantee IN ('authenticated', 'anon', 'public');
-- Expected: 0 rows

-- 4. Zero tables without RLS
SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;
-- Expected: 0

-- 5. Distributed rate limit table accessible only to service_role
SELECT grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_name = 'distributed_rate_limits'
  AND grantee IN ('authenticated', 'anon');
-- Expected: 0 rows

-- 6. Active vault secrets exist
SELECT public.fn_vault_secret_exists('risk_engine_hmac_secret');
-- Expected: true

-- 7. call_risk_engine uses wrapper (no direct vault access)
SELECT prosrc LIKE '%fn_get_active_hmac_secret%' AS uses_wrapper
FROM pg_proc WHERE proname = 'call_risk_engine';
-- Expected: true

-- 8. Rate limit trigger on contact_submissions
SELECT COUNT(*) FROM information_schema.triggers
WHERE event_object_table = 'contact_submissions'
  AND trigger_name = 'trg_contact_submission_guard';
-- Expected: 1

-- 9. Security rotation log is append-only
SELECT COUNT(*) FROM information_schema.triggers
WHERE event_object_table = 'security_rotation_log'
  AND trigger_name = 'trg_rotation_log_immutable';
-- Expected: 1

-- 10. Secret retrieval tokens expire correctly
SELECT COUNT(*) FROM public.secret_retrieval_tokens
WHERE expires_at < now() AND consumed = false;
-- Expected: 0 (any uncollected tokens are expired — safe)
```

### Next.js / Amplify Build

```bash
# Verify all API routes have force-dynamic
grep -rn "export const dynamic" frontend/app/api/
# Expected: force-dynamic in every route.ts file

# Verify next.config.js has standalone output
grep "output.*standalone" frontend/next.config.js
# Expected: 1 match

# Local build test
cd frontend && npm run build
# Expected: no errors, .next/standalone directory created
```

### Edge Functions

| Check | How to verify |
|---|---|
| `RISK_ENGINE_HMAC_SECRET` set | Dashboard → Edge Functions → risk-engine → Secrets |
| `RISK_ENGINE_HMAC_SECRET_PREV` removed after rotation | Same location |
| `TURNSTILE_SECRET_KEY` set | Dashboard → Edge Functions → contact-form → Secrets |
| `ALLOWED_ORIGIN` set to correct domain per environment | Same location |
| No CORS on risk-engine | No `Access-Control-Allow-Origin` header in response |

### Auth Settings

| Check | Location |
|---|---|
| Leaked password protection ON | Auth → Sign In / Up → Password |
| Minimum password length ≥ 12 | Auth → Sign In / Up → Password |
| JWT expiry = 3600s | Auth → Sessions |
| Inactivity timeout = 1800s | Auth → Sessions |
| TOTP MFA enabled | Auth → MFA |

---

## Rotation Schedule

| Secret | Frequency | Location |
|---|---|---|
| `risk_engine_hmac_secret` | 90 days | Vault → Edge Function secrets |
| Supabase service role key | 180 days | Dashboard → API → Rotate |
| Turnstile secret key | On compromise | Cloudflare Dashboard |
| GitHub PAT (`/safebet/github-token`) | 90 days | SSM Parameter Store |

---

## Incident Response: Suspected Secret Compromise

1. **Immediately** run `SELECT public.rotate_risk_engine_secret()` and update Edge Function secrets (Steps 1–4 above)
2. Check Edge Function logs: `SECURITY: invalid HMAC signature` — note IP patterns
3. Check rate limit breach logs: `ABUSE: distributed rate limit exceeded`
4. Log the incident:
   ```sql
   INSERT INTO public.security_rotation_log (event_type, notes)
   VALUES ('emergency_rotation', 'Describe the incident here');
   ```
5. Review `public.security_events` for anomalous activity in the affected time window
6. Notify compliance officer — POPIA requires breach notification within 72 hours if personal data was at risk
