import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../shared/db';
import { createLogger } from '../../shared/logger';
import {
  ok, created, notFound, badRequest, unauthorized, internalError, parseBody,
} from '../../shared/response';
import { extractBearerToken, verifyToken, AuthenticatedClaims } from '../../shared/auth';


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface Player {
  id:                   string;
  casino_id:            string;
  cognito_sub:          string;
  email:                string;
  full_name:            string;
  date_of_birth:        string;
  country_code:         string;
  currency_code:        string;
  status:               string;
  kyc_status:           string;
  deposit_limit_daily:  number | null;
  deposit_limit_weekly: number | null;
  deposit_limit_monthly:number | null;
  self_exclusion_until: string | null;
  tags:                 string[];
  created_at:           string;
  updated_at:           string;
}

interface CreatePlayerBody {
  email:          string;
  full_name:      string;
  date_of_birth:  string;
  country_code:   string;
  currency_code?: string;
}

interface UpdatePlayerBody {
  full_name?:              string;
  deposit_limit_daily?:    number | null;
  deposit_limit_weekly?:   number | null;
  deposit_limit_monthly?:  number | null;
  reality_check_interval_minutes?: number | null;
  tags?:                   string[];
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------
async function findPlayerById(casinoId: string, playerId: string): Promise<Player | null> {
  const { rows } = await query<Player>(
    `SELECT id, casino_id, cognito_sub, email, full_name, date_of_birth,
            country_code, currency_code, status, kyc_status,
            deposit_limit_daily, deposit_limit_weekly, deposit_limit_monthly,
            self_exclusion_until, tags, created_at, updated_at
     FROM   players
     WHERE  casino_id = $1 AND id = $2`,
    [casinoId, playerId],
    'findPlayerById',
  );
  return rows[0] ?? null;
}

async function findPlayerBySub(casinoId: string, cognitoSub: string): Promise<Player | null> {
  const { rows } = await query<Player>(
    `SELECT id, casino_id, cognito_sub, email, full_name, date_of_birth,
            country_code, currency_code, status, kyc_status,
            deposit_limit_daily, deposit_limit_weekly, deposit_limit_monthly,
            self_exclusion_until, tags, created_at, updated_at
     FROM   players
     WHERE  casino_id = $1 AND cognito_sub = $2`,
    [casinoId, cognitoSub],
    'findPlayerBySub',
  );
  return rows[0] ?? null;
}

async function createPlayer(
  casinoId: string,
  cognitoSub: string,
  body: CreatePlayerBody,
): Promise<Player> {
  const { rows } = await query<Player>(
    `INSERT INTO players
       (casino_id, cognito_sub, email, full_name, date_of_birth, country_code, currency_code)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      casinoId,
      cognitoSub,
      body.email.toLowerCase().trim(),
      body.full_name.trim(),
      body.date_of_birth,
      body.country_code.toUpperCase(),
      (body.currency_code ?? 'ZAR').toUpperCase(),
    ],
    'createPlayer',
  );
  return rows[0];
}

async function updatePlayer(
  casinoId: string,
  playerId: string,
  body: UpdatePlayerBody,
): Promise<Player | null> {
  const sets: string[] = [];
  const params: unknown[] = [casinoId, playerId];
  let idx = 3;

  const field = (col: string, val: unknown) => {
    sets.push(`${col} = $${idx++}`);
    params.push(val);
  };

  if (body.full_name              !== undefined) field('full_name', body.full_name);
  if (body.deposit_limit_daily    !== undefined) field('deposit_limit_daily', body.deposit_limit_daily);
  if (body.deposit_limit_weekly   !== undefined) field('deposit_limit_weekly', body.deposit_limit_weekly);
  if (body.deposit_limit_monthly  !== undefined) field('deposit_limit_monthly', body.deposit_limit_monthly);
  if (body.reality_check_interval_minutes !== undefined) field('reality_check_interval_minutes', body.reality_check_interval_minutes);
  if (body.tags                   !== undefined) field('tags', body.tags);

  if (sets.length === 0) return findPlayerById(casinoId, playerId);

  const { rows } = await query<Player>(
    `UPDATE players SET ${sets.join(', ')}
     WHERE  casino_id = $1 AND id = $2
     RETURNING *`,
    params,
    'updatePlayer',
  );
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
async function authenticate(event: APIGatewayProxyEvent): Promise<AuthenticatedClaims | null> {
  const token = extractBearerToken(event);
  if (!token) return null;
  try {
    return await verifyToken(token);
  } catch (err: unknown) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('auth/verify failed', { name: e.name, message: e.message });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
async function getPlayer(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const claims = await authenticate(event);
  if (!claims) return unauthorized();

  const playerId = event.pathParameters?.playerId ?? event.pathParameters?.id;
  if (!playerId) return badRequest('playerId path parameter is required');

  const player = await findPlayerById(claims.casinoId, playerId);
  if (!player) return notFound('Player');

  return ok(player);
}

async function getMe(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const claims = await authenticate(event);
  if (!claims) return unauthorized();

  const player = await findPlayerBySub(claims.casinoId, claims.sub);
  if (!player) return notFound('Player profile');

  return ok(player);
}

async function registerPlayer(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const claims = await authenticate(event);
  if (!claims) return unauthorized();

  let body: CreatePlayerBody;
  try {
    body = parseBody<CreatePlayerBody>(event.body);
  } catch {
    return badRequest('Request body must be valid JSON');
  }

  const required = ['email', 'full_name', 'date_of_birth', 'country_code'] as const;
  for (const field of required) {
    if (!body[field]) return badRequest(`Field '${field}' is required`);
  }

  // Idempotent — return existing profile if already registered
  const existing = await findPlayerBySub(claims.casinoId, claims.sub);
  if (existing) return ok(existing);

  const player = await createPlayer(claims.casinoId, claims.sub, body);
  return created(player);
}

async function patchPlayer(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const claims = await authenticate(event);
  if (!claims) return unauthorized();

  const playerId = event.pathParameters?.playerId ?? event.pathParameters?.id;
  if (!playerId) return badRequest('playerId path parameter is required');

  let body: UpdatePlayerBody;
  try {
    body = parseBody<UpdatePlayerBody>(event.body);
  } catch {
    return badRequest('Request body must be valid JSON');
  }

  const player = await updatePlayer(claims.casinoId, playerId, body);
  if (!player) return notFound('Player');

  return ok(player);
}

// ---------------------------------------------------------------------------
// Lambda entry point — route by method + path
// ---------------------------------------------------------------------------
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId;
  const logger    = createLogger('user-service', requestId);
  logger.info('Request', { method: event.httpMethod, path: event.path });

  try {
    const method   = event.httpMethod.toUpperCase();
    const resource = event.resource ?? event.path;

    if (method === 'GET'   && resource.endsWith('/me'))          return getMe(event);
    if (method === 'GET'   && resource.includes('{playerId}'))   return getPlayer(event);
    if (method === 'POST'  && resource.endsWith('/players'))     return registerPlayer(event);
    if (method === 'PATCH' && resource.includes('{playerId}'))   return patchPlayer(event);

    return { statusCode: 405, headers: { Allow: 'GET, POST, PATCH' }, body: 'Method Not Allowed' };
  } catch (err) {
    logger.error('Unhandled error in user-service', err);
    return internalError();
  }
};
