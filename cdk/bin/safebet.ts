#!/usr/bin/env node
/**
 * SafeBet IQ — CDK App Entry Point
 * ==================================
 * Creates four DR stacks across four AWS regions:
 *
 *   SafeBetDRPrimary  (af-south-1)  — RDS primary, auto-failover Lambda
 *   SafeBetDRAlarm    (us-east-1)   — CloudWatch alarm for Route53 health check
 *   SafeBetDRReplica  (eu-west-1)   — RDS replica, rds-failover Lambda, Route53
 *   SafeBetDRTrigger  (eu-north-1)  — S3 backups, dr-trigger Lambda, CW alarm (SNS chain)
 *
 * WHY FOUR STACKS?
 * ─────────────────────────────────────────────────────────────────────
 * Route53 CloudWatch metric health checks can only reference alarms in
 * us-east-1 (AWS constraint).  A minimal SafeBetDRAlarm stack creates the
 * 'SafeBetDatabaseHealthyAlarm' alarm there.  The trigger stack in eu-north-1
 * maintains a second alarm of the same name that drives the SNS → Lambda
 * failover chain.  The health-check.yml workflow publishes the metric to both.
 *
 * CROSS-REGION REFERENCES
 * ─────────────────────────────────────────────────────────────────────
 * crossRegionReferences: true is set on the primary and replica stacks.
 * CDK uses SSM Parameter Store to resolve primaryStack.primaryDb.dbInstanceEndpointAddress
 * in the replica stack's region — no manual Fn.importValue or user context needed.
 * Requires CDK bootstrap v16+ in all four regions (see step 1 below).
 *
 * REQUIRED BEFORE FIRST DEPLOY:
 *   1. Bootstrap all four regions:
 *        cdk bootstrap aws://ACCOUNT/af-south-1
 *        cdk bootstrap aws://ACCOUNT/us-east-1
 *        cdk bootstrap aws://ACCOUNT/eu-west-1
 *        cdk bootstrap aws://ACCOUNT/eu-north-1
 *
 *   2. Deploy with your account ID:
 *        cdk deploy --all --context account=046276255259 \
 *          --context supabaseDbUser=postgres.uexdjngogzunjxkpxwll \
 *          --context supabaseDbPassword=YOUR_SUPABASE_PASSWORD
 *
 *      CDK deploys in dependency order:
 *        SafeBetDRPrimary + SafeBetDRAlarm + SafeBetDRTrigger  (parallel)
 *        SafeBetDRReplica                                        (after primary + alarm)
 *
 *   3. After deploy, copy stack outputs to Amplify environment variables:
 *        DR_AWS_REGION              = eu-west-1
 *        DR_S3_REGION               = eu-north-1
 *        DR_S3_BUCKET               = <SafeBetDRTrigger.BackupBucketName>
 *        DR_LOG_GROUP               = /aws/lambda/safebet-rds-failover
 *        DR_ROUTE53_HEALTH_CHECK_ID = <SafeBetDRReplica.DbHealthCheckId>
 *        AWS_ACCESS_KEY_ID          = <IAM key with read-only DR access>
 *        AWS_SECRET_ACCESS_KEY      = <IAM secret>
 *
 *   4. Update GitHub Actions secrets:
 *        S3_BUCKET_NAME   = <SafeBetDRTrigger.BackupBucketName>
 *
 *   5. Ensure the GitHub Actions IAM user has:
 *        rds:DescribeDBInstances on arn:aws:rds:af-south-1:ACCOUNT:db:safebet-primary-capetown
 *        cloudwatch:PutMetricData (namespace condition: SafeBetIQ/DR) in us-east-1 + eu-north-1
 *
 * NOTE: Docker Desktop must be running during `cdk deploy` to bundle
 *       the safebet-auto-failover Lambda if the pre-built package/ dir
 *       is absent.  The local bundler (no Docker) is tried first.
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SafeBetDRPrimaryStack }  from '../lib/safebet-dr-primary-stack';
import { SafeBetDRAlarmStack }    from '../lib/safebet-dr-alarm-stack';
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

/* ── Shared props ─────────────────────────────────────────────────────── */
const bucketName = CONFIG.s3BucketName(account);
const baseTags   = commonTags(CONFIG.ENV_TAG);

/* ═══════════════════════════════════════════════════════════════════════
   STACK 1 — Primary  (Cape Town, af-south-1)
   Resources: VPC, RDS Primary, Secrets Manager, Lambda auto-failover,
              IAM, SNS topic

   crossRegionReferences: true — CDK will store the primary DB endpoint
   in SSM Parameter Store so the replica stack can read it cross-region.
   ═══════════════════════════════════════════════════════════════════ */
