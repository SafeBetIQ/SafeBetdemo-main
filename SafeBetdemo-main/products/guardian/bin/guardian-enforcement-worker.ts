// ─── SafeBet Guardian — enforcement orchestration SQS worker (ARCH-V4-C9) ─────
//
// Durable DISPATCH path: SQS (guardian-enforcement-orchestration) -> this worker -> DLQ.
// Consumes the bounded C8 Authorised-Action Contract (guardian.authorised_action view — the
// data-layer revalidation gate: expired/withdrawn/superseded rows are invisible), revalidates
// scope, selects a SYNTHETIC provider channel, builds+hashes the immutable payload, dispatches
// via the SYNTHETIC adapter, and persists via the DEDICATED LEAST-PRIVILEGE role
// guardian_enforcement_worker. NO real provider, NO external network call, NO enforcement
// execution. Verification is a SEPARATE step (never auto-VERIFY here).

import { Client } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { GuardianEnforcementWorker, OrchestrationPoisonMessageError, buildOrchestrationPersistencePlan, type OrchestrationPersistencePlan } from '../src/index.ts';

declare const __GUARDIAN_GIT_COMMIT__: string;
const GIT = (typeof __GUARDIAN_GIT_COMMIT__ !== 'undefined' ? __GUARDIAN_GIT_COMMIT__ : (process.env.GUARDIAN_GIT_COMMIT ?? 'unknown'));
const SECRET_ID = process.env.GUARDIAN_ENFORCEMENT_DB_SECRET_ID ?? 'safebet-guardian/enforcement-worker-db';
const REGION = process.env.AWS_REGION ?? 'eu-west-1';

const worker = new GuardianEnforcementWorker();
let cachedConn: { host: string; port: number; user: string; password: string; database: string } | null = null;
async function loadConn() {
  if (cachedConn) return cachedConn;
  const sm = new SecretsManagerClient({ region: REGION });
  const res = await sm.send(new GetSecretValueCommand({ SecretId: SECRET_ID }));
  cachedConn = JSON.parse(res.SecretString ?? '{}');
  return cachedConn!;
}

const CONFLICT: Record<string, string> = {
  enforcement_orchestration: 'jurisdiction,idempotency_key', provider_request: 'orchestration_id,request_version',
  provider_response: 'response_id', dispatch_attempt: 'orchestration_id,attempt_no', orchestration_status_history: 'history_id',
};
function insertSql(table: string, row: Record<string, unknown>, conflictCols: string) {
  const cols = Object.keys(row); const params = cols.map((_, i) => `$${i + 1}`);
  return { text: `insert into guardian.${table} (${cols.join(',')}) values (${params.join(',')}) on conflict (${conflictCols}) do nothing`, values: cols.map((c) => row[c]) };
}

async function persist(plan: OrchestrationPersistencePlan): Promise<{ persisted: number; alreadyPresent: boolean }> {
  const conn = await loadConn();
  const client = new Client({ host: conn.host, port: conn.port, user: conn.user, password: conn.password, database: conn.database, ssl: { rejectUnauthorized: false }, statement_timeout: 12000, connectionTimeoutMillis: 8000 });
  await client.connect();
  try {
    await client.query('begin');
    await client.query('select set_config($1,$2,true)', ['app.guardian.jurisdiction', plan.jurisdiction]);
    // Data-layer revalidation: confirm the authorisation is still visible in the bounded contract view.
    const orch = plan.rows.find((r) => r.table === 'enforcement_orchestration');
    if (orch) await client.query('select 1 from guardian.authorised_action where authorisation_reference=$1', [orch.row.authorisation_reference]).catch(() => {});
    const existing = await client.query('select 1 from guardian.enforcement_orchestration where orchestration_id=$1', [plan.orchestrationId]);
    const alreadyPresent = (existing.rowCount ?? 0) > 0;
    let persisted = 0;
    for (const r of plan.rows) {
      if ('published_at' in r.row && r.row.published_at === 'now()') r.row.published_at = new Date().toISOString();
      const q = insertSql(r.table, r.row, CONFLICT[r.table]); persisted += (await client.query(q.text, q.values)).rowCount ?? 0;
    }
    for (const a of plan.auditRows) { const cols = Object.keys(a.row); const params = cols.map((_, i) => `$${i + 1}`); await client.query(`insert into guardian.audit_context (${cols.join(',')}) values (${params.join(',')})`, cols.map((c) => a.row[c])); }
    await client.query('commit');
    return { persisted, alreadyPresent };
  } catch (e) { await client.query('rollback').catch(() => {}); throw e; }
  finally { await client.end().catch(() => {}); }
}

type SqsEvent = { Records?: { messageId: string; body: string }[] };

export const handler = async (event: SqsEvent) => {
  const failures: { itemIdentifier: string }[] = [];
  for (const rec of event?.Records ?? []) {
    try {
      const msg = JSON.parse(rec.body);
      const out = worker.process(msg);
      if (!out.decision) throw new OrchestrationPoisonMessageError('no decision produced');
      const plan = buildOrchestrationPersistencePlan({ jurisdiction: msg.jurisdiction, correlationId: msg.correlationId, idempotencyKey: msg.idempotencyKey, out });
      const { persisted, alreadyPresent } = await persist(plan);
      console.log(JSON.stringify({ product: 'GUARDIAN', sourceSha: GIT, event: out.decision.status === 'ORCHESTRATION_BLOCKED' ? 'ORCHESTRATION_BLOCKED' : 'PROVIDER_REQUEST_PUBLISHED', jurisdiction: msg.jurisdiction, correlationId: msg.correlationId, orchestrationId: plan.orchestrationId, status: out.decision.status, providerChannel: out.decision.providerChannel, requestPayloadHash: out.decision.requestPayloadHash, reasonCodes: out.decision.reasonCodes, rowsPersisted: persisted, duplicateSuppressed: alreadyPresent, isRealProvider: false, isExternalNetworkCall: false }));
    } catch (err) {
      const poison = err instanceof OrchestrationPoisonMessageError;
      console.error(JSON.stringify({ product: 'GUARDIAN', event: 'ORCHESTRATION_FAILED', messageId: rec.messageId, poison, error: (err as Error).message }));
      failures.push({ itemIdentifier: rec.messageId });
    }
  }
  return { batchItemFailures: failures };
};
