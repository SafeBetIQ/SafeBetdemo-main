"""
SafeBet IQ — Automated Failover Lambda
=======================================
Function name : safebet-auto-failover
Runtime       : Python 3.12
Trigger       : SNS → CloudWatch Alarm (DatabaseHealthy < 1)
Primary region: eu-north-1
DR region     : af-south-1

What this function does:
  1. Receive SNS event from CloudWatch Alarm
  2. Check if DB is already healthy (idempotency guard)
  3. Find the latest .sql.gz backup in S3
  4. Download + decompress to /tmp
  5. Restore into the production Supabase database
     — handles both regular SQL statements AND COPY blocks
  6. Validate the database responds after restore
  7. Emit FailoverExecuted / FailoverFailed metrics to CloudWatch
  8. Write a structured audit log to CloudWatch Logs

Environment variables required (set in Lambda config):
  S3_BUCKET            — safebetiq-backups-046276255259-eu-north-1-an
  S3_PREFIX            — backups/production   (default)
  SUPABASE_DB_URL_PROD — postgres://user:pass@host:port/db
  AWS_REGION           — eu-north-1           (injected by Lambda runtime)

GitHub workflows (backup.yml, auto-failover.yml, failover-restore.yml,
rollback-restore.yml) are kept as the FALLBACK / MANUAL path and are
NOT removed or modified by this function.
"""

import boto3
import gzip
import io
import json
import logging
import os
import time
from datetime import datetime, timezone
from urllib.parse import urlparse

import psycopg2

# ============================================================
# LOGGING
# ============================================================
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ============================================================
# CONSTANTS — derived from existing backup.yml paths
# ============================================================
REGION          = os.environ.get('AWS_REGION', 'eu-north-1')
S3_BUCKET       = os.environ['S3_BUCKET']               # set in Lambda env
S3_PREFIX       = os.environ.get('S3_PREFIX', 'backups/production')
DB_URL          = os.environ['SUPABASE_DB_URL_PROD']     # set in Lambda env

CW_NAMESPACE    = 'SafeBetIQ/DR'         # matches existing DatabaseHealthy namespace
LOG_GROUP       = 'safebet-backups'      # matches existing CloudWatch log group
MAX_RETRIES     = 3
CONNECT_TIMEOUT = 30                     # seconds

# Psycopg2 error codes that are safe to ignore during idempotent restores
IGNORABLE_PG_CODES = {
    '42P07',  # duplicate_table
    '42710',  # duplicate_object
    '42701',  # duplicate_column
    '23505',  # unique_violation  (safe on re-run)
    '42P06',  # duplicate_schema
}

# ============================================================
# AWS CLIENTS
# ============================================================
s3         = boto3.client('s3',         region_name=REGION)
cloudwatch = boto3.client('cloudwatch', region_name=REGION)
logs_cl    = boto3.client('logs',       region_name=REGION)


# ============================================================
# CLOUDWATCH HELPERS
# ============================================================

def cw_log(log_stream: str, payload: dict) -> None:
    """Write a structured JSON event to CloudWatch Logs."""
    try:
        logs_cl.put_log_events(
            logGroupName=LOG_GROUP,
            logStreamName=log_stream,
            logEvents=[{
                'timestamp': int(time.time() * 1000),
                'message':   json.dumps(payload),
            }]
        )
    except Exception as exc:
        logger.warning(f'[CW-LOG] Could not write to CloudWatch: {exc}')


def cw_metric(name: str, value: float) -> None:
    """Publish a single Count metric to SafeBetIQ/DR namespace."""
    try:
        cloudwatch.put_metric_data(
            Namespace=CW_NAMESPACE,
            MetricData=[{
                'MetricName': name,
                'Value':      value,
                'Unit':       'Count',
                'Timestamp':  datetime.now(timezone.utc),
            }]
        )
        logger.info(f'[METRIC] {CW_NAMESPACE}/{name} = {value}')
    except Exception as exc:
        logger.warning(f'[METRIC] Failed to publish {name}: {exc}')


# ============================================================
# S3 OPERATIONS
# ============================================================