const primaryStack = new SafeBetDRPrimaryStack(app, 'SafeBetDRPrimary', {
  env:                   { account, region: CONFIG.PRIMARY_REGION },
  description:           'SafeBet IQ — DR Primary (Cape Town): RDS Primary, auto-failover Lambda',
  terminationProtection: false,  // set true for production
  crossRegionReferences: true,   // enables SSM-backed cross-region reference resolution
  tags:                  baseTags,

  account,
  bucketName,
  supabaseDbHost,
  supabaseDbPort,
  supabaseDbName,
  supabaseDbUser,
  supabaseDbPassword,
});

/* ═══════════════════════════════════════════════════════════════════════
   STACK 2 — Alarm  (N. Virginia, us-east-1)
   Resources: CloudWatch alarm 'SafeBetDatabaseHealthyAlarm'

   MUST exist in us-east-1 — Route53 CloudWatch metric health checks
   require the referenced alarm to be in us-east-1.
   No SNS, no Lambda — Route53 reads alarm state directly.
   ═══════════════════════════════════════════════════════════════════ */
const alarmStack = new SafeBetDRAlarmStack(app, 'SafeBetDRAlarm', {
  env:                   { account, region: CONFIG.ALARM_REGION },
  description:           'SafeBet IQ — DR Alarm (N. Virginia): CloudWatch alarm for Route53 health check',
  terminationProtection: false,
  tags:                  baseTags,
});

/* ═══════════════════════════════════════════════════════════════════════
   STACK 3 — Replica  (Ireland, eu-west-1)
   Resources: VPC, RDS Replica (cross-region), Lambda rds-failover,
              Route53 hosted zone + health check + failover records, IAM

   Depends on:
     primaryStack — RDS primary must exist before replica can be created;
                    CDK resolves primaryDb.dbInstanceEndpointAddress via SSM.
     alarmStack   — 'SafeBetDatabaseHealthyAlarm' must exist in us-east-1
                    before the Route53 CfnHealthCheck references it.

   crossRegionReferences: true — enables reading the primary endpoint from
   SSM Parameter Store (written by primaryStack during its deploy).
   ═══════════════════════════════════════════════════════════════════ */
const replicaStack = new SafeBetDRReplicaStack(app, 'SafeBetDRReplica', {
  env:                   { account, region: CONFIG.REPLICA_REGION },
  description:           'SafeBet IQ — DR Replica (Ireland): RDS Replica, rds-failover Lambda, Route53',
  terminationProtection: false,
  crossRegionReferences: true,   // matches primaryStack — resolves SSM-backed reference
  tags:                  baseTags,

  account,
  bucketName,
  hostedZoneName,
  primaryDbId:       CONFIG.PRIMARY_DB_ID,
  primaryRegion:     CONFIG.PRIMARY_REGION,
  // Cross-region reference: CDK resolves this via SSM Parameter Store.
  // primaryStack must have crossRegionReferences: true (set above).
  // The actual RDS endpoint is not known until primaryStack deploys; CDK
  // generates the SSM Put (in af-south-1) and Get (in eu-west-1) automatically.
  primaryDbEndpoint: primaryStack.primaryDb.dbInstanceEndpointAddress,
});

/* ═══════════════════════════════════════════════════════════════════════
   STACK 4 — Trigger  (Stockholm, eu-north-1)
   Resources: S3 backup bucket, Lambda dr-trigger, SNS, CloudWatch alarm
              (this alarm drives the SNS → Lambda failover chain)
   ═══════════════════════════════════════════════════════════════════ */
const triggerStack = new SafeBetDRTriggerStack(app, 'SafeBetDRTrigger', {
  env:                   { account, region: CONFIG.TRIGGER_REGION },
  description:           'SafeBet IQ — DR Trigger (Stockholm): S3 backups, dr-trigger Lambda, CW alarm',
  terminationProtection: false,
  tags:                  baseTags,

  account,
  bucketName,
});

/* ── Deployment ordering ─────────────────────────────────────────────── */
// Replica must deploy after primary (needs the RDS endpoint via SSM)
// and after alarm (Route53 health check must reference an existing alarm).
replicaStack.addDependency(primaryStack);
replicaStack.addDependency(alarmStack);

// Suppress unused-variable warnings — triggerStack is referenced
// for ordering context but has no cross-stack dependencies here.
void triggerStack;

/* ── Global tags ─────────────────────────────────────────────────────── */
for (const [k, v] of Object.entries(baseTags)) {
  cdk.Tags.of(app).add(k, v);
}
