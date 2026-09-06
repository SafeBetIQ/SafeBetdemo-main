// ─── SafeBet Guardian — Domain observation SQS worker (ARCH-V4-C2 / C2.1) ─────
//
// Durable async path: SQS (guardian-domain-observation) → this worker → DLQ. It
// performs ONLY synthetic C2 processing (normalise + deterministic signals + registry
// comparison via the C1 contract) and PERSISTS the result idempotently into the
// Guardian-owned `guardian` schema through a DEDICATED LEAST-PRIVILEGE database role
// (`guardian_domain_worker`) whose connection secret lives in AWS Secrets Manager.
// That role has grants ONLY on the guardian domain tables (+ audit_context) — it
// cannot reach SafeBet IQ business data — and RLS is enforced (no BYPASSRLS), scoped
// by a per-message jurisdiction GUC. NO web crawl, NO DNS, NO generic SQL.
//
// Idempotency: deterministic ids + `on conflict do nothing` → duplicate delivery
// cannot duplicate authoritative state. A message is ACKed only after durable commit;
// any failure reports a batch-item failure so SQS retries and, past maxReceiveCount,
// routes to the DLQ. Bundled to CJS index.handler.

import { Client } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { GuardianDomainWorker, PoisonMessageError, buildPersistencePlan, type DomainPersistencePlan } from '../src/index.ts';

declare const __GUARDIAN_GIT_COMMIT__: string;
const GIT = (typeof __GUARDIAN_GIT_COMMIT__ !== 'undefined' ? __GUARDIAN_GIT_COMMIT__ : (process.env.GUARDIAN_GIT_COMMIT ?? 'unknown'));
const SECRET_ID = process.env.GUARDIAN_DB_SECRET_ID ?? 'safebet-guardian/domain-worker-db';
const REGION = process.env.AWS_REGION ?? 'eu-west-1';

const worker = new GuardianDomainWorker();
let cachedConn: { host: string; port: number; user: string; password: string; database: string } | null = null;

async function loadConn() {
  if (cachedConn) return cachedConn;
  const sm = new SecretsManagerClient({ region: REGION });
  const res = await sm.send(new GetSecretValueCommand({ SecretId: SECRET_ID }));
  cachedConn = JSON.parse(res.SecretString ?? '{}');
  return cachedConn!;
}

function insertSql(table: string, row: Record<string, unknown>, conflictCols: string): { text: string; values: unknown[] } {
  const cols = Object.keys(row);
  const params = cols.map((_, i) => `$${i + 1}`);
  const text = `insert into guardian.${table} (${cols.join(',')}) values (${params.join(',')}) on conflict (${conflictCols}) do nothing`;
  return { text, values: cols.map((c) => row[c]) };
}

const CONFLICT: Record<string, string> = {
  domain_subject: 'canonical_hostname,jurisdiction', domain_observation: 'observation_id', website_snapshot: 'snapshot_id',
  domain_registry_comparison: 'comparison_id', domain_change_history: 'history_id',
  domain_technical_signal: 'signal_id', domain_content_signal: 'signal_id', domain_review_item: 'review_id',
  audit_context: 'id',
};

/** Persist the plan in ONE transaction (all-or-nothing → no partial corrupt state). */
async function persist(plan: DomainPersistencePlan): Promise<{ persisted: number; alreadyPresent: boolean }> {
  const conn = await loadConn();
  const client = new Client({ host: conn.host, port: conn.port, user: conn.user, password: conn.password, database: conn.database, ssl: { rejectUnauthorized: false }, statement_timeout: 12000, connectionTimeoutMillis: 8000 });
  await client.connect();
  try {
    await client.query('begin');
    // Jurisdiction GUC → RLS enforces every write is in-jurisdiction (wrong-jur = blocked).
    await client.query('select set_config($1,$2,true)', ['app.guardian.jurisdiction', plan.jurisdiction]);
    // Idempotency check: is this observation already durably present?
    const existing = await client.query('select 1 from guardian.domain_observation where observation_id=$1', [plan.observationId]);
    const alreadyPresent = (existing.rowCount ?? 0) > 0;
    let persisted = 0;
    // createOrGetDomain: upsert on the natural key, then resolve the ACTUAL domain_id
    // (a subject with this hostname may already exist under a different id — e.g. seed).
    const subjectRow = plan.rows.find((r) => r.table === 'domain_subject');
    let actualDomainId = plan.domainId;
    if (subjectRow) {
      const q = insertSql('domain_subject', subjectRow.row, CONFLICT.domain_subject);
      persisted += (await client.query(q.text, q.values)).rowCount ?? 0;
      const got = await client.query('select domain_id from guardian.domain_subject where canonical_hostname=$1 and jurisdiction=$2', [subjectRow.row.canonical_hostname, subjectRow.row.jurisdiction]);
      if (got.rowCount) actualDomainId = String(got.rows[0].domain_id);
    }
    for (const r of plan.rows) {
      if (r.table === 'domain_subject') continue;                 // already handled
      if ('domain_id' in r.row) r.row.domain_id = actualDomainId;  // point children at the resolved id
      const q = insertSql(r.table, r.row, CONFLICT[r.table]);
      const res = await client.query(q.text, q.values);
      persisted += res.rowCount ?? 0;
    }
    // Audit rows (audit_context has an identity PK; append one processed event; suppression noted).
    for (const a of plan.auditRows) {
      const cols = Object.keys(a.row); const params = cols.map((_, i) => `$${i + 1}`);
      await client.query(`insert into guardian.audit_context (${cols.join(',')}) values (${params.join(',')})`, cols.map((c) => a.row[c]));
    }
    await client.query('commit');
    return { persisted, alreadyPresent };
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    await client.end().catch(() => {});
  }
}

type SqsRecord = { messageId: string; body: string };
type SqsEvent = { Records?: SqsRecord[] };

export const handler = async (event: SqsEvent) => {
  const failures: { itemIdentifier: string }[] = [];
  for (const rec of event?.Records ?? []) {
    let out;
    try {
      const msg = JSON.parse(rec.body);
      out = worker.process(msg);                    // synthetic processing (throws PoisonMessageError on bad input)
      if (!out.result) throw new PoisonMessageError('no result produced');
      const plan = buildPersistencePlan({
        jurisdiction: msg.jurisdiction, correlationId: msg.correlationId, idempotencyKey: msg.idempotencyKey,
        evidenceReference: `evref:${msg.idempotencyKey}`, contentHash: out.result.technicalSignals.find((s) => s.signalType === 'CONTENT_FINGERPRINT')?.value ?? '', pageTitle: out.result.canonicalHostname, result: out.result,
      });
      const { persisted, alreadyPresent } = await persist(plan);   // durable commit BEFORE ack
      console.log(JSON.stringify({ product: 'GUARDIAN', sourceSha: GIT, event: 'DOMAIN_OBSERVATION_PROCESSED', jurisdiction: msg.jurisdiction, correlationId: msg.correlationId, observationId: plan.observationId, matchState: out.result.registryMatchState, reviewRequired: out.result.reviewRequired, reviewPriority: out.result.reviewPriority, rowsPersisted: persisted, duplicateSuppressed: alreadyPresent, isIllegalDetermination: false }));
    } catch (err) {
      const poison = err instanceof PoisonMessageError;
      console.error(JSON.stringify({ product: 'GUARDIAN', event: 'PROCESSING_FAILED', messageId: rec.messageId, poison, error: (err as Error).message }));
      failures.push({ itemIdentifier: rec.messageId });   // NOT acked → retry → DLQ
    }
  }
  return { batchItemFailures: failures };
};
