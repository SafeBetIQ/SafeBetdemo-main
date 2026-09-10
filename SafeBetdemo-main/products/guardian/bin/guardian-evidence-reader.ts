// ─── SafeBet Guardian — controlled evidence RETRIEVAL Lambda (ARCH-V4-C7.2) ───
//
// Dedicated least-privilege retrieval identity (NOT the writer). Flow per request:
//   set jurisdiction GUC -> read evidence metadata (canonical hash + storage ref +
//   classification) -> evaluate access policy (jurisdiction x classification x purpose)
//   BEFORE any GetObject -> on DENY record an audited DENY access event, no GetObject ->
//   on ALLOW GetObject the ACTUAL stored bytes -> SHA-256 over the retrieved bytes vs the
//   canonical hash -> append audited ACCESS event + ACCESSED custody event (hash chain).
// IAM: s3:GetObject on evidence/* only (no List/Delete/Put). No public URL. No enforcement.

import { Client } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { authoriseRetrieval, verifyRetrievedBytes, computeCustodyEventHash, CUSTODY_GENESIS } from '../src/index.ts';

declare const __GUARDIAN_GIT_COMMIT__: string;
const GIT = (typeof __GUARDIAN_GIT_COMMIT__ !== 'undefined' ? __GUARDIAN_GIT_COMMIT__ : (process.env.GUARDIAN_GIT_COMMIT ?? 'unknown'));
const SECRET_ID = process.env.GUARDIAN_EVIDENCE_READER_SECRET_ID ?? 'safebet-guardian/evidence-reader-db';
const REGION = process.env.AWS_REGION ?? 'eu-west-1';
const s3 = new S3Client({ region: REGION });
let cachedConn: { host: string; port: number; user: string; password: string; database: string } | null = null;

async function loadConn() {
  if (cachedConn) return cachedConn;
  const sm = new SecretsManagerClient({ region: REGION });
  const res = await sm.send(new GetSecretValueCommand({ SecretId: SECRET_ID }));
  cachedConn = JSON.parse(res.SecretString ?? '{}');
  return cachedConn!;
}
async function streamToBuffer(body: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of body) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks);
}

type Req = { evidenceReference?: string; evidenceId?: string; jurisdiction: string; role: string; purpose: string | null; actor?: string; correlationId?: string };

