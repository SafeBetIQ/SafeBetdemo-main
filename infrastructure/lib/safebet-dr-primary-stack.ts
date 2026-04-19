/**
 * SafeBet IQ — DR Primary Stack  (af-south-1, Cape Town)
 * =========================================================
 * Provisions the PRIMARY side of the DR system:
 *
 *   • VPC           — isolated subnets for RDS (no NAT, no cost)
 *   • RDS           — PostgreSQL 15 t4g.micro primary instance
 *   • Secrets Mgr   — auto-rotated DB credentials (never in plaintext)
 *   • Lambda        — safebet-auto-failover (S3 → Supabase restore)
 *   • IAM role      — least-privilege role for auto-failover Lambda
 *   • CloudWatch    — Log group for Lambda execution
 *   • SNS           — DR alert topic (subscribed by dr-trigger in eu-north-1)
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
import * as logs         from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as path         from 'path';
import * as fs           from 'fs';
import { Construct }     from 'constructs';
import { CONFIG }        from './shared-config';

/* ── Stack props ─────────────────────────────────────────────────────── */
export interface SafeBetDRPrimaryProps extends cdk.StackProps {
  account:             string;
  bucketName:          string;
  supabaseDbHost:      string;
  supabaseDbPort:      string;
  supabaseDbName:      string;
  supabaseDbUser:      string;
  supabaseDbPassword:  string;
}

/* ═══════════════════════════════════════════════════════════════════════
   STACK
   ═══════════════════════════════════════════════════════════════════ */
export class SafeBetDRPrimaryStack extends cdk.Stack {

  /** Expose for cross-stack references within the CDK app */
  public readonly primaryDb:          rds.DatabaseInstance;
  public readonly dbSecret:           secretsmanager.ISecret;
  public readonly autoFailoverFn:     lambda.Function;
  public readonly drAlertsTopic:      sns.Topic;