def find_latest_backup() -> str:
    """
    Page through S3_BUCKET/S3_PREFIX, collect all .sql.gz objects,
    and return the key of the most recently modified file.

    Uses pagination so it works correctly with >1000 objects.
    """
    logger.info(f'[S3] Scanning s3://{S3_BUCKET}/{S3_PREFIX}')

    paginator   = s3.get_paginator('list_objects_v2')
    all_objects = []

    for page in paginator.paginate(Bucket=S3_BUCKET, Prefix=S3_PREFIX):
        for obj in page.get('Contents', []):
            if obj['Key'].endswith('.sql.gz'):
                all_objects.append(obj)

    if not all_objects:
        raise FileNotFoundError(
            f'No .sql.gz backup files found at s3://{S3_BUCKET}/{S3_PREFIX}'
        )

    latest = max(all_objects, key=lambda o: o['LastModified'])
    logger.info(
        f'[S3] Latest backup: {latest["Key"]} '
        f'(LastModified: {latest["LastModified"]}, '
        f'Size: {latest["Size"]:,} bytes)'
    )
    return latest['Key']


def download_and_decompress(s3_key: str) -> str:
    """
    Download the .sql.gz from S3 to /tmp and decompress it.
    Streams in 8 MB chunks to stay within Lambda memory limits.
    Returns the path of the decompressed .sql file.
    """
    gz_path  = '/tmp/restore.sql.gz'
    sql_path = '/tmp/restore.sql'

    logger.info(f'[S3] Downloading s3://{S3_BUCKET}/{s3_key} → {gz_path}')
    s3.download_file(S3_BUCKET, s3_key, gz_path)

    gz_size = os.path.getsize(gz_path)
    logger.info(f'[S3] Download complete: {gz_size:,} bytes (compressed)')

    logger.info('[DECOMPRESS] Decompressing backup (8 MB chunks)...')
    with gzip.open(gz_path, 'rb') as f_in, open(sql_path, 'wb') as f_out:
        while True:
            chunk = f_in.read(8 * 1024 * 1024)  # 8 MB
            if not chunk:
                break
            f_out.write(chunk)

    sql_size = os.path.getsize(sql_path)
    logger.info(f'[DECOMPRESS] Done: {sql_size:,} bytes (uncompressed)')

    if sql_size < 512:
        raise ValueError(
            f'Decompressed SQL is only {sql_size} bytes — backup may be corrupt'
        )

    return sql_path


# ============================================================
# DATABASE OPERATIONS
# ============================================================

def parse_db_url(url: str) -> dict:
    """Parse a postgres:// URL into psycopg2 keyword arguments."""
    p = urlparse(url)
    return {
        'host':            p.hostname,
        'port':            p.port or 5432,
        'dbname':          p.path.lstrip('/'),
        'user':            p.username,
        'password':        p.password,
        'connect_timeout': CONNECT_TIMEOUT,
        'sslmode':         'require',
    }


def is_db_healthy() -> bool:
    """
    Idempotency guard: return True if the database is already
    responding normally. If True, a restore is not needed.
    """
    try:
        conn   = psycopg2.connect(**parse_db_url(DB_URL))
        cur    = conn.cursor()
        cur.execute('SELECT 1;')
        result = cur.fetchone()
        cur.close()
        conn.close()
        return bool(result and result[0] == 1)
    except Exception:
        return False


