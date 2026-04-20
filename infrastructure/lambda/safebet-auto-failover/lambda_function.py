"""
SafeBet IQ — Automated Failover Lambda
=======================================
Function name : safebet-auto-failover
Runtime       : Python 3.12
Trigger       : SNS → CloudWatch Alarm (DatabaseHealthy < 1)
Primary region: eu-north-1
DR region     : af-south-1

What this function does:
  1.  Receive SNS event from CloudWatch Alarm
  2.  Check S3 for a restore-completion marker (idempotency guard)
  3.  If marker exists AND data integrity validation passes → skip restore
  4.  If marker missing OR integrity fails → proceed with full restore
  5.  Open streaming pipeline: s3.get_object() → GzipFile → TextIOWrapper (0 /tmp bytes)
  6.  Stream-decompress and execute SQL via psycopg2 — FAIL FAST on errors
  7.  COPY blocks streamed directly to copy_expert() — zero large-buffer RAM usage
  8.  Run validate_data_integrity(): tables exist, row counts > 0, no FK orphans
  9.  Write S3 restore-completion marker ONLY on full success
  10. Emit FailoverExecuted / FailoverFailed metrics to CloudWatch
  11. Write structured audit log to CloudWatch Logs

SCALABILITY (P1 fixes applied — Round 2: full S3 streaming):
  Previously:
    • COPY blocks were buffered in io.StringIO — entire block in RAM → OOM at > ~500 MB.
    • Full decompression wrote uncompressed SQL to /tmp → disk overflow at > ~3 GB.
    • s3.download_file() wrote the full .sql.gz to /tmp before streaming could begin.

  Now:
    • download_and_stream() calls s3.get_object()['Body'] and opens a pipeline:
        S3 StreamingBody → gzip.GzipFile(fileobj=body) → io.TextIOWrapper
      Zero bytes are written to /tmp; the compressed stream is never materialised.
    • execute_sql_dump() accepts any text iterable — receives the TextIOWrapper
      directly, so decompression is on-demand as each line is consumed.
    • _CopyBlockReader wraps the shared line iterator and feeds copy_expert() in
      ~8 KB chunks.  RAM per COPY block = O(one line), not O(entire block).
    • /tmp usage: 0 bytes.  Peak RAM ≈ gzip decompress buffer + one COPY row.

IDEMPOTENCY (P0 fix):
  S3 marker replaces the old SELECT 1 guard.  Marker written ONLY after a
  successful restore AND passed data integrity validation.

Environment variables required (set in Lambda configuration):
  S3_BUCKET        — safebetiq-backups-046276255259-eu-north-1-an
  S3_PREFIX        — backups/production          (default)
  MARKER_PREFIX    — restore-complete             (default)
  CRITICAL_TABLES  — users,bets,payments          (default; comma-separated)
  DB_HOST          — aws-0-eu-west-1.pooler.supabase.com
  DB_PORT          — 6543
  DB_NAME          — postgres
  DB_USER          — postgres.<project-ref>
  DB_PASSWORD      — <password>
  AWS_REGION       — eu-north-1                  (injected by Lambda runtime)

TEST MODE (safe failover testing — no production data risk):
  TEST_MODE             = true              → enable test mode (default: false)
  TEST_STRATEGY         = dry_run           → read stream, no execution (default)
                        = transaction_rollback → execute DDL then ROLLBACK
  TEST_STATEMENT_LIMIT  = 20               → max DDL stmts in rollback mode

IAM NOTE:
  The Lambda execution role requires s3:PutObject on the MARKER_PREFIX path.
  See lambda/iam/lambda-execution-role-policy.json.

GitHub workflows (backup.yml, auto-failover.yml, failover-restore.yml,
rollback-restore.yml) remain as the FALLBACK / MANUAL recovery path.
"""

import boto3
import gzip
import io
import json
import logging
import os
import time
from datetime import datetime, timezone

import psycopg2

# ============================================================
# LOGGING
# ============================================================
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ============================================================
# CONSTANTS
# ============================================================
REGION        = os.environ.get('AWS_REGION', 'eu-north-1')
S3_BUCKET     = os.environ['S3_BUCKET']
S3_PREFIX     = os.environ.get('S3_PREFIX',  'backups/production')
MARKER_PREFIX = os.environ.get('MARKER_PREFIX', 'restore-complete')

CRITICAL_TABLES: list[str] = [
    t.strip()
    for t in os.environ.get('CRITICAL_TABLES', 'users,bets,payments').split(',')
    if t.strip()
]

CW_NAMESPACE    = 'SafeBetIQ/DR'
LOG_GROUP       = 'safebet-backups'
MAX_RETRIES     = 3
CONNECT_TIMEOUT = 30   # seconds

# Psycopg2 error codes safe to skip on idempotent re-runs.
# "Object already exists" errors are expected when a dump is re-applied.
# EVERY OTHER psycopg2 error aborts the restore immediately (fail-fast).
IGNORABLE_PG_CODES = {
    '42P07',  # duplicate_table
    '42710',  # duplicate_object
    '42701',  # duplicate_column
    '23505',  # unique_violation  — row already present; safe to skip on re-run
    '42P06',  # duplicate_schema
}

# ============================================================
# TEST MODE — safe failover testing without touching production
# ============================================================
# Toggle via Lambda environment variable — never hardcode True in production.
#
#   TEST_MODE = true          → activate test mode (default: false)
#   TEST_STRATEGY = dry_run   → read stream + verify connectivity, execute nothing
#                 = transaction_rollback
#                             → execute DDL in a transaction, then ROLLBACK
#                               (COPY blocks are skipped; no data ever written)
#   TEST_STATEMENT_LIMIT = N  → max DDL statements in transaction_rollback mode
#                               (default: 20; prevents long-running test restores)
#
# What each strategy tests:
#   Both strategies:   S3 access, backup detection, streaming pipeline,
#                      gzip decompression, DB connectivity
#   dry_run only:      SQL parsing, statement categorisation
#   transaction_rollback: DDL execution, psycopg2 error handling
#                         (ROLLBACK guarantees zero data change)
#
# SAFETY GUARANTEE:
#   TEST_MODE never calls write_restore_marker().
#   TEST_MODE never emits FailoverExecuted / FailoverFailed metrics.
#   TEST_MODE never modifies production tables.
# ============================================================
# TEST_MODE, TEST_STRATEGY, and TEST_STATEMENT_LIMIT are intentionally NOT
# read here.  They are read inside handler() on every invocation so that
# changes made in the Lambda console take effect immediately on the next
# call — including on warm instances that reuse this module.  Reading them
# at import time (module level) causes stale values after an env-var update
# because Lambda may reuse the same process for many invocations without
# re-importing the module.

# ============================================================
# AWS CLIENTS — module-level for warm-start reuse
# ============================================================
s3         = boto3.client('s3',              region_name=REGION)
cloudwatch = boto3.client('cloudwatch',      region_name=REGION)
logs_cl    = boto3.client('logs',            region_name=REGION)
secretsmgr = boto3.client('secretsmanager',  region_name=REGION)

# Cache for Secrets Manager result — refreshed on each Lambda cold start.
# A warm invocation reuses the cached value to avoid extra API calls.
# Acceptable TTL: Lambda cold starts are infrequent; a stale cache here
# would only matter if the secret was rotated mid-warm-invocation, which
# Secrets Manager handles by rotating without immediate revocation.
_cached_db_creds: dict | None = None


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
                'message':   json.dumps(payload, default=str),
            }]
        )
    except Exception as exc:
        logger.warning(f'[CW-LOG] Could not write to CloudWatch Logs: {exc}')


