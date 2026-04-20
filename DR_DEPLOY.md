# SafeBet IQ — DR Infrastructure Deployment Guide
**Version: 2.0 | Last Updated: 2026-04-19**

---

## Prerequisites

- AWS CLI configured with account `046276255259`
- Node.js 20+, `aws-cdk` v2.178+
- `cd infrastructure && npm install` already run
- Docker Desktop running (only needed if pre-built Lambda package/ dir is absent)

---

## Step 0 — Create Secrets in Secrets Manager (ONCE, before any deploy)

Secrets must exist before CDK imports them. Run these once:

```bash
# RDS admin credentials
aws secretsmanager create-secret \
  --name safebet/rds/primary/credentials-v2 \
  --region af-south-1 \
  --secret-string '{
    "username": "safebet_admin",
    "password": "REPLACE_WITH_STRONG_PASSWORD"
  }'

# Supabase credentials (used by safebet-auto-failover Lambda — replaces plaintext env vars)
aws secretsmanager create-secret \
  --name safebet/supabase/credentials-v2 \
  --region af-south-1 \
  --secret-string '{
    "host": "aws-0-eu-west-1.pooler.supabase.com",
    "port": "6543",
    "dbname": "postgres",
    "username": "postgres.REPLACE_WITH_PROJECT_REF",
    "password": "REPLACE_WITH_SUPABASE_PASSWORD"
  }'
```

Rotate these secrets via Secrets Manager. Never commit them.

---

## Step 1 — Bootstrap All Four Regions (ONCE per account)

```bash
ACCOUNT=046276255259

npx cdk bootstrap aws://$ACCOUNT/af-south-1
npx cdk bootstrap aws://$ACCOUNT/us-east-1
npx cdk bootstrap aws://$ACCOUNT/eu-west-1
npx cdk bootstrap aws://$ACCOUNT/eu-north-1
```

CDK bootstrap v16+ is required for cross-region references (SSM Parameter Store bridge).

---

## Step 2 — Configure GitHub Actions Secrets (BEFORE deploying)

In your GitHub repository → Settings → Secrets → Actions, set:

| Secret | Value |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | IAM key with policy from `infrastructure/iam/github-actions-dr-policy.json` |
| `AWS_SECRET_ACCESS_KEY` | IAM secret |
| `SUPABASE_DB_URL_PROD` | `postgresql://postgres.PROJECTREF:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:6543/postgres` |
| `S3_BUCKET_NAME` | `safebetiq-backups-046276255259-eu-north-1` (fill in after Step 3) |

To create the IAM user and apply the policy:
```bash
aws iam create-user --user-name safebet-github-actions

aws iam put-user-policy \
  --user-name safebet-github-actions \
  --policy-name SafeBetDRPolicy \
  --policy-document file://infrastructure/iam/github-actions-dr-policy.json

aws iam create-access-key --user-name safebet-github-actions
# Copy AccessKeyId and SecretAccessKey to GitHub secrets
```

---

## Step 3 — Deploy (Production)

```bash
cd infrastructure

# Check what will be created first
npx cdk diff --all \
  --context account=046276255259 \
  --context env=Production \
  --context alertEmail=oncall@safebetiq.com \
  --context hostedZoneName=safebetiq.com

# If your Route53 hosted zone already exists in AWS (recommended — import it):
# Find your zone ID:
aws route53 list-hosted-zones --query 'HostedZones[?Name==`safebetiq.com.`].Id' --output text
# Then add: --context hostedZoneId=ZXXXXXXXXXX

# Deploy all stacks in dependency order
npx cdk deploy --all \
  --context account=046276255259 \
  --context env=Production \
  --context alertEmail=oncall@safebetiq.com \
  --context hostedZoneName=safebetiq.com \
  --context hostedZoneId=ZXXXXXXXXXX \
  --require-approval never
```

CDK deploys in this order (enforced by stack dependencies):
1. `SafeBetDRPrimary` (af-south-1) ── in parallel ──┐
2. `SafeBetDRAlarm`   (us-east-1) ── in parallel ──┤
3. `SafeBetDRTrigger` (eu-north-1) ─ in parallel ──┘
4. `SafeBetDRReplica` (eu-west-1)  — AFTER 1 + 2

**Expected time:** 20–40 minutes (RDS replica creation takes ~15 min).

---

## Step 4 — Capture Stack Outputs

```bash
# Primary stack outputs (af-south-1)
aws cloudformation describe-stacks \
  --stack-name SafeBetDRPrimary --region af-south-1 \
  --query 'Stacks[0].Outputs' --output table

# Alarm stack outputs (us-east-1)
aws cloudformation describe-stacks \
  --stack-name SafeBetDRAlarm --region us-east-1 \
  --query 'Stacks[0].Outputs' --output table

# Replica stack outputs (eu-west-1)
aws cloudformation describe-stacks \
  --stack-name SafeBetDRReplica --region eu-west-1 \
  --query 'Stacks[0].Outputs' --output table

# Trigger stack outputs (eu-north-1)
aws cloudformation describe-stacks \
  --stack-name SafeBetDRTrigger --region eu-north-1 \
  --query 'Stacks[0].Outputs' --output table
```

