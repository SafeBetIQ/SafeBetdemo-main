// ─── SafeBet Guardian — Evidence registration SQS worker (ARCH-V4-C7) ─────────
//
// Durable path: SQS (guardian-evidence-processing) → this worker → DLQ. Synthetic
// processing only (hash + custody chain over synthetic fixtures). Two-phase durability:
// (1) STORE the synthetic body to the PRIVATE Guardian evidence S3 vault (deterministic
// key → retry-safe/idempotent), then (2) persist metadata + append-only custody chain via
// the DEDICATED LEAST-PRIVILEGE role guardian_evidence_worker (evidence tables + audit +
// SELECT on the case_reference CONTRACT VIEW only; no public/IQ, no C1–C6 base tables).
// A DB failure AFTER store leaves a reconcilable orphan (deterministic key); redelivery is
// idempotent. NO enforcement, NO provider action, NO legal determination.

import { Client } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { GuardianEvidenceWorker, EvidencePoisonMessageError, buildEvidencePersistencePlan, SYNTHETIC_EVIDENCE_FIXTURES, type EvidencePersistencePlan } from '../src/index.ts';

declare const __GUARDIAN_GIT_COMMIT__: string;
const GIT = (typeof __GUARDIAN_GIT_COMMIT__ !== 'undefined' ? __GUARDIAN_GIT_COMMIT__ : (process.env.GUARDIAN_GIT_COMMIT ?? 'unknown'));
const SECRET_ID = process.env.GUARDIAN_EVIDENCE_DB_SECRET_ID ?? 'safebet-guardian/evidence-worker-db';
const BUCKET = process.env.GUARDIAN_EVIDENCE_BUCKET ?? 'safebet-guardian-evidence-demo';
const REGION = process.env.AWS_REGION ?? 'eu-west-1';

const worker = new GuardianEvidenceWorker();
const s3 = new S3Client({ region: REGION });
let cachedConn: { host: string; port: number; user: string; password: string; database: string } | null = null;

async function loadConn() {
  if (cachedConn) return cachedConn;
  const sm = new SecretsManagerClient({ region: REGION });
  const res = await sm.send(new GetSecretValueCommand({ SecretId: SECRET_ID }));
  cachedConn = JSON.parse(res.SecretString ?? '{}');
  return cachedConn!;
}

const CONFLICT: Record<string, string> = {
  guardian_evidence: 'evidence_reference,jurisdiction', guardian_evidence_version: 'evidence_id,version_no',
  guardian_evidence_integrity_check: 'check_id', guardian_evidence_custody_event: 'evidence_id,sequence_number',
};

function insertSql(table: string, row: Record<string, unknown>, conflictCols: string) {
  const cols = Object.keys(row); const params = cols.map((_, i) => `$${i + 1}`);
  return { text: `insert into guardian.${table} (${cols.join(',')}) values (${params.join(',')}) on conflict (${conflictCols}) do nothing`, values: cols.map((c) => row[c]) };
}

// Phase 1: store synthetic body to the PRIVATE vault (deterministic key → idempotent/retry-safe).
async function storeSynthetic(plan: EvidencePersistencePlan, syntheticBody: string): Promise<string> {
  const key = `evidence/${plan.jurisdiction}/${plan.evidenceId}`;
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: syntheticBody, ContentType: 'application/octet-stream', ServerSideEncryption: 'AES256' }));
  return `s3://${BUCKET}/${key}`;
}

async function persist(plan: EvidencePersistencePlan, storageRef: string): Promise<{ persisted: number; alreadyPresent: boolean }> {
  const conn = await loadConn();
  const client = new Client({ host: conn.host, port: conn.port, user: conn.user, password: conn.password, database: conn.database, ssl: { rejectUnauthorized: false }, statement_timeout: 12000, connectionTimeoutMillis: 8000 });
  await client.connect();
  try {
    await client.query('begin');
    await client.query('select set_config($1,$2,true)', ['app.guardian.jurisdiction', plan.jurisdiction]);
    const existing = await client.query('select 1 from guardian.guardian_evidence where evidence_id=$1', [plan.evidenceId]);
    const alreadyPresent = (existing.rowCount ?? 0) > 0;
    let persisted = 0;
    for (const r of plan.rows) {
      if (r.table === 'guardian_evidence') r.row.storage_reference = storageRef;               // durable object reference
      if (r.table === 'guardian_evidence_version') r.row.storage_reference = storageRef;
      if ('registered_at' in r.row && r.row.registered_at === 'now()') delete r.row.registered_at; // use column default
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
      if (!out.result) throw new EvidencePoisonMessageError('no result produced');
      const fx = SYNTHETIC_EVIDENCE_FIXTURES[msg.fixtureEvidenceReference];
      const plan = buildEvidencePersistencePlan({ jurisdiction: msg.jurisdiction, correlationId: msg.correlationId, idempotencyKey: msg.idempotencyKey, createdBy: 'guardian-evidence-worker', result: out.result });
      const storageRef = await storeSynthetic(plan, fx?.syntheticBody ?? out.result.contentHash);   // phase 1: store
      const { persisted, alreadyPresent } = await persist(plan, storageRef);                          // phase 2: metadata + custody
      console.log(JSON.stringify({ product: 'GUARDIAN', sourceSha: GIT, event: 'EVIDENCE_REGISTERED', jurisdiction: msg.jurisdiction, correlationId: msg.correlationId, evidenceId: plan.evidenceId, evidenceReference: plan.evidenceReference, evidenceType: out.result.evidenceType, classification: out.result.classification, contentHash: out.result.contentHash, integrityStatus: out.result.integrityStatus, storageReference: storageRef, custodyEvents: out.result.custodyChain.length, rowsPersisted: persisted, duplicateSuppressed: alreadyPresent, isLegalDetermination: false, isEnforcementAuthorised: false }));
    } catch (err) {
      const poison = err instanceof EvidencePoisonMessageError;
      console.error(JSON.stringify({ product: 'GUARDIAN', event: 'EVIDENCE_PROCESSING_FAILED', messageId: rec.messageId, poison, error: (err as Error).message }));
      failures.push({ itemIdentifier: rec.messageId });
    }
  }
  return { batchItemFailures: failures };
};