def cw_metric(name: str, value: float) -> None:
    """Publish a single Count metric to the SafeBetIQ/DR namespace."""
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
# DB CONNECTIVITY CHECK  (used by test mode — read-only)
# ============================================================

def check_db_connectivity() -> dict:
    """
    Open a DB connection, run a read-only query, and close immediately.
    Used by test mode to verify that psycopg2 can reach the database
    without executing any restore statements.

    Returns:
        dict with pg_version, current_database, current_user, server_start.
    Raises:
        Any psycopg2 / OS exception — caller logs and re-raises.
    """
    conn_params = get_db_conn_params()
    logger.info(
        f'[TEST] Verifying DB connectivity: '
        f'{conn_params["host"]}:{conn_params["port"]} db={conn_params["dbname"]}'
    )
    conn = psycopg2.connect(**conn_params)
    try:
        cur = conn.cursor()
        cur.execute(
            'SELECT version(), current_database(), current_user, '
            'pg_postmaster_start_time()'
        )
        row = cur.fetchone()
        cur.close()
        info = {
            'pg_version':       row[0],
            'current_database': row[1],
            'current_user':     row[2],
            'server_start':     str(row[3]),
        }
        logger.info(
            f'[TEST] DB connectivity OK — '
            f'db={info["current_database"]} user={info["current_user"]} '
            f'pg={info["pg_version"][:40]}'
        )
        return info
    finally:
        conn.close()


# ============================================================
# S3 BACKUP LOCATION
# ============================================================

