// ─── SafeBet Guardian — Geo observation SQS worker (ARCH-V4-C5) ───────────────
//
// Durable path: SQS (guardian-geo-observation) → this worker → DLQ. Synthetic
// processing only (normalise + deterministic region/reference signals + registry
// comparison via C1 + governed domain/app/payment reference contracts). Persists
// idempotently via the DEDICATED LEAST-PRIVILEGE role guardian_geo_worker (geo tables
// + audit_context + SELECT on the domain_reference/app_reference/payment_reference
// CONTRACT VIEWS only; no public/IQ, no C2/C3/C4 base tables).
//
// PRIVACY: GEO INTELLIGENCE != INDIVIDUAL SURVEILLANCE. No real user location, NO ISP
// subscriber lookup, NO bank geography, NO device tracking. A person-level payload is
// rejected (→ DLQ). NO enforcement, NO geo-block, NO provider referral.

import { Client } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { GuardianGeoWorker, GeoPoisonMessageError, buildGeoPersistencePlan, type GeoPersistencePlan } from '../src/index.ts';

declare const __GUARDIAN_GIT_COMMIT__: string;
const GIT = (typeof __GUARDIAN_GIT_COMMIT__ !== 'undefined' ? __GUARDIAN_GIT_COMMIT__ : (process.env.GUARDIAN_GIT_COMMIT ?? 'unknown'));
const SECRET_ID = process.env.GUARDIAN_GEO_DB_SECRET_ID ?? 'safebet-guardian/geo-worker-db';
const REGION = process.env.AWS_REGION ?? 'eu-west-1';

const worker = new GuardianGeoWorker();
let cachedConn: { host: string; port: number; user: string; password: string; database: string } | null = null;

async function loadConn() {
  if (cachedConn) return cachedConn;
  const sm = new SecretsManagerClient({ region: REGION });
  const res = await sm.send(new GetSecretValueCommand({ SecretId: SECRET_ID }));
  cachedConn = JSON.parse(res.SecretString ?? '{}');
  return cachedConn!;
}

const CONFLICT: Record<string, string> = {
  geo_subject: 'subject_reference,jurisdiction', geo_observation: 'observation_id',
  geo_service_availability: 'geo_subject_id,region_id', geo_registry_comparison: 'comparison_id',
  geo_entity_link: 'link_id', geo_review_item: 'review_id', geo_change_history: 'history_id',
};

function insertSql(table: string, row: Record<string, unknown>, conflictCols: string) {
  const cols = Object.keys(row); const params = cols.map((_, i) => `$${i + 1}`);
  return { text: `insert into guardian.${table} (${cols.join(',')}) values (${params.join(',')}) on conflict (${conflictCols}) do nothing`, values: cols.map((c) => row[c]) };
}

async function persist(plan: GeoPersistencePlan): Promise<{ persisted: number; alreadyPresent: boolean }> {
  const conn = await loadConn();
  const client = new Client({ host: conn.host, port: conn.port, user: conn.user, password: conn.password, database: conn.database, ssl: { rejectUnauthorized: false }, statement_timeout: 12000, connectionTimeoutMillis: 8000 });
  await client.connect();
  try {
    await client.query('begin');
    await client.query('select set_config($1,$2,true)', ['app.guardian.jurisdiction', plan.jurisdiction]);
    const existing = await client.query('select 1 from guardian.geo_observation where observation_id=$1', [plan.observationId]);
    const alreadyPresent = (existing.rowCount ?? 0) > 0;
    let persisted = 0;
    // createOrGetGeoSubject on the natural key, then resolve the real subject id.
    const subj = plan.rows.find((r) => r.table === 'geo_subject');
    let actualSubject = plan.geoSubjectId;
    if (subj) {
      const q = insertSql('geo_subject', subj.row, CONFLICT.geo_subject);
      persisted += (await client.query(q.text, q.values)).rowCount ?? 0;
      const got = await client.query('select geo_subject_id from guardian.geo_subject where subject_reference=$1 and jurisdiction=$2', [subj.row.subject_reference, subj.row.jurisdiction]);
      if (got.rowCount) actualSubject = String(got.rows[0].geo_subject_id);
    }
    for (const r of plan.rows) {
      if (r.table === 'geo_subject') continue;
      if ('geo_subject_id' in r.row) r.row.geo_subject_id = actualSubject;
      // Governed DOMAIN/APP/PAYMENT links: resolve the real reference id via the CONTRACT VIEWS (not base tables).
      if (r.table === 'geo_entity_link' && r.row.link_type === 'DOMAIN') {
        const d = await client.query('select domain_reference_id from guardian.domain_reference where canonical_hostname=$1', [r.row.target_reference]);
        r.row.target_reference = d.rowCount ? String(d.rows[0].domain_reference_id) : String(r.row.target_reference);
      }
      if (r.table === 'geo_entity_link' && r.row.link_type === 'APP') {
        const a = await client.query('select app_reference_id from guardian.app_reference where canonical_app_identifier=$1', [r.row.target_reference]);
        r.row.target_reference = a.rowCount ? String(a.rows[0].app_reference_id) : String(r.row.target_reference);
      }
      if (r.table === 'geo_entity_link' && r.row.link_type === 'PAYMENT') {
        const p = await client.query('select payment_reference_id from guardian.payment_reference where merchant_reference=$1', [r.row.target_reference]);
        r.row.target_reference = p.rowCount ? String(p.rows[0].payment_reference_id) : String(r.row.target_reference);
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
      if (!out.result) throw new GeoPoisonMessageError('no result produced');
      const plan = buildGeoPersistencePlan({ jurisdiction: msg.jurisdiction, correlationId: msg.correlationId, idempotencyKey: msg.idempotencyKey, evidenceReference: `evref:${msg.idempotencyKey}`, contentHash: out.result.provenance.evidenceReferences[0] ?? '', result: out.result });
      const { persisted, alreadyPresent } = await persist(plan);
      console.log(JSON.stringify({ product: 'GUARDIAN', sourceSha: GIT, event: 'GEO_OBSERVATION_PROCESSED', jurisdiction: msg.jurisdiction, correlationId: msg.correlationId, observationId: plan.observationId, availabilityState: out.result.observedAvailabilityState, matchState: out.result.registryMatchState, reviewRequired: out.result.reviewRequired, reviewPriority: out.result.reviewPriority, rowsPersisted: persisted, duplicateSuppressed: alreadyPresent, isIllegalDetermination: false, isEnforcementAuthorised: false }));
    } catch (err) {
      const poison = err instanceof GeoPoisonMessageError;
      console.error(JSON.stringify({ product: 'GUARDIAN', event: 'GEO_PROCESSING_FAILED', messageId: rec.messageId, poison, personDataRejected: (err as Error).name === 'GeoPersonDataRejectedError', error: (err as Error).message }));
      failures.push({ itemIdentifier: rec.messageId });
    }
  }
  return { batchItemFailures: failures };
};
