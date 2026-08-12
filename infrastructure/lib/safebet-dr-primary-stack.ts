/**
 * SafeBet IQ — DR Primary Stack  (af-south-1, Cape Town)
 * =========================================================
 * Provisions the PRIMARY side of the DR system:
 *
 *   • VPC           — isolated subnets for RDS (no NAT, no cost)
 *   • RDS           — PostgreSQL 15 t4g.micro primary instance
 *                     Multi-AZ enabled for HA within Cape Town
 *   • Secrets Mgr   — imported RDS + Supabase credentials (no plaintext)
 *   • Lambda        — safebet-auto-failover (S3 → Supabase restore)
 *   • IAM role      — least-privilege role for auto-failover Lambda
 *   • CloudWatch    — Log group for Lambda execution
 *   • SNS           — DR alert topic
 *
 * SECURITY:
 *   Supabase credentials are stored in Secrets Manager under
 *   CONFIG.SECRET_SUPABASE_CREDS and read by the Lambda at runtime
 *   via GetSecretValue.  They are NEVER present as plaintext env vars.
 *
 * OUTPUTS (copy to Amplify env vars after deploy):
 *   PrimaryDbEndpoint   — RDS writer endpoint
 *   PrimaryDbIdentifier — RDS instance ID
 *   PrimaryDbSecretArn  — Secrets Manager ARN for DB creds
 *   AutoFailoverLambdaArn
 */

import * as cdk          from 'aws-cdk-lib';
import * as ec2          from 'aws-cdk-lib/aws-ec2';
import * as rds          from 'aws-cdk-lib/aws-rds';
import * as lambda       from 'aws-cdk-lib/aws-lambda';
import * as iam          from 'aws-cdk-lib/aws-iam';
import * as sns          from 'aws-cdk-lib/aws-sns';
import * as sns_subs     from 'aws-cdk-lib/aws-sns-subscriptions';
import * as logs         from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as path         from 'path';
import * as fs           from 'fs';
import { Construct }     from 'constructs';
import { CONFIG }        from './shared-config';

/* ── Stack props ─────────────────────────────────────────────────────── */
export interface SafeBetDRPrimaryProps extends cdk.StackProps {
  account:    string;
  bucketName: string;
  alertEmail: string;   // SNS email subscription (empty = no subscription)
}

/* ═══════════════════════════════════════════════════════════════════════
   STACK
   ═══════════════════════════════════════════════════════════════════ */
export class SafeBetDRPrimaryStack extends cdk.Stack {

  public readonly primaryDb:      rds.DatabaseInstance;
  public readonly dbSecret:       secretsmanager.ISecret;
  public readonly drAlertsTopic:  sns.Topic;