export const handler = async (event: Req) => {
  const conn = await loadConn();
  const client = new Client({ host: conn.host, port: conn.port, user: conn.user, password: conn.password, database: conn.database, ssl: { rejectUnauthorized: false }, statement_timeout: 12000, connectionTimeoutMillis: 8000 });
  await client.connect();
  const actor = event.actor ?? 'guardian-evidence-reader'; const corr = event.correlationId ?? `ret-${Date.now()}`;
  try {
    await client.query('begin');
    await client.query('select set_config($1,$2,true)', ['app.guardian.jurisdiction', event.jurisdiction]);
    const where = event.evidenceId ? ['evidence_id', event.evidenceId] : ['evidence_reference', event.evidenceReference];
    const meta = await client.query(`select evidence_id, jurisdiction, classification, content_hash, storage_reference from guardian.guardian_evidence where ${where[0]}=$1`, [where[1]]);
    if (!meta.rowCount) { await client.query('rollback'); return resp(404, { error: 'evidence not found' }); }
    const m = meta.rows[0];
    const req = { evidenceId: m.evidence_id, evidenceReference: String(event.evidenceReference ?? m.evidence_id), role: event.role as any, principalJurisdiction: event.jurisdiction, evidenceJurisdiction: m.jurisdiction, classification: m.classification as any, purpose: (event.purpose as any) ?? null, recordedContentHash: m.content_hash };
    const gate = authoriseRetrieval(req);

    // Record the access decision (audited) BEFORE any GetObject.
    await client.query('insert into guardian.guardian_evidence_access_event (access_id, evidence_id, actor, actor_role, purpose, classification_at_access, decision, deny_reason, jurisdiction, correlation_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [`GEAE-${corr}`, m.evidence_id, actor, event.role, event.purpose, m.classification, gate.decision, gate.decision === 'DENY' ? gate.reason : null, m.jurisdiction, corr]);
    await client.query('insert into guardian.audit_context (product, jurisdiction, chain_scope, event_type, actor_principal_id, correlation_id, case_reference) values ($1,$2,$3,$4,$5,$6,$7)',
      ['GUARDIAN', m.jurisdiction, `guardian:${m.jurisdiction}`, gate.decision === 'ALLOW' ? 'EVIDENCE_ACCESS_ALLOWED' : 'EVIDENCE_ACCESS_DENIED', actor, corr, m.evidence_id]);

    if (gate.decision === 'DENY') {
      await client.query('commit');
      return resp(403, { product: 'GUARDIAN', sourceSha: GIT, evidenceId: m.evidence_id, decision: 'DENY', reason: gate.reason, integrityStatus: 'NOT_RETRIEVED', isLegalDetermination: false, isEnforcementAuthorised: false });
    }

    // ALLOW: retrieve the ACTUAL stored bytes and verify over them.
    const ref = String(m.storage_reference); const mm = ref.match(/^s3:\/\/([^/]+)\/(.+)$/);
    if (!mm) { await client.query('rollback'); return resp(500, { error: 'unsupported storage reference' }); }
    const obj = await s3.send(new GetObjectCommand({ Bucket: mm[1], Key: mm[2] }));
    const bytes = await streamToBuffer(obj.Body as any);
    const integrityStatus = verifyRetrievedBytes(m.content_hash, bytes);

    // Append an ACCESSED custody event (extend the hash chain).
    const last = await client.query('select sequence_number, event_hash from guardian.guardian_evidence_custody_event where evidence_id=$1 order by sequence_number desc limit 1', [m.evidence_id]);
    const seq = (last.rowCount ? Number(last.rows[0].sequence_number) : 0) + 1;
    const prev = last.rowCount ? String(last.rows[0].event_hash) : CUSTODY_GENESIS;
    const occurredAt = new Date().toISOString();
    const eventHash = computeCustodyEventHash({ evidenceId: m.evidence_id, sequenceNumber: seq, eventType: 'ACCESSED', actor, actorRole: event.role as any, jurisdiction: m.jurisdiction, occurredAt, previousEventHash: prev });
    await client.query('insert into guardian.guardian_evidence_custody_event (custody_event_id, evidence_id, sequence_number, event_type, actor, actor_role, jurisdiction, occurred_at, reason, previous_event_hash, event_hash, correlation_id, audit_reference) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
      [`GECE-${m.evidence_id}-${seq}`, m.evidence_id, seq, 'ACCESSED', actor, event.role, m.jurisdiction, occurredAt, `controlled retrieval; integrity ${integrityStatus}`, prev, eventHash, corr, event.evidenceReference ?? m.evidence_id]);
    await client.query('commit');

    // Content bytes are NEVER logged; return a controlled result only.
    console.log(JSON.stringify({ product: 'GUARDIAN', sourceSha: GIT, event: 'EVIDENCE_RETRIEVED', evidenceId: m.evidence_id, jurisdiction: m.jurisdiction, classification: m.classification, decision: 'ALLOW', integrityStatus, bytesRead: bytes.length, custodySeq: seq, isLegalDetermination: false, isEnforcementAuthorised: false }));
    return resp(200, { product: 'GUARDIAN', sourceSha: GIT, evidenceId: m.evidence_id, classification: m.classification, decision: 'ALLOW', integrityStatus, bytesRead: bytes.length, custodySequence: seq, isLegalDetermination: false, isEnforcementAuthorised: false });
  } catch (e) { await client.query('rollback').catch(() => {}); return resp(500, { error: (e as Error).message }); }
  finally { await client.end().catch(() => {}); }
};

function resp(statusCode: number, body: unknown) { return { statusCode, body }; }
