// ─── SafeBet Guardian — Payment observation SQS worker (ARCH-V4-C4) ───────────
//
// Durable path: SQS (guardian-payment-observation) → this worker → DLQ. Synthetic
// processing only (normalise + deterministic signals + registry comparison via C1 +
// governed domain/app reference contracts). Persists idempotently via the DEDICATED
// LEAST-PRIVILEGE role guardian_payment_worker (payment tables + audit_context +
// SELECT on the domain_reference/app_reference CONTRACT VIEWS only; no public/IQ, no
// C2/C3 base tables). NO bank/PSP connection, NO payment instruction, NO enforcement.
// PRIVACY: no PAN/CVV/raw bank/card data.

import { Client } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { GuardianPaymentWorker, PaymentPoisonMessageError, buildPaymentPersistencePlan, type PaymentPersistencePlan } from '../src/index.ts';

declare const __GUARDIAN_GIT_COMMIT__: string;
const GIT = (typeof __GUARDIAN_GIT_COMMIT__ !== 'undefined' ? __GUARDIAN_GIT_COMMIT__ : (process.env.GUARDIAN_GIT_COMMIT ?? 'unknown'));
const SECRET_ID = process.env.GUARDIAN_PAYMENT_DB_SECRET_ID ?? 'safebet-guardian/payment-worker-db';
const REGION = process.env.AWS_REGION ?? 'eu-west-1';

const worker = new GuardianPaymentWorker();
let cachedConn: { host: string; port: number; user: string; password: string; database: string } | null = null;

async function loadConn() {
  if (cachedConn) return cachedConn;
  const sm = new SecretsManagerClient({ region: REGION });
  const res = await sm.send(new GetSecretValueCommand({ SecretId: SECRET_ID }));
  cachedConn = JSON.parse(res.SecretString ?? '{}');
  return cachedConn!;
}

const CONFLICT: Record<string, string> = {
  merchant_subject: 'merchant_reference,jurisdiction', payment_subject: 'payment_subject_id',
  payment_observation: 'observation_id', payment_registry_comparison: 'comparison_id',
  payment_change_history: 'history_id', payment_entity_link: 'link_id', payment_review_item: 'review_id',
};

function insertSql(table: string, row: Record<string, unknown>, conflictCols: string) {
  const cols = Object.keys(row); const params = cols.map((_, i) => `$${i + 1}`);
  return { text: `insert into guardian.${table} (${cols.join(',')}) values (${params.join(',')}) on conflict (${conflictCols}) do nothing`, values: cols.map((c) => row[c]) };
}

async function persist(plan: PaymentPersistencePlan): Promise<{ persisted: number; alreadyPresent: boolean }> {
  const conn = await loadConn();
  const client = new Client({ host: conn.host, port: conn.port, user: conn.user, password: conn.password, database: conn.database, ssl: { rejectUnauthorized: false }, statement_timeout: 12000, connectionTimeoutMillis: 8000 });
  await client.connect();
  try {
    await client.query('begin');
    await client.query('select set_config($1,$2,true)', ['app.guardian.jurisdiction', plan.jurisdiction]);
    const existing = await client.query('select 1 from guardian.payment_observation where observation_id=$1', [plan.observationId]);
    const alreadyPresent = (existing.rowCount ?? 0) > 0;
    let persisted = 0;
    // createOrGetMerchant on the natural key, then resolve the real merchant id.
    const merch = plan.rows.find((r) => r.table === 'merchant_subject');
    let actualMerchant = plan.merchantSubjectId;
    if (merch) {
      const q = insertSql('merchant_subject', merch.row, CONFLICT.merchant_subject);
      persisted += (await client.query(q.text, q.values)).rowCount ?? 0;
      const got = await client.query('select merchant_subject_id from guardian.merchant_subject where merchant_reference=$1 and jurisdiction=$2', [merch.row.merchant_reference, merch.row.jurisdiction]);
      if (got.rowCount) actualMerchant = String(got.rows[0].merchant_subject_id);
    }
    for (const r of plan.rows) {
      if (r.table === 'merchant_subject') continue;
      if ('merchant_subject_id' in r.row) r.row.merchant_subject_id = actualMerchant;
      // Governed DOMAIN/APP links: resolve the real reference id via the CONTRACT VIEWS (not base tables).
      if (r.table === 'payment_entity_link' && (r.row.link_type === 'DOMAIN')) {
        const d = await client.query('select domain_reference_id from guardian.domain_reference where canonical_hostname=$1', [r.row.target_reference]);
        r.row.target_reference = d.rowCount ? String(d.rows[0].domain_reference_id) : String(r.row.target_reference);
      }
      if (r.table === 'payment_entity_link' && (r.row.link_type === 'APP')) {
        const a = await client.query('select app_reference_id from guardian.app_reference where canonical_app_identifier=$1', [r.row.target_reference]);
        r.row.target_reference = a.rowCount ? String(a.rows[0].app_reference_id) : String(r.row.target_reference);
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
      if (!out.result) throw new PaymentPoisonMessageError('no result produced');
      const plan = buildPaymentPersistencePlan({ jurisdiction: msg.jurisdiction, correlationId: msg.correlationId, idempotencyKey: msg.idempotencyKey, evidenceReference: `evref:${msg.idempotencyKey}`, contentHash: out.result.provenance.evidenceReferences[0] ?? '', descriptor: out.result.merchantSubjectId, providerReference: out.result.providerReferenceCategory === 'DECLARED' ? 'PSP-SYNTH-001' : '', amountAggregate: null, currency: 'ZAR', result: out.result });
      const { persisted, alreadyPresent } = await persist(plan);
      console.log(JSON.stringify({ product: 'GUARDIAN', sourceSha: GIT, event: 'PAYMENT_OBSERVATION_PROCESSED', jurisdiction: msg.jurisdiction, correlationId: msg.correlationId, observationId: plan.observationId, matchState: out.result.registryMatchState, reviewRequired: out.result.reviewRequired, reviewPriority: out.result.reviewPriority, rowsPersisted: persisted, duplicateSuppressed: alreadyPresent, isIllegalDetermination: false, isEnforcementAuthorised: false }));
    } catch (err) {
      const poison = err instanceof PaymentPoisonMessageError;
      console.error(JSON.stringify({ product: 'GUARDIAN', event: 'PAYMENT_PROCESSING_FAILED', messageId: rec.messageId, poison, error: (err as Error).message }));
      failures.push({ itemIdentifier: rec.messageId });
    }
  }
  return { batchItemFailures: failures };
};