  constructor(scope: Construct, id: string, props: SafeBetDRPrimaryProps) {
    super(scope, id, props);

    /* ── 1. VPC — isolated subnets only (no NAT = no cost) ─────────── */
    const vpc = new ec2.Vpc(this, 'DrPrimaryVpc', {
      vpcName:     'safebet-dr-primary-vpc',
      ipAddresses: ec2.IpAddresses.cidr('10.10.0.0/16'),
      maxAzs:      2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name:       'DrIsolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask:   24,
        },
      ],
      enableDnsHostnames: true,
      enableDnsSupport:   true,
    });

    /* ── 2. Security group — RDS only reachable within VPC ─────────── */
    const rdsSg = new ec2.SecurityGroup(this, 'PrimaryRdsSg', {
      vpc,
      securityGroupName: 'safebet-primary-rds-sg',
      description:       'SafeBet RDS primary - PostgreSQL from VPC only',
      allowAllOutbound:  false,
    });
    rdsSg.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'PostgreSQL from VPC CIDR',
    );

    /* ── 3. Secrets Manager — import existing RDS credentials ──────── */
    this.dbSecret = secretsmanager.Secret.fromSecretNameV2(
      this, 'PrimaryDbSecret', CONFIG.SECRET_RDS_CREDS,
    );

    /* ── 4. Supabase credentials secret (for auto-failover Lambda) ─── */
    // Credentials are stored in Secrets Manager and read by the Lambda
    // at runtime via GetSecretValue — never passed as plaintext env vars.
    const supabaseSecret = secretsmanager.Secret.fromSecretNameV2(
      this, 'SupabaseSecret', CONFIG.SECRET_SUPABASE_CREDS,
    );

    /* ── 5. RDS — PostgreSQL 15, Multi-AZ, deletion-protected ───────── */
    this.primaryDb = new rds.DatabaseInstance(this, 'PrimaryDb', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.MICRO,
      ),
      instanceIdentifier: CONFIG.PRIMARY_DB_ID,
      databaseName:       CONFIG.DB_NAME,

      vpc,
      vpcSubnets:     { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [rdsSg],

      credentials: rds.Credentials.fromSecret(this.dbSecret),

      // Backup retention >= 1 day is REQUIRED for cross-region replica
      backupRetention:          cdk.Duration.days(CONFIG.RDS_BACKUP_DAYS),
      preferredBackupWindow:    '02:00-03:00',
      preferredMaintenanceWindow: 'Mon:03:00-Mon:04:00',

      allocatedStorage:    CONFIG.RDS_STORAGE_GB,
      maxAllocatedStorage: CONFIG.RDS_MAX_STORAGE_GB,
      storageType:         rds.StorageType.GP3,
      storageEncrypted:    true,

      // Multi-AZ: synchronous standby in a second AZ within Cape Town.
      // Eliminates single-AZ failure as a DR gap. Adds ~$50/month for t4g.micro.
      multiAz:            true,
      publiclyAccessible: false,

      // Enhanced monitoring: free at 60s interval
      monitoringInterval: cdk.Duration.seconds(60),

      // Performance Insights: free tier (7 days retention)
      enablePerformanceInsights:      true,
      performanceInsightRetention:    rds.PerformanceInsightRetention.DEFAULT,

      // Production hardening
      deletionProtection: true,
      removalPolicy:      cdk.RemovalPolicy.RETAIN,

      cloudwatchLogsExports:   ['postgresql', 'upgrade'],
      cloudwatchLogsRetention: logs.RetentionDays.ONE_MONTH,
    });

    /* ── 6. IAM role for safebet-auto-failover Lambda ────────────────── */
    const autoFailoverRole = new iam.Role(this, 'AutoFailoverRole', {
      roleName:    'safebet-auto-failover-role',
      assumedBy:   new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Execution role for safebet-auto-failover Lambda (S3 to Supabase restore)',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        ),
      ],
    });

    autoFailoverRole.addToPolicy(new iam.PolicyStatement({
      sid:     'S3BackupRead',
      effect:  iam.Effect.ALLOW,
      actions: ['s3:GetObject', 's3:ListBucket'],
      resources: [
        `arn:aws:s3:::${props.bucketName}`,
        `arn:aws:s3:::${props.bucketName}/*`,
      ],
    }));
    autoFailoverRole.addToPolicy(new iam.PolicyStatement({
      sid:     'S3RestoreMarkerWrite',
      effect:  iam.Effect.ALLOW,
      actions: ['s3:PutObject'],
      resources: [`arn:aws:s3:::${props.bucketName}/${CONFIG.S3_MARKER_PREFIX}/*`],
      conditions: {
        StringEquals: { 's3:x-amz-server-side-encryption': 'AES256' },
      },
    }));
    autoFailoverRole.addToPolicy(new iam.PolicyStatement({
      sid:     'CloudWatchMetrics',
      effect:  iam.Effect.ALLOW,
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
      conditions: {
        StringEquals: { 'cloudwatch:namespace': CONFIG.CW_NAMESPACE },
      },
    }));
    autoFailoverRole.addToPolicy(new iam.PolicyStatement({
      sid:     'CloudWatchLogs',
      effect:  iam.Effect.ALLOW,
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: [
        `arn:aws:logs:${this.region}:${props.account}:log-group:/aws/lambda/${CONFIG.AUTO_FAILOVER_FN}:*`,
      ],
    }));
    // Secrets Manager: read Supabase credentials — eliminates plaintext password
    autoFailoverRole.addToPolicy(new iam.PolicyStatement({
      sid:     'ReadSupabaseSecret',
      effect:  iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: [supabaseSecret.secretArn],
    }));

    /* ── 7. CloudWatch Log Group for Lambda ─────────────────────────── */
    const autoFailoverLogGroup = new logs.LogGroup(this, 'AutoFailoverLogGroup', {
      logGroupName:  `/aws/lambda/${CONFIG.AUTO_FAILOVER_FN}`,
      retention:     logs.RetentionDays.THREE_MONTHS,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    /* Sections 8 & 9 (AutoFailover Lambda + its error alarm) REMOVED —
       obsolete DR auto-failover Lambda retired (Stage B2A). The dedicated
       IAM role (section 6) and log group (section 7) are intentionally
       RETAINED pending a later IAM/log cleanup milestone. */

    /* ── 10. SNS topic — DR alerts ──────────────────────────────────── */
    this.drAlertsTopic = new sns.Topic(this, 'DrAlertsTopic', {
      topicName:   CONFIG.SNS_TOPIC_NAME,
      displayName: 'SafeBet IQ — DR Alerts',
    });

    if (props.alertEmail) {
      this.drAlertsTopic.addSubscription(
        new sns_subs.EmailSubscription(props.alertEmail)
      );
    }

    /* ── 11. Stack outputs ───────────────────────────────────────────── */
    new cdk.CfnOutput(this, 'PrimaryDbEndpoint', {
      value:       this.primaryDb.dbInstanceEndpointAddress,
      description: 'RDS primary endpoint',
      exportName:  'SafeBetPrimaryDbEndpoint',
    });
    new cdk.CfnOutput(this, 'PrimaryDbIdentifier', {
      value:       CONFIG.PRIMARY_DB_ID,
      description: 'RDS primary instance identifier',
      exportName:  'SafeBetPrimaryDbId',
    });
    new cdk.CfnOutput(this, 'PrimaryDbSecretArn', {
      value:       this.dbSecret.secretArn,
      description: 'Secrets Manager ARN — RDS admin credentials',
      exportName:  'SafeBetPrimaryDbSecretArn',
    });
    new cdk.CfnOutput(this, 'DrAlertsTopicArn', {
      value:       this.drAlertsTopic.topicArn,
      description: 'SNS DR alerts topic ARN',
      exportName:  'SafeBetDrAlertsTopicArn',
    });
    new cdk.CfnOutput(this, 'SupabaseSecretArn', {
      value:       supabaseSecret.secretArn,
      description: 'Secrets Manager ARN — Supabase credentials for Lambda',
      exportName:  'SafeBetSupabaseSecretArn',
    });
  }
}
