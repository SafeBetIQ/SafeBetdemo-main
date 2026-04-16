/**
 * SafeBet IQ — DR Trigger Stack  (eu-north-1, Stockholm)
 * =========================================================
 * Provisions the monitoring + alerting layer:
 *
 *   • S3 bucket     — canonical backup bucket (fixes the naming mismatch)
 *   • Lambda        — safebet-dr-trigger (SNS relay → rds-failover in eu-west-1)
 *   • IAM role      — least-privilege role for dr-trigger Lambda
 *   • CloudWatch    — Log group, DatabaseHealthy alarm
 *   • SNS           — alert topic with Lambda subscription
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
 * OUTPUTS (copy to Amplify / GitHub Actions secrets):
 *   BackupBucketName      → DR_S3_BUCKET (Amplify), S3_BUCKET (workflows)
 *   DrTriggerLambdaArn    → for reference
 *   DatabaseHealthyAlarmArn
 */

import * as cdk            from 'aws-cdk-lib';
import * as s3             from 'aws-cdk-lib/aws-s3';
import * as lambda         from 'aws-cdk-lib/aws-lambda';
import * as lambda_events  from 'aws-cdk-lib/aws-lambda-event-sources';
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
}

/* ═══════════════════════════════════════════════════════════════════════
   STACK
   ═══════════════════════════════════════════════════════════════════ */
export class SafeBetDRTriggerStack extends cdk.Stack {

  public readonly backupBucket:       s3.Bucket;
  public readonly drTriggerFn:        lambda.Function;
  public readonly drAlertsTopic:      sns.Topic;
  public readonly dbHealthyAlarm:     cloudwatch.Alarm;

