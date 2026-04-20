# SafeBet IQ — Disaster Recovery Runbook
**Classification: CONFIDENTIAL — Infrastructure Operations**
**Version: 2.0 | Last Updated: 2026-04-19**

---

## Emergency Contacts

| Role | Contact | Escalation |
|------|---------|-----------|
| On-Call Engineer | oncall@safebetiq.com | Primary |
| CTO | [CTO contact] | 15-min escalation |
| AWS Support | support.console.aws.amazon.com | Severity 1 |
| Supabase Support | supabase.com/support | Database issues |

---

## System Overview

```
Cape Town (af-south-1)          Ireland (eu-west-1)
┌─────────────────────┐         ┌─────────────────────┐
│  RDS Primary PG15   │──rep──▶ │  RDS Replica PG15   │
│  Multi-AZ           │         │  safebet-rds-failover│
│  safebet-auto-fail  │         │  Route53 CNAME       │
└─────────────────────┘         └─────────────────────┘
         ▲                               ▲
         │                               │
Stockholm (eu-north-1)          N. Virginia (us-east-1)
┌─────────────────────┐         ┌─────────────────────┐
│  GitHub Actions     │         │  CW Alarm            │
│  → CW metric        │         │  Route53 HC          │
│  safebet-dr-trigger │         │  DNS failover        │
│  S3 backup bucket   │         └─────────────────────┘
└─────────────────────┘
```

**RTO Target:** < 10 minutes (automated) | < 30 minutes (manual)
**RPO Target:** < 5 minutes (last backup lag)

---

## 1. AUTOMATED FAILOVER (Normal Path)

### When it triggers
The automated failover fires when:
1. `health-check.yml` publishes `DatabaseHealthy=0` for 2 consecutive 5-minute periods (10 min total)
2. CloudWatch alarm `SafeBetDatabaseHealthyAlarm` in `eu-north-1` transitions to ALARM
3. SNS topic `safebet-dr-alerts` publishes to `safebet-dr-trigger` Lambda
4. `safebet-dr-trigger` invokes `safebet-rds-failover` in `eu-west-1` asynchronously
5. `safebet-rds-failover` promotes Ireland replica and updates Route53 CNAME

### What happens automatically
- [ ] RDS `safebet-replica-ireland` is promoted to standalone primary
- [ ] Route53 `db.safebetiq.com` SECONDARY record updated to replica endpoint
- [ ] Route53 DNS failover switches traffic from PRIMARY (unhealthy) to SECONDARY
- [ ] `FailoverExecuted=1` metric published to CloudWatch
- [ ] DR state saved to S3: `dr-state.json`
- [ ] SNS alert email sent to `alertEmail`

### Verify automated failover succeeded
```bash
# 1. Check Lambda execution (Ireland)
aws logs tail /aws/lambda/safebet-rds-failover \
  --region eu-west-1 --since 30m --format short

# 2. Check RDS state
aws rds describe-db-instances \
  --db-instance-identifier safebet-replica-ireland \
  --region eu-west-1 \
  --query 'DBInstances[0].{Status:DBInstanceStatus,MultiAZ:MultiAZ,ReadReplicaSourceDBInstanceIdentifier:ReadReplicaSourceDBInstanceIdentifier}'

# 3. Check Route53 DNS resolution
dig db.safebetiq.com CNAME +short

# 4. Check DR state in S3
aws s3 cp s3://safebetiq-backups-046276255259-eu-north-1/dr-state.json - | python3 -m json.tool

# 5. Check CloudWatch failover metric
aws cloudwatch get-metric-statistics \
  --namespace SafeBetIQ/DR \
  --metric-name FailoverExecuted \
  --start-time $(date -u -d '2 hours ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 3600 \
  --statistics Sum \
  --region eu-north-1
```

---

## 2. MANUAL FAILOVER PROCEDURE

**Use when:** automated failover did not trigger, or you need to force a controlled failover.

