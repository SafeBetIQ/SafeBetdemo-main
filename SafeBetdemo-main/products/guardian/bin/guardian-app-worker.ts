// ─── SafeBet Guardian — Mobile App observation SQS worker (ARCH-V4-C3) ────────
//
// Durable async path: SQS (guardian-app-observation) → this worker → DLQ. Synthetic
// processing only (normalise + deterministic signals + registry comparison via C1 +
// governed app→domain link). Persists idempotently into the `guardian` schema via a
// DEDICATED LEAST-PRIVILEGE role `guardian_app_worker` (grants only on mobile_app_* +
// audit_context + read-only domain_subject; no public/IQ). RLS enforced (jurisdiction
// GUC). NO real platform access, NO crawl, NO generic SQL. Bundled to CJS index.handler.

import { Client } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { GuardianAppWorker, AppPoisonMessageError, buildAppPersistencePlan, type AppPersistencePlan } from '../src/index.ts';

declare const __GUARDIAN_GIT_COMMIT__: string;
const GIT = (typeof __GUARDIAN_GIT_COMMIT__ !== 'undefined' ? __GUARDIAN_GIT_COMMIT__ : (process.env.GUARDIAN_GIT_COMMIT ?? 'unknown'));
const SECRET_ID = process.env.GUARDIAN_APP_DB_SECRET_ID ?? 'safebet-guardian/app-worker-db';
const REGION = process.env.AWS_REGION ?? 'eu-west-1';

const worker = new GuardianAppWorker();
let cachedConn: { host: string; port: number; user: string; password: string; database: string } | null = null;

async function loadConn() {
  if (cachedConn) return cachedConn;
  const sm = new SecretsManagerClient({ region: REGION });
  const res = await sm.send(new GetSecretValueCommand({ SecretId: SECRET_ID }));
  cachedConn = JSON.parse(res.SecretString ?? '{}');
  return cachedConn!;
}

const CONFLICT: Record<string, string> = {
  mobile_app_subject: 'canonical_app_identifier,jurisdiction', mobile_app_observation: 'observation_id',
  mobile_app_snapshot: 'snapshot_id', mobile_app_registry_comparison: 'comparison_id',
  mobile_app_change_history: 'history_id', mobile_app_technical_signal: 'signal_id',
  mobile_app_content_signal: 'signal_id', mobile_app_domain_link: 'link_id', mobile_app_review_item: 'review_id',
};

function insertSql(table: string, row: Record<string, unknown>, conflictCols: string) {
  const cols = Object.keys(row); const params = cols.map((_, i) => `$${i + 1}`);
  return { text: `insert into guardian.${table} (${cols.join(',')}) values (${params.join(',')}) on conflict (${conflictCols}) do nothing`, values: cols.map((c) => row[c]) };
}

async function persist(plan: AppPersistencePlan): Promise<{ persisted: number; alreadyPresent: boolean }> {
  const conn = await loadConn();
  const client = new Client({ host: conn.host, port: conn.port, user: conn.user, password: conn.password, database: conn.database, ssl: { rejectUnauthorized: false }, statement_timeout: 12000, connectionTimeoutMillis: 8000 });
  await client.connect();
  try {
    await client.query('begin');
    await client.query('select set_config($1,$2,true)', ['app.guardian.jurisdiction', plan.jurisdiction]);
    const existing = await client.query('select 1 from guardian.mobile_app_observation where observation_id=$1', [plan.observationId]);
    const alreadyPresent = (existing.rowCount ?? 0) > 0;
    let persisted = 0;
    const subjectRow = plan.rows.find((r) => r.table === 'mobile_app_subject');
    let actualId = plan.appSubjectId;
    if (subjectRow) {
      const q = insertSql('mobile_app_subject', subjectRow.row, CONFLICT.mobile_app_subject);
      persisted += (await client.query(q.text, q.values)).rowCount ?? 0;
      const got = await client.query('select app_subject_id from guardian.mobile_app_subject where canonical_app_identifier=$1 and jurisdiction=$2', [subjectRow.row.canonical_app_identifier, subjectRow.row.jurisdiction]);
      if (got.rowCount) actualId = String(got.rows[0].app_subject_id);
    }
    for (const r of plan.rows) {
      if (r.table === 'mobile_app_subject') continue;
      if ('app_subject_id' in r.row) r.row.app_subject_id = actualId;
      // Governed app→domain link: resolve the REAL C2 domain_id (or NULL) — never guess an FK.
      if (r.table === 'mobile_app_domain_link') {
        const dom = await client.query('select domain_id from guardian.domain_subject where canonical_hostname=$1 and jurisdiction=$2', [r.row.declared_domain, plan.jurisdiction]);
        r.row.matched_domain_id = dom.rowCount ? String(dom.rows[0].domain_id) : null;
      }
      const q = insertSql(r.table, r.row, CONFLICT[r.table]);
      persisted += (await client.query(q.text, q.values)).rowCount ?? 0;
    }
    for (const a of plan.auditRows) {
      const cols = Object.keys(a.row); const params = cols.map((_, i) => `$${i + 1}`);
      await client.query(`insert into guardian.audit_context (${cols.join(',')}) values (${params.join(',')})`, cols.map((c) => a.row[c]));
    }
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
      if (!out.result) throw new AppPoisonMessageError('no result produced');
      const plan = buildAppPersistencePlan({ jurisdiction: msg.jurisdiction, correlationId: msg.correlationId, idempotencyKey: msg.idempotencyKey, evidenceReference: `evref:${msg.idempotencyKey}`, contentHash: out.result.technicalSignals.find((s) => s.signalType === 'CONTENT_FINGERPRINT')?.value ?? '', metadataHash: out.result.technicalSignals.find((s) => s.signalType === 'METADATA_FINGERPRINT')?.value ?? '', version: out.result.technicalSignals.find((s) => s.signalType === 'VERSION')?.value ?? '', publisher: out.result.technicalSignals.find((s) => s.signalType === 'PUBLISHER')?.value ?? '', title: out.result.canonicalAppIdentifier, result: out.result });
      const { persisted, alreadyPresent } = await persist(plan);
      console.log(JSON.stringify({ product: 'GUARDIAN', sourceSha: GIT, event: 'APP_OBSERVATION_PROCESSED', jurisdiction: msg.jurisdiction, correlationId: msg.correlationId, observationId: plan.observationId, matchState: out.result.registryMatchState, reviewRequired: out.result.reviewRequired, reviewPriority: out.result.reviewPriority, rowsPersisted: persisted, duplicateSuppressed: alreadyPresent, isIllegalDetermination: false }));
    } catch (err) {
      const poison = err instanceof AppPoisonMessageError;
      console.error(JSON.stringify({ product: 'GUARDIAN', event: 'APP_PROCESSING_FAILED', messageId: rec.messageId, poison, error: (err as Error).message }));
      failures.push({ itemIdentifier: rec.messageId });
    }
  }
  return { batchItemFailures: failures };
};
