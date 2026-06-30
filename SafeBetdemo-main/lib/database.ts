/**
 * Server-side database module — NEVER import in client components or pages/_app.
 *
 * Resolution order:
 *   1. AWS Secrets Manager (DATABASE_URL_SECRET_ARN env var)
 *   2. DATABASE_URL env var (plaintext fallback, retired after migration)
 *   3. Fatal startup error
 *
 * Required packages:
 *   npm install pg @aws-sdk/client-secrets-manager @smithy/node-http-handler
 *   npm install --save-dev @types/pg
 *
 * Pre-deploy:
 *   Download: https://truststore.pki.rds.amazonaws.com/af-south-1/af-south-1-bundle.pem
 *   Place at: certs/af-south-1-bundle.pem (relative to project root)
 */

import fs from 'fs';
import path from 'path';
import { Pool, PoolConfig } from 'pg';
import type { QueryResultRow } from 'pg';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
  SecretsManagerServiceException,
} from '@aws-sdk/client-secrets-manager';
import { NodeHttpHandler } from '@smithy/node-http-handler';

// ── Types ──────────────────────────────────────────────────────────────────────

interface DbSecret {
  host: string;
  port: number;
  dbname: string;
  username: string;
  password: string;
}

// ── RDS CA bundle ──────────────────────────────────────────────────────────────

function getRdsCaBundle(): string | undefined {
  const candidates = [
    path.join(process.cwd(), 'certs', 'af-south-1-bundle.pem'),
    '/etc/ssl/certs/af-south-1-bundle.pem',
    '/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem',
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p).toString();
      }
    } catch {
      // continue to next candidate
    }
  }
  console.warn('[db] RDS CA bundle not found — relying on system trust store for TLS');
  return undefined;
}

// ── Secrets Manager client (lazy singleton, with timeout) ─────────────────────

let secretsClient: SecretsManagerClient | null = null;

function getSecretsClient(): SecretsManagerClient {
  if (!secretsClient) {
    secretsClient = new SecretsManagerClient({
      region: 'af-south-1',
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 3_000,
        requestTimeout: 5_000,
      }),
      maxAttempts: 2,
    });
  }
  return secretsClient;
}

// ── Secret retrieval ───────────────────────────────────────────────────────────

async function fetchSecretFromSecretsManager(secretArn: string): Promise<DbSecret> {
  const client = getSecretsClient();
  const command = new GetSecretValueCommand({ SecretId: secretArn });
  const response = await client.send(command);

  if (!response.SecretString) {
    throw new Error('Secrets Manager returned an empty SecretString');
  }

  const parsed = JSON.parse(response.SecretString) as DbSecret;

  if (!parsed.host || !parsed.username || !parsed.password || !parsed.dbname) {
    throw new Error('Secret JSON is missing required fields: host, username, password, dbname');
  }

  return parsed;
}

// ── Connection string builder ──────────────────────────────────────────────────

function buildConnectionUrl(secret: DbSecret): string {
  const { username, password, host, port, dbname } = secret;
  const encodedPassword = encodeURIComponent(password);
  return `postgresql://${username}:${encodedPassword}@${host}:${port ?? 5432}/${dbname}`;
}

// ── Pool factory ───────────────────────────────────────────────────────────────

function createPool(connectionString: string): Pool {
  const ca = getRdsCaBundle();
  const config: PoolConfig = {
    connectionString,
    ssl: {
      rejectUnauthorized: true,
      ...(ca ? { ca } : {}),
    },
    max: 10,
    min: 2,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  };
  return new Pool(config);
}

// ── Pool initialisation ────────────────────────────────────────────────────────

async function initialisePool(): Promise<Pool> {
  const secretArn = process.env.DATABASE_URL_SECRET_ARN;
  const fallbackUrl = process.env.DATABASE_URL;

  // Path 1: Secrets Manager
  if (secretArn) {
    try {
      const secret = await fetchSecretFromSecretsManager(secretArn);
      const connectionUrl = buildConnectionUrl(secret);
      console.info('[db] Credentials resolved from Secrets Manager: %s', secretArn);
      return createPool(connectionUrl);
    } catch (err) {
      const message = err instanceof SecretsManagerServiceException
        ? `${err.name}: ${err.message}`
        : String(err);
      console.warn(
        '[db] Secrets Manager retrieval failed (%s) — falling back to DATABASE_URL.',
        message,
      );
    }
  }

  // Path 2: Plaintext fallback
  if (fallbackUrl) {
    console.warn(
      '[db] Using plaintext DATABASE_URL. Remove after Secrets Manager path is validated.',
    );
    return createPool(fallbackUrl);
  }

  // Path 3: Fatal
  throw new Error(
    '[db] FATAL: No database credentials available. ' +
    'Set DATABASE_URL_SECRET_ARN (preferred) or DATABASE_URL.',
  );
}

// ── Singleton pool with retry cooldown ────────────────────────────────────────

let poolPromise: Promise<Pool> | null = null;
let lastFailureTime = 0;
const RETRY_COOLDOWN_MS = 5_000;

function getPool(): Promise<Pool> {
  if (!poolPromise) {
    if (Date.now() - lastFailureTime < RETRY_COOLDOWN_MS) {
      return Promise.reject(
        new Error('[db] Pool initialisation in cooldown after recent failure'),
      );
    }
    poolPromise = initialisePool().catch((err) => {
      poolPromise = null;
      lastFailureTime = Date.now();
      throw err;
    });
  }
  return poolPromise;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number | null }> {
  const pool = await getPool();
  const result = await pool.query<T>(sql, params);
  return { rows: result.rows, rowCount: result.rowCount };
}

export async function getClient() {
  const pool = await getPool();
  return pool.connect();
}

export async function checkConnection(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    const pool = await getPool();
    await pool.query('SELECT 1');
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}