### Step 1 — Confirm primary is actually down
```bash
aws rds describe-db-instances \
  --db-instance-identifier safebet-primary-capetown \
  --region af-south-1 \
  --query 'DBInstances[0].DBInstanceStatus'
```
Expected during failure: `failed` | `incompatible-network` | `storage-full` | timeout

### Step 2 — Confirm replica is healthy and replication is current
```bash
aws rds describe-db-instances \
  --db-instance-identifier safebet-replica-ireland \
  --region eu-west-1 \
  --query 'DBInstances[0].{Status:DBInstanceStatus,ReplicaLag:StatusInfos}'
```
Proceed only if Status = `available`.

### Step 3 — Take pre-failover backup
```bash
# Trigger manual backup workflow
gh workflow run backup.yml --repo SafeBetIQ/SafeBetdemo-main
```
Wait for backup to complete (check GitHub Actions). This creates a pre-failover snapshot.

### Step 4 — Invoke rds-failover Lambda manually
```bash
aws lambda invoke \
  --function-name safebet-rds-failover \
  --region eu-west-1 \
  --payload '{"Records":[{"Sns":{"Message":"{\"NewStateValue\":\"ALARM\",\"AlarmName\":\"SafeBetDatabaseHealthyAlarm\"}"}}]}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/failover-response.json && cat /tmp/failover-response.json
```

Expected response: `{"status": "FAILOVER_COMPLETE"}`

### Step 5 — Verify DNS switch
```bash
# Should resolve to Ireland endpoint after TTL expires (60s)
watch -n 5 'dig db.safebetiq.com CNAME +short'
```

### Step 6 — Verify application connectivity
```bash
# Test DB connectivity on new primary
psql "host=db.safebetiq.com port=5432 sslmode=require" -c "SELECT version();"
```

### Step 7 — Update Supabase connection strings
If the application connects directly to Supabase (not via the RDS CNAME), update:
- Amplify env var: `NEXT_PUBLIC_SUPABASE_URL`
- This typically does NOT need to change unless Supabase project is failing

---

## 3. ROLLBACK PROCEDURE

**Use when:** failover was premature, primary recovered, you want to switch back.

### When to rollback
- Primary RDS is back to `available` status
- Primary has been verified clean (no data corruption)
- Ireland promoted primary has received < 30 minutes of writes (to minimise re-sync time)

### Step 1 — Verify primary is healthy
```bash
aws rds describe-db-instances \
  --db-instance-identifier safebet-primary-capetown \
  --region af-south-1 \
  --query 'DBInstances[0].DBInstanceStatus'
```

### Step 2 — Create new replica (Cape Town reading from Ireland)
```bash
aws rds create-db-instance-read-replica \
  --db-instance-identifier safebet-replica-capetown-v2 \
  --source-db-instance-identifier arn:aws:rds:eu-west-1:046276255259:db:safebet-replica-ireland \
  --source-region eu-west-1 \
  --db-instance-class db.t4g.micro \
  --region af-south-1
```
Wait ~20 minutes for replica to sync.

### Step 3 — Confirm replication lag is near zero
```bash
aws rds describe-db-instances \
  --db-instance-identifier safebet-replica-capetown-v2 \
  --region af-south-1 \
  --query 'DBInstances[0].StatusInfos'
```

### Step 4 — Switch Route53 back manually
```bash
# Get hosted zone ID
HZ_ID=$(aws cloudformation describe-stacks \
  --stack-name SafeBetDRReplica --region eu-west-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`HostedZoneId`].OutputValue' --output text)

# Get Cape Town primary endpoint
PRIMARY_EP=$(aws rds describe-db-instances \
  --db-instance-identifier safebet-primary-capetown \
  --region af-south-1 \
  --query 'DBInstances[0].Endpoint.Address' --output text)

# Update PRIMARY failover record to point to Cape Town
aws route53 change-resource-record-sets \
  --hosted-zone-id $HZ_ID \
  --change-batch "{
    \"Changes\": [{
      \"Action\": \"UPSERT\",
      \"ResourceRecordSet\": {
        \"Name\": \"db.safebetiq.com\",
        \"Type\": \"CNAME\",
        \"TTL\": 60,
        \"SetIdentifier\": \"primary-capetown\",
        \"Failover\": \"PRIMARY\",
        \"ResourceRecords\": [{\"Value\": \"$PRIMARY_EP\"}]
      }
    }]
  }"
```

