/**
 * SafeBet IQ — DR Alarm Stack  (us-east-1, N. Virginia)
 * ========================================================
 * Creates the CloudWatch alarm that Route53 uses to evaluate DNS health.
 *
 * WHY A SEPARATE STACK IN us-east-1?
 * ─────────────────────────────────────────────────────────────────────
 * Route53 CloudWatch metric health checks can ONLY reference CloudWatch
 * alarms in us-east-1 (AWS constraint — not a CDK limitation).
 * Any other region is silently ignored; the health check stays in
 * INSUFFICIENT_DATA and Route53 treats the primary as permanently
 * unhealthy, causing immediate permanent failover to the secondary.
 *
 * This stack contains ONLY the alarm. There is no SNS topic, no Lambda,
 * and no other infrastructure here. Route53 reads the alarm state
 * directly via the CloudWatch metric health check mechanism.
 *
 * THE TWO-ALARM DESIGN
 * ─────────────────────────────────────────────────────────────────────
 *  • SafeBetDRAlarm (this stack, us-east-1)
 *      Alarm name: SafeBetDatabaseHealthyAlarm
 *      Purpose:    Route53 health check → DNS failover
 *      Actions:    None (Route53 reads state directly)
 *
 *  • SafeBetDRTrigger (trigger stack, eu-north-1)
 *      Alarm name: SafeBetDatabaseHealthyAlarm  (same name, different region)
 *      Purpose:    SNS → dr-trigger Lambda → rds-failover Lambda
 *      Actions:    SnsAction(drAlertsTopic)
 *
 * The health-check.yml GitHub Actions workflow publishes
 * SafeBetIQ/DR/DatabaseHealthy to BOTH us-east-1 and eu-north-1
 * so both alarms are fed simultaneously.
 *
 * DEPLOYMENT ORDER
 * ─────────────────────────────────────────────────────────────────────
 * SafeBetDRAlarm must be deployed BEFORE SafeBetDRReplica because the
 * replica stack's Route53 health check references this alarm by name.
 * CDK enforces this via replicaStack.addDependency(alarmStack).
 *
 * OUTPUTS:
 *   AlarmName  — always 'SafeBetDatabaseHealthyAlarm' (for reference)
 *   AlarmArn   — the ARN in us-east-1
 */

import * as cdk        from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as logs       from 'aws-cdk-lib/aws-logs';
import { Construct }   from 'constructs';
import { CONFIG }      from './shared-config';

export class SafeBetDRAlarmStack extends cdk.Stack {

  public readonly dbHealthyAlarm: cloudwatch.Alarm;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    /* ── 1. CloudWatch alarm — DatabaseHealthy (us-east-1) ─────────────── */
    // This alarm is the SOLE resource in this stack.
    // It is placed in us-east-1 to satisfy Route53's constraint on
    // CloudWatch metric health checks.
    //
    // The DatabaseHealthy metric (value 1 = healthy, 0 = unhealthy) is
    // published to us-east-1 by the health-check.yml GitHub Actions
    // workflow every 5 minutes.  It is also published to eu-north-1
    // (for the trigger stack's alarm) in the same workflow run.
    //
    // ALARM NAME: 'SafeBetDatabaseHealthyAlarm'
    // This exact name is referenced in SafeBetDRReplicaStack's Route53
    // CfnHealthCheck alarmIdentifier.  Do not rename without updating
    // the replica stack.
    const dbHealthMetric = new cloudwatch.Metric({
      namespace:  CONFIG.CW_NAMESPACE,
      metricName: CONFIG.CW_METRIC_DB_HEALTH,
      statistic:  'Minimum',
      period:     cdk.Duration.minutes(5),
    });

    this.dbHealthyAlarm = new cloudwatch.Alarm(this, 'DatabaseHealthyAlarm', {
      alarmName:        'SafeBetDatabaseHealthyAlarm',
      alarmDescription: [
        'Route53 DNS failover signal.',
        'Fires when DatabaseHealthy < 1 for 2 consecutive 5-min periods.',
        'Route53 health check evaluates this alarm state directly —',
        'when ALARM, primary DNS record is marked unhealthy and traffic',
        'routes to the Ireland replica (SECONDARY record).',
      ].join(' '),

      metric:             dbHealthMetric,
      threshold:          1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods:  2,
      datapointsToAlarm:  2,

      // NOT_BREACHING: if the health-check workflow hasn't run yet (e.g.,
      // first deploy), treat missing data as healthy to avoid false failover.
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,

      // No alarm actions — Route53 reads the state directly via the
      // CloudWatch metric health check.  The SNS → Lambda chain is
      // driven by the separate alarm in eu-north-1 (trigger stack).
      actionsEnabled: false,
    });

    /* ── 2. Stack outputs ───────────────────────────────────────────────── */
    new cdk.CfnOutput(this, 'AlarmName', {
      value:       this.dbHealthyAlarm.alarmName,
      description: 'CloudWatch alarm name for Route53 health check (us-east-1)',
      exportName:  'SafeBetDatabaseHealthyAlarmName',
    });

    new cdk.CfnOutput(this, 'AlarmArn', {
      value:       this.dbHealthyAlarm.alarmArn,
      description: 'CloudWatch alarm ARN (us-east-1) referenced by Route53 health check',
      exportName:  'SafeBetDatabaseHealthyAlarmArn',
    });

    new cdk.CfnOutput(this, 'DeployNote', {
      value: [
        'GitHub Actions health-check.yml publishes SafeBetIQ/DR/DatabaseHealthy',
        'to BOTH us-east-1 (this alarm) AND eu-north-1 (trigger alarm).',
        'Required IAM: rds:DescribeDBInstances on primary ARN +',
        'cloudwatch:PutMetricData on SafeBetIQ/DR namespace in both regions.',
      ].join(' '),
      description: 'Setup note for health-check workflow',
    });
  }
}