  constructor(scope: Construct, id: string, props: SafeBetDRTriggerProps) {
    super(scope, id, props);

    /* ── 1. S3 — Canonical backup bucket ────────────────────────────── */
    // This is the SINGLE canonical bucket used by:
    //   • backup.yml (GitHub Actions)      — pg_dump upload
    //   • failover-restore.yml             — restore download
    //   • rollback-restore.yml             — rollback download
    //   • safebet-auto-failover Lambda     — streaming restore
    //   • safebet-rds-failover Lambda      — DR state persistence
    //
    // FIXES the mismatch between:
    //   OLD backup.yml target:    safebetiq-backups-046276255259-eu-north-1-an
    //   OLD restore source:       safebetiq-backups-secondary
    //   NEW everywhere:           safebetiq-backups-{account}-eu-north-1
    this.backupBucket = new s3.Bucket(this, 'BackupBucket', {
      bucketName:        props.bucketName,
      versioned:         true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption:        s3.BucketEncryption.S3_MANAGED,   // AES-256
      enforceSSL:        true,

      lifecycleRules: [
        {
          id:         'BackupRetention30Days',
          enabled:    true,
          prefix:     CONFIG.S3_BACKUP_PREFIX + '/',
          expiration: cdk.Duration.days(30),
          // Move to cheaper storage after 7 days before deletion
          transitions: [
            {
              storageClass:         s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter:      cdk.Duration.days(7),
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

      removalPolicy: cdk.RemovalPolicy.RETAIN,  // never auto-delete backup data
    });

    /* ── 2. SNS topic — DR alerts ────────────────────────────────────── */
    this.drAlertsTopic = new sns.Topic(this, 'DrAlertsTopic', {
      topicName:   CONFIG.SNS_TOPIC_NAME,
      displayName: 'SafeBet IQ — DR Alerts (eu-north-1)',
    });

    /* ── 3. IAM role for safebet-dr-trigger Lambda ───────────────────── */
    const drTriggerRole = new iam.Role(this, 'DrTriggerRole', {
      roleName:    'safebet-dr-trigger-role',
      assumedBy:   new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Execution role for safebet-dr-trigger Lambda (SNS relay → rds-failover)',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        ),
      ],
    });

    // Invoke safebet-rds-failover Lambda in eu-west-1 (Ireland)
    drTriggerRole.addToPolicy(new iam.PolicyStatement({
      sid:     'InvokeIrelandFailoverLambda',
      effect:  iam.Effect.ALLOW,
      actions: ['lambda:InvokeFunction'],
      resources: [
        `arn:aws:lambda:${CONFIG.REPLICA_REGION}:${props.account}:function:${CONFIG.RDS_FAILOVER_FN}`,
      ],
    }));

    // CloudWatch Logs
    drTriggerRole.addToPolicy(new iam.PolicyStatement({
      sid:     'CloudWatchLogs',
      effect:  iam.Effect.ALLOW,
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: [
        `arn:aws:logs:${this.region}:${props.account}:log-group:/aws/lambda/${CONFIG.DR_TRIGGER_FN}:*`,
      ],
    }));

    /* ── 4. CloudWatch Log Group ─────────────────────────────────────── */
    const drTriggerLogGroup = new logs.LogGroup(this, 'DrTriggerLogGroup', {
      logGroupName:  `/aws/lambda/${CONFIG.DR_TRIGGER_FN}`,
      retention:     logs.RetentionDays.THREE_MONTHS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Shared log group for GitHub Actions health check + backup workflows
    new logs.LogGroup(this, 'SafeBetBackupsLogGroup', {
      logGroupName:  CONFIG.CW_LOG_GROUP_BACKUP,
      retention:     logs.RetentionDays.THREE_MONTHS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    /* ── 5. Lambda — safebet-dr-trigger ─────────────────────────────── */
    // No external dependencies — boto3 is pre-installed in Lambda runtime.
    this.drTriggerFn = new lambda.Function(this, 'DrTriggerFn', {
      functionName:  CONFIG.DR_TRIGGER_FN,
      description:   'DR: relay SNS alarm event → invoke safebet-rds-failover in eu-west-1',
      runtime:       lambda.Runtime.PYTHON_3_12,
      architecture:  lambda.Architecture.X86_64,
      handler:       'lambda_function.lambda_handler',
      role:          drTriggerRole,
      timeout:       cdk.Duration.minutes(1),   // relay only — should complete in seconds
      memorySize:    128,                         // minimal memory needed
      logGroup:      drTriggerLogGroup,

      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../lambda/safebet-dr-trigger'),
      ),

      environment: {
        // Forward to safebet-rds-failover in Ireland (not the default af-south-1 target)
        DR_LAMBDA_NAME:   CONFIG.RDS_FAILOVER_FN,
        DR_LAMBDA_REGION: CONFIG.REPLICA_REGION,
        DR_LAMBDA_ARN:    `arn:aws:lambda:${CONFIG.REPLICA_REGION}:${props.account}:function:${CONFIG.RDS_FAILOVER_FN}`,
      },

      retryAttempts: 1,  // retry once on infrastructure failure (safe — rds-failover has cooldown)
    });

    /* ── 6. SNS → Lambda subscription ───────────────────────────────── */
    this.drAlertsTopic.addSubscription(
      new sns_subs.LambdaSubscription(this.drTriggerFn)
    );

    // Allow SNS to invoke the Lambda
    this.drTriggerFn.addPermission('AllowSnsInvoke', {
      principal: new iam.ServicePrincipal('sns.amazonaws.com'),
      sourceArn: this.drAlertsTopic.topicArn,
    });

    /* ── 7. CloudWatch alarm — DatabaseHealthy ───────────────────────── */
    // This metric is written by GitHub Actions (auto-failover.yml) every 5 min.
    // When it drops below 1 for 2 consecutive evaluation periods (10 minutes),
    // the alarm fires and sends to the SNS topic → dr-trigger Lambda.
    //
    // NOTE: The SafeBetDRReplica Route53 health check references this alarm
    //       by the name 'SafeBetDatabaseHealthyAlarm' — do not rename it.
    const dbHealthMetric = new cloudwatch.Metric({
      namespace:  CONFIG.CW_NAMESPACE,
      metricName: CONFIG.CW_METRIC_DB_HEALTH,
      statistic:  'Minimum',
      period:     cdk.Duration.minutes(5),
    });

    this.dbHealthyAlarm = new cloudwatch.Alarm(this, 'DatabaseHealthyAlarm', {
      alarmName:          'SafeBetDatabaseHealthyAlarm',
      alarmDescription:   'Fires when DatabaseHealthy metric < 1 for 2 consecutive 5-minute periods (10 minutes total). Triggers automated RDS failover.',
      metric:             dbHealthMetric,
      threshold:          1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods:  2,
      datapointsToAlarm:  2,
      treatMissingData:   cloudwatch.TreatMissingData.NOT_BREACHING,  // absent = healthy
      actionsEnabled:     true,
    });

    // Wire alarm → SNS → Lambda
    this.dbHealthyAlarm.addAlarmAction(
      new cw_actions.SnsAction(this.drAlertsTopic)
    );

    /* ── 8. Additional CloudWatch alarms ─────────────────────────────── */
    // Alarm when dr-trigger Lambda errors out (failover path broken)
    const drTriggerErrors = this.drTriggerFn.metricErrors({
      period:    cdk.Duration.minutes(5),
      statistic: 'Sum',
    });
    new cloudwatch.Alarm(this, 'DrTriggerErrorAlarm', {
      alarmName:          'SafeBetDrTriggerErrors',
      alarmDescription:   'safebet-dr-trigger Lambda is throwing errors — failover relay is broken',
      metric:             drTriggerErrors,
      threshold:          1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      evaluationPeriods:  1,
      treatMissingData:   cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    /* ── 9. Stack outputs ────────────────────────────────────────────── */
    new cdk.CfnOutput(this, 'BackupBucketName', {
      value:       this.backupBucket.bucketName,
      description: 'Canonical S3 backup bucket — set as DR_S3_BUCKET in Amplify and S3_BUCKET in GitHub Actions',
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
      description: 'CloudWatch alarm ARN — DatabaseHealthy (referenced by Route53 health check)',
      exportName:  'SafeBetDatabaseHealthyAlarmArn',
    });

    new cdk.CfnOutput(this, 'GithubActionsSetupNote', {
      value: [
        `Update GitHub Actions secrets:`,
        `  S3_BUCKET_NAME = ${props.bucketName}`,
        `  AWS_DEFAULT_REGION = ${this.region}`,
      ].join(' | '),
      description: 'Update these GitHub Actions / Amplify variables after deploy',
    });
  }
}