### Step 5 — Re-enable health check on primary
Once primary is healthy and Route53 health check passes, DNS will automatically prefer PRIMARY.

---

## 4. FAILOVER TEST PROCEDURE (Scheduled Quarterly)

**Goal:** Prove the DR chain works end-to-end without affecting production.

### Safe test using Lambda TEST_MODE
```bash
# Set TEST_MODE on auto-failover Lambda (no data changes)
aws lambda update-function-configuration \
  --function-name safebet-auto-failover \
  --region af-south-1 \
  --environment "Variables={
    TEST_MODE=true,
    TEST_STRATEGY=dry_run,
    SUPABASE_SECRET_ARN=<arn>,
    S3_BUCKET=safebetiq-backups-046276255259-eu-north-1,
    S3_PREFIX=backups/production,
    MARKER_PREFIX=restore-complete,
    CRITICAL_TABLES=users,bets,payments
  }"

# Invoke manually
aws lambda invoke \
  --function-name safebet-auto-failover \
  --region af-south-1 \
  --payload '{"Records":[{"Sns":{"Message":"{\"NewStateValue\":\"ALARM\"}"}}]}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/test-result.json && python3 -m json.tool /tmp/test-result.json

# Read CloudWatch logs
aws logs tail /aws/lambda/safebet-auto-failover \
  --region af-south-1 --since 10m --format short
```

### Full DR chain test (use staging only — NEVER production)
```bash
# 1. Force health check to publish 0 for 2 cycles (10 min)
gh workflow run health-check.yml \
  --field force_unhealthy=true \
  --repo SafeBetIQ/SafeBetdemo-main

# 2. Monitor CloudWatch alarm in eu-north-1
watch -n 30 'aws cloudwatch describe-alarms \
  --alarm-names SafeBetDatabaseHealthyAlarm \
  --region eu-north-1 \
  --query "MetricAlarms[0].StateValue"'

# 3. Watch Lambda invocation in eu-north-1
aws logs tail /aws/lambda/safebet-dr-trigger \
  --region eu-north-1 --follow --since 5m

# 4. Watch Lambda invocation in eu-west-1
aws logs tail /aws/lambda/safebet-rds-failover \
  --region eu-west-1 --follow --since 5m
```

### Test result checklist
- [ ] DatabaseHealthy alarm transitioned to ALARM in eu-north-1
- [ ] SNS published to `safebet-dr-alerts` topic
- [ ] `safebet-dr-trigger` Lambda invoked (check CloudWatch logs)
- [ ] `safebet-rds-failover` Lambda invoked (check CloudWatch logs eu-west-1)
- [ ] RDS replica promoted (check `describe-db-instances`)
- [ ] Route53 CNAME updated (check `dig db.safebetiq.com`)
- [ ] `FailoverExecuted=1` metric in SafeBetIQ/DR namespace
- [ ] SNS email received at `alertEmail`
- [ ] RTO measured: _____ minutes (target < 10 min)

---

## 5. RECOVERY VERIFICATION CHECKLIST

After any failover event, confirm ALL of the following before closing the incident:

### Database
- [ ] `safebet-replica-ireland` status = `available` (no longer shows ReadReplica source)
- [ ] Can execute `SELECT COUNT(*) FROM users;` on new primary
- [ ] Can execute `SELECT COUNT(*) FROM bets;`
- [ ] Row counts match last known good values (compare to backup)

