import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../shared/db';
import { createLogger } from '../../shared/logger';
import { ok, badRequest, unauthorized, internalError } from '../../shared/response';
import { extractBearerToken, verifyToken } from '../auth-service';

const log = createLogger('risk-engine');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface RiskComponents {
  velocity:      number;   // 0-100: bet frequency in last hour
  lossChasing:   number;   // 0-100: increasing stakes after losses
  sessionFreq:   number;   // 0-100: sessions per day over last 7 days
  depositSpike:  number;   // 0-100: deposit volume vs 30-day average
  lateNight:     number;   // 0-100: proportion of late-night sessions (00-05)
}

export interface RiskScore {
  playerId:      string;
  casinoId:      string;
  score:         number;
  level:         'low' | 'medium' | 'high' | 'critical';
  components:    RiskComponents;
  computedAt:    string;
  validUntil:    string;
}

interface SessionRow {
  started_at:        string;
  ended_at:          string | null;
  total_wagered:     string;
  total_won:         string;
  total_deposited:   string;
  chasing_loss:      boolean;
  rapid_betting:     boolean;
  late_night:        boolean;
}

interface BetRow {
  placed_at: string;
  stake:     string;
  outcome:   string | null;
  payout:    string;
}

// ---------------------------------------------------------------------------
// Scoring weights (must sum to 1.0)
// ---------------------------------------------------------------------------
const WEIGHTS: Record<keyof RiskComponents, number> = {
  velocity:     0.30,
  lossChasing:  0.25,
  sessionFreq:  0.20,
  depositSpike: 0.15,
  lateNight:    0.10,
};

function clamp(val: number): number {
  return Math.min(100, Math.max(0, val));
}