  constructor(scope: Construct, id: string, props: SafeBetDRPrimaryProps) {
    super(scope, id, props);

    /* ── 1. VPC — isolated subnets only (no NAT = no cost) ─────────── */
    // Lambda functions are deployed OUTSIDE the VPC — they use public AWS
    // API endpoints (boto3) and the public Supabase pooler.  The VPC exists
    // solely to keep the RDS instance off the public internet.
    const vpc = new ec2.Vpc(this, 'DrPrimaryVpc', {
      vpcName:     'safebet-dr-primary-vpc',
      ipAddresses: ec2.IpAddresses.cidr('10.10.0.0/16'),
      maxAzs:      2,
      natGateways: 0,   // ← saves ~$32/month; Lambda does not need VPC
      subnetConfiguration: [
        {
          name:           'DrIsolated',
          subnetType:     ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask:       24,
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

    /* ── 3. Secrets Manager — import existing RDS credentials ──────────── */
    // Secret already exists in AWS — importing instead of creating to avoid
    // AlreadyExists errors. Use fromSecretNameV2 for path-style secret names.
    this.dbSecret = secretsmanager.Secret.fromSecretNameV2(
      this, 'PrimaryDbSecret', CONFIG.SECRET_RDS_CREDS,
    );

    /* ── 4. Supabase credentials secret (for auto-failover Lambda) ─── */
    // Secret already exists in AWS — importing instead of creating to avoid
    // AlreadyExists errors. The Lambda reads credentials from env vars directly;
    // the secret ARN is passed as SUPABASE_SECRET_ARN for future GetSecretValue use.
    const supabaseSecret = secretsmanager.Secret.fromSecretNameV2(
      this, 'SupabaseSecret', CONFIG.SECRET_SUPABASE_CREDS,
    );

    /* ── 5. RDS — PostgreSQL 15, t4g.micro, no Multi-AZ (demo) ──────── */
    this.primaryDb = new rds.DatabaseInstance(this, 'PrimaryDb', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_13,
      }),
      instanceType:       ec2.InstanceType.of(
                            ec2.InstanceClass.T4G,
                            ec2.InstanceSize.MICRO,
                          ),
      instanceIdentifier: CONFIG.PRIMARY_DB_ID,
      databaseName:       CONFIG.DB_NAME,

      vpc,
      vpcSubnets:         { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups:     [rdsSg],

      credentials:        rds.Credentials.fromSecret(this.dbSecret),

      // Backup retention >= 1 day is REQUIRED to create a cross-region replica
      backupRetention:    cdk.Duration.days(CONFIG.RDS_BACKUP_DAYS),
      preferredBackupWindow: '02:00-03:00',     // 2 AM UTC (4 AM SAST)
      preferredMaintenanceWindow: 'Mon:03:00-Mon:04:00',

      allocatedStorage:   CONFIG.RDS_STORAGE_GB,
      maxAllocatedStorage: CONFIG.RDS_MAX_STORAGE_GB,
      storageType:        rds.StorageType.GP3,
      storageEncrypted:   true,

      multiAz:            false,   // single-AZ for demo cost
      publiclyAccessible: false,

      // Enable enhanced monitoring (free tier: 60s interval)
      monitoringInterval: cdk.Duration.seconds(60),

      enablePerformanceInsights: false,  // free tier only 7 days; skip for demo

      deletionProtection: false,    // set true for production
      removalPolicy:      cdk.RemovalPolicy.DESTROY,

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

    // S3: read backups + write restore marker
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

    // CloudWatch: emit DR metrics
    autoFailoverRole.addToPolicy(new iam.PolicyStatement({
      sid:     'CloudWatchMetrics',
      effect:  iam.Effect.ALLOW,
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
      conditions: {
        StringEquals: { 'cloudwatch:namespace': CONFIG.CW_NAMESPACE },
      },
    }));

    // CloudWatch Logs: write to log group
    autoFailoverRole.addToPolicy(new iam.PolicyStatement({
      sid:     'CloudWatchLogs',
      effect:  iam.Effect.ALLOW,
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: [
        `arn:aws:logs:${this.region}:${props.account}:log-group:/aws/lambda/${CONFIG.AUTO_FAILOVER_FN}:*`,
      ],
    }));

    // Secrets Manager: read Supabase credentials
    autoFailoverRole.addToPolicy(new iam.PolicyStatement({
      sid:     'ReadSupabaseSecret',
      effect:  iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: [supabaseSecret.secretArn],
    }));

    /* ── 7. CloudWatch Log Group for Lambda ─────────────────────────── */
    const autoFailoverLogGroup = new logs.LogGroup(this, 'AutoFailoverLogGroup', {
      logGroupName:    `/aws/lambda/${CONFIG.AUTO_FAILOVER_FN}`,
      retention:       logs.RetentionDays.ONE_MONTH,
      removalPolicy:   cdk.RemovalPolicy.DESTROY,
    });

    /* ── 8. Lambda — safebet-auto-failover ───────────────────────────── */
    // Bundling strategy (tried in order):
    //   LOCAL  — copies the pre-built package/ dir; no Docker required.
    //            Rebuild with: cd lambda/safebet-auto-failover &&
    //              pip install -r requirements.txt -t package \
    //                --platform manylinux2014_x86_64 --only-binary=:all: \
    //                --implementation cp --python-version 3.12
    //   DOCKER — clean build via Docker (requires Docker Desktop).
    const lambdaSrcDir = path.join(__dirname, '../../lambda/safebet-auto-failover');

    this.autoFailoverFn = new lambda.Function(this, 'AutoFailoverFn', {
      functionName:  CONFIG.AUTO_FAILOVER_FN,
      description:   'DR: stream S3 pg_dump backup → restore to Supabase PostgreSQL',
      runtime:       lambda.Runtime.PYTHON_3_12,
      architecture:  lambda.Architecture.X86_64,
      handler:       'lambda_function.lambda_handler',
      role:          autoFailoverRole,
      timeout:       cdk.Duration.minutes(CONFIG.LAMBDA_TIMEOUT_MIN),
      memorySize:    CONFIG.LAMBDA_MEMORY_MB,
      logGroup:      autoFailoverLogGroup,

      code: lambda.Code.fromAsset(lambdaSrcDir, {
        bundling: {
          image:    lambda.Runtime.PYTHON_3_12.bundlingImage,
          platform: 'linux/amd64',

          // ── Local bundler: uses pre-built package/ dir (no Docker) ──
          local: {
            tryBundle(outputDir: string): boolean {
              const packageDir = path.join(lambdaSrcDir, 'package');
              const pyFile     = path.join(lambdaSrcDir, 'lambda_function.py');
              if (!fs.existsSync(packageDir) || !fs.existsSync(pyFile)) {
                return false;  // fall through to Docker
              }
              try {
                fs.cpSync(packageDir, outputDir, { recursive: true });
                fs.copyFileSync(pyFile, path.join(outputDir, 'lambda_function.py'));
                return true;
              } catch { return false; }
            },
          },

          // ── Docker fallback: clean build from PyPI ───────────────────
          command: [
            'bash', '-c',
            [
              'pip install -r requirements.txt -t /asset-output'
              + ' --platform manylinux2014_x86_64'
              + ' --only-binary=:all:'
              + ' --implementation cp'
              + ' --python-version 3.12'
              + ' --no-compile',
              'cp *.py /asset-output/',
            ].join(' && '),
          ],
        },
      }),

      environment: {
        S3_BUCKET:       props.bucketName,
        S3_PREFIX:       CONFIG.S3_BACKUP_PREFIX,
        MARKER_PREFIX:   CONFIG.S3_MARKER_PREFIX,
        CRITICAL_TABLES: 'users,bets,payments',
        // Supabase credentials — passed as env vars for compatibility with
        // existing Lambda code.  For production: update Lambda to call
        // secretsmanager:GetSecretValue using SUPABASE_SECRET_ARN below.
        DB_HOST:         props.supabaseDbHost,
        DB_PORT:         props.supabaseDbPort,
        DB_NAME:         props.supabaseDbName,
        DB_USER:         props.supabaseDbUser,
        DB_PASSWORD:     props.supabaseDbPassword,
        SUPABASE_SECRET_ARN: supabaseSecret.secretArn,  // future use
      },

      retryAttempts: 0,   // no retry — failover must not be attempted twice
    });

    /* ── 9. SNS topic — DR alerts ────────────────────────────────────── */
    // The dr-trigger Lambda in eu-north-1 subscribes to this topic.
    // Note: SNS cross-region subscriptions are not supported — the alarm
    // in eu-north-1 will fire the dr-trigger Lambda directly in that region.
    // This topic is available for optional email/Slack alerting.
    this.drAlertsTopic = new sns.Topic(this, 'DrAlertsTopic', {
      topicName:   CONFIG.SNS_TOPIC_NAME,
      displayName: 'SafeBet IQ — DR Alerts',
    });

    /* ── 10. Stack outputs ───────────────────────────────────────────── */
    new cdk.CfnOutput(this, 'PrimaryDbEndpoint', {
      value:       this.primaryDb.dbInstanceEndpointAddress,
      description: 'RDS primary endpoint (use as DB_HOST in replica Lambda env)',
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

    new cdk.CfnOutput(this, 'AutoFailoverLambdaArn', {
      value:       this.autoFailoverFn.functionArn,
      description: 'safebet-auto-failover Lambda ARN',
      exportName:  'SafeBetAutoFailoverArn',
    });

    new cdk.CfnOutput(this, 'DrAlertsTopicArn', {
      value:       this.drAlertsTopic.topicArn,
      description: 'SNS DR alerts topic ARN',
      exportName:  'SafeBetDrAlertsTopicArn',
    });
  }
}
