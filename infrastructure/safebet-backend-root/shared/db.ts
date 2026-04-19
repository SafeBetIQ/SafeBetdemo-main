import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { createLogger } from './logger';

const log = createLogger('db');

// DB_HOST is always db.safebetiq.com — Route53 CNAME that fails over between
// Cape Town (primary) and Ireland (replica) automatically via health checks.
// Never hardcode an RDS endpoint here.
const poolConfig = {
  host:               process.env.DB_HOST     ?? 'db.safebetiq.com',
  port:               parseInt(process.env.DB_PORT ?? '5432', 10),
  database:           process.env.DB_NAME     ?? 'safebet',
  user:               process.env.DB_USER,
  password:           process.env.DB_PASSWORD,
  ssl:                { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' },
  max:                parseInt(process.env.DB_POOL_MAX   ?? '10', 10),
  idleTimeoutMillis:  parseInt(process.env.DB_IDLE_MS    ?? '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT_MS ?? '5000', 10),
};

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool(poolConfig);
    pool.on('error', (err) => {
      log.error('Idle pg pool client error', err);
    });
  }
  return pool;
}

const RETRY_DELAYS_MS = [200, 500, 1000, 2000];

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isRetryable = isRetryableError(err);

      if (!isRetryable || attempt === RETRY_DELAYS_MS.length) {
        log.error(`DB operation failed after ${attempt + 1} attempt(s): ${label}`, err);
        throw err;
      }

      const delay = RETRY_DELAYS_MS[attempt];
      log.warn(`DB retry ${attempt + 1}/${RETRY_DELAYS_MS.length} for ${label} in ${delay}ms`, {
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      await sleep(delay);

      // Reset the pool on connection errors — the Route53 CNAME may have
      // resolved to a new endpoint after a DR failover.
      if (isConnectionError(err)) {
        log.info('Resetting pg pool after connection error (possible DR failover)');
        await pool?.end().catch(() => undefined);
        pool = null;
      }
    }
  }

  throw lastError;
}

function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const retryableCodes = new Set([
    'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND',
    '57P01',  // admin_shutdown
    '57P02',  // crash_shutdown
    '57P03',  // cannot_connect_now
    '08000',  // connection_exception
    '08006',  // connection_failure
  ]);
  const pgCode = (err as NodeJS.ErrnoException & { code?: string }).code ?? '';
  return retryableCodes.has(pgCode) || isConnectionError(err);
}

function isConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.message.includes('connect ECONNREFUSED') ||
    err.message.includes('Connection terminated') ||
    err.message.includes('ENOTFOUND') ||
    err.message.includes('getaddrinfo')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function query<R extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[],
  label = 'query',
): Promise<QueryResult<R>> {
  return withRetry(() => getPool().query<R>(sql, params), label);
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return withRetry(async () => {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }, 'transaction');
}

export async function healthCheck(): Promise<boolean> {
  try {
    await query('SELECT 1', [], 'healthCheck');
    return true;
  } catch {
    return false;
  }
}
