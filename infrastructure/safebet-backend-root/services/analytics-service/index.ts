import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../shared/db';
import { createLogger } from '../../shared/logger';
import { ok, badRequest, unauthorized, internalError } from '../../shared/response';
import { extractBearerToken, verifyToken, requireGroup } from '../auth-service';


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface PlayerSummary {
  player_id:        string;
  full_name:        string;
  email:            string;
  status:           string;
  kyc_status:       string;
  risk_score:       number | null;
  risk_level:       string | null;
  total_sessions:   number;
  total_wagered:    number;
  total_won:        number;
  net_loss:         number;
  total_deposited:  number;
  last_seen:        string | null;
}

interface CasinoMetrics {
  period:           string;
  active_players:   number;
  new_players:      number;
  total_sessions:   number;
  total_wagered:    number;
  total_deposits:   number;
  net_revenue:      number;
  high_risk_count:  number;
  critical_risk_count: number;
  interventions_triggered: number;
  self_exclusions:  number;
}

interface RiskDistribution {
  level:    string;
  count:    number;
  pct:      number;
}

interface TopLossPlayer {
  player_id:   string;
  full_name:   string;
  net_loss:    number;
  risk_level:  string | null;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
async function getPlayerSummaries(
  casinoId: string,
  limit:    number,
  offset:   number,
  riskLevel?: string,
): Promise<{ rows: PlayerSummary[]; total: number }> {
  const conditions = ['p.casino_id = $1'];
  const params: unknown[] = [casinoId];

  if (riskLevel) {
    params.push(riskLevel);
    conditions.push(`r.level = $${params.length}`);
  }

  const where = conditions.join(' AND ');

  const [dataResult, countResult] = await Promise.all([
    query<PlayerSummary>(
      `SELECT
         p.id                         AS player_id,
         p.full_name,
         p.email,
         p.status,
         p.kyc_status,
         r.score                      AS risk_score,
         r.level                      AS risk_level,
         COUNT(DISTINCT s.id)         AS total_sessions,
         COALESCE(SUM(s.total_wagered), 0)  AS total_wagered,
         COALESCE(SUM(s.total_won), 0)      AS total_won,
         COALESCE(SUM(s.net_loss), 0)       AS net_loss,
         COALESCE(SUM(s.total_deposited),0) AS total_deposited,
         MAX(s.started_at)            AS last_seen
       FROM   players p
       LEFT JOIN mv_player_risk_current r USING (casino_id, player_id)
       LEFT JOIN sessions s ON s.casino_id = p.casino_id AND s.player_id = p.id
       WHERE  ${where}
       GROUP BY p.id, p.full_name, p.email, p.status, p.kyc_status, r.score, r.level
       ORDER BY net_loss DESC
       LIMIT  $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
      'getPlayerSummaries',
    ),
    query<{ total: string }>(
      `SELECT COUNT(DISTINCT p.id) AS total
       FROM   players p
       LEFT JOIN mv_player_risk_current r USING (casino_id, player_id)
       WHERE  ${where}`,
      params,
      'getPlayerSummariesCount',
    ),
  ]);

  return {
    rows:  dataResult.rows,
    total: parseInt(countResult.rows[0]?.total ?? '0', 10),
  };
}

async function getCasinoMetrics(
  casinoId:  string,
  startDate: string,
  endDate:   string,
): Promise<CasinoMetrics> {
  const { rows } = await query(
    `SELECT
       $3::date || ' to ' || $4::date              AS period,
       COUNT(DISTINCT s.player_id)                  AS active_players,
       COUNT(DISTINCT CASE
         WHEN p.created_at BETWEEN $3 AND $4 THEN p.id END) AS new_players,
       COUNT(DISTINCT s.id)                         AS total_sessions,
       COALESCE(SUM(s.total_wagered), 0)            AS total_wagered,
       COALESCE(SUM(s.total_deposited), 0)          AS total_deposits,
       COALESCE(SUM(s.net_loss), 0)                 AS net_revenue,
       COUNT(DISTINCT CASE WHEN r.level = 'high'     THEN p.id END) AS high_risk_count,
       COUNT(DISTINCT CASE WHEN r.level = 'critical' THEN p.id END) AS critical_risk_count,
       (SELECT COUNT(*) FROM interventions i
        WHERE  i.casino_id = $1 AND i.triggered_at BETWEEN $3 AND $4) AS interventions_triggered,
       (SELECT COUNT(*) FROM compliance_events ce
        WHERE  ce.casino_id = $1 AND ce.event_type = 'self_exclusion_requested'
          AND  ce.occurred_at BETWEEN $3 AND $4)    AS self_exclusions
     FROM   players p
     LEFT JOIN sessions s ON s.casino_id = p.casino_id
       AND s.player_id = p.id
       AND s.started_at BETWEEN $3 AND $4
     LEFT JOIN mv_player_risk_current r ON r.casino_id = p.casino_id AND r.player_id = p.id
     WHERE  p.casino_id = $1`,
    [casinoId, casinoId, startDate, endDate],
    'getCasinoMetrics',
  );

  return rows[0] as unknown as CasinoMetrics;
}

async function getRiskDistribution(casinoId: string): Promise<RiskDistribution[]> {
  const { rows } = await query(
    `WITH totals AS (
       SELECT COUNT(*) AS total FROM mv_player_risk_current WHERE casino_id = $1
     )
     SELECT
       r.level,
       COUNT(*) AS count,
       ROUND(COUNT(*) * 100.0 / NULLIF(t.total, 0), 2) AS pct
     FROM  mv_player_risk_current r, totals t
     WHERE r.casino_id = $1
     GROUP BY r.level, t.total
     ORDER BY CASE r.level WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`,
    [casinoId],
    'getRiskDistribution',
  );
  return rows as unknown as RiskDistribution[];
}

async function getTopLossPlayers(casinoId: string, limit = 10): Promise<TopLossPlayer[]> {
  const { rows } = await query(
    `SELECT
       p.id          AS player_id,
       p.full_name,
       SUM(s.net_loss) AS net_loss,
       r.level         AS risk_level
     FROM   players p
     JOIN   sessions s ON s.casino_id = p.casino_id AND s.player_id = p.id
       AND  s.started_at >= NOW() - INTERVAL '30 days'
     LEFT JOIN mv_player_risk_current r ON r.casino_id = p.casino_id AND r.player_id = p.id
     WHERE  p.casino_id = $1
     GROUP BY p.id, p.full_name, r.level
     ORDER BY net_loss DESC
     LIMIT  $2`,
    [casinoId, limit],
    'getTopLossPlayers',
  );
  return rows as unknown as TopLossPlayer[];
}

async function getSessionTrend(
  casinoId:  string,
  days:      number,
): Promise<Array<{ date: string; sessions: number; wagered: number; deposited: number }>> {
  const { rows } = await query(
    `SELECT
       DATE_TRUNC('day', started_at)::date::text AS date,
       COUNT(*)                                  AS sessions,
       COALESCE(SUM(total_wagered), 0)           AS wagered,
       COALESCE(SUM(total_deposited), 0)         AS deposited
     FROM   sessions
     WHERE  casino_id = $1
       AND  started_at >= NOW() - ($2 || ' days')::INTERVAL
     GROUP BY 1
     ORDER BY 1`,
    [casinoId, days],
    'getSessionTrend',
  );
  return rows as unknown as Array<{ date: string; sessions: number; wagered: number; deposited: number }>;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
async function handlePlayerSummaries(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const token = extractBearerToken(event);
  if (!token) return unauthorized();
  const claims = await verifyToken(token);

  if (!requireGroup(claims, 'analytics') && !requireGroup(claims, 'admin') && !requireGroup(claims, 'compliance')) {
    return unauthorized('Analytics access requires analytics, compliance, or admin group');
  }

  const limit     = Math.min(parseInt(event.queryStringParameters?.limit  ?? '50', 10), 200);
  const offset    = parseInt(event.queryStringParameters?.offset ?? '0', 10);
  const riskLevel = event.queryStringParameters?.riskLevel;

  const { rows, total } = await getPlayerSummaries(claims.casinoId, limit, offset, riskLevel);

  return ok(rows, { total, limit, offset, returned: rows.length });
}

async function handleCasinoMetrics(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const token = extractBearerToken(event);
  if (!token) return unauthorized();
  const claims = await verifyToken(token);

  if (!requireGroup(claims, 'analytics') && !requireGroup(claims, 'admin')) {
    return unauthorized('Metrics access requires analytics or admin group');
  }

  const startDate = event.queryStringParameters?.startDate;
  const endDate   = event.queryStringParameters?.endDate ?? new Date().toISOString().slice(0, 10);
  if (!startDate) return badRequest('startDate query parameter is required (YYYY-MM-DD)');

  const metrics = await getCasinoMetrics(claims.casinoId, startDate, endDate);
  return ok(metrics);
}

async function handleRiskDistribution(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const token = extractBearerToken(event);
  if (!token) return unauthorized();
  const claims = await verifyToken(token);

  const distribution = await getRiskDistribution(claims.casinoId);
  return ok(distribution);
}

async function handleTopLossPlayers(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const token = extractBearerToken(event);
  if (!token) return unauthorized();
  const claims = await verifyToken(token);

  if (!requireGroup(claims, 'analytics') && !requireGroup(claims, 'admin') && !requireGroup(claims, 'compliance')) {
    return unauthorized('Top loss players requires analytics, compliance, or admin group');
  }

  const limit = Math.min(parseInt(event.queryStringParameters?.limit ?? '10', 10), 50);
  const players = await getTopLossPlayers(claims.casinoId, limit);
  return ok(players);
}

async function handleSessionTrend(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const token = extractBearerToken(event);
  if (!token) return unauthorized();
  const claims = await verifyToken(token);

  const days = Math.min(parseInt(event.queryStringParameters?.days ?? '30', 10), 90);
  const trend = await getSessionTrend(claims.casinoId, days);
  return ok(trend, { days });
}

// ---------------------------------------------------------------------------
// Lambda entry point
// ---------------------------------------------------------------------------
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId;
  const logger    = createLogger('analytics-service', requestId);
  logger.info('Request', { method: event.httpMethod, path: event.path });

  try {
    const resource = event.resource ?? event.path;

    if (resource.endsWith('/players'))             return handlePlayerSummaries(event);
    if (resource.endsWith('/metrics'))             return handleCasinoMetrics(event);
    if (resource.endsWith('/risk-distribution'))   return handleRiskDistribution(event);
    if (resource.endsWith('/top-loss'))            return handleTopLossPlayers(event);
    if (resource.endsWith('/session-trend'))       return handleSessionTrend(event);

    return { statusCode: 404, headers: {}, body: JSON.stringify({ error: 'Route not found' }) };
  } catch (err) {
    logger.error('Unhandled error in analytics-service', err);
    return internalError();
  }
};