---

## Step 5 — Post-Deploy Checklist

### Route53 NS Delegation (ONLY if a new hosted zone was created)

If `hostedZoneId` was NOT passed (new zone created), the `NameServers` output contains
4 NS records that must be entered at your domain registrar:

```bash
aws cloudformation describe-stacks \
  --stack-name SafeBetDRReplica --region eu-west-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`NameServers`].OutputValue' --output text
```

Enter these in your registrar (Cloudflare, GoDaddy, etc.) as NS records for `safebetiq.com`.
DNS propagation takes 24–48h. Until it propagates, Route53 DNS failover will not work.

### Confirm S3 Bucket Name Secret

```bash
BUCKET=$(aws cloudformation describe-stacks \
  --stack-name SafeBetDRTrigger --region eu-north-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`BackupBucketName`].OutputValue' --output text)
echo "Set GitHub secret S3_BUCKET_NAME = $BUCKET"
```

### Update Amplify Environment Variables

From the stack outputs, set these in **Amplify Console → Environment Variables** per branch:

| Variable | Source | Branch |
|----------|--------|--------|
| `DR_AWS_REGION` | `eu-west-1` (hardcoded) | both |
| `DR_S3_REGION` | `eu-north-1` (hardcoded) | both |
| `DR_S3_BUCKET` | `SafeBetDRTrigger.BackupBucketName` | both |
| `DR_LOG_GROUP` | `/aws/lambda/safebet-rds-failover` | both |
| `DR_ROUTE53_HEALTH_CHECK_ID` | `SafeBetDRAlarm.HealthCheckId` | both |
| `DR_CW_NAMESPACE` | `SafeBetIQ/DR` | both |

### Confirm email subscription

SNS will send a confirmation email to `alertEmail`. Click **Confirm subscription** to activate.

---

## Step 6 — Verify End-to-End

```bash
# 1. Confirm RDS primary is available and Multi-AZ
aws rds describe-db-instances \
  --db-instance-identifier safebet-primary-capetown \
  --region af-south-1 \
  --query 'DBInstances[0].{Status:DBInstanceStatus,MultiAZ:MultiAZ,Engine:EngineVersion}'

# 2. Confirm replica is available
aws rds describe-db-instances \
  --db-instance-identifier safebet-replica-ireland \
  --region eu-west-1 \
  --query 'DBInstances[0].{Status:DBInstanceStatus,Source:ReadReplicaSourceDBInstanceIdentifier}'

# 3. Confirm health check is healthy
HC_ID=$(aws cloudformation describe-stacks \
  --stack-name SafeBetDRAlarm --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`HealthCheckId`].OutputValue' --output text)
aws route53 get-health-check-status --health-check-id $HC_ID \
  --query 'HealthCheckObservations[*].StatusReport.Status'

# 4. Confirm Lambda functions exist
aws lambda get-function --function-name safebet-dr-trigger --region eu-north-1 \
  --query 'Configuration.{State:State,Handler:Handler}'
aws lambda get-function --function-name safebet-rds-failover --region eu-west-1 \
  --query 'Configuration.{State:State,Handler:Handler}'
aws lambda get-function --function-name safebet-auto-failover --region af-south-1 \
  --query 'Configuration.{State:State,Handler:Handler}'

# 5. Trigger first backup manually
gh workflow run backup.yml --repo SafeBetIQ/SafeBetdemo-main

# 6. Trigger health check manually
gh workflow run health-check.yml --repo SafeBetIQ/SafeBetdemo-main

# 7. Confirm metric is flowing
aws cloudwatch get-metric-statistics \
  --namespace SafeBetIQ/DR \
  --metric-name DatabaseHealthy \
  --start-time $(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Minimum \
  --region eu-north-1
```

---

## Step 7 — Rotation: Re-deploy Updates

For infrastructure updates after initial deploy:

```bash
# Safe: diff first
npx cdk diff --all --context account=046276255259 --context env=Production

# Deploy a single stack (faster)
npx cdk deploy SafeBetDRPrimary \
  --context account=046276255259 --context env=Production

# Deploy all stacks
npx cdk deploy --all \
  --context account=046276255259 \
  --context env=Production \
  --context alertEmail=oncall@safebetiq.com \
  --context hostedZoneName=safebetiq.com \
  --context hostedZoneId=ZXXXXXXXXXX
```

---

## Rollback / Destroy (Emergency Only)

All stacks have `terminationProtection: true`. To destroy, first disable it:

```bash
aws cloudformation update-termination-protection \
  --no-enable-termination-protection \
  --stack-name SafeBetDRReplica --region eu-west-1
# Repeat for each stack you need to destroy
npx cdk destroy --all --context account=046276255259
```

⚠️ The S3 bucket has `removalPolicy: RETAIN` — it will NOT be deleted by `cdk destroy`.
⚠️ The RDS instances have `deletionProtection: true` — they must be manually disabled in Console before deletion.
