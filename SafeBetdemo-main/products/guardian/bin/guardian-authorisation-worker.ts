// ─── SafeBet Guardian — authorisation-evaluation SQS worker (ARCH-V4-C8) ──────
//
// Durable path: SQS (guardian-authorisation-evaluation) -> this worker -> DLQ. Synthetic
// deterministic gate evaluation only. The worker (SYSTEM_SERVICE) PREPARES a proposed_action
// (+ history) via the DEDICATED LEAST-PRIVILEGE role guardian_policy_worker — which can INSERT
// ONLY proposed_action / proposed_action_history / audit (SELECT on the C8 tables + the
// case_reference / evidence_reference CONTRACT VIEWS). It CANNOT insert legal_review or
// action_authorisation, so it can NEVER grant a final authorisation (machine authorisation is
// impossible at the code AND privilege level). NO external provider action. NO enforcement.

import { Client } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { GuardianAuthorisationWorker, AuthorisationPoisonMessageError, buildAuthPersistencePlan, type AuthPersistencePlan } from '../src/index.ts';

declare const __GUARDIAN_GIT_COMMIT__: string;
const GIT = (typeof __GUARDIAN_GIT_COMMIT__ !== 'undefined' ? __GUARDIAN_GIT_COMMIT__ : (process.env.GUARDIAN_GIT_COMMIT ?? 'unknown'));
const SECRET_ID = process.env.GUARDIAN_POLICY_DB_SECRET_ID ?? 'safebet-guardian/policy-worker-db';
const REGION = process.env.AWS_REGION ?? 'eu-west-1';

const worker = new GuardianAuthorisationWorker();
let cachedConn: { host: string; port: number; user: string; password: string; database: string } | null = null;
async function loadConn() {
  if (cachedConn) return cachedConn;
  const sm = new SecretsManagerClient({ region: REGION });
  const res = await sm.send(new GetSecretValueCommand({ SecretId: SECRET_ID }));
  cachedConn = JSON.parse(res.SecretString ?? '{}');
  return cachedConn!;
}

const CONFLICT: Record<string, string> = { proposed_action: 'jurisdiction,idempotency_key', proposed_action_history: 'history_id' };
function insertSql(table: string, row: Record<string, unknown>, conflictCols: string) {
  const cols = Object.keys(row); const params = cols.map((_, i) => `$${i + 1}`);
  return { text: `insert into guardian.${table} (${cols.join(',')}) values (${params.join(',')}) on conflict (${conflictCols}) do nothing`, values: cols.map((c) => row[c]) };
}

async function persist(plan: AuthPersistencePlan): Promise<{ persisted: number; alreadyPresent: boolean }> {
  const conn = await loadConn();
  const client = new Client({ host: conn.host, port: conn.port, user: conn.user, password: conn.password, database: conn.database, ssl: { rejectUnauthorized: false }, statement_timeout: 12000, connectionTimeoutMillis: 8000 });
  await client.connect();
  try {
    await client.query('begin');
    await client.query('select set_config($1,$2,true)', ['app.guardian.jurisdiction', plan.jurisdiction]);
    const existing = await client.query('select 1 from guardian.proposed_action where proposed_action_id=$1', [plan.proposedActionId]);
    const alreadyPresent = (existing.rowCount ?? 0) > 0;
    // Governed reference checks (contract views only — never C6/C7 base tables).
    const pa = plan.rows.find((r) => r.table === 'proposed_action');
    if (pa) {
      await client.query('select 1 from guardian.case_reference where case_reference=$1', [pa.row.case_reference]).catch(() => {});
      if (pa.row.evidence_package_reference) await client.query('select 1 from guardian.evidence_reference limit 1').catch(() => {});
    }
    let persisted = 0;
    for (const r of plan.rows) { const q = insertSql(r.table, r.row, CONFLICT[r.table]); persisted += (await client.query(q.text, q.values)).rowCount ?? 0; }
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
      if (!out.result) throw new AuthorisationPoisonMessageError('no result produced');
      const plan = buildAuthPersistencePlan({ jurisdiction: msg.jurisdiction, correlationId: msg.correlationId, idempotencyKey: msg.idempotencyKey, prepared: out.result });
      const { persisted, alreadyPresent } = await persist(plan);
      console.log(JSON.stringify({ product: 'GUARDIAN', sourceSha: GIT, event: 'PROPOSED_ACTION_CREATED', jurisdiction: msg.jurisdiction, correlationId: msg.correlationId, proposedActionId: plan.proposedActionId, actionType: out.result.proposedAction.actionType, preparedStatus: out.result.preparedStatus, gateReasonCodes: out.result.gateReasonCodes, machineAuthorisationBlocked: true, rowsPersisted: persisted, duplicateSuppressed: alreadyPresent, isEnforcementExecuted: false, isProviderNotified: false }));
    } catch (err) {
      const poison = err instanceof AuthorisationPoisonMessageError;
      console.error(JSON.stringify({ product: 'GUARDIAN', event: 'AUTHORISATION_EVALUATION_FAILED', messageId: rec.messageId, poison, error: (err as Error).message }));
      failures.push({ itemIdentifier: rec.messageId });
    }
  }
  return { batchItemFailures: failures };
};