### DNS
- [ ] `dig db.safebetiq.com CNAME` resolves to Ireland endpoint
- [ ] TTL propagation complete (wait 60–120s after Route53 change)
- [ ] Application can connect to new endpoint

### Application
- [ ] Amplify frontend loads without error
- [ ] Authentication works (Supabase JWT valid)
- [ ] API routes return 200 (check `/api/dr-status`)
- [ ] No error spike in CloudWatch application logs

### Monitoring
- [ ] Reset `health-check.yml` force_unhealthy flag to false
- [ ] Confirm DatabaseHealthy metric returns to 1
- [ ] Confirm alarm returns to OK state
- [ ] Confirm email received for OK action

---

## 6. MANUAL OVERRIDE — Break Glass

If automated systems are not responding:

### Force DNS switch immediately (bypass Lambda)
```bash
# Get current Ireland replica endpoint
IR_EP=$(aws rds describe-db-instances \
  --db-instance-identifier safebet-replica-ireland \
  --region eu-west-1 \
  --query 'DBInstances[0].Endpoint.Address' --output text)

# Update Route53 directly
aws route53 change-resource-record-sets \
  --hosted-zone-id $HZ_ID \
  --change-batch "{
    \"Changes\": [
      {
        \"Action\": \"UPSERT\",
        \"ResourceRecordSet\": {
          \"Name\": \"db.safebetiq.com\",
          \"Type\": \"CNAME\",
          \"TTL\": 60,
          \"SetIdentifier\": \"secondary-ireland\",
          \"Failover\": \"SECONDARY\",
          \"ResourceRecords\": [{\"Value\": \"$IR_EP\"}]
        }
      }
    ]
  }"
```

### Promote replica manually (if Lambda fails)
```bash
aws rds promote-read-replica \
  --db-instance-identifier safebet-replica-ireland \
  --region eu-west-1

# Wait for promotion (~5 min)
aws rds wait db-instance-available \
  --db-instance-identifier safebet-replica-ireland \
  --region eu-west-1
```

---

## 7. INCIDENT LOG TEMPLATE

```
INCIDENT: SafeBet IQ DR Failover
Date: ____________________
Reported By: ____________________
Detection Time: ____________________
Failover Start: ____________________
Failover Complete: ____________________
RTO (actual): ____________________
RPO (data loss): ____________________

Root Cause: ____________________
Automated failover triggered: YES / NO
Manual intervention required: YES / NO

Actions Taken:
1.
2.
3.

Post-Incident Follow-Up:
[ ] Rebuild replica in original region
[ ] Update runbook if steps were unclear
[ ] Schedule RCA review within 48h
[ ] Test restored system before closing
```

---

## 8. KEY RESOURCE IDS

| Resource | ID / Name | Region |
|----------|-----------|--------|
| Primary RDS | `safebet-primary-capetown` | af-south-1 |
| Replica RDS | `safebet-replica-ireland` | eu-west-1 |
| Backup S3 | `safebetiq-backups-046276255259-eu-north-1` | eu-north-1 |
| Lambda: auto-failover | `safebet-auto-failover` | af-south-1 |
| Lambda: rds-failover | `safebet-rds-failover` | eu-west-1 |
| Lambda: dr-trigger | `safebet-dr-trigger` | eu-north-1 |
| CW Alarm (DNS) | `SafeBetDatabaseHealthyAlarm` | us-east-1 |
| CW Alarm (Lambda) | `SafeBetDatabaseHealthyAlarm` | eu-north-1 |
| SNS Topic | `safebet-dr-alerts` | eu-north-1 |
| Supabase Secret | `safebet/supabase/credentials-v2` | af-south-1 |
| RDS Secret | `safebet/rds/primary/credentials-v2` | af-south-1 |

*Update the HostedZoneId and HealthCheckId rows after first deploy from stack outputs.*
