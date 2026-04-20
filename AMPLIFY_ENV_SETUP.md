# SafeBet IQ — Amplify Branch Environment Setup

> **Reference for DevOps / infra team.**  
> All sensitive values must be set in AWS Amplify Console **only** — never committed to git.

---

## Architecture

| Branch | Environment | Supabase Project | URL |
|--------|-------------|-----------------|-----|
| `demo` | Demo / Staging | `uexdjngogzunjxkpxwll` | https://demo.safebetiq.com |
| `production` | Production | `ilibvipqbkugqkppzdmh` | https://safebetiq.com |

The `amplify.yml` build script detects `$AWS_BRANCH` and loads the matching
`.env.*` baseline file. Amplify Console environment variables (set per-branch)
are injected at build time and **override** any file values — so secrets never
touch the repo.

---

## Step 1 — Connect branches in Amplify Console

1. Open **AWS Amplify Console** → your app
2. Go to **Hosting → Branches**
3. Connect `demo` branch → point to `demo` in Git
4. Connect `production` branch → point to `production` in Git
5. For each branch set **App root** = `frontend`

---

## Step 2 — Set environment variables per branch

Navigate to: **App settings → Environment variables**

### `demo` branch — required variables

Set these with scope **demo only** (use the branch selector dropdown):

```
NEXT_PUBLIC_ENV                  = demo
NEXT_PUBLIC_SUPABASE_URL         = https://uexdjngogzunjxkpxwll.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY    = <paste demo anon key from Supabase Dashboard>
NEXT_PUBLIC_API_BASE_URL         = https://demo.safebetiq.com/api
NEXT_PUBLIC_APP_NAME             = SafeBet IQ (Demo)
NEXT_PUBLIC_ENABLE_DEBUG         = true
NEXT_PUBLIC_ENABLE_MOCK_DATA     = true
NEXT_PUBLIC_REGION               = af-south-1
NEXT_PUBLIC_DR_REGION            = eu-west-1

SUPABASE_SERVICE_ROLE_KEY        = <paste demo service_role key — NEVER expose as NEXT_PUBLIC_>
DR_S3_BUCKET                     = safebet-demo-backups
DR_CW_NAMESPACE                  = SafeBetIQ/Demo
DR_ROUTE53_HEALTH_CHECK_ID       = <health check ID from Route53>
CLOUDWATCH_NAMESPACE             = SafeBetIQ/Demo
S3_BACKUP_BUCKET                 = safebet-demo-backups
FAILOVER_ENABLED                 = false

TWILIO_ACCOUNT_SID               = <twilio account SID>
TWILIO_AUTH_TOKEN                = <twilio auth token>
TWILIO_WHATSAPP_NUMBER           = <whatsapp number>
TWILIO_SMS_NUMBER                = <sms number>

SAFEPLAY_API_KEY                 = <demo API key>
SAFEPLAY_WEBHOOK_SECRET          = <demo webhook secret>
```

### `production` branch — required variables

Set these with scope **production only**:

```
NEXT_PUBLIC_ENV                  = production
NEXT_PUBLIC_SUPABASE_URL         = https://ilibvipqbkugqkppzdmh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY    = <paste production anon key from Supabase Dashboard>
NEXT_PUBLIC_API_BASE_URL         = https://safebetiq.com/api
NEXT_PUBLIC_APP_NAME             = SafeBet IQ
NEXT_PUBLIC_ENABLE_DEBUG         = false
NEXT_PUBLIC_ENABLE_MOCK_DATA     = false
NEXT_PUBLIC_REGION               = af-south-1
NEXT_PUBLIC_DR_REGION            = eu-west-1

SUPABASE_SERVICE_ROLE_KEY        = <paste production service_role key>
DR_S3_BUCKET                     = safebet-prod-backups
DR_CW_NAMESPACE                  = SafeBetIQ/DR
DR_ROUTE53_HEALTH_CHECK_ID       = <health check ID from Route53>
CLOUDWATCH_NAMESPACE             = SafeBetIQ/Production
S3_BACKUP_BUCKET                 = safebet-prod-backups
FAILOVER_ENABLED                 = true

TWILIO_ACCOUNT_SID               = <production twilio account SID>
TWILIO_AUTH_TOKEN                = <production twilio auth token>
TWILIO_WHATSAPP_NUMBER           = <production whatsapp number>
TWILIO_SMS_NUMBER                = <production sms number>

SAFEPLAY_API_KEY                 = <production API key>
SAFEPLAY_WEBHOOK_SECRET          = <production webhook secret>
```

---

## Step 3 — Build settings

In Amplify Console → **Build settings** for each branch:

| Setting | Value |
|---------|-------|
| Base directory | `frontend` |
| Build command | `npm run build` |
| Output directory | `.next` |
| Node.js version | `20` |

The `amplify.yml` in the repo root handles this automatically if left on default.

---

## Step 4 — IAM permissions (recommended)

Instead of static `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, attach an
**IAM role** to the Amplify app with the minimum permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DRStatusRead",
      "Effect": "Allow",
      "Action": [
        "cloudwatch:GetMetricStatistics",
        "logs:FilterLogEvents",
        "s3:ListBucket",
        "s3:GetObject",
        "route53:GetHealthCheckStatus"
      ],
      "Resource": [
        "arn:aws:s3:::safebet-*-backups",
        "arn:aws:s3:::safebet-*-backups/*",
        "arn:aws:logs:*:*:log-group:/aws/lambda/safebet-*",
        "arn:aws:cloudwatch:*:*:*",
        "arn:aws:route53:::healthcheck/*"
      ]
    }
  ]
}
```

Attach this role under: **App settings → General → Service role**

---

## Step 5 — Optional: AWS Secrets Manager

For values like `SUPABASE_SERVICE_ROLE_KEY` and `TWILIO_AUTH_TOKEN`, store them
in AWS Secrets Manager and reference them in the build spec:

```yaml
# amplify.yml preBuild addition:
- aws secretsmanager get-secret-value \
    --secret-id safebet/$AWS_BRANCH/supabase \
    --query SecretString --output text | \
  jq -r 'to_entries[] | "\(.key)=\(.value)"' >> frontend/.env.local
```

Secret name convention: `safebet/demo/<service>` and `safebet/production/<service>`

---

## Security Checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set in Amplify Console only (never in git)
- [ ] `demo` branch variables point ONLY to `uexdjngogzunjxkpxwll` Supabase project
- [ ] `production` branch variables point ONLY to `ilibvipqbkugqkppzdmh` Supabase project
- [ ] No `NEXT_PUBLIC_` prefix on any secret variable
- [ ] Amplify IAM role is used instead of static AWS keys
- [ ] `.env.demo` and `.env.production` are listed in `.gitignore`
- [ ] Only `.env.example` is committed (contains no real values)
- [ ] `NEXT_PUBLIC_ENABLE_DEBUG=false` is set on production branch
- [ ] `FAILOVER_ENABLED=true` is set on production branch only
