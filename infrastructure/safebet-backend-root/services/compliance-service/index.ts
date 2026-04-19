import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query, withTransaction } from '../../shared/db';
import { createLogger } from '../../shared/logger';
import { ok, created, badRequest, unauthorized, forbidden, internalError, parseBody } from '../../shared/response';
import { extractBearerToken, verifyToken, requireGroup } from '../auth-service';

const log = createLogger('compliance-service');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type ComplianceEventType =
  | 'kyc_submitted'
  | 'kyc_approved'
  | 'kyc_rejected'
  | 'self_exclusion_requested'
  | 'self_exclusion_lifted'
  | 'deposit_limit_set'
  | 'deposit_limit_removed'
  | 'account_suspended'
  | 'account_closed'
  | 'aml_flag_raised'
  | 'aml_flag_cleared'
  | 'data_export_requested'
  | 'complaint_filed';

interface ComplianceEventRow {
  id:          string;
  casino_id:   string;
  player_id:   string | null;
  event_type:  string;
  actor:       string;
  payload:     Record<string, unknown>;
  occurred_at: string;
}

interface LogEventBody {
  playerId?:  string;
  eventType:  ComplianceEventType;
  actor:      string;
  payload?:   Record<string, unknown>;
}

interface SelfExclusionBody {
  playerId:    string;
  durationDays: number;
  reason?:     string;
}