def execute_sql_dump(sql_path: str) -> int:
    """
    Execute a pg_dump plain-text SQL file against the target database.

    Handles two types of content produced by pg_dump:
      1. Regular SQL statements (ending with ';')
      2. COPY ... FROM stdin blocks (tab-delimited data ending with '\\.')

    Uses psycopg2 with autocommit=True to match `psql` default behaviour.
    Non-critical errors (duplicate objects etc.) are logged and skipped
    so that re-runs are safe (idempotency).

    Returns the number of successfully executed statements + COPY blocks.
    """
    conn_params = parse_db_url(DB_URL)
    logger.info(
        f'[DB] Connecting to {conn_params["host"]}:{conn_params["port"]} '
        f'(db={conn_params["dbname"]})'
    )

    conn           = psycopg2.connect(**conn_params)
    conn.autocommit = True          # Required for DDL and COPY outside transactions
    cursor         = conn.cursor()

    executed  = 0
    warnings  = 0
    in_copy   = False
    copy_stmt = None
    copy_buf  = io.StringIO()
    stmt_buf  = []

    logger.info(f'[DB] Executing SQL from {sql_path}...')

    with open(sql_path, 'r', encoding='utf-8', errors='replace') as fh:
        for raw_line in fh:
            line     = raw_line.rstrip('\n')
            stripped = line.strip()

            # ── Inside a COPY data block ──────────────────────────────
            if in_copy:
                if line == '\\.':
                    # End-of-data marker: flush the buffer via copy_expert
                    copy_buf.seek(0)
                    try:
                        cursor.copy_expert(copy_stmt, copy_buf)
                        executed += 1
                    except psycopg2.Error as exc:
                        if exc.pgcode not in IGNORABLE_PG_CODES:
                            logger.warning(
                                f'[DB] COPY warning ({exc.pgcode}): '
                                f'{(exc.pgerror or "").strip()}'
                            )
                            warnings += 1
                    in_copy   = False
                    copy_stmt = None
                    copy_buf  = io.StringIO()
                else:
                    # Accumulate data rows (keep the original newline)
                    copy_buf.write(raw_line)
                continue

            # ── Regular SQL ───────────────────────────────────────────
            # Skip blank lines and comments
            if not stripped or stripped.startswith('--'):
                continue

            stmt_buf.append(line)
            upper = stripped.upper()

            # Detect start of a COPY ... FROM STDIN block
            if upper.startswith('COPY ') and 'FROM STDIN' in upper:
                # copy_expert does not want the trailing semicolon
                copy_stmt = '\n'.join(stmt_buf).rstrip(';').strip()
                stmt_buf  = []
                in_copy   = True
                continue

            # Regular statement terminates with ';'
            if stripped.endswith(';'):
                full_stmt = '\n'.join(stmt_buf).strip()
                stmt_buf  = []
                if not full_stmt:
                    continue
                try:
                    cursor.execute(full_stmt)
                    executed += 1
                except psycopg2.Error as exc:
                    if exc.pgcode not in IGNORABLE_PG_CODES:
                        logger.warning(
                            f'[DB] Statement warning ({exc.pgcode}): '
                            f'{(exc.pgerror or "").strip()}'
                        )
                        warnings += 1
                    # autocommit=True means no open transaction to roll back

    cursor.close()
    conn.close()

    logger.info(
        f'[DB] Restore complete: {executed} executed, {warnings} warnings'
    )
    return executed


def validate_db(retries: int = MAX_RETRIES) -> None:
    """
    Confirm the database responds to SELECT 1 after restore.
    Retries up to `retries` times with a 5-second wait between attempts.
    Raises RuntimeError if all attempts fail.
    """
    conn_params = parse_db_url(DB_URL)
    logger.info(f'[VALIDATE] Checking database health ({retries} attempts max)...')

    for attempt in range(1, retries + 1):
        try:
            conn   = psycopg2.connect(**conn_params)
            cur    = conn.cursor()
            cur.execute('SELECT 1;')
            row    = cur.fetchone()
            cur.close()
            conn.close()

            if row and row[0] == 1:
                logger.info(f'[VALIDATE] Database healthy (attempt {attempt})')
                return

        except Exception as exc:
            logger.warning(f'[VALIDATE] Attempt {attempt} failed: {exc}')
            if attempt < retries:
                time.sleep(5)

    raise RuntimeError(
        '[VALIDATE] Database not responding after restore — manual intervention required'
    )


# ============================================================
# LAMBDA HANDLER
# ============================================================

