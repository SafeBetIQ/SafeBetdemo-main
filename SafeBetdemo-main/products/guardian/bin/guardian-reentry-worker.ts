// ─── SafeBet Guardian — re-entry intelligence SQS worker (ARCH-V4-C10) ────────
//
// Durable DETECTION path: SQS (guardian-reentry-intelligence) -> this worker -> DLQ.
// Consumes the bounded C9 Orchestration Reference Contract (guardian.orchestration_reference),
// builds a follow-up verification observation + a re-entry candidate for HUMAN REVIEW, and
// persists via the DEDICATED LEAST-PRIVILEGE role guardian_reentry_worker. It has NO grant on
// any C1–C9 base table, NO UPDATE/DELETE, and NO capability to enqueue C9 enforcement (its IAM
// role has no sqs:SendMessage). No real crawling/provider query; historic verification untouched.

import { Client } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { GuardianReentryWorker, ReentryPoisonMessageError, buildReentryPersistencePlan, type ReentryPersistencePlan } from '../src/reentry/index.ts';

declare const __GUARDIAN_GIT_COMMIT__: string;
const GIT = (typeof __GUARDIAN_GIT_COMMIT__ !== 'undefined' ? __GUARDIAN_GIT_COMMIT__ : (process.env.GUARDIAN_GIT_COMMIT ?? 'unknown'));
const SECRET_ID = process.env.GUARDIAN_REENTRY_DB_SECRET_ID ?? 'safebet-guardian/reentry-worker-db';
const REGION = process.env.AWS_REGION ?? 'eu-west-1';

const worker = new GuardianReentryWorker();
let cachedConn: { host: string; port: number; user: string; password: string; database: string } | null = null;
async function loadConn() {
  if (cachedConn) return cachedConn;
  const sm = new SecretsManagerClient({ region: REGION });
  const res = await sm.send(new GetSecretValueCommand({ SecretId: SECRET_ID }));
  cachedConn = JSON.parse(res.SecretString ?? '{}');
  return cachedConn!;
}

const CONFLICT: Record<string, string> = {
  enforcement_verification_observation: 'verification_observation_id',
  reentry_candidate: 'reentry_candidate_id', reentry_candidate_history: 'history_id',
};
function insertSql(table: string, row: Record<string, unknown>, conflictCols: string) {
  const cols = Object.keys(row); const params = cols.map((_, i) => `$${i + 1}`);
  return { text: `insert into guardian.${table} (${cols.join(',')}) values (${params.join(',')}) on conflict (${conflictCols}) do nothing`, values: cols.map((c) => row[c]) };
}

async function persist(plan: ReentryPersistencePlan): Promise<{ persisted: number; alreadyPresent: boolean }> {
  const conn = await loadConn();
  const client = new Client({ host: conn.host, port: conn.port, user: conn.user, password: conn.password, database: conn.database, ssl: { rejectUnauthorized: false }, statement_timeout: 12000, connectionTimeoutMillis: 8000 });
  await client.connect();
  try {
    await client.query('begin');
    await client.query('select set_config($1,$2,true)', ['app.guardian.jurisdiction', plan.jurisdiction]);
    // Consume the bounded C9 Orchestration Reference Contract (best-effort; real gate = view grant + RLS).
    const obs = plan.rows.find((r) => r.table === 'enforcement_verification_observation');
    if (obs) await client.query('select 1 from guardian.orchestration_reference where orchestration_reference=$1', [obs.row.orchestration_reference]).catch(() => {});
    let persisted = 0;
    for (const r of plan.rows) { const q = insertSql(r.table, r.row, CONFLICT[r.table]); persisted += (await client.query(q.text, q.values)).rowCount ?? 0; }
    for (const a of plan.auditRows) { const cols = Object.keys(a.row); const params = cols.map((_, i) => `$${i + 1}`); await client.query(`insert into guardian.audit_context (${cols.join(',')}) values (${params.join(',')})`, cols.map((c) => a.row[c])); }
    const alreadyPresent = persisted === 0;
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
      if (!out.decision) throw new ReentryPoisonMessageError('no decision produced');
      const plan = buildReentryPersistencePlan({ jurisdiction: msg.jurisdiction, correlationId: msg.correlationId, idempotencyKey: msg.idempotencyKey, out });
      const { persisted, alreadyPresent } = await persist(plan);
      console.log(JSON.stringify({ product: 'GUARDIAN', sourceSha: GIT, event: out.decision.candidateCreated ? 'REENTRY_CANDIDATE_CREATED' : 'FOLLOWUP_VERIFICATION_COMPLETED', jurisdiction: msg.jurisdiction, correlationId: msg.correlationId, reentryCandidateId: plan.reentryCandidateId, candidateCreated: out.decision.candidateCreated, relationshipType: out.decision.relationshipType, reviewPriority: out.decision.reviewPriority, coverageState: out.decision.coverageState, reasonCodes: out.decision.reasonCodes, verificationResult: out.decision.verification.result, rowsPersisted: persisted, duplicateSuppressed: alreadyPresent, isEnforcementDispatched: false, isRealObservationSource: false, isExternalNetworkCall: false }));
    } catch (err) {
      const poison = err instanceof ReentryPoisonMessageError;
      console.error(JSON.stringify({ product: 'GUARDIAN', event: 'REENTRY_DETECTION_FAILED', messageId: rec.messageId, poison, error: (err as Error).message }));
      failures.push({ itemIdentifier: rec.messageId });
    }
  }
  return { batchItemFailures: failures };
};
