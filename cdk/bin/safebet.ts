#!/usr/bin/env node
/**
 * SafeBet IQ — CDK App Entry Point
 * ==================================
 * Creates three DR stacks across three AWS regions:
 *
 *   SafeBetDRPrimary  (af-south-1)  — RDS primary, auto-failover Lambda
 *   SafeBetDRReplica  (eu-west-1)   — RDS replica, rds-failover Lambda, Route53
 *   SafeBetDRTrigger  (eu-north-1)  — S3 backups, dr-trigger Lambda, CloudWatch alarm
 *
 * REQUIRED BEFORE FIRST DEPLOY:
 *   1. Bootstrap all three regions:
 *        cdk bootstrap aws://ACCOUNT/af-south-1
 *        cdk bootstrap aws://ACCOUNT/eu-west-1
 *        cdk bootstrap aws://ACCOUNT/eu-north-1
 *
 *   2. Deploy with your account ID:
 *        cdk deploy --all --context account=046276255259 \
 *          --context supabaseDbUser=postgres.uexdjngogzunjxkpxwll \
 *          --context supabaseDbPassword=YOUR_SUPABASE_PASSWORD
 *
 *   3. After deploy, copy stack outputs to Amplify environment variables:
 *        DR_AWS_REGION            = eu-west-1
 *        DR_S3_REGION             = eu-north-1
 *        DR_S3_BUCKET             = <SafeBetDRTrigger.BackupBucketName>
 *        DR_LOG_GROUP             = /aws/lambda/safebet-rds-failover
 *        DR_ROUTE53_HEALTH_CHECK_ID = <SafeBetDRReplica.HealthCheckId>
 *        AWS_ACCESS_KEY_ID        = <IAM key with read-only DR access>
 *        AWS_SECRET_ACCESS_KEY    = <IAM secret>
 *
 * NOTE: Docker Desktop must be running during `cdk deploy` to bundle
 *       the safebet-auto-failover Lambda (psycopg2 binary dependency).
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SafeBetDRPrimaryStack }  from '../lib/safebet-dr-primary-stack';
import { SafeBetDRReplicaStack }  from '../lib/safebet-dr-replica-stack';
import { SafeBetDRTriggerStack }  from '../lib/safebet-dr-trigger-stack';
import { CONFIG, commonTags }     from '../lib/shared-config';

const app = new cdk.App();

/* ── Resolve required context ─────────────────────────────────────────── */
const account = app.node.tryGetContext('account') as string | undefined
  ?? process.env.CDK_DEFAULT_ACCOUNT;

if (!account) {
  throw new Error(
    '\n❌  AWS account ID is required.\n' +
    '    Pass it with: --context account=YOUR_ACCOUNT_ID\n' +
    '    Example: cdk deploy --all --context account=046276255259\n'
  );
}

/* ── Optional context ─────────────────────────────────────────────────── */
const hostedZoneName    = (app.node.tryGetContext('hostedZoneName')      as string | undefined) ?? 'safebetiq.com';
const supabaseDbHost    = (app.node.tryGetContext('supabaseDbHost')      as string | undefined) ?? 'aws-0-eu-west-1.pooler.supabase.com';
const supabaseDbPort    = (app.node.tryGetContext('supabaseDbPort')      as string | undefined) ?? '6543';
const supabaseDbName    = (app.node.tryGetContext('supabaseDbName')      as string | undefined) ?? 'postgres';
const supabaseDbUser    = (app.node.tryGetContext('supabaseDbUser')      as string | undefined) ?? '';
const supabaseDbPassword = (app.node.tryGetContext('supabaseDbPassword') as string | undefined) ?? '';

if (!supabaseDbUser || !supabaseDbPassword) {
  console.warn(
    '\n⚠️  Supabase credentials not provided — safebet-auto-failover Lambda will have empty DB env vars.\n' +
    '   Pass with: --context supabaseDbUser=postgres.PROJECTREF --context supabaseDbPassword=SECRET\n'
  );
}

/* ── Shared stack props ───────────────────────────────────────────────── */
const bucketName = CONFIG.s3BucketName(account);

const baseTags = commonTags(CONFIG.ENV_TAG);

/* ═══════════════════════════════════════════════════════════════════════
   STACK 1 — Primary  (Cape Town, af-south-1)
   Resources: VPC, RDS Primary, Secrets Manager, Lambda auto-failover,
              IAM, SNS topic
   ═══════════════════════════════════════════════════════════════════ */
const primaryStack = new SafeBetDRPrimaryStack(app, 'SafeBetDRPrimary', {
  env:              { account, region: CONFIG.PRIMARY_REGION },
  description:      'SafeBet IQ — DR Primary (Cape Town): RDS Primary, auto-failover Lambda',
  terminationProtection: false,  // set true for production
  tags:             baseTags,

  account,
  bucketName,
  supabaseDbHost,
  supabaseDbPort,
  supabaseDbName,
  supabaseDbUser,
  supabaseDbPassword,
});

/* ═══════════════════════════════════════════════════════════════════════
   STACK 2 — Replica  (Ireland, eu-west-1)
   Resources: VPC, RDS Replica (cross-region), Lambda rds-failover,
              Route53 hosted zone + health check + failover records, IAM
   ═══════════════════════════════════════════════════════════════════ */
const replicaStack = new SafeBetDRReplicaStack(app, 'SafeBetDRReplica', {
  env:              { account, region: CONFIG.REPLICA_REGION },
  description:      'SafeBet IQ — DR Replica (Ireland): RDS Replica, rds-failover Lambda, Route53',
  terminationProtection: false,
  tags:             baseTags,

  account,
  bucketName,
  hostedZoneName,
  primaryDbId:      CONFIG.PRIMARY_DB_ID,
  primaryRegion:    CONFIG.PRIMARY_REGION,
});

/* ═══════════════════════════════════════════════════════════════════════
   STACK 3 — Trigger  (Stockholm, eu-north-1)
   Resources: S3 backup bucket, Lambda dr-trigger, SNS, CloudWatch alarm
              (alarm fires when DatabaseHealthy metric drops to 0)
   ═══════════════════════════════════════════════════════════════════ */
const triggerStack = new SafeBetDRTriggerStack(app, 'SafeBetDRTrigger', {
  env:              { account, region: CONFIG.TRIGGER_REGION },
  description:      'SafeBet IQ — DR Trigger (Stockholm): S3 backups, dr-trigger Lambda, CW alarm',
  terminationProtection: false,
  tags:             baseTags,

  account,
  bucketName,
});

/* ── Deployment ordering ─────────────────────────────────────────────── */
// Replica depends on primary RDS being created first
replicaStack.addDependency(primaryStack);

/* ── Tags ────────────────────────────────────────────────────────────── */
// Apply tags to every resource in every stack
for (const [k, v] of Object.entries(baseTags)) {
  cdk.Tags.of(app).add(k, v);
}
