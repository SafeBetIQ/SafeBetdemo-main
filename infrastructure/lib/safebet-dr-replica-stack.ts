/**
 * SafeBet IQ — DR Replica Stack  (eu-west-1, Ireland)
 * ======================================================
 * RECONCILED (Stage D2A3): the legacy Ireland DR/failover apparatus was
 * surgically retired under Stage D2A2. This stack now owns ONLY the
 * authoritative production Route53 hosted zone (Z08227093). The previously
 * defined replica VPC/subnets, cross-region RDS read replica, safebet-rds-
 * failover Lambda + IAM/log resources, the CrossRegionExportReader, and the
 * db.safebetiq.com PRIMARY/SECONDARY failover records are NO LONGER defined
 * here so that a future deploy will not recreate them.
 *
 * CRITICAL: the hosted zone construct ID ('DrHostedZone') is preserved so the
 * CloudFormation logical ID (DrHostedZone190C37DD) and the physical zone
 * (Z08227093, which serves app.safebetiq.com and the apex) are NOT replaced.
 *
 * HOSTED ZONE STRATEGY:
 *   If props.hostedZoneId is provided (non-empty), the existing hosted zone is
 *   imported. If hostedZoneId is empty, a new public hosted zone is created and
 *   the NameServers output MUST be copied to the domain registrar NS records.
 *
 * OUTPUTS:
 *   HostedZoneId              — Route53 zone ID
 *   DbDnsCname                — db.{hostedZoneName} (LEGACY — failover apparatus retired)
 *   NameServers               — ONLY populated for new zones; register at domain registrar
 *
 * NOTE: several props (primaryDb*, healthCheckId, bucketName, alertEmail) are
 * retained on the interface for caller compatibility but are no longer consumed
 * after the D2A2 retirement; trimming them + the caller is a later governance
 * cleanup. They are intentionally NOT referenced in any resource, so no
 * cross-region export/reader is synthesised.
 */

import * as cdk          from 'aws-cdk-lib';
import * as route53      from 'aws-cdk-lib/aws-route53';
import { Construct }     from 'constructs';
import { CONFIG }        from './shared-config';

/* ── Stack props ─────────────────────────────────────────────────────── */
export interface SafeBetDRReplicaProps extends cdk.StackProps {
  account:           string;
  bucketName:        string;
  hostedZoneName:    string;
  /**
   * If non-empty, the existing Route53 hosted zone with this ID is imported.
   * If empty, a new public hosted zone is created and the NameServers stack
   * output MUST be registered at the domain registrar.
   *
   * Pass via: --context hostedZoneId=ZXXXXXXXXXX
   */
  hostedZoneId:      string;
  alertEmail:        string;
  primaryDbId:       string;
  primaryRegion:     string;
  primaryDbEndpoint: string;
  healthCheckId:     string;
}

/* ═══════════════════════════════════════════════════════════════════════
   STACK
   ═══════════════════════════════════════════════════════════════════ */
export class SafeBetDRReplicaStack extends cdk.Stack {

  public readonly hostedZone:    route53.IHostedZone;

  constructor(scope: Construct, id: string, props: SafeBetDRReplicaProps) {
    super(scope, id, props);

    /* ── Route53 — Hosted Zone (RETAINED) ────────────────────────────── */
    // Import existing zone if hostedZoneId is provided; otherwise create new.
    // CRITICAL: construct ID 'DrHostedZone' MUST be preserved to keep the
    // logical ID (DrHostedZone190C37DD) and avoid replacing the live zone.
    if (props.hostedZoneId) {
      this.hostedZone = route53.HostedZone.fromHostedZoneAttributes(
        this, 'DrHostedZone', {
          hostedZoneId: props.hostedZoneId,
          zoneName:     props.hostedZoneName,
        }
      );
      new cdk.CfnOutput(this, 'HostedZoneImported', {
        value:       props.hostedZoneId,
        description: 'Imported existing Route53 hosted zone ID',
      });
    } else {
      const newZone = new route53.HostedZone(this, 'DrHostedZone', {
        zoneName: props.hostedZoneName,
        comment:  'SafeBet IQ DR failover zone — managed by CDK',
      });
      this.hostedZone = newZone;
      new cdk.CfnOutput(this, 'NameServers', {
        value:       cdk.Fn.join(', ', newZone.hostedZoneNameServers ?? []),
        description: '⚠️  NEW ZONE: Copy these NS records to your domain registrar immediately',
      });
    }

    const dbRecordName = `${CONFIG.DB_RECORD_PREFIX}.${props.hostedZoneName}`;

    /* ── Stack outputs (RETAINED) ────────────────────────────────────── */
    new cdk.CfnOutput(this, 'HostedZoneId', {
      value:       this.hostedZone.hostedZoneId,
      description: 'Route53 hosted zone ID',
      exportName:  'SafeBetHostedZoneId',
    });
    new cdk.CfnOutput(this, 'DbDnsCname', {
      value:       dbRecordName,
      description: 'Failover DNS CNAME (primary=Cape Town, secondary=Ireland)',
      exportName:  'SafeBetDbDnsCname',
    });
  }
}
