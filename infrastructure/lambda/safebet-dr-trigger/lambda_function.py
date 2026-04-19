"""
SafeBet IQ — DR Trigger Lambda (Stockholm → Cape Town)
=======================================================
Function name : safebet-dr-trigger
Runtime       : Python 3.12
Region        : eu-north-1 (Stockholm)
Trigger       : SNS topic — safebet-dr-alerts

What this function does:
  Receives a DR alert from the safebet-dr-alerts SNS topic and forwards
  it to the safebet-auto-failover Lambda in af-south-1 (Cape Town).
  Returns as soon as the Cape Town Lambda accepts the invocation —
  the full restore runs independently and asynchronously.

Invocation type: Event (asynchronous, HTTP 202)
  The Cape Town Lambda may run for up to 15 minutes during a restore.
  Using Event invocation means this trigger Lambda is not blocked waiting
  for the restore to complete, and does not risk its own 15-minute timeout.
  A StatusCode of 202 confirms the Lambda service accepted the request —
  it does NOT confirm the restore succeeded.  Check Cape Town CloudWatch
  Logs (log group: safebet-backups) for restore outcome.

Environment variables:
  DR_LAMBDA_NAME    — target function name   (default: safebet-auto-failover)
  DR_LAMBDA_REGION  — target AWS region      (default: af-south-1)
  DR_LAMBDA_ARN     — optional full ARN; used instead of name when set

IAM requirement (attach to this Lambda's execution role):
  {
    "Effect": "Allow",
    "Action": "lambda:InvokeFunction",
    "Resource": "arn:aws:lambda:af-south-1:<account_id>:function:safebet-auto-failover"
  }
"""

import json
import logging
import os

import boto3
from botocore.exceptions import ClientError

# ── Logging ──────────────────────────────────────────────────────────────────
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ── Module-level boto3 client ─────────────────────────────────────────────────
# Created once and reused across warm invocations.  Targeting af-south-1
# explicitly — this trigger runs in eu-north-1 but must reach Cape Town.
#
# If DR_LAMBDA_REGION is changed via env var after a cold start, the cached
# client will still target the old region.  For a static cross-region setup
# (always eu-north-1 → af-south-1) this is the correct trade-off: warm
# reuse outweighs the flexibility cost.
_DR_LAMBDA_REGION = os.environ.get('DR_LAMBDA_REGION', 'af-south-1')
_lambda_client    = boto3.client('lambda', region_name=_DR_LAMBDA_REGION)


def lambda_handler(event, context):
    """
    Entry point.

    Reads target configuration on every invocation (not at module level)
    so that env-var changes take effect on the next call without a cold start.
    The boto3 client is reused from module scope for warm-start performance.
    """
    invocation_id = context.aws_request_id

    # ── Read target config fresh on every call ────────────────────────────
    dr_lambda_name   = os.environ.get('DR_LAMBDA_NAME',   'safebet-auto-failover')
    dr_lambda_region = os.environ.get('DR_LAMBDA_REGION', 'af-south-1')
    dr_lambda_arn    = os.environ.get('DR_LAMBDA_ARN',    '').strip()

    # Use explicit ARN when provided — avoids cross-account name resolution
    # ambiguity.  Falls back to bare function name (same account assumed).
    target = dr_lambda_arn if dr_lambda_arn else dr_lambda_name

    logger.info(
        '[TRIGGER] DR trigger invoked | '
        f'request={invocation_id} | '
        f'target={dr_lambda_region}:{target}'
    )

    # ── Log the incoming SNS event (sanitised) ────────────────────────────
    # The full event is forwarded as-is to the Cape Town Lambda so it receives
    # the same SNS envelope structure it expects from its own subscription.
    try:
        alarm_name = (
            json.loads(event['Records'][0]['Sns']['Message'])
            .get('AlarmName', 'unknown')
        )
    except Exception:
        alarm_name = 'unknown'

    logger.info(f'[TRIGGER] Alarm: {alarm_name} | forwarding to {dr_lambda_region}')
    logger.info(f'[TRIGGER] Raw event: {json.dumps(event, default=str)}')

    # ── Invoke Cape Town Lambda ───────────────────────────────────────────
    payload = json.dumps(event, default=str).encode('utf-8')

    try:
        response = _lambda_client.invoke(
            FunctionName   = target,
            InvocationType = 'Event',   # async — Lambda service returns 202 immediately
            Payload        = payload,
        )

        status_code = response.get('StatusCode', 0)

        if status_code == 202:
            # 202 = Lambda service accepted the invocation request.
            # The function is now queued; it has NOT necessarily started yet.
            logger.info(
                f'[TRIGGER] Invocation accepted (StatusCode=202) | '
                f'target={dr_lambda_region}:{target} | '
                f'alarm={alarm_name}'
            )
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'status':       'INVOKED',
                    'target':       f'{dr_lambda_region}:{target}',
                    'alarm_name':   alarm_name,
                    'invocation_id': invocation_id,
                }),
            }

        # Any non-202 means the Lambda service rejected the call before
        # the target function ran (e.g., throttle, bad config).
        error_msg = (
            f'Lambda service rejected invocation: StatusCode={status_code} | '
            f'target={dr_lambda_region}:{target}'
        )
        logger.error(f'[TRIGGER] {error_msg}')
        return {
            'statusCode': 500,
            'body': json.dumps({
                'status':        'INVOCATION_REJECTED',
                'reason':        error_msg,
                'invocation_id': invocation_id,
            }),
        }

    except ClientError as exc:
        error_code = exc.response['Error']['Code']
        error_msg  = exc.response['Error']['Message']

        if error_code == 'ResourceNotFoundException':
            msg = f'Function not found: {dr_lambda_region}:{target}'
            logger.error(f'[TRIGGER] {msg}')
            return {
                'statusCode': 404,
                'body': json.dumps({
                    'status':        'NOT_FOUND',
                    'reason':        msg,
                    'invocation_id': invocation_id,
                }),
            }

        if error_code == 'TooManyRequestsException':
            msg = f'Lambda throttled — too many concurrent requests for {target}'
            logger.error(f'[TRIGGER] {msg}')
            return {
                'statusCode': 429,
                'body': json.dumps({
                    'status':        'THROTTLED',
                    'reason':        msg,
                    'invocation_id': invocation_id,
                }),
            }

        if error_code == 'AccessDeniedException':
            msg = (
                f'Permission denied invoking {dr_lambda_region}:{target}. '
                f'Ensure the execution role has lambda:InvokeFunction on the target ARN.'
            )
            logger.error(f'[TRIGGER] {msg}')
            return {
                'statusCode': 403,
                'body': json.dumps({
                    'status':        'ACCESS_DENIED',
                    'reason':        msg,
                    'invocation_id': invocation_id,
                }),
            }

        # All other boto3 / AWS errors
        msg = f'ClientError {error_code}: {error_msg}'
        logger.error(f'[TRIGGER] {msg}', exc_info=True)
        return {
            'statusCode': 500,
            'body': json.dumps({
                'status':        'AWS_ERROR',
                'error_code':    error_code,
                'reason':        msg,
                'invocation_id': invocation_id,
            }),
        }

    except Exception as exc:
        msg = f'{type(exc).__name__}: {exc}'
        logger.error(f'[TRIGGER] Unhandled exception: {msg}', exc_info=True)
        return {
            'statusCode': 500,
            'body': json.dumps({
                'status':        'ERROR',
                'reason':        msg,
                'invocation_id': invocation_id,
            }),
        }
