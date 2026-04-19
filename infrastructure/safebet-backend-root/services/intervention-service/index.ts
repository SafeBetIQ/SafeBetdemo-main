import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../shared/db';
import { createLogger } from '../../shared/logger';
import { ok, notFound, badRequest, unauthorized, internalError, parseBody } from '../../shared/response';
import { extractBearerToken, verifyToken } from '../auth-service';
import { computeRiskScore, RiskScore } from '../risk-engine';

const log = createLogger('intervention-service');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type InterventionType =
  | 'reality_check'
  | 'deposit_limit_prompt'
  | 'cooldown_period'
  | 'self_exclusion_prompt'
  | 'account_review'
  | 'manual_review';

type InterventionStatus = 'pending' | 'delivered' | 'acknowledged' | 'dismissed' | 'escalated';

interface InterventionRow {
  id:              string;
  casino_id:       string;
  player_id:       string;
  risk_score_id:   string | null;
  type:            InterventionType;
  status:          InterventionStatus;
  triggered_at:    string;
  delivered_at:    string | null;
  acknowledged_at: string | null;
  resolved_at:     string | null;
  triggered_by:    string;
  message:         string | null;
  metadata:        Record<string, unknown>;
}

interface AcknowledgeBody {
  action: 'acknowledged' | 'dismissed' | 'escalated';
  notes?: string;
}

// ---------------------------------------------------------------------------
// Intervention rule thresholds
// ---------------------------------------------------------------------------
const INTERVENTION_RULES: Array<{
  minScore:          number;
  type:              InterventionType;
  message:           string;
  dedupWindowHours:  number;
}> = [
  {
    minScore:         25,
    type:             'reality_check',
    message:          'You have been playing for a while. Take a moment to review your activity.',
    dedupWindowHours: 4,
  },
  {
    minScore:         50,
    type:             'deposit_limit_prompt',
    message:          'Our responsible gambling tools can help you manage your spending. Would you like to set a deposit limit?',
    dedupWindowHours: 24,
  },
  {
    minScore:         75,
    type:             'cooldown_period',
    message:          'We have detected patterns that may indicate problem gambling. A 24-hour cooling-off period has been applied to your account.',
    dedupWindowHours: 48,
  },
  {
    minScore:         90,
    type:             'account_review',
    message:          'Your account has been flagged for a mandatory responsible gambling review.',
    dedupWindowHours: 72,
  },
];

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------
async function hasPendingIntervention(
  casinoId:  string,
  playerId:  string,
  type:      InterventionType,
  windowHrs: number,
): Promise<boolean> {
  const { rows } = await query(
    `SELECT 1 FROM interventions
     WHERE  casino_id = $1 AND player_id = $2 AND type = $3
       AND  triggered_at >= NOW() - ($4 || ' hours')::INTERVAL
       AND  status NOT IN ('dismissed')
     LIMIT 1`,
    [casinoId, playerId, type, windowHrs],
    'hasPendingIntervention',
  );
  return rows.length > 0;
}