function levelFromScore(score: number): RiskScore['level'] {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// Component calculators
// ---------------------------------------------------------------------------

function calcVelocity(bets: BetRow[]): number {
  const oneHourAgo = Date.now() - 3_600_000;
  const recentBets = bets.filter((b) => new Date(b.placed_at).getTime() >= oneHourAgo);
  // >60 bets/hour = 100, linear below
  return clamp((recentBets.length / 60) * 100);
}

function calcLossChasing(bets: BetRow[]): number {
  if (bets.length < 3) return 0;

  let chasingSequences = 0;
  let consecutiveLosses = 0;
  let prevStake = 0;

  for (const bet of bets) {
    const stake = parseFloat(bet.stake);
    if (bet.outcome === 'loss') {
      consecutiveLosses++;
      if (consecutiveLosses >= 2 && stake > prevStake * 1.2) chasingSequences++;
    } else {
      consecutiveLosses = 0;
    }
    prevStake = stake;
  }

  const ratio = chasingSequences / Math.max(1, bets.length - 2);
  return clamp(ratio * 200); // 50% chasing ratio = 100
}

function calcSessionFrequency(sessions: SessionRow[]): number {
  const sevenDaysAgo = Date.now() - 7 * 86_400_000;
  const recentSessions = sessions.filter(
    (s) => new Date(s.started_at).getTime() >= sevenDaysAgo,
  );
  const sessionsPerDay = recentSessions.length / 7;
  // >5 sessions/day = 100
  return clamp((sessionsPerDay / 5) * 100);
}

function calcDepositSpike(sessions: SessionRow[]): number {
  const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
  const sevenDaysAgo  = Date.now() - 7 * 86_400_000;

  const baseline = sessions
    .filter((s) => new Date(s.started_at).getTime() >= thirtyDaysAgo)
    .reduce((sum, s) => sum + parseFloat(s.total_deposited), 0) / 30;

  const recent = sessions
    .filter((s) => new Date(s.started_at).getTime() >= sevenDaysAgo)
    .reduce((sum, s) => sum + parseFloat(s.total_deposited), 0) / 7;

  if (baseline === 0) return recent > 0 ? 50 : 0;
  const spike = (recent - baseline) / baseline;
  return clamp(spike * 50); // 2x baseline = 100
}

function calcLateNight(sessions: SessionRow[]): number {
  if (sessions.length === 0) return 0;
  const lateCount = sessions.filter((s) => s.late_night).length;
  return clamp((lateCount / sessions.length) * 100);
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------
export async function computeRiskScore(
  casinoId: string,
  playerId: string,
  triggerSessionId?: string,
): Promise<RiskScore> {
  const [sessionsResult, betsResult] = await Promise.all([
    query<SessionRow>(
      `SELECT started_at, ended_at, total_wagered, total_won, total_deposited,
              chasing_loss, rapid_betting, late_night
       FROM   sessions
       WHERE  casino_id = $1 AND player_id = $2
         AND  started_at >= NOW() - INTERVAL '30 days'
       ORDER BY started_at DESC
       LIMIT  200`,
      [casinoId, playerId],
      'riskEngine.fetchSessions',
    ),
    query<BetRow>(
      `SELECT placed_at, stake, outcome, payout
       FROM   bets
       WHERE  casino_id = $1 AND player_id = $2
         AND  placed_at >= NOW() - INTERVAL '24 hours'
       ORDER BY placed_at ASC
       LIMIT  500`,
      [casinoId, playerId],
      'riskEngine.fetchBets',
    ),
  ]);

  const sessions = sessionsResult.rows;
  const bets     = betsResult.rows;

  const components: RiskComponents = {
    velocity:     calcVelocity(bets),
    lossChasing:  calcLossChasing(bets),
    sessionFreq:  calcSessionFrequency(sessions),
    depositSpike: calcDepositSpike(sessions),
    lateNight:    calcLateNight(sessions),
  };

  const score = clamp(
    Object.entries(components).reduce(
      (total, [key, val]) => total + val * WEIGHTS[key as keyof RiskComponents],
      0,
    ),
  );

  const level      = levelFromScore(score);
  const computedAt = new Date().toISOString();
  const validUntil = new Date(Date.now() + 3_600_000).toISOString();

  // Persist the score asynchronously (fire and forget for latency)
  persistRiskScore(casinoId, playerId, score, level, components, computedAt, validUntil, triggerSessionId).catch(
    (err) => log.error('Failed to persist risk score', err, { casinoId, playerId }),
  );

  return { playerId, casinoId, score: Math.round(score * 100) / 100, level, components, computedAt, validUntil };
}

async function persistRiskScore(
  casinoId:       string,
  playerId:       string,
  score:          number,
  level:          string,
  components:     RiskComponents,
  computedAt:     string,
  validUntil:     string,
  triggerSessionId?: string,
): Promise<void> {
  await query(
    `INSERT INTO risk_scores
       (casino_id, player_id, score, level,
        component_velocity, component_loss_chasing, component_session_freq,
        component_deposit_spike, component_late_night,
        computed_at, valid_until, trigger_session_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      casinoId, playerId, score, level,
      components.velocity, components.lossChasing, components.sessionFreq,
      components.depositSpike, components.lateNight,
      computedAt, validUntil,
      triggerSessionId ?? null,
    ],
    'persistRiskScore',
  );
}

export async function getLatestRiskScore(
  casinoId: string,
  playerId: string,
): Promise<RiskScore | null> {
  const { rows } = await query(
    `SELECT player_id, casino_id, score, level,
            component_velocity     AS "componentVelocity",
            component_loss_chasing AS "componentLossChasing",
            component_session_freq AS "componentSessionFreq",
            component_deposit_spike AS "componentDepositSpike",
            component_late_night   AS "componentLateNight",
            computed_at, valid_until
     FROM   risk_scores
     WHERE  casino_id = $1 AND player_id = $2
     ORDER BY computed_at DESC
     LIMIT  1`,
    [casinoId, playerId],
    'getLatestRiskScore',
  );

  if (!rows[0]) return null;

  const r = rows[0] as Record<string, unknown>;
  return {
    playerId:   r['player_id'] as string,
    casinoId:   r['casino_id'] as string,
    score:      parseFloat(r['score'] as string),
    level:      r['level'] as RiskScore['level'],
    components: {
      velocity:     parseFloat(r['componentVelocity'] as string),
      lossChasing:  parseFloat(r['componentLossChasing'] as string),
      sessionFreq:  parseFloat(r['componentSessionFreq'] as string),
      depositSpike: parseFloat(r['componentDepositSpike'] as string),
      lateNight:    parseFloat(r['componentLateNight'] as string),
    },
    computedAt: r['computed_at'] as string,
    validUntil: r['valid_until'] as string,
  };
}

// ---------------------------------------------------------------------------
// Lambda handler
// ---------------------------------------------------------------------------
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId;
  const logger    = createLogger('risk-engine', requestId);

  try {
    const token = extractBearerToken(event);
    if (!token) return unauthorized();
    const claims = await verifyToken(token);

    const playerId       = event.pathParameters?.playerId ?? event.pathParameters?.id;
    const sessionId      = event.queryStringParameters?.sessionId;
    const forceRecompute = event.queryStringParameters?.recompute === 'true';

    if (!playerId) return badRequest('playerId path parameter is required');

    logger.info('Risk score requested', { playerId, casinoId: claims.casinoId, forceRecompute });

    if (!forceRecompute) {
      const cached = await getLatestRiskScore(claims.casinoId, playerId);
      if (cached && new Date(cached.validUntil).getTime() > Date.now()) {
        return ok(cached, { source: 'cache' });
      }
    }

    const score = await computeRiskScore(claims.casinoId, playerId, sessionId);
    logger.info('Risk score computed', { playerId, score: score.score, level: score.level });

    return ok(score, { source: 'computed' });
  } catch (err) {
    logger.error('Risk engine error', err);
    return internalError();
  }
};
