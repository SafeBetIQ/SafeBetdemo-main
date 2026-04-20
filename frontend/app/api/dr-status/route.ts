/**
 * GET /api/dr-status
 *
 * Server-side DR status aggregator.  Queries AWS directly — credentials
 * never reach the browser.  Each data source is independent; a failure
 * in one degrades gracefully without blocking the others.
 *
 * Environment variables required (set in Amplify / .env.local):
 *   AWS_ACCESS_KEY_ID          — IAM key (or omit to use Amplify IAM role)
 *   AWS_SECRET_ACCESS_KEY      — IAM secret
 *   DR_AWS_REGION              — Lambda + CloudWatch region  (default: eu-west-1)
 *   DR_S3_REGION               — Backup S3 bucket region     (default: eu-north-1)
 *   DR_S3_BUCKET               — Backup bucket name
 *   DR_S3_PREFIX               — Backup object prefix        (default: backups/production/)
 *   DR_LOG_GROUP               — Lambda log group            (default: /aws/lambda/safebet-rds-failover)
 *   DR_CW_NAMESPACE            — CloudWatch metric namespace (default: SafeBetIQ/DR)
 *   DR_ROUTE53_HEALTH_CHECK_ID — Route53 health check ID (optional)
 */

import { NextResponse } from 'next/server';
import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
  type Datapoint,
} from '@aws-sdk/client-cloudwatch';
import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import {
  S3Client,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import {
  Route53Client,
  GetHealthCheckStatusCommand,
} from '@aws-sdk/client-route-53';
import { serverEnv } from '@/config/env';

export const runtime  = 'nodejs';
export const dynamic  = 'force-dynamic';
export const revalidate = 0;

/* ─────────────────────────────────────────────────────────────
   CONFIG — sourced from validated serverEnv, never raw process.env
───────────────────────────────────────────────────────────── */
const DR_REGION   = serverEnv.DR_AWS_REGION;
const S3_REGION   = serverEnv.DR_S3_REGION;
const S3_BUCKET   = serverEnv.DR_S3_BUCKET;
const S3_PREFIX   = serverEnv.DR_S3_PREFIX;
const LOG_GROUP   = serverEnv.DR_LOG_GROUP;
const CW_NS       = serverEnv.DR_CW_NAMESPACE;
const R53_HCID    = serverEnv.DR_ROUTE53_HEALTH_CHECK_ID;

/** Build AWS credential config — omit if running under Amplify IAM role */
function awsCreds(region: string) {
  const keyId  = serverEnv.AWS_ACCESS_KEY_ID;
  const secret = serverEnv.AWS_SECRET_ACCESS_KEY;
  return {
    region,
    ...(keyId && secret ? { credentials: { accessKeyId: keyId, secretAccessKey: secret } } : {}),
  };
}

/* ─────────────────────────────────────────────────────────────
   RESPONSE SHAPE
───────────────────────────────────────────────────────────── */
export interface DRStatusPayload {
  status:      'OPERATIONAL' | 'DEGRADED' | 'FAILOVER_ACTIVE' | 'UNKNOWN';
  healthScore: number;
  activeRegion: string;
  metrics: {
    failoverExecuted:    number;
    failoverFailed:      number;
    failoverAborted:     number;
    failoverAlreadyDone: number;
    criticalFailures:    number;
  };
  lastFailover: {
    time:       string | null;
    status:     string | null;
    detail:     string | null;
    oldPrimary: string | null;
    newPrimary: string | null;
    region:     string | null;
  };
  lastBackup: {
    time: string | null;
    key:  string | null;
  };
  route53: {
    status:         string | null;
    checkedRegions: string[];
  };
  fetchedAt: string;
  source:    'live' | 'partial' | 'unavailable';
  errors:    string[];
}

/* ─────────────────────────────────────────────────────────────
   DATA FETCHERS  (each returns null on failure — never throws)
───────────────────────────────────────────────────────────── */

/** Sum a CloudWatch metric over the last 30 days */
async function fetchMetricSum(
  cw: CloudWatchClient,
  metricName: string,
  periodDays = 30,
): Promise<number> {
  const now   = new Date();
  const start = new Date(now.getTime() - periodDays * 86_400_000);

  const res = await cw.send(new GetMetricStatisticsCommand({
    Namespace:  CW_NS,
    MetricName: metricName,
    StartTime:  start,
    EndTime:    now,
    Period:     periodDays * 86400,   // one bucket for the whole window
    Statistics: ['Sum'],
  }));

  const points: Datapoint[] = res.Datapoints ?? [];
  return points.reduce((acc, p) => acc + (p.Sum ?? 0), 0);
}

interface CloudWatchMetrics {
  failoverExecuted:    number;
  failoverFailed:      number;
  failoverAborted:     number;
  failoverAlreadyDone: number;
  criticalFailures:    number;
}

async function fetchCloudWatchMetrics(): Promise<CloudWatchMetrics | null> {
  try {
    const cw = new CloudWatchClient(awsCreds(DR_REGION));
    const [executed, failed, aborted, alreadyDone, critical] = await Promise.all([
      fetchMetricSum(cw, 'FailoverExecuted'),
      fetchMetricSum(cw, 'FailoverFailed'),
      fetchMetricSum(cw, 'FailoverAborted'),
      fetchMetricSum(cw, 'FailoverAlreadyDone'),
      fetchMetricSum(cw, 'FailoverCriticalFailure'),
    ]);
    return { failoverExecuted: executed, failoverFailed: failed, failoverAborted: aborted, failoverAlreadyDone: alreadyDone, criticalFailures: critical };
  } catch {
    return null;
  }
}

/* ── Last failover event from CloudWatch Logs ────────────────────────────── */
interface LastFailoverEvent {
  time:       string | null;
  status:     string | null;
  detail:     string | null;
  oldPrimary: string | null;
  newPrimary: string | null;
  region:     string | null;
}

async function fetchLastFailoverEvent(): Promise<LastFailoverEvent | null> {
  try {
    const logs = new CloudWatchLogsClient(awsCreds(DR_REGION));

    // Search last 90 days for structured failover-success log lines
    const ninetyDaysAgo = Date.now() - 90 * 86_400_000;

    const res = await logs.send(new FilterLogEventsCommand({
      logGroupName:  LOG_GROUP,
      startTime:     ninetyDaysAgo,
      filterPattern: '"failover-success"',      // matches event_type field
      limit:         10,
    }));

    const events = (res.events ?? []).sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

    for (const ev of events) {
      try {
        const parsed = JSON.parse(ev.message ?? '{}');
        if (parsed.event_type === 'failover-success') {
          return {
            time:       parsed.timestamp ?? new Date(ev.timestamp ?? 0).toISOString(),
            status:     'FAILOVER_COMPLETE',
            detail:     parsed.message ?? null,
            oldPrimary: parsed.alert?.['old_primary'] ?? null,
            newPrimary: parsed.replica_id ?? parsed.alert?.new_primary ?? null,
            region:     parsed.replica_region ?? null,
          };
        }
      } catch {
        // non-JSON line — skip
      }
    }

    // Fallback: search for AUDIT text lines (plain print statements)
    const auditRes = await logs.send(new FilterLogEventsCommand({
      logGroupName:  LOG_GROUP,
      startTime:     ninetyDaysAgo,
      filterPattern: '"[AUDIT] Failover executed"',
      limit:         5,
    }));

    const auditEvents = (auditRes.events ?? []).sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
    if (auditEvents.length > 0) {
      const ts = new Date(auditEvents[0].timestamp ?? 0).toISOString();
      return {
        time:       ts,
        status:     'FAILOVER_COMPLETE',
        detail:     auditEvents[0].message?.trim() ?? null,
        oldPrimary: null,
        newPrimary: null,
        region:     DR_REGION,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/* ── Latest S3 backup object ─────────────────────────────────────────────── */
interface BackupInfo {
  time: string | null;
  key:  string | null;
}

async function fetchLatestBackup(): Promise<BackupInfo | null> {
  if (!S3_BUCKET) return null;
  try {
    const s3 = new S3Client(awsCreds(S3_REGION));
    const res = await s3.send(new ListObjectsV2Command({
      Bucket:  S3_BUCKET,
      Prefix:  S3_PREFIX,
      MaxKeys: 50,
    }));

    const objects = (res.Contents ?? [])
      .filter(o => o.LastModified)
      .sort((a, b) => (b.LastModified!.getTime()) - (a.LastModified!.getTime()));

    if (objects.length === 0) return { time: null, key: null };

    return {
      time: objects[0].LastModified!.toISOString(),
      key:  objects[0].Key ?? null,
    };
  } catch {
    return null;
  }
}

/* ── Route53 health check status ─────────────────────────────────────────── */
interface Route53Status {
  status:         string | null;
  checkedRegions: string[];
}

async function fetchRoute53Status(): Promise<Route53Status | null> {
  if (!R53_HCID) return null;
  try {
    const r53 = new Route53Client(awsCreds('us-east-1'));
    const res = await r53.send(new GetHealthCheckStatusCommand({
      HealthCheckId: R53_HCID,
    }));

    const observations = res.HealthCheckObservations ?? [];
    const healthy = observations.filter(o => o.StatusReport?.Status?.startsWith('Success'));
    const overallOk = healthy.length > 0 && healthy.length === observations.length;

    return {
      status:         overallOk ? 'Healthy' : healthy.length > 0 ? 'Degraded' : 'Unhealthy',
      checkedRegions: observations.map(o => o.Region ?? '').filter(Boolean),
    };
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
   STATUS DERIVATION
───────────────────────────────────────────────────────────── */
function deriveStatus(
  metrics:   CloudWatchMetrics | null,
  r53:       Route53Status | null,
): { status: DRStatusPayload['status']; healthScore: number } {
  // If metrics are unavailable, we cannot determine status
  if (!metrics) {
    return { status: 'UNKNOWN', healthScore: 0 };
  }

  // Recent critical failure or failed failover → DEGRADED
  if (metrics.criticalFailures > 0 || metrics.failoverFailed > metrics.failoverExecuted) {
    return { status: 'DEGRADED', healthScore: 65 };
  }

  // Route53 unhealthy → DEGRADED
  if (r53 && r53.status === 'Unhealthy') {
    return { status: 'DEGRADED', healthScore: 75 };
  }

  // Recent successful failover that wasn't pre-existing → FAILOVER_ACTIVE (rare edge case)
  // We treat this as OPERATIONAL unless Route53 is down
  const score = Math.min(
    100,
    100
    - (metrics.failoverFailed      * 15)
    - (metrics.criticalFailures     * 25)
    - (r53?.status === 'Degraded' ? 10 : 0),
  );

  return {
    status:     score >= 90 ? 'OPERATIONAL' : 'DEGRADED',
    healthScore: Math.max(0, Math.round(score)),
  };
}

/* ─────────────────────────────────────────────────────────────
   HANDLER
───────────────────────────────────────────────────────────── */
export async function GET(): Promise<NextResponse<DRStatusPayload>> {
  const errors: string[] = [];

  // Fire all fetchers in parallel — each is independent and never throws
  const [metrics, lastFailover, lastBackup, route53] = await Promise.all([
    fetchCloudWatchMetrics().catch(e => { errors.push(`CW metrics: ${e}`); return null; }),
    fetchLastFailoverEvent().catch(e => { errors.push(`CW logs: ${e}`); return null; }),
    fetchLatestBackup().catch(e       => { errors.push(`S3 backup: ${e}`); return null; }),
    fetchRoute53Status().catch(e      => { errors.push(`Route53: ${e}`); return null; }),
  ]);

  const { status, healthScore } = deriveStatus(metrics, route53);

  // Determine source reliability
  const liveSources = [metrics, lastBackup, route53].filter(Boolean).length;
  const source: DRStatusPayload['source'] =
    liveSources === 0 ? 'unavailable' :
    liveSources  < 3  ? 'partial'     :
                        'live';

  const payload: DRStatusPayload = {
    status,
    healthScore,
    activeRegion: DR_REGION,
    metrics: metrics ?? {
      failoverExecuted:    0,
      failoverFailed:      0,
      failoverAborted:     0,
      failoverAlreadyDone: 0,
      criticalFailures:    0,
    },
    lastFailover: lastFailover ?? {
      time:       null,
      status:     null,
      detail:     null,
      oldPrimary: null,
      newPrimary: null,
      region:     null,
    },
    lastBackup: lastBackup ?? { time: null, key: null },
    route53:    route53    ?? { status: null, checkedRegions: [] },
    fetchedAt:  new Date().toISOString(),
    source,
    errors,
  };

  // Cache-control: allow 20s browser cache, 30s CDN staleness
  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=10' },
  });
}