async function createIntervention(
  casinoId:    string,
  playerId:    string,
  type:        InterventionType,
  message:     string,
  triggeredBy: string,
  riskScoreId?: string,
): Promise<InterventionRow> {
  const { rows } = await query<InterventionRow>(
    `INSERT INTO interventions
       (casino_id, player_id, type, message, triggered_by, risk_score_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [casinoId, playerId, type, message, triggeredBy, riskScoreId ?? null],
    'createIntervention',
  );
  return rows[0];
}

async function getPlayerInterventions(
  casinoId: string,
  playerId: string,
  status?:  InterventionStatus,
): Promise<InterventionRow[]> {
  const conditions = ['casino_id = $1', 'player_id = $2'];
  const params: unknown[] = [casinoId, playerId];

  if (status) {
    conditions.push(`status = $${params.length + 1}`);
    params.push(status);
  }

  const { rows } = await query<InterventionRow>(
    `SELECT * FROM interventions
     WHERE  ${conditions.join(' AND ')}
     ORDER BY triggered_at DESC
     LIMIT  100`,
    params,
    'getPlayerInterventions',
  );
  return rows;
}

async function acknowledgeIntervention(
  casinoId:       string,
  interventionId: string,
  action:         'acknowledged' | 'dismissed' | 'escalated',
): Promise<InterventionRow | null> {
  const tsColumn =
    action === 'acknowledged' ? 'acknowledged_at = NOW(),'
    : action === 'escalated'  ? 'resolved_at = NOW(),'
    : '';

  const { rows } = await query<InterventionRow>(
    `UPDATE interventions
     SET    status = $3, ${tsColumn} updated_at = NOW()
     WHERE  casino_id = $1 AND id = $2
     RETURNING *`,
    [casinoId, interventionId, action],
    'acknowledgeIntervention',
  );
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Trigger logic — called by risk-engine or session close events
// ---------------------------------------------------------------------------
export async function triggerInterventionsForPlayer(
  casinoId:  string,
  playerId:  string,
  riskScore: RiskScore,
): Promise<InterventionRow[]> {
  const triggered: InterventionRow[] = [];

  for (const rule of INTERVENTION_RULES) {
    if (riskScore.score < rule.minScore) continue;

    const alreadyActive = await hasPendingIntervention(
      casinoId, playerId, rule.type, rule.dedupWindowHours,
    );
    if (alreadyActive) {
      log.debug('Skipping intervention (dedup)', { type: rule.type, playerId, casinoId });
      continue;
    }

    const intervention = await createIntervention(
      casinoId, playerId, rule.type, rule.message, 'system',
    );
    triggered.push(intervention);

    log.info('Intervention triggered', {
      casinoId, playerId, type: rule.type, score: riskScore.score,
    });
  }

  return triggered;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
async function handleEvaluate(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const token = extractBearerToken(event);
  if (!token) return unauthorized();
  const claims = await verifyToken(token);

  const playerId = event.pathParameters?.playerId;
  if (!playerId) return badRequest('playerId path parameter is required');

  const riskScore = await computeRiskScore(claims.casinoId, playerId);
  const interventions = await triggerInterventionsForPlayer(claims.casinoId, playerId, riskScore);

  return ok({
    riskScore,
    interventionsTriggered: interventions.length,
    interventions,
  });
}

async function handleList(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const token = extractBearerToken(event);
  if (!token) return unauthorized();
  const claims = await verifyToken(token);

  const playerId = event.pathParameters?.playerId;
  if (!playerId) return badRequest('playerId path parameter is required');

  const status = event.queryStringParameters?.status as InterventionStatus | undefined;
  const interventions = await getPlayerInterventions(claims.casinoId, playerId, status);

  return ok(interventions, { count: interventions.length });
}

async function handleAcknowledge(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const token = extractBearerToken(event);
  if (!token) return unauthorized();
  const claims = await verifyToken(token);

  const interventionId = event.pathParameters?.interventionId;
  if (!interventionId) return badRequest('interventionId path parameter is required');

  let body: AcknowledgeBody;
  try {
    body = parseBody<AcknowledgeBody>(event.body);
  } catch {
    return badRequest('Invalid JSON body');
  }

  const allowed = ['acknowledged', 'dismissed', 'escalated'];
  if (!body.action || !allowed.includes(body.action)) {
    return badRequest(`action must be one of: ${allowed.join(', ')}`);
  }

  const updated = await acknowledgeIntervention(claims.casinoId, interventionId, body.action);
  if (!updated) return notFound('Intervention');

  return ok(updated);
}

// ---------------------------------------------------------------------------
// Lambda entry point
// ---------------------------------------------------------------------------
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId;
  const logger    = createLogger('intervention-service', requestId);
  logger.info('Request', { method: event.httpMethod, path: event.path });

  try {
    const method   = event.httpMethod.toUpperCase();
    const resource = event.resource ?? event.path;

    if (method === 'POST' && resource.endsWith('/evaluate'))              return handleEvaluate(event);
    if (method === 'GET'  && resource.includes('/interventions'))         return handleList(event);
    if (method === 'PATCH'&& resource.includes('{interventionId}'))       return handleAcknowledge(event);

    return { statusCode: 405, headers: { Allow: 'GET, POST, PATCH' }, body: 'Method Not Allowed' };
  } catch (err) {
    logger.error('Unhandled error in intervention-service', err);
    return internalError();
  }
};
