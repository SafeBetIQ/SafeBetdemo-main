// ─── SafeBet Guardian — Case intake SQS worker (ARCH-V4-C6) ───────────────────
//
// Durable path: SQS (guardian-case-intake) → this worker → DLQ. Synthetic processing
// only (deterministic multi-signal correlation over governed C1–C5 references). Persists
// idempotently via the DEDICATED LEAST-PRIVILEGE role guardian_case_worker (case tables +
// audit_context + SELECT on the domain/app/payment/geo reference CONTRACT VIEWS only; no
// public/IQ, no C2–C5 base tables). A system-recommended intake creates a DRAFT case.
//
// NO enforcement, NO provider action, NO legal determination. Case opened != illegal.

import { Client } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { GuardianCaseWorker, CasePoisonMessageError, buildCasePersistencePlan, verifyEvidenceIntegrity, type CasePersistencePlan } from '../src/index.ts';

declare const __GUARDIAN_GIT_COMMIT__: string;
const GIT = (typeof __GUARDIAN_GIT_COMMIT__ !== 'undefined' ? __GUARDIAN_GIT_COMMIT__ : (process.env.GUARDIAN_GIT_COMMIT ?? 'unknown'));
const SECRET_ID = process.env.GUARDIAN_CASE_DB_SECRET_ID ?? 'safebet-guardian/case-worker-db';
const REGION = process.env.AWS_REGION ?? 'eu-west-1';

const worker = new GuardianCaseWorker();
let cachedConn: { host: string; port: number; user: string; password: string; database: string } | null = null;

async function loadConn() {
  if (cachedConn) return cachedConn;
  const sm = new SecretsManagerClient({ region: REGION });
  const res = await sm.send(new GetSecretValueCommand({ SecretId: SECRET_ID }));
  cachedConn = JSON.parse(res.SecretString ?? '{}');
  return cachedConn!;
}

const CONFLICT: Record<string, string> = {
  investigation_case: 'case_reference,jurisdiction', case_subject: 'case_subject_id',
  case_intelligence_link: 'link_id', case_evidence_link: 'evidence_link_id', case_finding: 'finding_id',
  case_chronology: 'chronology_id', case_status_history: 'status_history_id', case_priority_history: 'priority_history_id',
};

function insertSql(table: string, row: Record<string, unknown>, conflictCols: string) {
  const cols = Object.keys(row); const params = cols.map((_, i) => `$${i + 1}`);
  return { text: `insert into guardian.${table} (${cols.join(',')}) values (${params.join(',')}) on conflict (${conflictCols}) do nothing`, values: cols.map((c) => row[c]) };
}

// Resolve a case_subject reference to the real reference id via the governed CONTRACT VIEW.
async function resolveSubject(client: Client, subjectType: string, ref: string): Promise<string> {
  try {
    if (subjectType === 'DOMAIN') { const d = await client.query('select domain_reference_id from guardian.domain_reference where canonical_hostname=$1', [ref]); if (d.rowCount) return String(d.rows[0].domain_reference_id); }
    if (subjectType === 'MOBILE_APP') { const a = await client.query('select app_reference_id from guardian.app_reference where canonical_app_identifier=$1', [ref]); if (a.rowCount) return String(a.rows[0].app_reference_id); }
    if (subjectType === 'MERCHANT') { const p = await client.query('select payment_reference_id from guardian.payment_reference where merchant_reference=$1', [ref]); if (p.rowCount) return String(p.rows[0].payment_reference_id); }
    if (subjectType === 'GEO_SERVICE_REFERENCE') { const g = await client.query('select geo_reference_id from guardian.geo_reference where geo_reference=$1', [ref]); if (g.rowCount) return String(g.rows[0].geo_reference_id); }
  } catch { /* view resolution best-effort; fall through to raw reference */ }
  return ref;
}

async function persist(plan: CasePersistencePlan): Promise<{ persisted: number; alreadyPresent: boolean }> {
  const conn = await loadConn();
  const client = new Client({ host: conn.host, port: conn.port, user: conn.user, password: conn.password, database: conn.database, ssl: { rejectUnauthorized: false }, statement_timeout: 12000, connectionTimeoutMillis: 8000 });
  await client.connect();
  try {
    await client.query('begin');
    await client.query('select set_config($1,$2,true)', ['app.guardian.jurisdiction', plan.jurisdiction]);
    const existing = await client.query('select 1 from guardian.investigation_case where case_id=$1', [plan.caseId]);
    const alreadyPresent = (existing.rowCount ?? 0) > 0;
    let persisted = 0;
    // createOrGetCase on the natural key, then resolve the real case id.
    const c = plan.rows.find((r) => r.table === 'investigation_case');
    let actualCase = plan.caseId;
    if (c) {
      const q = insertSql('investigation_case', c.row, CONFLICT.investigation_case);
      persisted += (await client.query(q.text, q.values)).rowCount ?? 0;
      const got = await client.query('select case_id from guardian.investigation_case where case_reference=$1 and jurisdiction=$2', [c.row.case_reference, c.row.jurisdiction]);
      if (got.rowCount) actualCase = String(got.rows[0].case_id);
    }
    for (const r of plan.rows) {
      if (r.table === 'investigation_case') continue;
      if ('case_id' in r.row) r.row.case_id = actualCase;
      // Governed subject links: resolve the real reference id via the CONTRACT VIEWS (not base tables).
      if (r.table === 'case_subject') r.row.subject_reference = await resolveSubject(client, String(r.row.subject_type), String(r.row.subject_reference));
      const q = insertSql(r.table, r.row, CONFLICT[r.table]);
      persisted += (await client.query(q.text, q.values)).rowCount ?? 0;
    }
    for (const a of plan.auditRows) {
      const cols = Object.keys(a.row); const params = cols.map((_, i) => `$${i + 1}`);
      await client.query(`insert into guardian.audit_context (${cols.join(',')}) values (${params.join(',')})`, cols.map((col) => a.row[col]));
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
      if (!out.result) throw new CasePoisonMessageError('no result produced');
      // Evidence integrity: an optional synthetic body/hash pair. Tamper → INTEGRITY_FAILED (never silently accepted).
      const integrity = verifyEvidenceIntegrity(msg.evidenceIntegrityHash ?? null, msg.evidenceSyntheticBody ?? null);
      const plan = buildCasePersistencePlan({ jurisdiction: msg.jurisdiction, correlationId: msg.correlationId, idempotencyKey: msg.idempotencyKey, evidenceReference: out.result.provenance.evidenceReferences[0] ?? null, evidenceIntegrityStatus: integrity, createdBy: 'guardian-case-worker', result: out.result });
      const { persisted, alreadyPresent } = await persist(plan);
      console.log(JSON.stringify({ product: 'GUARDIAN', sourceSha: GIT, event: 'CASE_CREATED', jurisdiction: msg.jurisdiction, correlationId: msg.correlationId, caseReference: plan.caseReference, caseType: out.result.caseType, priority: out.result.priority, recommendation: out.result.recommendation, reviewRequired: out.result.reviewRequired, evidenceIntegrity: integrity, rowsPersisted: persisted, duplicateSuppressed: alreadyPresent, isLegalDetermination: false, isEnforcementAuthorised: false }));
    } catch (err) {
      const poison = err instanceof CasePoisonMessageError;
      console.error(JSON.stringify({ product: 'GUARDIAN', event: 'CASE_INTAKE_FAILED', messageId: rec.messageId, poison, error: (err as Error).message }));
      failures.push({ itemIdentifier: rec.messageId });
    }
  }
  return { batchItemFailures: failures };
};