interface KycUpdateBody {
  playerId: string;
  status:   'submitted' | 'verified' | 'rejected';
  notes?:   string;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------
async function logComplianceEvent(
  casinoId:  string,
  eventType: ComplianceEventType,
  actor:     string,
  playerId?: string,
  payload?:  Record<string, unknown>,
): Promise<ComplianceEventRow> {
  const { rows } = await query<ComplianceEventRow>(
    `INSERT INTO compliance_events (casino_id, player_id, event_type, actor, payload)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [casinoId, playerId ?? null, eventType, actor, JSON.stringify(payload ?? {})],
    'logComplianceEvent',
  );
  return rows[0];
}

async function getComplianceHistory(
  casinoId: string,
  playerId: string,
  limit = 50,
): Promise<ComplianceEventRow[]> {
  const { rows } = await query<ComplianceEventRow>(
    `SELECT id, casino_id, player_id, event_type, actor, payload, occurred_at
     FROM   compliance_events
     WHERE  casino_id = $1 AND player_id = $2
     ORDER BY occurred_at DESC
     LIMIT  $3`,
    [casinoId, playerId, limit],
    'getComplianceHistory',
  );
  return rows;
}

async function applySelfExclusion(
  casinoId:     string,
  playerId:     string,
  durationDays: number,
  actor:        string,
  reason?:      string,
): Promise<void> {
  await withTransaction(async (client) => {
    const exclusionUntil = new Date();
    exclusionUntil.setDate(exclusionUntil.getDate() + durationDays);

    await client.query(
      `UPDATE players
       SET    status = 'self_excluded', self_exclusion_until = $3
       WHERE  casino_id = $1 AND id = $2`,
      [casinoId, playerId, exclusionUntil.toISOString()],
    );

    await client.query(
      `INSERT INTO compliance_events (casino_id, player_id, event_type, actor, payload)
       VALUES ($1, $2, 'self_exclusion_requested', $3, $4)`,
      [
        casinoId, playerId, actor,
        JSON.stringify({ durationDays, exclusionUntil: exclusionUntil.toISOString(), reason }),
      ],
    );
  });
}

async function updateKycStatus(
  casinoId:  string,
  playerId:  string,
  status:    'submitted' | 'verified' | 'rejected',
  actor:     string,
  notes?:    string,
): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE players SET kyc_status = $3 WHERE casino_id = $1 AND id = $2`,
      [casinoId, playerId, status],
    );

    const eventType: ComplianceEventType =
      status === 'submitted' ? 'kyc_submitted'
      : status === 'verified' ? 'kyc_approved'
      : 'kyc_rejected';

    await client.query(
      `INSERT INTO compliance_events (casino_id, player_id, event_type, actor, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [casinoId, playerId, eventType, actor, JSON.stringify({ notes })],
    );
  });
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
async function handleLogEvent(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const token = extractBearerToken(event);
  if (!token) return unauthorized();
  const claims = await verifyToken(token);

  if (!requireGroup(claims, 'compliance') && !requireGroup(claims, 'admin')) {
    return forbidden('Compliance log requires compliance or admin group membership');
  }

  let body: LogEventBody;
  try {
    body = parseBody<LogEventBody>(event.body);
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.eventType || !body.actor) {
    return badRequest('Fields eventType and actor are required');
  }

  const record = await logComplianceEvent(
    claims.casinoId, body.eventType, body.actor, body.playerId, body.payload,
  );
  return created(record);
}

async function handleGetHistory(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const token = extractBearerToken(event);
  if (!token) return unauthorized();
  const claims = await verifyToken(token);

  if (!requireGroup(claims, 'compliance') && !requireGroup(claims, 'admin')) {
    return forbidden('Compliance history requires compliance or admin group membership');
  }

  const playerId = event.pathParameters?.playerId;
  if (!playerId) return badRequest('playerId path parameter is required');

  const limit = parseInt(event.queryStringParameters?.limit ?? '50', 10);
  const events = await getComplianceHistory(claims.casinoId, playerId, Math.min(limit, 200));
  return ok(events, { count: events.length });
}

async function handleSelfExclusion(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const token = extractBearerToken(event);
  if (!token) return unauthorized();
  const claims = await verifyToken(token);

  let body: SelfExclusionBody;
  try {
    body = parseBody<SelfExclusionBody>(event.body);
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.playerId) return badRequest('playerId is required');
  if (!body.durationDays || body.durationDays < 1) return badRequest('durationDays must be >= 1');

  const actor = requireGroup(claims, 'compliance') ? `staff:${claims.sub}` : 'player';
  await applySelfExclusion(claims.casinoId, body.playerId, body.durationDays, actor, body.reason);

  log.info('Self exclusion applied', {
    casinoId: claims.casinoId, playerId: body.playerId, durationDays: body.durationDays,
  });
  return ok({ applied: true, durationDays: body.durationDays });
}

async function handleKycUpdate(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const token = extractBearerToken(event);
  if (!token) return unauthorized();
  const claims = await verifyToken(token);

  if (!requireGroup(claims, 'compliance') && !requireGroup(claims, 'admin')) {
    return forbidden('KYC updates require compliance or admin group membership');
  }

  let body: KycUpdateBody;
  try {
    body = parseBody<KycUpdateBody>(event.body);
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.playerId || !body.status) return badRequest('playerId and status are required');
  const allowed = ['submitted', 'verified', 'rejected'];
  if (!allowed.includes(body.status)) return badRequest(`status must be one of: ${allowed.join(', ')}`);

  await updateKycStatus(
    claims.casinoId, body.playerId, body.status, `staff:${claims.sub}`, body.notes,
  );
  return ok({ updated: true, kyc_status: body.status });
}

// ---------------------------------------------------------------------------
// Lambda entry point
// ---------------------------------------------------------------------------
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId;
  const logger    = createLogger('compliance-service', requestId);
  logger.info('Request', { method: event.httpMethod, path: event.path });

  try {
    const method   = event.httpMethod.toUpperCase();
    const resource = event.resource ?? event.path;

    if (method === 'POST'  && resource.endsWith('/events'))          return handleLogEvent(event);
    if (method === 'GET'   && resource.includes('/history'))         return handleGetHistory(event);
    if (method === 'POST'  && resource.endsWith('/self-exclusion'))  return handleSelfExclusion(event);
    if (method === 'PATCH' && resource.endsWith('/kyc'))             return handleKycUpdate(event);

    return { statusCode: 405, headers: { Allow: 'GET, POST, PATCH' }, body: 'Method Not Allowed' };
  } catch (err) {
    logger.error('Unhandled error in compliance-service', err);
    return internalError();
  }
};