def handler(event, context):
    """
    Lambda entry point.

    Triggered by SNS from a CloudWatch Alarm when DatabaseHealthy
    metric drops below 1 for 2 consecutive evaluation periods.

    The function is safe to invoke multiple times (idempotent):
    if the database is already healthy it exits early without
    performing a restore.
    """
    invocation_id = context.aws_request_id
    start_ts      = datetime.now(timezone.utc)
    log_stream    = f'lambda-failover-{start_ts.strftime("%Y-%m-%d-%H-%M-%S")}'

    logger.info(
        f'=== SAFEBET IQ AUTOMATED FAILOVER START '
        f'| id={invocation_id} | ts={start_ts.isoformat()} ==='
    )

    # ── Parse SNS envelope (informational only) ───────────────────────
    alarm_name = 'unknown'
    try:
        sns_msg    = json.loads(event['Records'][0]['Sns']['Message'])
        alarm_name = sns_msg.get('AlarmName', 'unknown')
        logger.info(f'[SNS] Triggered by alarm: {alarm_name}')
    except Exception:
        logger.info('[SNS] Could not parse alarm name — continuing anyway')

    # ── Create CloudWatch log stream ──────────────────────────────────
    try:
        logs_cl.create_log_stream(
            logGroupName=LOG_GROUP,
            logStreamName=log_stream
        )
    except logs_cl.exceptions.ResourceAlreadyExistsException:
        pass  # stream already exists; harmless

    cw_log(log_stream, {
        'event':         'failover-started',
        'alarm_name':    alarm_name,
        'invocation_id': invocation_id,
        'timestamp':     start_ts.isoformat(),
    })

    # ── Idempotency guard ─────────────────────────────────────────────
    logger.info('[IDEMPOTENCY] Checking if database is already healthy...')
    if is_db_healthy():
        msg = 'Database is already healthy — skipping restore (idempotency guard)'
        logger.info(f'[IDEMPOTENCY] {msg}')
        cw_log(log_stream, {
            'event':         'failover-skipped',
            'reason':        msg,
            'invocation_id': invocation_id,
            'timestamp':     datetime.now(timezone.utc).isoformat(),
        })
        return {
            'statusCode': 200,
            'body': json.dumps({'status': 'SKIPPED', 'reason': msg}),
        }

    backup_key = None

    try:
        # ── STEP 1: Locate latest backup ──────────────────────────────
        logger.info('[STEP 1/4] Locating latest backup in S3...')
        backup_key = find_latest_backup()
        cw_log(log_stream, {
            'event': 'backup-located',
            'key':   backup_key,
        })

        # ── STEP 2: Download + decompress ─────────────────────────────
        logger.info('[STEP 2/4] Downloading and decompressing backup...')
        sql_path = download_and_decompress(backup_key)
        cw_log(log_stream, {
            'event':    'backup-downloaded',
            'sql_path': sql_path,
            'sql_size': os.path.getsize(sql_path),
        })

        # ── STEP 3: Restore database ──────────────────────────────────
        logger.info('[STEP 3/4] Executing database restore...')
        stmt_count = execute_sql_dump(sql_path)
        cw_log(log_stream, {
            'event':               'restore-executed',
            'statements_executed': stmt_count,
        })

        # ── STEP 4: Validate ──────────────────────────────────────────
        logger.info('[STEP 4/4] Validating database post-restore...')
        validate_db()
        cw_log(log_stream, {'event': 'restore-validated'})

        # ── Success metrics ───────────────────────────────────────────
        cw_metric('FailoverExecuted', 1)
        cw_metric('FailoverFailed',   0)

        end_ts       = datetime.now(timezone.utc)
        duration_sec = (end_ts - start_ts).total_seconds()

        cw_log(log_stream, {
            'event':         'failover-complete',
            'status':        'SUCCESS',
            'backup_used':   backup_key,
            'duration_sec':  duration_sec,
            'invocation_id': invocation_id,
            'timestamp':     end_ts.isoformat(),
        })

        # ============================================================
        # FUTURE HOOK — Phase 3: Route53 DNS Failover
        # ============================================================
        # To activate, set these Lambda environment variables:
        #   ROUTE53_ZONE_ID      — your Hosted Zone ID
        #   ROUTE53_RECORD_NAME  — e.g. db.safebetiq.com
        #   DR_DB_CNAME          — DR database CNAME endpoint
        #
        # route53 = boto3.client('route53')
        # route53.change_resource_record_sets(
        #     HostedZoneId=os.environ['ROUTE53_ZONE_ID'],
        #     ChangeBatch={
        #         'Changes': [{
        #             'Action': 'UPSERT',
        #             'ResourceRecordSet': {
        #                 'Name':  os.environ['ROUTE53_RECORD_NAME'],
        #                 'Type':  'CNAME',
        #                 'TTL':   60,
        #                 'ResourceRecords': [
        #                     {'Value': os.environ['DR_DB_CNAME']}
        #                 ]
        #             }
        #         }]
        #     }
        # )
        # logger.info('[ROUTE53] DNS failover record updated to DR endpoint')
        # ============================================================

        logger.info(
            f'=== FAILOVER COMPLETE: SUCCESS '
            f'| backup={backup_key} '
            f'| duration={duration_sec:.1f}s ==='
        )

        return {
            'statusCode': 200,
            'body': json.dumps({
                'status':        'SUCCESS',
                'backup_used':   backup_key,
                'duration_sec':  duration_sec,
                'invocation_id': invocation_id,
                'timestamp':     end_ts.isoformat(),
            }),
        }

    except Exception as exc:
        err_ts = datetime.now(timezone.utc)
        logger.error(f'=== FAILOVER FAILED: {exc} ===', exc_info=True)

        cw_metric('FailoverExecuted', 0)
        cw_metric('FailoverFailed',   1)

        cw_log(log_stream, {
            'event':         'failover-failed',
            'status':        'FAILED',
            'error':         str(exc),
            'backup_used':   backup_key,
            'invocation_id': invocation_id,
            'timestamp':     err_ts.isoformat(),
        })

        # Re-raise so Lambda marks the invocation as failed.
        # If a DLQ is configured on the SNS subscription, the event
        # will be retried according to the Lambda retry policy.
        raise
