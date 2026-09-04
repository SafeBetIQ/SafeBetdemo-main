#!/usr/bin/env bash
# ─── ARCH-V4-A2 — Financial Rollup Worker isolation infrastructure (DEMO only) ──
# Provisions the durable-queue + dedicated-worker path that removes the financial
# rollup from shared pg_cron/OLTP scheduling (Architecture Authority v4.0 §9).
# Idempotent-ish; safe to re-run. Region eu-west-1, account 046276255259 (Demo).
#
# NEVER pass the Supabase service-role key on the command line. It is stored in
# Secrets Manager (safebet/demo-supabase-service-role) and read by the worker at
# runtime; this script only references the secret ARN.
#
#   PROVISION (one-time):   ./deploy/a2/provision-financial-rollup.sh
#   Worker source:          workers/financial-rollup/index.mjs
set -euo pipefail

REGION=eu-west-1
ACCT=046276255259
SUPABASE_URL=https://uexdjngogzunjxkpxwll.supabase.co        # DEMO project (public)
SECRET_NAME=safebet/demo-supabase-service-role
FN=safebet-iq-financial-rollup-worker
QUEUE=safebet-iq-financial-rollup
DLQ=safebet-iq-financial-rollup-dlq
WORKER_ROLE=SafeBetIqFinancialRollupWorkerRole
SCHED_ROLE=SafeBetIqSchedulerRole
SCHEDULE=safebet-iq-financial-rollup-schedule

# 1. Secret (service-role key) — create once from an env var, never echoed:
#    NEXT: SRK=<demo service role key> aws secretsmanager create-secret \
#      --name $SECRET_NAME --secret-string "{\"service_role_key\":\"$SRK\"}" --region $REGION
SECRET_ARN=$(aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region $REGION --query ARN --output text)

# 2. DLQ + main queue (redrive maxReceiveCount=3, visibility 180s)
DLQ_URL=$(aws sqs create-queue --queue-name "$DLQ" --region $REGION \
  --attributes MessageRetentionPeriod=1209600 --query QueueUrl --output text)
DLQ_ARN=$(aws sqs get-queue-attributes --queue-url "$DLQ_URL" --region $REGION --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)
REDRIVE="{\"maxReceiveCount\":\"3\",\"deadLetterTargetArn\":\"$DLQ_ARN\"}"
# create main queue via cli-input-json (RedrivePolicy is a JSON string value)
cat > /tmp/main.json <<JSON
{"QueueName":"$QUEUE","Attributes":{"VisibilityTimeout":"180","MessageRetentionPeriod":"345600","RedrivePolicy":$(python3 -c "import json,sys;print(json.dumps('$REDRIVE'))")}}
JSON
MAIN_URL=$(aws sqs create-queue --cli-input-json file:///tmp/main.json --region $REGION --query QueueUrl --output text)
MAIN_ARN=$(aws sqs get-queue-attributes --queue-url "$MAIN_URL" --region $REGION --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)

# 3. Worker execution role (LEAST PRIVILEGE: logs, scoped metrics, one secret, consume one queue)
aws iam create-role --role-name "$WORKER_ROLE" \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' || true
aws iam put-role-policy --role-name "$WORKER_ROLE" --policy-name FinancialRollupWorkerInline --policy-document "{
  \"Version\":\"2012-10-17\",\"Statement\":[
   {\"Sid\":\"Logs\",\"Effect\":\"Allow\",\"Action\":[\"logs:CreateLogGroup\",\"logs:CreateLogStream\",\"logs:PutLogEvents\"],\"Resource\":\"arn:aws:logs:$REGION:$ACCT:log-group:/aws/lambda/$FN*\"},
   {\"Sid\":\"Metrics\",\"Effect\":\"Allow\",\"Action\":[\"cloudwatch:PutMetricData\"],\"Resource\":\"*\",\"Condition\":{\"StringEquals\":{\"cloudwatch:namespace\":\"SafeBet/FinancialRollup\"}}},
   {\"Sid\":\"Secret\",\"Effect\":\"Allow\",\"Action\":[\"secretsmanager:GetSecretValue\"],\"Resource\":\"$SECRET_ARN\"},
   {\"Sid\":\"ConsumeQueue\",\"Effect\":\"Allow\",\"Action\":[\"sqs:ReceiveMessage\",\"sqs:DeleteMessage\",\"sqs:GetQueueAttributes\"],\"Resource\":\"$MAIN_ARN\"}]}"

# 4. Package + create the Lambda (nodejs20.x bundles AWS SDK v3; no deps to vendor)
( cd workers/financial-rollup && zip -q -r /tmp/worker.zip index.mjs )
sleep 10
aws lambda create-function --function-name "$FN" --region $REGION \
  --runtime nodejs20.x --handler index.handler --role "arn:aws:iam::$ACCT:role/$WORKER_ROLE" \
  --zip-file fileb:///tmp/worker.zip --timeout 120 --memory-size 256 \
  --environment "Variables={SUPABASE_URL=$SUPABASE_URL,SUPABASE_SECRET_ID=$SECRET_ARN,MAX_BUCKETS=500}"
aws lambda put-function-concurrency --function-name "$FN" --region $REGION --reserved-concurrent-executions 1   # single writer
aws lambda create-event-source-mapping --function-name "$FN" --region $REGION --event-source-arn "$MAIN_ARN" --batch-size 1 --enabled

# 5. Scheduler role + schedule (rate 15 min -> SQS)
aws iam create-role --role-name "$SCHED_ROLE" \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"scheduler.amazonaws.com"},"Action":"sts:AssumeRole"}]}' || true
aws iam put-role-policy --role-name "$SCHED_ROLE" --policy-name SchedulerSendToQueue \
  --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":[\"sqs:SendMessage\"],\"Resource\":\"$MAIN_ARN\"}]}"
aws scheduler create-schedule --name "$SCHEDULE" --region $REGION \
  --schedule-expression "rate(15 minutes)" --flexible-time-window Mode=OFF --state ENABLED \
  --target "{\"Arn\":\"$MAIN_ARN\",\"RoleArn\":\"arn:aws:iam::$ACCT:role/$SCHED_ROLE\",\"Input\":\"{\\\"trigger\\\":\\\"scheduled\\\"}\"}"

# 6. Observability alarms
aws cloudwatch put-metric-alarm --region $REGION --alarm-name "${DLQ}-not-empty" \
  --namespace AWS/SQS --metric-name ApproximateNumberOfMessagesVisible --dimensions Name=QueueName,Value=$DLQ \
  --statistic Maximum --period 300 --evaluation-periods 1 --threshold 0 --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching
aws cloudwatch put-metric-alarm --region $REGION --alarm-name "${FN}-failures" \
  --namespace SafeBet/FinancialRollup --metric-name RollupFailure \
  --statistic Sum --period 900 --evaluation-periods 1 --threshold 0 --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching

echo "Provisioned. CUTOVER (only after validation): disable pg_cron via SQL:"
echo "  select cron.alter_job((select jobid from cron.job where jobname='sbiq-financial-rollup-refresh'), active => false);"
echo "ROLLBACK: disable schedule + re-enable pg_cron (see docs/runbooks/financial-rollup-worker.md)."
