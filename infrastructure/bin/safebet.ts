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
 * REQUIRED BEFORE FIRST DEPLOY:
 *   1. Bootstrap all four regions:
 *        npx cdk bootstrap aws://ACCOUNT/af-south-1
 *        npx cdk bootstrap aws://ACCOUNT/us-east-1
 *        npx cdk bootstrap aws://ACCOUNT/eu-west-1
 *        npx cdk bootstrap aws://ACCOUNT/eu-north-1
 *
 *   2. Create secrets in Secrets Manager BEFORE deploying:
 *        aws secretsmanager create-secret \
 *          --name safebet/rds/primary/credentials-v2 \
 *          --region af-south-1 \
 *          --secret-string '{"username":"safebet_admin","password":"CHANGE_ME"}'
 *
 *        aws secretsmanager create-secret \
 *          --name safebet/supabase/credentials-v2 \
 *          --region af-south-1 \
 *          --secret-string '{"host":"aws-0-eu-west-1.pooler.supabase.com","port":"6543","dbname":"postgres","username":"postgres.PROJECTREF","password":"CHANGE_ME"}'
 *
 *   3. Deploy (production):
 *        npx cdk deploy --all \
 *          --context account=046276255259 \
 *          --context env=Production \
 *          --context alertEmail=oncall@safebetiq.com \
 *          --context hostedZoneName=safebetiq.com
 *
 *      If your Route53 hosted zone already exists, also pass:
 *          --context hostedZoneId=ZXXXXXXXXXX
 *
 *   4. After deploy, copy stack outputs to Amplify + GitHub Actions secrets.
 *      See DR_DEPLOY.md for the complete post-deploy checklist.
 *
 * SECURITY NOTE:
 *   Supabase credentials are stored in AWS Secrets Manager (safebet/supabase/credentials-v2).
 *   They must NOT be passed on the command line or committed to the repo.
 *   The Lambda reads them via GetSecretValue at runtime using SUPABASE_SECRET_ARN.
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SafeBetDRPrimaryStack }  from '../lib/safebet-dr-primary-stack';
import { SafeBetDRAlarmStack }    from '../lib/safebet-dr-alarm-stack';
import { SafeBetDRReplicaStack }  from '../lib/safebet-dr-replica-stack';
import { SafeBetDRTriggerStack }  from '../lib/safebet-dr-trigger-stack';
import { CONFIG, getEnvTag, commonTags } from '../lib/shared-config';

const app = new cdk.App();

/* ── Required context ─────────────────────────────────────────────────── */
const account = app.node.tryGetContext('account') as string | undefined
  ?? process.env.CDK_DEFAULT_ACCOUNT;

if (!account) {
  throw new Error(
    '\n❌  AWS account ID is required.\n' +
    '    Pass it with: --context account=YOUR_ACCOUNT_ID\n' +
    '    Example: npx cdk deploy --all --context account=046276255259\n'
  );
}

/* ── Optional context ─────────────────────────────────────────────────── */
const deployEnv      = (app.node.tryGetContext('env')           as string | undefined) ?? 'Demo';
const alertEmail     = (app.node.tryGetContext('alertEmail')    as string | undefined) ?? '';
const hostedZoneName = (app.node.tryGetContext('hostedZoneName') as string | undefined) ?? 'safebetiq.com';
const hostedZoneId   = (app.node.tryGetContext('hostedZoneId')  as string | undefined) ?? '';

// SECURITY: Supabase credentials are read from Secrets Manager at Lambda runtime.
// They are NOT passed as CDK context to prevent accidental logging or exposure.
// Ensure the secret safebet/supabase/credentials-v2 exists in af-south-1 before deploying.

if (!alertEmail) {
  console.warn(
    '\n⚠️  alertEmail not provided — SNS alarm subscriptions will have no email recipient.\n' +
    '   Pass with: --context alertEmail=oncall@safebetiq.com\n'
  );
}

/* ── Shared props ─────────────────────────────────────────────────────── */
const bucketName = CONFIG.s3BucketName(account);
const envTag     = getEnvTag(deployEnv);
const baseTags   = commonTags(envTag);

console.log(`\n[SafeBet CDK] Deploying with env=${envTag} account=${account} region=multi\n`);

/* ═══════════════════════════════════════════════════════════════════════
   STACK 1 — Primary  (Cape Town, af-south-1)
   ═══════════════════════════════════════════════════════════════════ */
const primaryStack = new SafeBetDRPrimaryStack(app, 'SafeBetDRPrimary', {
  env:                   { account, region: CONFIG.PRIMARY_REGION },
  description:           'SafeBet IQ — DR Primary (Cape Town): RDS Primary, auto-failover Lambda',
  terminationProtection: true,
  crossRegionReferences: true,
  tags:                  baseTags,

  account,
  bucketName,
  alertEmail,
});

/* ═══════════════════════════════════════════════════════════════════════
   STACK 2 — Alarm  (N. Virginia, us-east-1)
   Route53 CloudWatch metric health checks REQUIRE the alarm in us-east-1.
   ═══════════════════════════════════════════════════════════════════ */
const alarmStack = new SafeBetDRAlarmStack(app, 'SafeBetDRAlarm', {
  env:                   { account, region: CONFIG.ALARM_REGION },
  description:           'SafeBet IQ — DR Alarm (N. Virginia): CloudWatch alarm for Route53 health check',
  terminationProtection: true,
  crossRegionReferences: true,
  tags:                  baseTags,

  alertEmail,
});

/* ═══════════════════════════════════════════════════════════════════════
   STACK 3 — Replica  (Ireland, eu-west-1)
   Depends on primaryStack (RDS endpoint) and alarmStack (health check ID).
   ═══════════════════════════════════════════════════════════════════ */
const replicaStack = new SafeBetDRReplicaStack(app, 'SafeBetDRReplica', {
  env:                   { account, region: CONFIG.REPLICA_REGION },
  description:           'SafeBet IQ — DR Replica (Ireland): RDS Replica, rds-failover Lambda, Route53',
  terminationProtection: true,
  crossRegionReferences: true,
  tags:                  baseTags,

  account,
  bucketName,
  hostedZoneName,
  hostedZoneId,        // if set, imports existing zone instead of creating new one
  alertEmail,
  primaryDbId:       CONFIG.PRIMARY_DB_ID,
  primaryRegion:     CONFIG.PRIMARY_REGION,
  primaryDbEndpoint: primaryStack.primaryDb.dbInstanceEndpointAddress,
  healthCheckId:     alarmStack.dbHealthCheck.attrHealthCheckId,
});

/* ═══════════════════════════════════════════════════════════════════════
   STACK 4 — Trigger  (Stockholm, eu-north-1)
   ═══════════════════════════════════════════════════════════════════ */
const triggerStack = new SafeBetDRTriggerStack(app, 'SafeBetDRTrigger', {
  env:                   { account, region: CONFIG.TRIGGER_REGION },
  description:           'SafeBet IQ — DR Trigger (Stockholm): S3 backups, dr-trigger Lambda, CW alarm',
  terminationProtection: true,
  tags:                  baseTags,

  account,
  bucketName,
  alertEmail,
});

/* ── Deployment ordering ─────────────────────────────────────────────── */
replicaStack.addDependency(primaryStack);
replicaStack.addDependency(alarmStack);

void triggerStack;

/* ── Global tags ─────────────────────────────────────────────────────── */
for (const [k, v] of Object.entries(baseTags)) {
  cdk.Tags.of(app).add(k, v);
}
