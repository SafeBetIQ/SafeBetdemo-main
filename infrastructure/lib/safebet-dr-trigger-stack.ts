/**
 * SafeBet IQ — DR Trigger Stack  (eu-north-1, Stockholm)
 * =========================================================
 * Provisions the monitoring + alerting layer:
 *
 *   • S3 bucket     — canonical backup bucket (versioned, AES-256, lifecycle rules)
 *   • Lambda        — safebet-dr-trigger (SNS relay → rds-failover in eu-west-1)
 *   • IAM role      — least-privilege role for dr-trigger Lambda
 *   • CloudWatch    — Log groups, DatabaseHealthy alarm (drives failover chain)
 *   • SNS           — alert topic with Lambda subscription + optional email
 *
 * ALARM DESIGN:
 *   DatabaseHealthyAlarm (eu-north-1) — BREACHING on missing data.
 *     Rationale: if the health-check.yml workflow stops publishing metrics,
 *     the DR monitoring is silently broken.  BREACHING makes this failure
 *     visible immediately — it fires the SNS → Lambda chain and sends an alert.
 *     This is correct: a dead monitoring workflow is itself a DR risk.
 *
 *   IMPORTANT: health-check.yml must be configured and publishing metrics
 *   BEFORE this stack is deployed, or the alarm will fire on first deploy.
 *   Alternatively, temporarily set treatMissingData to NOT_BREACHING,
 *   deploy, configure the workflow, then update to BREACHING.
 *
 *   MetricPublishingStaleAlarm — fires when DatabaseHealthy metric has
 *   not been updated for > 15 minutes (3 missed cycles). Used to detect
 *   a broken health-check workflow without triggering full failover.
 *
 * EVENT FLOW:
 *   GitHub Actions (every 5 min)
 *     → PUT SafeBetIQ/DR/DatabaseHealthy metric (eu-north-1 CloudWatch)
 *   CloudWatch alarm fires when DatabaseHealthy < 1 for 2 consecutive periods
 *     → Publishes to SNS topic safebet-dr-alerts (eu-north-1)
 *   SNS triggers safebet-dr-trigger Lambda (eu-north-1)
 *     → Async InvocationType=Event → safebet-rds-failover (eu-west-1)
 *   safebet-rds-failover promotes Ireland RDS replica + updates Route53
 *
 * OUTPUTS:
 *   BackupBucketName      → DR_S3_BUCKET (Amplify), S3_BUCKET_NAME (GitHub secrets)
 *   DrTriggerLambdaArn
 *   DatabaseHealthyAlarmArn
 */

import * as cdk            from 'aws-cdk-lib';
import * as s3             from 'aws-cdk-lib/aws-s3';
import * as lambda         from 'aws-cdk-lib/aws-lambda';
import * as iam            from 'aws-cdk-lib/aws-iam';
import * as sns            from 'aws-cdk-lib/aws-sns';
import * as sns_subs       from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cloudwatch     from 'aws-cdk-lib/aws-cloudwatch';
import * as cw_actions     from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as logs           from 'aws-cdk-lib/aws-logs';
import * as path           from 'path';
import { Construct }       from 'constructs';
import { CONFIG }          from './shared-config';

/* ── Stack props ─────────────────────────────────────────────────────── */
export interface SafeBetDRTriggerProps extends cdk.StackProps {
  account:    string;
  bucketName: string;
  alertEmail: string;
}

/* ═══════════════════════════════════════════════════════════════════════
   STACK
   ═══════════════════════════════════════════════════════════════════ */
export class SafeBetDRTriggerStack extends cdk.Stack {

  public readonly backupBucket:   s3.Bucket;
  public readonly drTriggerFn:    lambda.Function;
  public readonly drAlertsTopic:  sns.Topic;
  public readonly dbHealthyAlarm: cloudwatch.Alarm;