def find_latest_backup() -> str:
    """
    Page through S3_BUCKET/S3_PREFIX, collect all .sql.gz objects,
    and return the key of the most recently modified one.
    Pagination ensures correctness with > 1000 objects.
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


# ============================================================
# [P1 Round 2 — NEW] FULLY STREAMING S3 → GZIP → TEXT PIPELINE
# ============================================================
# Replaces download_backup() which called s3.download_file(), writing
# the full compressed .sql.gz to /tmp before any streaming could begin.
#
# New contract:
#   • s3.get_object()['Body'] opens a streaming HTTP response — no bytes
#     are buffered or written to disk.
#   • gzip.GzipFile(fileobj=body) wraps the stream; GzipFile is a subclass
#     of io.BufferedIOBase, so io.TextIOWrapper accepts it directly.
#   • The returned TextIOWrapper is passed straight to execute_sql_dump()
#     as the line source.  Decompression is on-demand as lines are consumed.
#
# /tmp usage:
#   Old (download_backup): compressed file size (typically 1–4 GB)
#   New (download_and_stream): 0 bytes — nothing on disk
#
# Trade-off:
#   Streaming means we cannot retry a partial download mid-stream.  If the
#   S3 connection drops after 500 MB, the restore aborts (fail-fast) and
#   FailoverFailed=1 is emitted.  The next Lambda invocation retries from
#   the start.  This is the correct behaviour for a DR restore: a partial
#   restore that silently continues on a broken stream is worse than a clean
#   abort and retry.
# ============================================================

def download_and_stream(s3_key: str) -> tuple[io.TextIOWrapper, int]:
    """
    [P1 Round 2 — NEW] Open a fully streaming pipeline from S3.

    Pipeline:
        s3.get_object()['Body']          — boto3 StreamingBody (HTTP)
        → gzip.GzipFile(fileobj=body)   — on-demand decompression
        → io.TextIOWrapper(gz_stream)    — UTF-8 text line iteration

    Nothing is written to /tmp.

    Returns:
        (text_wrapper, compressed_size_bytes)
        text_wrapper   — the open TextIOWrapper; caller must close() it
                         to release the underlying S3 HTTP connection.
        compressed_size — 0 if Content-Length is absent (chunked transfer).

    Raises:
        ValueError: if the S3 object is implausibly small (< 512 bytes).
        Any boto3 exception propagates to handler() → FailoverFailed.
    """
    logger.info(f'[STREAM] Opening s3://{S3_BUCKET}/{s3_key}')
    response        = s3.get_object(Bucket=S3_BUCKET, Key=s3_key)
    body            = response['Body']           # boto3 StreamingBody
    compressed_size = response.get('ContentLength', 0)

    logger.info(
        f'[STREAM] S3 object opened — ContentLength={compressed_size:,} bytes '
        f'(0 = chunked/unknown)'
    )

    if compressed_size > 0 and compressed_size < 512:
        body.close()
        raise ValueError(
            f'S3 object is only {compressed_size} bytes — '
            f'file is likely empty or corrupt (expected > 512 bytes minimum)'
        )

    # gzip.GzipFile inherits from io.BufferedIOBase; io.TextIOWrapper accepts
    # any io.BufferedIOBase without an adapter.  errors='replace' prevents
    # UnicodeDecodeError from stopping a restore mid-way on a single bad byte.
    gz_stream    = gzip.GzipFile(fileobj=body, mode='rb')
    text_wrapper = io.TextIOWrapper(gz_stream, encoding='utf-8', errors='replace')

    logger.info('[STREAM] Pipeline open — S3 → GzipFile → TextIOWrapper ready')
    return text_wrapper, compressed_size


# ============================================================
# DATABASE CONNECTION
# ============================================================

def _load_db_creds_from_secrets_manager() -> dict:
    """
    Fetch and parse Supabase credentials from AWS Secrets Manager.
    Expected secret JSON format:
      {
        "host":     "aws-0-eu-west-1.pooler.supabase.com",
        "port":     "6543",
        "dbname":   "postgres",
        "username": "postgres.PROJECTREF",
        "password": "SECRET"
      }
    Falls back to env vars if any required key is missing from the secret.
    """
    global _cached_db_creds

    if _cached_db_creds is not None:
        logger.debug('[DB-CREDS] Using cached Secrets Manager credentials')
        return _cached_db_creds

    secret_arn = os.environ.get('SUPABASE_SECRET_ARN', '').strip()
    if not secret_arn:
        logger.warning('[DB-CREDS] SUPABASE_SECRET_ARN not set — falling back to env vars')
        return {}

    try:
        logger.info(f'[DB-CREDS] Fetching credentials from Secrets Manager: {secret_arn}')
        resp   = secretsmgr.get_secret_value(SecretId=secret_arn)
        secret = json.loads(resp.get('SecretString', '{}'))

        creds = {
            'host':     secret.get('host',     ''),
            'port':     int(secret.get('port',  6543)),
            'dbname':   secret.get('dbname',   'postgres'),
            'user':     secret.get('username', secret.get('user', '')),
            'password': secret.get('password', ''),
        }

        if not creds['host'] or not creds['password']:
            raise ValueError('Secret is missing required host or password fields')

        logger.info(
            f'[DB-CREDS] Loaded from Secrets Manager — '
            f'host={creds["host"]} port={creds["port"]} '
            f'user={creds["user"]} dbname={creds["dbname"]}'
        )
        _cached_db_creds = creds
        return creds

    except Exception as exc:
        logger.error(f'[DB-CREDS] Secrets Manager fetch failed: {exc} — falling back to env vars')
        return {}


def get_db_conn_params() -> dict:
    """
    Build psycopg2 connection params.

    Priority:
      1. AWS Secrets Manager (SUPABASE_SECRET_ARN env var must be set)
      2. Explicit env vars (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
         — fallback for backward compatibility or if secret fetch fails

    Explicit env vars prevent breakage when passwords contain special chars
    that confuse urlparse-based connection string parsers.
    """
    # Try Secrets Manager first
    sm_creds = _load_db_creds_from_secrets_manager()

    if sm_creds:
        params = {
            'host':            sm_creds['host'],
            'port':            sm_creds['port'],
            'dbname':          sm_creds['dbname'],
            'user':            sm_creds['user'],
            'password':        sm_creds['password'],
            'sslmode':         'require',
            'connect_timeout': CONNECT_TIMEOUT,
        }
    else:
        # Fallback: explicit env vars
        # This path is used when SUPABASE_SECRET_ARN is not set or secret fetch fails.
        # DB_PASSWORD in env vars is a security risk — Secrets Manager is preferred.
        logger.warning('[DB-CREDS] Using env var credentials — Secrets Manager preferred for production')
        params = {
            'host':            os.environ.get('DB_HOST', ''),
            'port':            int(os.environ.get('DB_PORT', '6543')),
            'dbname':          os.environ.get('DB_NAME', 'postgres'),
            'user':            os.environ.get('DB_USER', ''),
            'password':        os.environ.get('DB_PASSWORD', ''),
            'sslmode':         'require',
            'connect_timeout': CONNECT_TIMEOUT,
        }
        if not params['host'] or not params['password']:
            raise RuntimeError(
                '[DB-CREDS] No credentials available: '
                'SUPABASE_SECRET_ARN is not set or failed, '
                'and DB_HOST/DB_PASSWORD env vars are missing. '
                'Configure SUPABASE_SECRET_ARN in Lambda environment variables.'
            )

    logger.info(
        f'[DB-CONNECT] host={params["host"]} port={params["port"]} '
        f'user={params["user"]} dbname={params["dbname"]}'
    )
    return params


# ============================================================
# RESTORE-COMPLETION MARKER  (S3-based idempotency — P0 fix)
# ============================================================

def get_latest_restore_marker() -> dict | None:
    """
    Scan S3 for the most recent restore-completion marker.
    Returns the parsed payload or None.
    On any S3 error: returns None and forces a restore (safe default).
    """
    try:
        paginator = s3.get_paginator('list_objects_v2')
        markers   = []

        for page in paginator.paginate(
            Bucket=S3_BUCKET,
            Prefix=f'{MARKER_PREFIX}/',
        ):
            for obj in page.get('Contents', []):
                if obj['Key'].endswith('.json'):
                    markers.append(obj)

        if not markers:
            logger.info('[MARKER] No restore-completion marker found — restore required.')
            return None

        latest   = max(markers, key=lambda o: o['LastModified'])
        response = s3.get_object(Bucket=S3_BUCKET, Key=latest['Key'])
        payload  = json.loads(response['Body'].read())

        logger.info(
            f'[MARKER] Found: {latest["Key"]} '
            f'written={latest["LastModified"]} '
            f'backup={payload.get("backup_key", "unknown")}'
        )
        return payload

    except Exception as exc:
        logger.warning(
            f'[MARKER] Error reading marker — treating as absent, forcing restore: {exc}'
        )
        return None


def write_restore_marker(backup_key: str, validation_detail: dict) -> None:
    """
    Write an S3 restore-completion marker.
    Called ONLY after execute_sql_dump() AND validate_data_integrity() succeed.
    A partial or failed restore never reaches this call.
    """
    ts      = datetime.now(timezone.utc)
    key     = f'{MARKER_PREFIX}/{ts.strftime("%Y-%m-%dT%H-%M-%SZ")}.json'
    payload = {
        'timestamp':         ts.isoformat(),
        'backup_key':        backup_key,
        'validation_status': 'PASSED',
        'validation_detail': validation_detail,
        'lambda_version':    os.environ.get('AWS_LAMBDA_FUNCTION_VERSION', 'unknown'),
    }
    s3.put_object(
        Bucket               = S3_BUCKET,
        Key                  = key,
        Body                 = json.dumps(payload, default=str).encode('utf-8'),
        ContentType          = 'application/json',
        ServerSideEncryption = 'AES256',
    )
    logger.info(f'[MARKER] Written: s3://{S3_BUCKET}/{key}')


# ============================================================
# DATA INTEGRITY VALIDATION  (P0 fix — replaces SELECT 1)
# ============================================================

def validate_data_integrity(conn) -> dict:
    """
    Production-grade post-restore validation.

    Three checks in order:
      1. Schema  — every table in CRITICAL_TABLES exists in public schema.
      2. Rows    — every critical table has at least one row.
      3. Orphans — zero bets that reference non-existent users.

    Raises RuntimeError (with diagnostic message) on any failure.
    Returns a summary dict that is written into the S3 marker.
    """
    cur = conn.cursor()
    result: dict = {
        'tables_checked': [],
        'row_counts':     {},
        'orphan_check':   None,
    }

    try:
        # ── CHECK 1: Required tables exist ───────────────────────────────
        logger.info(f'[VALIDATE] CHECK 1 — tables exist: {CRITICAL_TABLES}')
        cur.execute("""
            SELECT table_name
            FROM   information_schema.tables
            WHERE  table_schema = 'public'
            AND    table_type   = 'BASE TABLE'
        """)
        existing_tables = {row[0] for row in cur.fetchall()}
        missing_tables  = [t for t in CRITICAL_TABLES if t not in existing_tables]

        if missing_tables:
            raise RuntimeError(
                f'[VALIDATE] FAILED — tables missing after restore: {missing_tables}. '
                f'Present: {sorted(existing_tables)}. '
                f'Restore was interrupted before all DDL was applied.'
            )

        result['tables_checked'] = list(CRITICAL_TABLES)
        logger.info('[VALIDATE] CHECK 1 PASSED — all required tables present')

        # ── CHECK 2: Critical tables have rows ───────────────────────────
        logger.info('[VALIDATE] CHECK 2 — row counts...')
        empty_tables = []
        for table in CRITICAL_TABLES:
            cur.execute(f'SELECT COUNT(*) FROM public."{table}"')
            count = cur.fetchone()[0]
            result['row_counts'][table] = count
            logger.info(f'[VALIDATE]   {table}: {count:,} rows')
            if count == 0:
                empty_tables.append(table)

        if empty_tables:
            raise RuntimeError(
                f'[VALIDATE] FAILED — critical tables empty after restore: {empty_tables}. '
                f'Row counts: {result["row_counts"]}. '
                f'COPY block for these tables likely failed or was never reached.'
            )

        logger.info(f'[VALIDATE] CHECK 2 PASSED — {result["row_counts"]}')

        # ── CHECK 3: Referential integrity — no orphan bets ──────────────
        if 'bets' in existing_tables and 'users' in existing_tables:
            logger.info('[VALIDATE] CHECK 3 — orphan bets (bets.user_id → users.id)...')
            cur.execute("""
                SELECT COUNT(*)
                FROM   public."bets"  b
                LEFT JOIN public."users" u ON b.user_id = u.id
                WHERE  u.id IS NULL
            """)
            orphan_count = cur.fetchone()[0]
            result['orphan_check'] = {
                'check':        'bets.user_id → users.id',
                'orphan_count': orphan_count,
            }
            if orphan_count > 0:
                raise RuntimeError(
                    f'[VALIDATE] FAILED — referential integrity broken: '
                    f'{orphan_count:,} bets reference non-existent users. '
                    f'Classic symptom of a partial restore: bets loaded before '
                    f'all referenced users were committed. '
                    f'Do NOT serve production traffic in this state.'
                )
            logger.info('[VALIDATE] CHECK 3 PASSED — 0 orphan bets')
        else:
            result['orphan_check'] = {'check': 'skipped — bets/users not in CRITICAL_TABLES'}
            logger.info('[VALIDATE] CHECK 3 skipped (bets/users not in schema)')

        logger.info(f'[VALIDATE] ALL CHECKS PASSED: {result}')
        return result

    finally:
        cur.close()


# ============================================================
# [P1 — NEW] ZERO-BUFFER COPY BLOCK STREAMER
# ============================================================
# WHY io.StringIO() was wrong:
#   copy_expert() requires a file-like object but does not require that
#   the entire COPY block be in memory at once.  It calls read() in chunks
#   (default 8 KB).  io.StringIO() loads the whole block before the first
#   read() call, meaning a 5 GB bets table → 5 GB of RAM → OOM → SIGKILL.
#   OOM is an unrecoverable kernel kill; the except block never runs, so
#   FailoverFailed is never emitted and the failure is invisible.
#
# HOW _CopyBlockReader SOLVES THIS:
#   It wraps the shared line iterator and presents a file-like read()
#   interface to copy_expert().  psycopg2 pulls data in ~8 KB chunks via
#   read(); the reader fetches exactly as many lines from the iterator as
#   are needed to satisfy each chunk.  The rest of the iterator (lines
#   after the COPY block) remain untouched.
#
# MEMORY USAGE:
#   O(1 line) at any instant — typically < 1 KB per COPY data row.
#   For pathological single-column JSON blobs (e.g., 10 MB per row),
#   _buf peaks at one row size, then drains across multiple read() calls.
#   This is unavoidable with a line-oriented format and is still orders
#   of magnitude better than buffering the whole block.
#
# ITERATOR SHARING (the key design):
#   execute_sql_dump() converts the gzip text file to an explicit iterator
#   (line_iter = iter(gz_fh)).  The outer for loop and _CopyBlockReader
#   share the same iterator object.  When copy_expert() exhausts the
#   _CopyBlockReader (i.e., reader.read() returns b''), the outer loop
#   resumes exactly at the first line after '\.' because the iterator
#   has already advanced past it.  No sentinel is left for the loop to see.
#   No threads, no pipes — pure cooperative iteration.
# ============================================================

class _CopyBlockReader:
    """
    [P1 — NEW] A read-only file-like object that streams pg_dump COPY data
    from a shared line iterator directly into psycopg2.copy_expert().

    Lifecycle per COPY block:
      1. Instantiated with the current line_iter when a COPY header is detected.
      2. Passed to cursor.copy_expert(copy_stmt, reader).
      3. psycopg2 calls read(size) repeatedly — each call pulls the minimum
         number of lines from the iterator needed to fill `size` bytes.
      4. When the pg_dump end-of-COPY sentinel (a bare backslash-dot line)
         is encountered, the reader sets _done = True and returns b'' on the
         next read(), signalling EOF to copy_expert().
      5. After copy_expert() returns, the outer loop calls next(line_iter) and
         receives the first line after the sentinel, continuing normally.

    Thread safety: not needed — Lambda executes a single invocation at a time
    and this reader is used synchronously within a single thread.
    """

    # pg_dump end-of-data sentinel, as bytes (encoding-independent comparison)
    _SENTINEL_BYTES = b'\\.'

    def __init__(self, line_iter):
        # The shared iterator from execute_sql_dump's outer loop.
        # _CopyBlockReader consumes it until the sentinel; the outer loop
        # then continues from the next line.
        self._iter = line_iter
        self._buf  = b''    # bytes pulled from the current line, not yet returned
        self._done = False  # True once sentinel was seen or iterator exhausted

    # ── Core interface — called by psycopg2 ──────────────────────────────

    def read(self, size: int = -1) -> bytes:
        """
        Return up to `size` decompressed, UTF-8 encoded COPY data bytes.
        Returns b'' to signal EOF (COPY block complete) to copy_expert().

        psycopg2 calls this with size = connection._copysize (default 8192).
        We pull lines from the iterator until the buffer satisfies `size`
        or the sentinel is reached.

        Design note: if a single COPY row is larger than `size` (e.g., a
        10 MB JSON blob in one column), _buf temporarily holds one row's
        bytes and drains across multiple read() calls.  Peak _buf size is
        bounded by max(size, single_row_size), not the block size.
        """
        # Fast path: already done, drain remaining buffer
        if self._done:
            return self._drain(size)

        # Drain buffered bytes from a previous oversized line first
        if size > 0 and len(self._buf) >= size:
            return self._drain(size)

        # Pull lines until buffer satisfies `size` or we hit EOF/sentinel
        while not self._done:
            try:
                raw = next(self._iter)
            except StopIteration:
                # Iterator exhausted before sentinel — treat as EOF.
                # copy_expert will finish; the outer loop will also finish.
                self._done = True
                break

            raw_bytes = raw.encode('utf-8') if isinstance(raw, str) else raw

            # Detect sentinel: '\.' followed by optional \r and/or \n.
            # We strip all trailing whitespace to handle \r\n (Windows) and
            # bare \n (Unix) line endings from any pg_dump variant.
            if raw_bytes.rstrip(b'\r\n') == self._SENTINEL_BYTES:
                self._done = True
                break   # Do NOT add sentinel bytes to the output buffer

            self._buf += raw_bytes

            # Stop accumulating once we have enough to satisfy this read()
            if size > 0 and len(self._buf) >= size:
                break

        return self._drain(size)

    def readline(self) -> bytes:
        """
        Return one complete line (including the newline byte).
        Some psycopg2 internal paths use readline() instead of read().

        Implementation: drain _buf up to the first newline; if none is
        buffered, pull the next line from the iterator.
        """
        if self._done and not self._buf:
            return b''

        # Check if a complete line is already buffered
        nl = self._buf.find(b'\n')
        if nl >= 0:
            line, self._buf = self._buf[:nl + 1], self._buf[nl + 1:]
            return line

        # Pull lines until we get a complete line (newline-terminated)
        while not self._done:
            try:
                raw = next(self._iter)
            except StopIteration:
                self._done = True
                break

            raw_bytes = raw.encode('utf-8') if isinstance(raw, str) else raw

            if raw_bytes.rstrip(b'\r\n') == self._SENTINEL_BYTES:
                self._done = True
                break

            self._buf += raw_bytes

            nl = self._buf.find(b'\n')
            if nl >= 0:
                line, self._buf = self._buf[:nl + 1], self._buf[nl + 1:]
                return line

        # Iterator exhausted or sentinel hit — return whatever is buffered
        result, self._buf = self._buf, b''
        return result

    # ── Internal helper ──────────────────────────────────────────────────

    def _drain(self, size: int) -> bytes:
        """Return up to `size` bytes from _buf; size < 0 returns all."""
        if size < 0 or len(self._buf) <= size:
            result, self._buf = self._buf, b''
        else:
            result, self._buf = self._buf[:size], self._buf[size:]
        return result


# ============================================================
# [P1 Round 2 — CHANGED] DATABASE RESTORE — FULLY STREAMING
# ============================================================
# Summary of changes across all P1 rounds:
#
#   Round 1 changes (previous session):
#     1. Signature: execute_sql_dump(gz_path)  [was: execute_sql_dump(sql_path)]
#     2. COPY handling: _CopyBlockReader  [was: io.StringIO() — O(block) RAM]
#     3. Line source: gzip.open(gz_path) — no uncompressed SQL on disk
#
#   Round 2 changes (this session):
#     4. Signature: execute_sql_dump(line_source)  [was: execute_sql_dump(gz_path)]
#        — accepts any text iterable; caller opens the gzip/S3 pipeline.
#          gzip.open() is no longer called here — the TextIOWrapper from
#          download_and_stream() is passed in directly.
#        — eliminates the last /tmp dependency from the restore pipeline.
#
#   Fail-fast on non-ignorable errors is PRESERVED from the P0 fix.
#   IGNORABLE_PG_CODES behaviour is UNCHANGED.
# ============================================================

def execute_sql_dump(line_source) -> int:
    """
    [P1 Round 2 — CHANGED] Execute SQL from any text line iterable.

    Accepts a TextIOWrapper, an open file, or any iterable of str lines.
    In production this receives the TextIOWrapper from download_and_stream()
    which pipelines S3 StreamingBody → GzipFile → TextIOWrapper with zero
    /tmp usage.

    COPY blocks are fed to copy_expert() via _CopyBlockReader — a zero-buffer
    streaming reader that holds at most one COPY data row in memory at a time.

    Fail-fast: any psycopg2 error NOT in IGNORABLE_PG_CODES raises RuntimeError
    immediately, aborting the restore.  The caller (handler) catches this,
    emits FailoverFailed=1, and re-raises.

    Args:
        line_source: Any iterable of str lines (TextIOWrapper, file, list, …).

    Returns:
        Number of successfully executed statements + COPY blocks.
    """
    conn_params = get_db_conn_params()
    logger.info(
        f'[DB] Connecting: {conn_params["host"]}:{conn_params["port"]} '
        f'db={conn_params["dbname"]}'
    )

    conn            = psycopg2.connect(**conn_params)
    conn.autocommit = True   # required for DDL and COPY outside a transaction
    cursor          = conn.cursor()

    executed  = 0
    skipped   = 0
    stmt_buf: list[str] = []

    logger.info('[DB] Streaming restore (fail-fast mode)...')

    try:
        # [P1 Round 2] line_source is already an open TextIOWrapper (or any
        # iterable of str).  An explicit iterator is created so it can be
        # shared between the outer for-loop and _CopyBlockReader.  When
        # copy_expert() exhausts the reader, the outer loop resumes at the
        # first line after the sentinel — no manual bookkeeping required.
        line_iter = iter(line_source)

        for raw_line in line_iter:
            line     = raw_line.rstrip('\n')
            stripped = line.strip()

            # Skip blank lines and SQL comments outside COPY blocks
            if not stripped or stripped.startswith('--'):
                continue

            stmt_buf.append(line)
            upper = stripped.upper()

            # ── COPY … FROM STDIN detected ────────────────────────────
            # pg_dump always puts the entire COPY header on one line.
            # stmt_buf may contain multi-line preamble (e.g., preceding
            # SET commands that merged into the buffer) — we handle that
            # by joining and stripping the trailing semicolon before
            # passing to copy_expert (which does not accept one).
            if upper.startswith('COPY ') and 'FROM STDIN' in upper:
                copy_stmt = '\n'.join(stmt_buf).rstrip(';').strip()
                stmt_buf  = []

                # [P1 — NEW] _CopyBlockReader streams COPY rows to
                # copy_expert() in ~8 KB chunks without buffering the
                # whole block.  It advances line_iter past '\.' before
                # returning, so the outer for-loop continues correctly.
                reader = _CopyBlockReader(line_iter)
                try:
                    cursor.copy_expert(copy_stmt, reader)
                    executed += 1
                    logger.debug(f'[DB] COPY executed: {copy_stmt[:80]}')
                except psycopg2.Error as exc:
                    if exc.pgcode in IGNORABLE_PG_CODES:
                        logger.info(
                            f'[DB] COPY skipped (ignorable {exc.pgcode}): '
                            f'{(exc.pgerror or "").strip()[:120]}'
                        )
                        skipped += 1
                    else:
                        raise RuntimeError(
                            f'[DB] COPY block failed — non-ignorable error '
                            f'(pgcode={exc.pgcode}): {(exc.pgerror or "").strip()}. '
                            f'COPY header: {copy_stmt[:200]}. '
                            f'Aborting restore — partial data has been committed.'
                        ) from exc
                continue

            # ── Regular statement (terminates with ';') ───────────────
            if stripped.endswith(';'):
                full_stmt = '\n'.join(stmt_buf).strip()
                stmt_buf  = []
                if not full_stmt:
                    continue
                try:
                    cursor.execute(full_stmt)
                    executed += 1
                except psycopg2.Error as exc:
                    if exc.pgcode in IGNORABLE_PG_CODES:
                        logger.info(
                            f'[DB] Statement skipped (ignorable {exc.pgcode}): '
                            f'{(exc.pgerror or "").strip()[:120]}'
                        )
                        skipped += 1
                    else:
                        raise RuntimeError(
                            f'[DB] Statement failed — non-ignorable error '
                            f'(pgcode={exc.pgcode}): {(exc.pgerror or "").strip()}. '
                            f'Statement: {full_stmt[:300]}. '
                            f'Aborting restore.'
                        ) from exc

    finally:
        cursor.close()
        conn.close()

    logger.info(
        f'[DB] Streaming restore complete: '
        f'{executed} succeeded, {skipped} skipped (ignorable)'
    )
    return executed


# ============================================================
# TEST MODE — STRATEGY 1: DRY RUN
# ============================================================
# Reads the SQL stream and categorises every statement without
# executing any of them.  No DB writes occur at all.
#
# What is tested:
#   ✔ S3 access (find_latest_backup)
#   ✔ Backup detection
#   ✔ Streaming pipeline (S3 Body → GzipFile → TextIOWrapper)
#   ✔ Gzip decompression integrity
#   ✔ SQL statement parsing + categorisation
#   ✔ DB connectivity (separate SELECT version() call)
#   ✗ Actual SQL execution (intentionally skipped)
# ============================================================

def execute_dry_run(line_source) -> dict:
    """
    [TEST MODE — DRY RUN] Iterate the SQL stream without executing anything.

    Reads up to the end of the stream (or TEST_STATEMENT_LIMIT statements),
    categorises each statement, logs the first 10, then discards them.
    COPY data blocks are drained line-by-line without buffering.

    Returns:
        stats dict: ddl_count, copy_count, other_count, lines_read, errors.
    """
    logger.warning('[TEST MODE] Strategy: DRY RUN — no SQL will be executed')

    stats: dict = {
        'ddl_count':   0,
        'copy_count':  0,
        'other_count': 0,
        'lines_read':  0,
        'errors':      0,
    }

    stmt_buf: list[str] = []
    stmt_total = 0
    PREVIEW_LIMIT = 10   # log the first N statements verbatim

    line_iter = iter(line_source)

    for raw_line in line_iter:
        stats['lines_read'] += 1
        line     = raw_line.rstrip('\n')
        stripped = line.strip()

        if not stripped or stripped.startswith('--'):
            continue

        stmt_buf.append(line)
        upper = stripped.upper()

        # ── COPY block: drain data lines without buffering ─────────────────
        if upper.startswith('COPY ') and 'FROM STDIN' in upper:
            copy_header = '\n'.join(stmt_buf).strip()
            stmt_buf    = []
            stats['copy_count'] += 1
            stmt_total          += 1

            if stats['copy_count'] <= PREVIEW_LIMIT:
                logger.info(
                    f'[DRY RUN] COPY #{stats["copy_count"]} '
                    f'(data skipped): {copy_header[:100]}'
                )

            # Drain COPY data rows — do NOT buffer them
            for copy_line in line_iter:
                stats['lines_read'] += 1
                if copy_line.rstrip('\r\n') == '\\.':
                    break
            continue

        # ── Regular statement ──────────────────────────────────────────────
        if stripped.endswith(';'):
            full_stmt = '\n'.join(stmt_buf).strip()
            stmt_buf  = []
            if not full_stmt:
                continue

            stmt_total += 1
            upper_stmt  = full_stmt.upper()

            if any(upper_stmt.startswith(kw) for kw in (
                'CREATE', 'DROP', 'ALTER', 'COMMENT', 'SET', 'SELECT',
                'GRANT', 'REVOKE', 'TRUNCATE',
            )):
                stats['ddl_count'] += 1
            else:
                stats['other_count'] += 1

            if stmt_total <= PREVIEW_LIMIT:
                preview = full_stmt.replace('\n', ' ')[:120]
                logger.info(f'[DRY RUN] Statement #{stmt_total} (not executed): {preview}')

    logger.warning(
        f'[DRY RUN] Complete — '
        f'DDL={stats["ddl_count"]} COPY={stats["copy_count"]} '
        f'other={stats["other_count"]} lines_read={stats["lines_read"]}'
    )
    return stats


# ============================================================
# TEST MODE — STRATEGY 2: TRANSACTION ROLLBACK
# ============================================================
# Executes DDL statements inside a single PostgreSQL transaction,
# then unconditionally issues ROLLBACK.  COPY data blocks are
# drained and skipped (no data is ever loaded).
#
# Each statement is wrapped in a SAVEPOINT so a failed statement
# does not abort the enclosing transaction — it is rolled back
# individually and execution continues.
#
# What is tested:
#   ✔ S3 access
#   ✔ Backup detection
#   ✔ Streaming pipeline + gzip decompression
#   ✔ DB connectivity
#   ✔ DDL statement parsing + execution
#   ✔ psycopg2 error handling
#   ✗ COPY data loading (intentionally skipped)
#   ✗ Permanent schema changes (ROLLBACK guarantees none)
# ============================================================

def execute_transaction_rollback_test(line_source, statement_limit: int) -> dict:
    """
    [TEST MODE — TRANSACTION ROLLBACK] Execute DDL in a transaction, then ROLLBACK.

    autocommit is set to False so every statement runs inside a single
    transaction.  ROLLBACK at the end guarantees the database is returned
    to its pre-test state.  COPY blocks are drained without execution.

    Execution stops after `statement_limit` DDL statements to keep
    test runs short.

    Returns:
        stats dict: ddl_executed, copy_skipped, errors, rolled_back (bool).
    """
    logger.warning(
        f'[TEST MODE] Strategy: TRANSACTION ROLLBACK — '
        f'DDL limit={statement_limit}, COPY blocks skipped, '
        f'ROLLBACK guaranteed'
    )

    conn_params         = get_db_conn_params()
    conn                = psycopg2.connect(**conn_params)
    conn.autocommit     = False   # CRITICAL: all changes inside one transaction
    cursor              = conn.cursor()

    stats: dict = {
        'ddl_executed': 0,
        'copy_skipped': 0,
        'errors':       0,
        'rolled_back':  False,
    }

    stmt_buf: list[str] = []

    try:
        line_iter = iter(line_source)

        for raw_line in line_iter:
            if stats['ddl_executed'] >= statement_limit:
                logger.info(
                    f'[TEST] DDL statement limit ({statement_limit}) reached '
                    f'— stopping early (stream not fully consumed)'
                )
                break

            line     = raw_line.rstrip('\n')
            stripped = line.strip()

            if not stripped or stripped.startswith('--'):
                continue

            stmt_buf.append(line)
            upper = stripped.upper()

            # ── COPY block: skip entirely (drain data rows without loading) ─
            if upper.startswith('COPY ') and 'FROM STDIN' in upper:
                copy_header = '\n'.join(stmt_buf).strip()
                stmt_buf    = []
                stats['copy_skipped'] += 1
                logger.info(
                    f'[TEST] COPY #{stats["copy_skipped"]} skipped '
                    f'(data not loaded): {copy_header[:100]}'
                )
                for copy_line in line_iter:
                    if copy_line.rstrip('\r\n') == '\\.':
                        break
                continue

            # ── Regular statement ──────────────────────────────────────────
            if stripped.endswith(';'):
                full_stmt = '\n'.join(stmt_buf).strip()
                stmt_buf  = []
                if not full_stmt:
                    continue

                sp = f'test_sp_{stats["ddl_executed"]}'
                cursor.execute(f'SAVEPOINT {sp}')
                try:
                    cursor.execute(full_stmt)
                    cursor.execute(f'RELEASE SAVEPOINT {sp}')
                    stats['ddl_executed'] += 1
                    preview = full_stmt.replace('\n', ' ')[:100]
                    logger.info(
                        f'[TEST] Executed #{stats["ddl_executed"]} '
                        f'(in transaction, not committed): {preview}'
                    )
                except psycopg2.Error as exc:
                    cursor.execute(f'ROLLBACK TO SAVEPOINT {sp}')
                    cursor.execute(f'RELEASE SAVEPOINT {sp}')
                    if exc.pgcode in IGNORABLE_PG_CODES:
                        logger.info(
                            f'[TEST] Ignorable error {exc.pgcode} at statement '
                            f'#{stats["ddl_executed"] + 1} — continuing'
                        )
                    else:
                        stats['errors'] += 1
                        logger.warning(
                            f'[TEST] Non-ignorable error {exc.pgcode} at statement '
                            f'#{stats["ddl_executed"] + 1}: '
                            f'{(exc.pgerror or "").strip()[:120]} — '
                            f'savepoint rolled back, continuing'
                        )

    finally:
        # UNCONDITIONAL ROLLBACK — this is the entire safety guarantee.
        # Even if an exception escaped the loop, this block fires.
        logger.warning(
            '[TEST] Issuing ROLLBACK — all test DDL changes will be discarded'
        )
        try:
            conn.rollback()
            stats['rolled_back'] = True
            logger.warning('[TEST] ROLLBACK complete — database is in original state')
        except Exception as rb_exc:
            logger.error(f'[TEST] ROLLBACK failed: {rb_exc} — investigate immediately')
            stats['rolled_back'] = False
        cursor.close()
        conn.close()

    logger.warning(
        f'[TEST] Transaction rollback test complete — '
        f'DDL executed (then rolled back)={stats["ddl_executed"]} '
        f'COPY skipped={stats["copy_skipped"]} '
        f'errors={stats["errors"]} '
        f'rolled_back={stats["rolled_back"]}'
    )
    return stats


# ============================================================
# TEST MODE — ORCHESTRATOR
# ============================================================

def _run_test_mode(
    log_stream:       str,
    invocation_id:    str,
    start_ts,
    test_strategy:    str,
    statement_limit:  int,
) -> dict:
    """
    [TEST MODE] Orchestrate a safe end-to-end failover test.

    Runs INSTEAD of the normal restore pipeline when TEST_MODE=true.
    Returns a structured result dict — does NOT write a restore marker,
    does NOT emit FailoverExecuted / FailoverFailed metrics.

    Steps:
      1. Find latest backup in S3                 (real — tests S3 access)
      2. Open streaming pipeline                  (real — tests decompression)
      3. Verify DB connectivity (SELECT version)  (real — tests psycopg2)
      4. Execute chosen test strategy             (safe — no production writes)
    """
    logger.warning('=' * 70)
    logger.warning('[TEST MODE ENABLED] SafeBet IQ failover test starting')
    logger.warning('[TEST MODE ENABLED] Production data will NOT be modified')
    logger.warning(f'[TEST MODE ENABLED] Strategy: {test_strategy.upper()}')
    logger.warning('=' * 70)

    cw_log(log_stream, {
        'event':           'test-mode-started',
        'strategy':        test_strategy,
        'statement_limit': statement_limit,
        'invocation_id':   invocation_id,
        'timestamp':       start_ts.isoformat(),
    })

    result: dict = {
        'mode':            'TEST',
        'strategy':        test_strategy,
        's3_access':       False,
        'stream_opened':   False,
        'db_connectivity': False,
        'test_stats':      {},
        'errors':          [],
    }

    sql_stream = None

    try:
        # ── STEP 1: Locate backup (tests S3 access + bucket permissions) ──
        logger.warning('[TEST] [SIMULATED FAILURE] Behaving as if DB is unhealthy')
        logger.info('[TEST] STEP 1/4 — Locating latest backup in S3...')
        backup_key       = find_latest_backup()
        result['s3_access'] = True
        logger.info(f'[TEST] STEP 1 PASSED — backup found: {backup_key}')
        cw_log(log_stream, {'event': 'test-s3-ok', 'key': backup_key})

        # ── STEP 2: Open streaming pipeline (tests gzip decompression) ────
        logger.info('[TEST] STEP 2/4 — Opening S3 streaming pipeline...')
        sql_stream, compressed_size = download_and_stream(backup_key)
        result['stream_opened'] = True
        logger.info(
            f'[TEST] STEP 2 PASSED — stream open, '
            f'ContentLength={compressed_size:,} bytes'
        )
        cw_log(log_stream, {
            'event':           'test-stream-ok',
            'compressed_size': compressed_size,
        })

        # ── STEP 3: Verify DB connectivity ────────────────────────────────
        logger.info('[TEST] STEP 3/4 — Verifying database connectivity...')
        db_info                  = check_db_connectivity()
        result['db_connectivity'] = True
        result['db_info']         = db_info
        logger.info('[TEST] STEP 3 PASSED — DB connectivity verified')
        cw_log(log_stream, {'event': 'test-db-connectivity-ok', 'db_info': db_info})

        # ── STEP 4: Execute chosen strategy ───────────────────────────────
        logger.info(f'[TEST] STEP 4/4 — Executing strategy: {test_strategy}...')

        if test_strategy == 'transaction_rollback':
            test_stats = execute_transaction_rollback_test(sql_stream, statement_limit)
        else:
            # Default: dry_run (safest option)
            if test_strategy != 'dry_run':
                logger.warning(
                    f'[TEST] Unknown TEST_STRATEGY "{test_strategy}" — '
                    f'defaulting to dry_run'
                )
            test_stats = execute_dry_run(sql_stream)

        result['test_stats'] = test_stats
        logger.info(f'[TEST] STEP 4 PASSED — stats: {test_stats}')
        cw_log(log_stream, {
            'event':      'test-strategy-complete',
            'strategy':   test_strategy,
            'test_stats': test_stats,
        })

    except Exception as exc:
        err_msg = f'{type(exc).__name__}: {exc}'
        result['errors'].append(err_msg)
        logger.error(f'[TEST] STEP FAILED: {err_msg}', exc_info=True)
        cw_log(log_stream, {
            'event':     'test-step-failed',
            'error':     err_msg,
            'timestamp': datetime.now(timezone.utc).isoformat(),
        })

    finally:
        if sql_stream is not None:
            try:
                sql_stream.close()
            except Exception:
                pass

    # ── Summary ───────────────────────────────────────────────────────────
    passed = (
        result['s3_access']
        and result['stream_opened']
        and result['db_connectivity']
        and not result['errors']
    )
    result['overall'] = 'PASSED' if passed else 'FAILED'

    logger.warning('=' * 70)
    logger.warning(f'[TEST MODE] Overall result: {result["overall"]}')
    logger.warning(f'[TEST MODE]   S3 access:       {result["s3_access"]}')
    logger.warning(f'[TEST MODE]   Stream opened:   {result["stream_opened"]}')
    logger.warning(f'[TEST MODE]   DB connectivity: {result["db_connectivity"]}')
    logger.warning(f'[TEST MODE]   Strategy stats:  {result["test_stats"]}')
    if result['errors']:
        logger.warning(f'[TEST MODE]   Errors: {result["errors"]}')
    logger.warning('[TEST MODE ENABLED] No production data was modified')
    logger.warning('[TEST MODE ENABLED] No restore marker written')
    logger.warning('[TEST MODE ENABLED] No FailoverExecuted/FailoverFailed metrics emitted')
    logger.warning('=' * 70)

    cw_log(log_stream, {
        'event':         'test-mode-complete',
        'result':        result,
        'invocation_id': invocation_id,
        'timestamp':     datetime.now(timezone.utc).isoformat(),
    })

    return {
        'statusCode': 200 if passed else 500,
        'body': json.dumps({'status': f'TEST_{result["overall"]}', **result}, default=str),
    }


# ============================================================
# LAMBDA HANDLER
# ============================================================

def lambda_handler(event, context):
    """
    AWS Lambda entry point — triggered by SNS from a CloudWatch Alarm.
    Handler setting: lambda_function.lambda_handler

    Execution order (guaranteed):
      STEP 0  Read env vars fresh on every call (no module-level caching)
      STEP 1  TEST MODE check — returns immediately if TEST_MODE=true,
              bypassing idempotency, SNS parsing, and the restore pipeline
      STEP 2  Idempotency guard (S3 marker + integrity re-validation)
      STEP 3  Full restore pipeline (find backup → stream → validate → marker)

    P0 fixes applied:
      • S3 marker idempotency replaces SELECT 1 guard
      • validate_data_integrity() replaces validate_db()
      • Fail-fast in execute_sql_dump() on non-ignorable errors
      • Guaranteed FailoverFailed=1 on every exception path

    P1 fixes applied:
      • download_and_stream() opens s3.get_object()['Body'] → GzipFile → TextIOWrapper
        Zero /tmp writes — the S3 stream is consumed directly.
      • execute_sql_dump() accepts any text iterable; no gzip.open() internally.
      • _CopyBlockReader gives copy_expert() a zero-buffer streaming source (O(1 row) RAM).
      • finally block closes the TextIOWrapper, releasing the S3 HTTP connection.
    """
    # ── Reset credentials cache on every invocation ───────────────────────
    # Ensures rotated secrets take effect within one invocation cycle rather
    # than waiting for a Lambda cold start.
    global _cached_db_creds
    _cached_db_creds = None

    BUILD_STAMP = 'safebet-dr-v4-2026-04-19'
    print(f'[BUILD] {BUILD_STAMP} | request={context.aws_request_id}')

    # ── STEP 0: Read env vars — must be first, read on every invocation ─────
    # Never read at module level: Lambda reuses warm processes without
    # re-importing, so module-level reads cache the value from the cold start
    # and ignore any changes made in the Lambda console afterwards.
    test_mode     = os.environ.get('TEST_MODE',            'false').lower() == 'true'
    test_strategy = os.environ.get('TEST_STRATEGY',        'dry_run')
    stmt_limit    = int(os.environ.get('TEST_STATEMENT_LIMIT', '20'))

    print(f'[DEBUG] TEST_MODE={test_mode} | TEST_STRATEGY={test_strategy} | STMT_LIMIT={stmt_limit}')

    # ── STEP 1: TEST MODE OVERRIDE ────────────────────────────────────────
    # Checked before invocation bookkeeping, SNS parsing, idempotency guard,
    # and the restore pipeline.  Nothing below this block runs when test_mode
    # is True — _run_test_mode() builds its own log stream internally.
    if test_mode:
        invocation_id = context.aws_request_id
        start_ts      = datetime.now(timezone.utc)
        log_stream    = f'lambda-failover-{start_ts.strftime("%Y-%m-%d-%H-%M-%S")}'
        return _run_test_mode(log_stream, invocation_id, start_ts, test_strategy, stmt_limit)

    # ── Production path: bookkeeping + SNS parsing ────────────────────────
    invocation_id = context.aws_request_id
    start_ts      = datetime.now(timezone.utc)
    log_stream    = f'lambda-failover-{start_ts.strftime("%Y-%m-%d-%H-%M-%S")}'

    logger.info(
        f'=== SAFEBET IQ AUTOMATED FAILOVER START '
        f'| id={invocation_id} | ts={start_ts.isoformat()} ==='
    )

    # ── Parse SNS envelope ────────────────────────────────────────────────
    alarm_name = 'unknown'
    try:
        sns_msg    = json.loads(event['Records'][0]['Sns']['Message'])
        alarm_name = sns_msg.get('AlarmName', 'unknown')
        logger.info(f'[SNS] Triggered by alarm: {alarm_name}')
    except Exception:
        logger.info('[SNS] Could not parse alarm name — continuing')

    # ── Create CloudWatch log stream ──────────────────────────────────────
    try:
        logs_cl.create_log_stream(
            logGroupName=LOG_GROUP,
            logStreamName=log_stream
        )
    except logs_cl.exceptions.ResourceAlreadyExistsException:
        pass

    cw_log(log_stream, {
        'event':         'failover-started',
        'alarm_name':    alarm_name,
        'invocation_id': invocation_id,
        'timestamp':     start_ts.isoformat(),
    })

    # ── STEP 2: S3 marker idempotency guard ───────────────────────────────
    logger.info('[IDEMPOTENCY] Checking S3 restore-completion marker...')
    marker = get_latest_restore_marker()

    if marker is not None:
        logger.info(
            '[IDEMPOTENCY] Marker found — re-validating DB integrity '
            'before deciding to skip restore...'
        )
        try:
            chk_conn = psycopg2.connect(**get_db_conn_params())
            try:
                validate_data_integrity(chk_conn)
            finally:
                chk_conn.close()

            skip_msg = (
                f'Restore-completion marker exists and data integrity re-validated — '
                f'skipping restore. Previous backup: {marker.get("backup_key", "unknown")}'
            )
            logger.info(f'[IDEMPOTENCY] {skip_msg}')
            cw_log(log_stream, {
                'event':         'failover-skipped',
                'reason':        skip_msg,
                'marker':        marker,
                'invocation_id': invocation_id,
                'timestamp':     datetime.now(timezone.utc).isoformat(),
            })
            return {
                'statusCode': 200,
                'body': json.dumps({'status': 'SKIPPED', 'reason': skip_msg}),
            }

        except Exception as integrity_exc:
            logger.warning(
                f'[IDEMPOTENCY] Marker found but integrity re-validation FAILED: '
                f'{integrity_exc}. Forcing full restore.'
            )
            cw_log(log_stream, {
                'event':         'idempotency-overridden',
                'reason':        'Marker found but integrity re-validation failed',
                'error':         str(integrity_exc),
                'invocation_id': invocation_id,
                'timestamp':     datetime.now(timezone.utc).isoformat(),
            })
    else:
        logger.info('[IDEMPOTENCY] No marker — proceeding with full restore.')

    # ── Main restore pipeline ─────────────────────────────────────────────
    backup_key       = None
    integrity_result = None
    sql_stream       = None   # TextIOWrapper; closed in finally to release S3 connection

    try:
        # ── STEP 1: Locate latest backup ──────────────────────────────────
        logger.info('[STEP 1/4] Locating latest backup in S3...')
        backup_key = find_latest_backup()
        cw_log(log_stream, {
            'event': 'backup-located',
            'key':   backup_key,
        })

        # ── STEP 2: Open streaming pipeline (0 /tmp bytes) ────────────────
        # [P1 Round 2] s3.get_object()['Body'] → GzipFile → TextIOWrapper.
        # Nothing is written to /tmp; the S3 HTTP response body is consumed
        # directly as the restore streams.  sql_stream is closed in finally.
        logger.info('[STEP 2/4] Opening S3 streaming pipeline...')
        sql_stream, compressed_size = download_and_stream(backup_key)
        cw_log(log_stream, {
            'event':            'stream-opened',
            'compressed_size':  compressed_size,   # 0 if Content-Length absent
        })

        # ── STEP 3: Stream-execute restore (fail-fast, zero COPY buffer) ──
        # [P1 Round 2] sql_stream is the TextIOWrapper; execute_sql_dump
        # iterates it line-by-line.  COPY blocks use _CopyBlockReader (O(1 row) RAM).
        logger.info('[STEP 3/4] Streaming database restore...')
        stmt_count = execute_sql_dump(sql_stream)
        cw_log(log_stream, {
            'event':               'restore-executed',
            'statements_executed': stmt_count,
        })

        # ── STEP 4: Data integrity validation ─────────────────────────────
        logger.info('[STEP 4/4] Validating data integrity post-restore...')
        val_conn = psycopg2.connect(**get_db_conn_params())
        try:
            integrity_result = validate_data_integrity(val_conn)
        finally:
            val_conn.close()

        cw_log(log_stream, {
            'event':             'integrity-validated',
            'validation_result': integrity_result,
        })

        # ── Write restore-completion marker ───────────────────────────────
        # Reached only when BOTH execute_sql_dump and validate_data_integrity
        # returned without raising.  Any earlier exception skips this line,
        # leaving no marker, so the next invocation runs a full restore.
        logger.info('[MARKER] Writing restore-completion marker...')
        write_restore_marker(backup_key, integrity_result)

        # ── Success metrics ───────────────────────────────────────────────
        cw_metric('FailoverExecuted', 1)
        cw_metric('FailoverFailed',   0)

        end_ts       = datetime.now(timezone.utc)
        duration_sec = (end_ts - start_ts).total_seconds()

        cw_log(log_stream, {
            'event':             'failover-complete',
            'status':            'SUCCESS',
            'backup_used':       backup_key,
            'duration_sec':      duration_sec,
            'validation_result': integrity_result,
            'invocation_id':     invocation_id,
            'timestamp':         end_ts.isoformat(),
        })

        # ============================================================
        # FUTURE HOOK — Phase 3: Route53 DNS Failover
        # ============================================================
        # Activate by setting these Lambda env vars:
        #   ROUTE53_ZONE_ID, ROUTE53_RECORD_NAME, DR_DB_CNAME
        #
        # route53 = boto3.client('route53')
        # route53.change_resource_record_sets(...)
        # logger.info('[ROUTE53] DNS record updated to DR endpoint')
        # ============================================================

        logger.info(
            f'=== FAILOVER COMPLETE: SUCCESS '
            f'| backup={backup_key} | duration={duration_sec:.1f}s ==='
        )

        return {
            'statusCode': 200,
            'body': json.dumps({
                'status':            'SUCCESS',
                'backup_used':       backup_key,
                'duration_sec':      duration_sec,
                'validation_result': integrity_result,
                'invocation_id':     invocation_id,
                'timestamp':         end_ts.isoformat(),
            }, default=str),
        }

    except Exception as exc:
        # Guaranteed failure capture — every code path that raises ends here.
        # OOM (SIGKILL) is the one exception: the kernel kills the process
        # before this block runs.  The P1 streaming fix eliminates OOM for
        # COPY blocks; /tmp overflow for large gz files remains a hard limit
        # of Lambda's ephemeral storage configuration (10 GB).
        err_ts = datetime.now(timezone.utc)
        logger.error(
            f'=== FAILOVER FAILED: {type(exc).__name__}: {exc} ===',
            exc_info=True
        )

        cw_metric('FailoverExecuted', 0)
        cw_metric('FailoverFailed',   1)

        cw_log(log_stream, {
            'event':         'failover-failed',
            'status':        'FAILED',
            'error':         str(exc),
            'error_type':    type(exc).__name__,
            'backup_used':   backup_key,
            'invocation_id': invocation_id,
            'timestamp':     err_ts.isoformat(),
        })

        raise   # re-raise: Lambda marks invocation FAILED; SNS retries fire

    finally:
        # Always close the TextIOWrapper.  This closes the GzipFile and the
        # underlying boto3 StreamingBody, which releases the S3 HTTP connection
        # regardless of whether the restore succeeded or failed mid-stream.
        if sql_stream is not None:
            try:
                sql_stream.close()
            except Exception:
                pass


