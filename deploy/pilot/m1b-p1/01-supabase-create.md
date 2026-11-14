# Phase 1 - Create the Supabase Pilot project (owner action; current Management API)

**Not AWS. The provisioner role has no Supabase authority.** You perform this with a Supabase management token
for the SafeBet organisation, held only in your shell. Never share the token, DB password, or service-role key
with Claude or commit them.

Current Management API note: `organization_id` is deprecated in favour of `organization_slug`, and a project's
`id` is deprecated in favour of `ref`. Use the current fields below.

Phase 1 completion requires BOTH: the project is `ACTIVE_HEALTHY` **and** PITR is explicitly confirmed active
(Pro membership does NOT imply PITR). Run the whole sequence in a `try { } finally { }` so the token, DB URL
and password are cleared whether it succeeds or aborts.

## Inputs (set in THIS shell only)
```powershell
$env:SUPABASE_ACCESS_TOKEN = '<your management token>'   # never commit / never echo
$PilotDbPassword = Read-Host -AsSecureString 'New strong Pilot DB password'
$H = @{ Authorization = "Bearer $env:SUPABASE_ACCESS_TOKEN" }
```

## Owner sequence (cleanup guaranteed by finally)
```powershell
try {
  # A) verify the organisation slug (READ-ONLY; do not guess). STOP if not found.
  $orgs = Invoke-RestMethod -Uri 'https://api.supabase.com/v1/organizations' -Headers $H
  $orgs | Select-Object slug, name                      # non-secret
  $ORG = ($orgs | Where-Object { $_.slug -eq 'fhttwsuoliasybqkacrm' }).slug
  if (-not $ORG) { throw 'ABORT: expected organisation slug fhttwsuoliasybqkacrm not found - stop for owner review.' }

  # B) create exactly ONE project. Plan is inherited from the org; do NOT send a `plan` field.
  $body = @{ organization_slug = $ORG; name = 'SafeBet IQ Pilot'; region = 'eu-west-1';
             db_pass = (New-Object pscredential 'x',$PilotDbPassword).GetNetworkCredential().Password } | ConvertTo-Json
  $proj = Invoke-RestMethod -Method POST -Uri 'https://api.supabase.com/v1/projects' -Headers $H -ContentType 'application/json' -Body $body
  $ref = $proj.ref                                       # current API: project reference is .ref (NOT .id)

  # C) validate the ref and returned identity BEFORE polling.
  if (-not $ref -or ($ref -notmatch '^[a-z]{20}$')) { throw "ABORT: project ref '$ref' is not 20 lowercase chars." }
  if ($ref -in 'ilibvipqbkugqkppzdmh','uexdjngogzunjxkpxwll','druuskabkgyotslcgnys') { throw 'ABORT: ref is a FORBIDDEN project (Prod/Demo/Guardian).' }
  if ($proj.organization_slug -and $proj.organization_slug -ne $ORG) { throw 'ABORT: returned organization_slug mismatch.' }
  if ($proj.name -ne 'SafeBet IQ Pilot') { throw 'ABORT: returned name mismatch.' }
  if ($proj.region -ne 'eu-west-1')      { throw 'ABORT: returned region mismatch.' }
  "ref=$ref name=$($proj.name) region=$($proj.region) org=$ORG status=$($proj.status) created=$($proj.created_at)"   # non-secret

  # D) poll by ref until ready. NEVER re-POST on a slow/ambiguous response.
  do { Start-Sleep 10; $st = (Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/$ref" -Headers $H).status; $st } while ($st -ne 'ACTIVE_HEALTHY')

  # E) PITR is a SEPARATE per-project add-on. Enable it (Dashboard -> Database -> Backups -> Point-in-Time
  #    Recovery, or the add-ons API) and CONFIRM it is active. Phase 1 is NOT complete until this passes.
  #    Example confirmation (endpoint/shape may vary - verify in the dashboard if unsure):
  $pitr = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/$ref/database/backups" -Headers $H
  "pitr_enabled=$($pitr.pitr_enabled)"                   # require this to be true before reporting completion
  if (-not $pitr.pitr_enabled) { throw 'ABORT: PITR is NOT confirmed active on the Pilot project - enable it and re-verify.' }

  # F) record MINIMUM non-secret identity (anon key deferred to the app-config phase).
  .\01-record-values.ps1 -PilotProjectRef $ref -SupabaseUrl "https://$ref.supabase.co"

  # G) read-only preflight. Prefer the official connection string from Project Settings -> Database (already
  #    correctly URL-encoded). If you construct it manually, URI-ENCODE the password so reserved characters
  #    (@ : / ? # % &) do not corrupt the URI:
  $PlainPilotDbPassword   = (New-Object pscredential 'x',$PilotDbPassword).GetNetworkCredential().Password
  $EncodedPilotDbPassword = [System.Uri]::EscapeDataString($PlainPilotDbPassword)
  $env:PILOT_DB_URL = "postgresql://postgres:$EncodedPilotDbPassword@db.$ref.supabase.co:5432/postgres?sslmode=require"
  $PlainPilotDbPassword = $null; $EncodedPilotDbPassword = $null     # clear immediately; never print either
  .\02-supabase-preflight.ps1
}
finally {
  # Cleanup ALWAYS runs (success or failure) - but only after PITR/project verification above have completed.
  Remove-Item Env:\PILOT_DB_URL         -ErrorAction SilentlyContinue
  Remove-Item Env:\SUPABASE_ACCESS_TOKEN -ErrorAction SilentlyContinue
  if ($PilotDbPassword) { $PilotDbPassword.Dispose() }
  $PilotDbPassword = $null; $PlainPilotDbPassword = $null; $EncodedPilotDbPassword = $null
}
```

### Duplicate / resume (if a create looks slow or ambiguous - do NOT re-POST)
```powershell
$cands = @((Invoke-RestMethod -Uri 'https://api.supabase.com/v1/projects' -Headers $H) |
  Where-Object { $_.name -eq 'SafeBet IQ Pilot' -and $_.organization_slug -eq $ORG -and $_.region -eq 'eu-west-1' })
$cands.Count
```
- exactly 1 candidate -> resume using `$cands[0].ref`.
- 0 or more than 1 -> STOP for owner review (create no second project).

## What Phase 1 records (non-secret only)
`pilot-context.json` contains ONLY: `project_ref`, `supabase_url`, `anon_key_recorded=false` (plus project
name/org/region). It must NEVER contain the management token, DB password, DB URL, service-role key, or (in
Phase 1) the anon key. The application uses the **legacy** anon key via `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(confirmed: no publishable-key usage); it is required only at the application build phase, so re-run
`01-record-values.ps1 -AnonKey '<public legacy anon key>'` before Phase 6b/7. Do not substitute a publishable key.

## Firewall
Exactly one new project in org `fhttwsuoliasybqkacrm`, region `eu-west-1`. The ref must NOT be
`ilibvipqbkugqkppzdmh` (Prod), `uexdjngogzunjxkpxwll` (Demo), or `druuskabkgyotslcgnys` (Guardian).
The service-role key is never retrieved. No SafeBet schema is applied in Phase 1. No AWS activity.

## Rollback
Delete the project: `Invoke-RestMethod -Method DELETE -Uri "https://api.supabase.com/v1/projects/$ref" -Headers $H`
(irreversible; the Pilot is empty / no real data).