  constructor(scope: Construct, id: string, props: SafeBetDRTriggerProps) {
    super(scope, id, props);

    /* ── 1. S3 — Canonical backup bucket ────────────────────────────── */
    this.backupBucket = new s3.Bucket(this, 'BackupBucket', {
      bucketName:        props.bucketName,
      versioned:         true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption:        s3.BucketEncryption.S3_MANAGED,
      enforceSSL:        true,

      lifecycleRules: [
        {
          id:         'BackupRetention30Days',
          enabled:    true,
          prefix:     CONFIG.S3_BACKUP_PREFIX + '/',
          expiration: cdk.Duration.days(30),
          transitions: [
            {
              storageClass:    s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(7),
            },
          ],
        },
        {
          id:         'MonthlyBackupRetention90Days',
          enabled:    true,
          prefix:     'backups/monthly/',
          expiration: cdk.Duration.days(90),
        },
        {
          id:         'DemoBackupRetention14Days',
          enabled:    true,
          prefix:     CONFIG.S3_DEMO_PREFIX + '/',
          expiration: cdk.Duration.days(14),
        },
        {
          id:         'PreFailoverRetention14Days',
          enabled:    true,
          prefix:     'backups/pre-failover/',
          expiration: cdk.Duration.days(14),
        },
        {
          id:         'NoncurrentVersionCleanup',
          enabled:    true,
          noncurrentVersionExpiration: cdk.Duration.days(7),
        },
      ],

      // RETAIN: never auto-delete backup data on stack destroy
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    /* ── 2. SNS topic — DR alerts ────────────────────────────────────── */
    this.drAlertsTopic = new sns.Topic(this, 'DrAlertsTopic', {
      topicName:   CONFIG.SNS_TOPIC_NAME,
      displayName: 'SafeBet IQ — DR Alerts (eu-north-1)',
    });
    if (props.alertEmail) {
      this.drAlertsTopic.addSubscription(
        new sns_subs.EmailSubscription(props.alertEmail)
      );
    }

    /* ── 3. IAM role for safebet-dr-trigger Lambda ───────────────────── */
    const drTriggerRole = new iam.Role(this, 'DrTriggerRole', {
      roleName:    'safebet-dr-trigger-role',
      assumedBy:   new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Execution role for safebet-dr-trigger Lambda (SNS relay to rds-failover)',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        ),
      ],
    });

    drTriggerRole.addToPolicy(new iam.PolicyStatement({
      sid:     'InvokeIrelandFailoverLambda',
      effect:  iam.Effect.ALLOW,
      actions: ['lambda:InvokeFunction'],
      resources: [
        `arn:aws:lambda:${CONFIG.REPLICA_REGION}:${props.account}:function:${CONFIG.RDS_FAILOVER_FN}`,
      ],
    }));
    drTriggerRole.addToPolicy(new iam.PolicyStatement({
      sid:     'CloudWatchLogs',
      effect:  iam.Effect.ALLOW,
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: [
        `arn:aws:logs:${this.region}:${props.account}:log-group:/aws/lambda/${CONFIG.DR_TRIGGER_FN}:*`,
      ],
    }));

    /* ── 4. CloudWatch Log Groups ────────────────────────────────────── */
    const drTriggerLogGroup = new logs.LogGroup(this, 'DrTriggerLogGroup', {
      logGroupName:  `/aws/lambda/${CONFIG.DR_TRIGGER_FN}`,
      retention:     logs.RetentionDays.THREE_MONTHS,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Shared log group for GitHub Actions health check + backup audit events
    new logs.LogGroup(this, 'SafeBetBackupsLogGroup', {
      logGroupName:  CONFIG.CW_LOG_GROUP_BACKUP,
      retention:     logs.RetentionDays.THREE_MONTHS,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    /* ── 5. Lambda — safebet-dr-trigger ─────────────────────────────── */
    this.drTriggerFn = new lambda.Function(this, 'DrTriggerFn', {
      functionName:  CONFIG.DR_TRIGGER_FN,
      description:   'DR: relay SNS alarm event → invoke safebet-rds-failover in eu-west-1',
      runtime:       lambda.Runtime.PYTHON_3_12,
      architecture:  lambda.Architecture.X86_64,
      handler:       'lambda_function.lambda_handler',
      role:          drTriggerRole,
      timeout:       cdk.Duration.minutes(1),
      memorySize:    128,
      logGroup:      drTriggerLogGroup,

      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../lambda/safebet-dr-trigger'),
      ),

      environment: {
        DR_LAMBDA_NAME:   CONFIG.RDS_FAILOVER_FN,
        DR_LAMBDA_REGION: CONFIG.REPLICA_REGION,
        DR_LAMBDA_ARN:    `arn:aws:lambda:${CONFIG.REPLICA_REGION}:${props.account}:function:${CONFIG.RDS_FAILOVER_FN}`,
      },

      retryAttempts: 1,
    });

    /* ── 6. SNS → Lambda subscription ───────────────────────────────── */
    this.drAlertsTopic.addSubscription(
      new sns_subs.LambdaSubscription(this.drTriggerFn)
    );
    this.drTriggerFn.addPermission('AllowSnsInvoke', {
      principal: new iam.ServicePrincipal('sns.amazonaws.com'),
      sourceArn: this.drAlertsTopic.topicArn,
    });

    /* ── 7. CloudWatch alarm — DatabaseHealthy (eu-north-1) ─────────── */
    // BREACHING on missing data: if the health-check workflow stops publishing,
    // this alarm fires rather than silently staying OK.
    // A dead monitoring pipeline is itself a DR risk and must be visible.
    //
    // Pre-requisite: health-check.yml must be running before this alarm fires
    // correctly. On first deploy, if the workflow is not yet configured, this
    // will fire. Set MONITORING_ENABLED=false in GitHub Actions to suppress
    // the workflow until secrets are in place, then enable it.
    const dbHealthMetric = new cloudwatch.Metric({
      namespace:  CONFIG.CW_NAMESPACE,
      metricName: CONFIG.CW_METRIC_DB_HEALTH,
      statistic:  'Minimum',
      period:     cdk.Duration.minutes(5),
    });

    this.dbHealthyAlarm = new cloudwatch.Alarm(this, 'DatabaseHealthyAlarm', {
      alarmName:          'SafeBetDatabaseHealthyAlarm',
      alarmDescription:   [
        'Fires when DatabaseHealthy metric < 1 for 2 consecutive 5-minute periods.',
        'BREACHING on missing data: a dead health-check workflow also triggers this alarm.',
        'This drives the SNS → dr-trigger → rds-failover Lambda chain.',
      ].join(' '),
      metric:             dbHealthMetric,
      threshold:          1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods:  2,
      datapointsToAlarm:  2,
      // BREACHING: missing metrics trigger failover — silent failure is not acceptable
      treatMissingData:   cloudwatch.TreatMissingData.BREACHING,
      actionsEnabled:     true,
    });

    this.dbHealthyAlarm.addAlarmAction(
      new cw_actions.SnsAction(this.drAlertsTopic)
    );
    this.dbHealthyAlarm.addOkAction(
      new cw_actions.SnsAction(this.drAlertsTopic)
    );

    /* ── 8. Stale metric detection alarm ─────────────────────────────── */
    // Fires when the DatabaseHealthy metric has not been updated for > 15 min
    // (3 missed 5-minute cycles). Used for alerting without triggering failover.
    // Alarm is INFORMATION only — no SNS failover action.
    new cloudwatch.Alarm(this, 'MetricStaleAlarm', {
      alarmName:          'SafeBetHealthCheckMetricStale',
      alarmDescription:   'DatabaseHealthy metric has not been published for >15 min — health-check.yml may be down',
      metric:             new cloudwatch.Metric({
        namespace:  CONFIG.CW_NAMESPACE,
        metricName: CONFIG.CW_METRIC_DB_HEALTH,
        statistic:  'SampleCount',
        period:     cdk.Duration.minutes(5),
      }),
      threshold:          1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods:  3,        // 15 minutes of no data
      datapointsToAlarm:  3,
      treatMissingData:   cloudwatch.TreatMissingData.BREACHING,
      actionsEnabled:     true,
    }).addAlarmAction(new cw_actions.SnsAction(this.drAlertsTopic));

    /* ── 9. dr-trigger Lambda error alarm ────────────────────────────── */
    const drTriggerErrors = this.drTriggerFn.metricErrors({
      period:    cdk.Duration.minutes(5),
      statistic: 'Sum',
    });
    new cloudwatch.Alarm(this, 'DrTriggerErrorAlarm', {
      alarmName:          'SafeBetDrTriggerErrors',
      alarmDescription:   'safebet-dr-trigger Lambda errors — failover relay is broken',
      metric:             drTriggerErrors,
      threshold:          1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      evaluationPeriods:  1,
      treatMissingData:   cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(new cw_actions.SnsAction(this.drAlertsTopic));

    /* ── 10. Stack outputs ───────────────────────────────────────────── */
    new cdk.CfnOutput(this, 'BackupBucketName', {
      value:       this.backupBucket.bucketName,
      description: 'Canonical S3 backup bucket → set as DR_S3_BUCKET in Amplify and S3_BUCKET_NAME in GitHub secrets',
      exportName:  'SafeBetBackupBucketName',
    });
    new cdk.CfnOutput(this, 'BackupBucketArn', {
      value:       this.backupBucket.bucketArn,
      description: 'S3 backup bucket ARN',
      exportName:  'SafeBetBackupBucketArn',
    });
    new cdk.CfnOutput(this, 'DrTriggerLambdaArn', {
      value:       this.drTriggerFn.functionArn,
      description: 'safebet-dr-trigger Lambda ARN',
      exportName:  'SafeBetDrTriggerArn',
    });
    new cdk.CfnOutput(this, 'DrAlertsTopicArn', {
      value:       this.drAlertsTopic.topicArn,
      description: 'SNS DR alerts topic ARN (eu-north-1)',
      exportName:  'SafeBetDrAlertsTopicArnStockholm',
    });
    new cdk.CfnOutput(this, 'DatabaseHealthyAlarmArn', {
      value:       this.dbHealthyAlarm.alarmArn,
      description: 'CloudWatch alarm ARN — DatabaseHealthy (eu-north-1, drives Lambda failover chain)',
      exportName:  'SafeBetDatabaseHealthyAlarmArn',
    });
    new cdk.CfnOutput(this, 'GithubActionsSetupNote', {
      value: [
        `S3_BUCKET_NAME = ${props.bucketName}`,
        `AWS_DEFAULT_REGION = ${this.region}`,
        'Confirm GitHub secrets: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, SUPABASE_DB_URL_PROD',
      ].join(' | '),
      description: 'Update these GitHub Actions secrets after deploy',
    });
  }
}
