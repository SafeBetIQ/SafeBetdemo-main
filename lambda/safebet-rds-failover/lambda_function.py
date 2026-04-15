import json
import os
import time
import boto3
from botocore.exceptions import ClientError


# ─────────────────────────────────────────────────────────────────────────────
# NEW: S3-backed DR state  (persistent cooldown + audit trail)
# ─────────────────────────────────────────────────────────────────────────────

def get_dr_state(s3, bucket, key='dr-state.json') -> dict:
    """
    Load DR state from S3.  Returns {} when the object does not yet exist.
    Any S3 error other than NoSuchKey is swallowed and logged — a read failure
    must never block a real failover.
    """
    try:
        resp = s3.get_object(Bucket=bucket, Key=key)
        return json.loads(resp['Body'].read())
    except ClientError as exc:
        if exc.response['Error']['Code'] in ('NoSuchKey', 'NoSuchBucket'):
            print(f'[STATE] No existing DR state found in s3://{bucket}/{key} — starting fresh.')
        else:
            print(f'[STATE] WARNING: Could not read DR state: {exc} — proceeding without it.')
        return {}
    except Exception as exc:
        print(f'[STATE] WARNING: Unexpected error reading DR state: {exc} — proceeding without it.')
        return {}


def save_dr_state(s3, bucket, state: dict, key='dr-state.json') -> None:
    """
    Persist DR state to S3 as JSON.  Failures are logged but never raised —
    a write failure must not roll back a completed failover.
    """
    try:
        s3.put_object(
            Bucket      = bucket,
            Key         = key,
            Body        = json.dumps(state, indent=2),
            ContentType = 'application/json',
        )
        print(f'[STATE] DR state saved to s3://{bucket}/{key}')
    except Exception as exc:
        print(f'[STATE] WARNING: Could not save DR state: {exc} — state may be stale.')


# ─────────────────────────────────────────────────────────────────────────────
# Deterministic replica naming  (unchanged)
# ─────────────────────────────────────────────────────────────────────────────

def _replica_name_for(primary_id: str) -> str:
    """
    Return a fixed replica identifier — prevents suffix-chaining.

      primary contains 'ireland'  →  safebet-replica-capetown-v2
      anything else               →  safebet-replica-ireland-v2
    """
    if 'ireland' in primary_id.lower():
        return 'safebet-replica-capetown-v2'
    return 'safebet-replica-ireland-v2'


# ─────────────────────────────────────────────────────────────────────────────
# MODIFIED: Replica rebuild  (dynamic instance class + unchanged safety checks)
# ─────────────────────────────────────────────────────────────────────────────

def rebuild_replica(new_primary_id, new_primary_region, target_region):
    """
    Recreate a read replica of new_primary_id in target_region.

    Idempotent: skips creation if the replica already exists in any state.
    NEW: matches the source instance class dynamically instead of hardcoding.
    """
    replica_id = _replica_name_for(new_primary_id)
    rds_source = boto3.client('rds', region_name=new_primary_region)
    rds_target = boto3.client('rds', region_name=target_region)

    print(f'[REBUILD] Starting replica creation: {replica_id} in {target_region}')

    # ── Safety check — skip if replica already exists in ANY state ────────
    try:
        resp   = rds_target.describe_db_instances(DBInstanceIdentifier=replica_id)
        status = resp['DBInstances'][0]['DBInstanceStatus']
        print(f'[REBUILD] Replica {replica_id} already exists (status={status}) — skipping.')
        return
    except ClientError as exc:
        if exc.response['Error']['Code'] in ('DBInstanceNotFound', 'DBInstanceNotFoundFault'):
            pass   # expected — proceed
        else:
            print(f'[REBUILD ERROR] Existence check failed: {exc}')
            raise

    # NEW: resolve instance class from the source — no hardcoded size
    instance_class = 'db.t3.medium'   # safe fallback if describe fails
    try:
        src_resp       = rds_source.describe_db_instances(DBInstanceIdentifier=new_primary_id)
        instance_class = src_resp['DBInstances'][0]['DBInstanceClass']
        print(f'[REBUILD] Matched source instance class: {instance_class}')
    except Exception as exc:
        print(f'[REBUILD] WARNING: Could not read source instance class ({exc}) — '
              f'using fallback {instance_class}')

    # ── Build cross-region source ARN ─────────────────────────────────────
    account_id = boto3.client('sts').get_caller_identity()['Account']
    source_arn = f'arn:aws:rds:{new_primary_region}:{account_id}:db:{new_primary_id}'

    print(f'[REBUILD] Source ARN : {source_arn}')
    print(f'[REBUILD] Replica ID : {replica_id} | Class: {instance_class} | Region: {target_region}')

    # ── Create the replica ────────────────────────────────────────────────
    try:
        rds_target.create_db_instance_read_replica(
            DBInstanceIdentifier       = replica_id,
            SourceDBInstanceIdentifier = source_arn,
            DBInstanceClass            = instance_class,   # MODIFIED: dynamic
            PubliclyAccessible         = False,
            MultiAZ                    = False,
            SourceRegion               = new_primary_region,
        )
        print(f'[REBUILD] Replica creation triggered: {replica_id} in {target_region}')
        print(f'[REBUILD] Replica will take several minutes to become available.')
    except ClientError as exc:
        if exc.response['Error']['Code'] == 'DBInstanceAlreadyExists':
            print(f'[REBUILD] Replica {replica_id} already exists (race condition) — skipping.')
        else:
            print(f'[REBUILD ERROR] create_db_instance_read_replica failed: {exc}')
            raise


# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def lambda_handler(event, context):
    replica_id       = os.environ['REPLICA_DB']
    replica_region   = os.environ.get('REPLICA_DB_REGION',  'eu-west-1')
    replica_endpoint = os.environ['REPLICA_DB_ENDPOINT']
    r53_zone_id      = os.environ['ROUTE53_HOSTED_ZONE_ID']
    r53_record_name  = os.environ['ROUTE53_RECORD_NAME']

    # Optional — failover works without any of these
    auto_rebuild   = os.environ.get('AUTO_REBUILD',        'false').lower() == 'true'
    primary_db     = os.environ.get('PRIMARY_DB',          'safebet-primary-capetown')
    primary_region = os.environ.get('PRIMARY_DB_REGION',   'af-south-1')
    cooldown_sec   = int(os.environ.get('FAILOVER_COOLDOWN', '600'))
    s3_bucket      = os.environ.get('S3_BUCKET', '')       # NEW: empty = S3 state disabled

    rds = boto3.client('rds',     region_name=replica_region)
    r53 = boto3.client('route53')
    # NEW: S3 client created once; used only when S3_BUCKET is set
    s3  = boto3.client('s3') if s3_bucket else None

    # ── Parse SNS / CloudWatch alarm event ───────────────────────────────
    try:
        message     = json.loads(event['Records'][0]['Sns']['Message'])
        alarm_state = message.get('NewStateValue', '')
        alarm_name  = message.get('AlarmName', 'unknown')
    except Exception as exc:
        print(f'[ERROR] Failed to parse SNS event: {exc}')
        raise

    print(f'[DR] Failover started | Alarm={alarm_name} State={alarm_state}')

    if alarm_state != 'ALARM':
        print(f'[DR] State is {alarm_state!r} — no action required.')
        return {'status': 'NO_ACTION'}

    # NEW: Load persistent DR state from S3 (falls back to {} on any error)
    dr_state = get_dr_state(s3, s3_bucket) if s3_bucket else {}
    if not s3_bucket:
        print('[STATE] S3_BUCKET not set — persistent state disabled.')

    # ── MODIFIED: Persistent cooldown (S3-backed, replaces in-memory var) ─
    now            = time.time()
    last_failover  = dr_state.get('last_failover', 0)
    if last_failover:
        elapsed = now - last_failover
        if elapsed < cooldown_sec:
            remaining = int(cooldown_sec - elapsed)
            print(
                f'[COOLDOWN] Persistent cooldown active — last failover was '
                f'{int(elapsed)}s ago ({remaining}s remaining). Skipping.'
            )
            return {'status': 'COOLDOWN_ACTIVE', 'cooldown_remaining_sec': remaining}
    print(f'[DR] Cooldown check passed (last_failover={last_failover:.0f})')

    # ── Check current replica state ───────────────────────────────────────
    try:
        resp     = rds.describe_db_instances(DBInstanceIdentifier=replica_id)
        instance = resp['DBInstances'][0]
    except ClientError as exc:
        print(f'[ERROR] describe_db_instances failed: {exc}')
        raise

    source         = instance.get('ReadReplicaSourceDBInstanceIdentifier', '')
    # MODIFIED: no early return — already-primary still falls through to rebuild
    already_primary = not source

    if already_primary:
        print(f'[DR] {replica_id} has no replication source — already a primary. '
              f'Skipping promotion.')
    else:
        print(f'[DR] Promoting replica: {replica_id} (source={source})')

        # ── Promote replica  (UNCHANGED) ─────────────────────────────────
        try:
            rds.promote_read_replica(DBInstanceIdentifier=replica_id)
            print(f'[DR] promote_read_replica accepted for {replica_id}.')
        except ClientError as exc:
            if exc.response['Error']['Code'] == 'InvalidDBInstanceState':
                print(f'[DR] {replica_id} is already standalone — skipping promote call.')
            else:
                print(f'[ERROR] promote_read_replica failed: {exc}')
                raise

        # ── Wait for available  (UNCHANGED) ──────────────────────────────
        print(f'[DR] Waiting for {replica_id} to reach available status...')
        try:
            waiter = rds.get_waiter('db_instance_available')
            waiter.wait(
                DBInstanceIdentifier=replica_id,
                WaiterConfig={'Delay': 30, 'MaxAttempts': 24},  # up to 12 minutes
            )
        except Exception as exc:
            print(f'[ERROR] Waiter failed or timed out: {exc}')
            raise

        print(f'[DR] {replica_id} is now available.')

    # ── Update Route53 CNAME (skipped when already primary — DNS is correct) ─
    if not already_primary:
        print(f'[DR] Updating DNS: {r53_record_name} → {replica_endpoint}')
        try:
            r53.change_resource_record_sets(
                HostedZoneId = r53_zone_id,
                ChangeBatch  = {
                    'Changes': [{
                        'Action': 'UPSERT',
                        'ResourceRecordSet': {
                            'Name': r53_record_name,
                            'Type': 'CNAME',
                            'TTL':  60,
                            'ResourceRecords': [{'Value': replica_endpoint}],
                        },
                    }],
                },
            )
            print(f'[DR] DNS updated successfully.')
        except ClientError as exc:
            print(f'[ERROR] Route53 update failed: {exc}')
            raise
    else:
        print('[DR] DNS update skipped — instance was already primary.')
        print('[DR] Skipping Route53 — assuming DNS already points to primary')
        print(json.dumps({'event': 'route53_skipped', 'reason': 'already_primary', 'assumption': 'dns_correct'}))

    # ── Persist state + audit log ─────────────────────────────────────────
    failover_ts = time.time()
    if s3_bucket:
        save_dr_state(s3, s3_bucket, {
            'last_failover': failover_ts,
            'new_primary':   replica_id,
            'region':        replica_region,
        })

    old_primary = source if source else primary_db
    print(f'[AUDIT] Failover executed')
    print(f'[AUDIT] Old primary : {old_primary}')
    print(f'[AUDIT] New primary : {replica_id}')
    print(f'[AUDIT] Region      : {replica_region}')
    print(f'[AUDIT] Timestamp   : {failover_ts:.0f}')
    print(f'[DR] Cooldown armed for {cooldown_sec}s.')

    # ── Rebuild replica (runs whether we promoted or were already primary) ─
    if auto_rebuild:
        print(f'[REBUILD] AUTO_REBUILD=true — rebuilding replica of {replica_id} in {primary_region}')
        try:
            rebuild_replica(
                new_primary_id     = replica_id,
                new_primary_region = replica_region,
                target_region      = primary_region,
            )
        except Exception as exc:
            print(f'[REBUILD ERROR] Replica rebuild failed — manual rebuild required: {exc}')
    else:
        print('[REBUILD] AUTO_REBUILD=false — skipping replica rebuild.')

    status = 'ALREADY_PRIMARY_REBUILD_TRIGGERED' if already_primary else 'FAILOVER_COMPLETE'
    return {'status': status}
